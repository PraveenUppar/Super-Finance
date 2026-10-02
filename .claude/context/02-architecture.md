# Architecture

```
Intake (wizard + uploads)
        ↓
   Issuer Fact Base          ← single canonical JSON, versioned,
   (Zod-typed, provenance)     provenance on every field
        ↓
   ┌────┴────┬──────────────┬─────────────┐
   ↓         ↓              ↓             ↓
Rule      Template      Computed       LLM drafting
engine    engine        sections       harness
   ↓         └──────┬───────┴─────────────┘
Gap                 ↓
dashboard    DocumentNode AST
                    ↓
            ┌───────┴───────┐
       HTML preview     DOCX export
                        (watermarked until sign-off)
```

---

## Fact base

```ts
type Fact<T> = {
  value: T | null
  source: 'user' | 'extracted' | 'computed'
  ref?: { docId: string; page: number }    // extracted
  derivedFrom?: FactPath[]                 // computed
  confidence?: number
  updatedAt: string
  updatedBy: string
}
```

One canonical object per issuer. Zod schemas per domain: `company`, `capital`, `promoters`, `management`, `business`, `financials`, `legal`, `approvals`, `offer`, `groupCos`.

Addressed by `FactPath` — `capital.allotmentHistory[2].issuePrice`.

**Storage is hybrid, deliberately:**

| What | Where | Why |
|---|---|---|
| Fact base | Postgres `jsonb`, append-only versions | Deeply nested, 400+ fields, evolving. Relational modelling = ~40 tables and a migration per new disclosure field. Zod validates at the boundary, so flexibility without losing type safety. |
| `issuers`, `users`, `module_assignments`, `documents`, `extractions`, `gaps`, `section_status`, `comments`, `audit_log` | Real tables | These get queried, filtered, sorted, joined. JSONB would make the gap dashboard miserable. |

Going all-in either direction is the mistake. All-relational drowns in migrations; all-JSONB makes the dashboard slow and awkward.

---

## Module engine

**A module is data, not code.** Build one engine; every module after is a spec file.

```ts
type Module = {
  id: 'M2'
  title: 'Capital & Shareholding'
  estimatedMinutes: 210
  assignableTo: 'CS' | 'CFO' | 'PROMOTER' | 'LEGAL'
  dependsOn: ['M1']
  requestsDocuments: ['shareholding_register', 'pas3_filings']
  fields: Field[]
  completionRule: (fb: FactBase) => Completion
}

type Field = {
  id: 'capital.allotmentHistory'
  label: 'Share allotment history'
  type: FieldType
  schema: ZodType              // validation + extraction schema

  helpText: string             // the "ⓘ Why we ask" block
  clause?: string              // shown with the help

  feedsInto: SectionId[]       // powers "📍 Where this appears"

  showIf?: (fb: FactBase) => boolean
  extractionHint?: string
  validate?: (v, fb) => Issue[]  // live consistency
  columns?: RepeaterColumn[]     // for `table` fields; cell types text · number ·
                                 // money (decimal string) · date · select · boolean · list
}
```

A field whose schema takes `null` gets a **None** state in the form; a table gets one too, saving
`[]`. The store keeps absent (not reached), none, and answered apart (D37).

`feedsInto` earns its place three times: the promoter-education feature, the dependency graph, and "which sections unblock when this module completes."

### Field types

text · longtext · number · currency · percent · date · select · boolean · **table (repeater)** · file · computed

**The repeater is the workhorse — ~60% of all data volume.** Allotment history, directors, litigation, customers, licences, group companies, RPTs, indebtedness. Needs: add/remove/reorder, per-cell validation, running totals, CSV paste-from-Excel, computed columns, inline extraction fill.

If the repeater is good, the app is good. If it's clunky, M2 alone sinks the demo.

### The ten modules

| # | Module | Who | Time | Documents |
|---|---|---|---|---|
| M1 | Company & History | CS | 45 min | Incorporation cert, MOA/AOA, name-change certs, ROC filings |
| M2 | Capital & Shareholding | CS | **3–4 h** | Allotment history since incorporation, shareholding register, transfers |
| M3 | Promoters & Promoter Group | Promoter | 2 h | PAN, Aadhaar, DIN, passport, career history, family tree, other holdings |
| M4 | Board & Management | CS | 1.5 h | Director KYC, DINs, other directorships, remuneration |
| M5 | Business Operations | Promoter | 3 h | Customer/supplier concentration, capacity, order book, plants, headcount |
| M6 | Financials | CFO/Auditor | **4–6 h** | Restated financials, RPT, loans, contingent liabilities |
| M7 | Legal & Litigation | Legal | 2–3 h | All cases: criminal, civil, tax, statutory |
| M8 | Approvals & Licences | CS | 1.5 h | Sector licences with validity |
| M9 | The Offer | Promoter + MB | 2 h | Issue size, objects, capex quotes, chartered engineer cert |
| M10 | Group Companies & RPT | CFO | 1.5 h | Group entity financials, RPT |

### Four intake design rules

1. **Delegate, don't struggle.** The promoter can't answer M6 or M7. Assign with a link; assignee sees only their module. The promoter is the coordinator, not the sole author.
2. **Ask once.** Company name typed once, appears ~200 times. Promoter DOB flows to promoter section, director section, lock-in table, two risk factors.
3. **Every question explains itself** — "ⓘ Why we ask" + "📍 Where this appears". This is what makes it usable by a first-time issuer; they learn the disclosure framework while using it.
4. **Live consistency checks.** Shareholding ≠ 100% flags on entry, not in week nine.

---

## Document engine

**A section is data too.**

```ts
type Section = {
  id: 'IX.3.OfferProcedure'
  number: '9.3'
  title: 'Offer Procedure'
  producer: 'template' | 'computed' | 'narrative' | 'external'

  appliesIf?: (cfg) => boolean     // fixedPrice vs bookBuilt, exchange, sector
  requiredFacts: FactPath[]         // → drives gap detection
  clause: string

  // exactly one of:
  template?: string                 // {{variables}}, conditional blocks
  compute?: (fb) => DocumentNode[]
  promptSpec?: { factSlice, instructions, wordTarget }
  externalNote?: string             // "auditor must supply"
}
```

`requiredFacts` gives gap detection free: fact missing → placeholder rendered **and** gap raised, from one check. That's MM4 mechanised.

### One AST, two renderers

```ts
type DocumentNode =
  | { type: 'section'; level: 1|2|3; title: string; children: DocumentNode[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'table'; caption?: string; headers: string[]; rows: Cell[][] }
  | { type: 'placeholder'; ask: string; gapId: string }
  | { type: 'toc' }
```

Every producer emits `DocumentNode[]`. `renderHtml()` and `renderDocx()` consume it. **Do not generate DOCX and HTML separately** — they will drift and cost a day.

`renderHtml()` must be **section-lazy**. Rendering 280 pages at once freezes the tab, and it will happen live during the demo.

### Build in waves by producer, not document order

| Wave | Sections | Pages |
|---|---|---|
| **1 — Template** | Offer Procedure (30) · AoA (20) · Definitions (18) · Regulatory Disclosures (15) · Terms of the Offer (10) · Key Regulations (10, sector-switched) · Conventions (4) · Offer Structure (4) · Forward-Looking (3) · Foreign Ownership (3) · Dividend/Declaration/Covers (6) | **~123** |
| **2 — Computed** | Capital Structure + tables · The Offer · Summary of Financial Information · Capitalisation · Indebtedness · Management · Promoter Group · Litigation · Approvals | ~50 |
| **3 — Narrative** | Our Business · Industry Overview · MD&A · History · Objects of the Offer · Basis for Offer Price | ~70 |
| **4 — Derived** | Risk Factors · Summary of the Offer Document | ~50 |
| **5 — External** | Restated Financials · Special Tax Benefits | placeholder only |

---

## Rule engine

```ts
type Rule = {
  id: string
  clause: string        // from 05-rule-sources.md, never from memory
  severity: 'blocker' | 'major' | 'minor'
  category: 'eligibility' | 'completeness' | 'consistency'
  appliesTo?: (fb: FactBase) => boolean
  check: (fb: FactBase) => Gap | null
}
```

Plain TS functions in a registry array. **Not prompts.** Trivially testable.

| Family | What |
|---|---|
| **Eligibility** | Post-issue capital cap, operating-profit track record, promoter contribution & lock-in, OFS caps, minimum allottees. Ships as a **standalone no-signup pre-check** — a usable product on its own. |
| **Completeness** | Mandatory disclosure item absent for this issuer's profile. Auto-derived from `requiredFacts`. |
| **Consistency** | Shareholding = 100% · objects + issue expenses = issue size · capitalisation ties to balance sheet · build-up reconciles with lock-in · RPT figures agree across sections. **These are the checks that eat weeks in real life.** |

---

## Risk engine

```ts
type RiskArchetype = {
  id: string
  category: 'business' | 'financial' | 'legal' | 'promoter' | 'industry' | 'offer'
  trigger: (fb: FactBase) => boolean
  materiality: (fb: FactBase) => number
  factSlice: (fb: FactBase) => object    // all the LLM may reference
  fallbackTemplate: string
}
```

~40 archetypes (design scales to 150), harvested by clustering the S0 corpus's risk sections.

Rules *select* applicable risks — top-5 customers >50% of revenue fires customer concentration with the real percentage — then the model writes issuer-specific prose from `factSlice` only. Sorted by materiality. Each shows **"why this fired"**.

---

## Drafting harness

One harness, six prompt specs. Constraints:

- Model sees **only** `factSlice` for that section — not the whole fact base
- No-invention system prompt; missing fact → placeholder, never a guess
- Forced fact citation per claim
- Regenerate per section, keep prior versions

**Verification:** take 20 generated sentences at random; every one must trace to a fact-base entry. Any that doesn't is the bug that matters most.

---

## Review workflow

Domain roles, still cosmetic (D74 kept this unchanged): Promoter · CFO/CS · Merchant Banker · Auditor · Legal — a picker with no bearing on access, `lib/review/role.ts`. Real access control is a separate system now (D74, supersedes D8): Clerk sign-in, one organization per project, `org:admin` (edit/download) vs `org:member` (view only) — `lib/auth/require-role.ts`.

Section status: `Draft → Ready for Review → Reviewed → Locked`. Section-anchored comment threads. Append-only audit log, now carrying the real signed-in identity alongside the cosmetic role.

**Exports carry `UNSIGNED DRAFT — NOT FOR FILING` in the running header until MB certification** (D35 — a notice on every page, not a page watermark). Required by the problem statement, and the honest answer to "aren't you replacing bankers?"

---

## Gotchas designed around from day one

1. **Never floats for money.** `decimal.js` everywhere. Share counts are integers and safe; prices and percentages are not.
2. **PDF extraction exceeds serverless timeouts.** 200-page financials take 30–90s. Upload → `extractions` row `pending` → process → client polls. Never block a request.
3. **Never render 280 pages at once.** Section-lazy.
4. **Server state, not client state.** Save/resume and delegation require it. RHF for the form on screen, debounced autosave per field, server is truth. No giant client store of the fact base.
5. **Version the fact base from day one.** Append; never overwrite. Retrofitting is painful.

---

## API cost discipline

**D43: Gemini free tier, not Claude, and not paid at all — a hobby-project decision.** Model:
`gemini-3.5-flash-lite`. Free-tier rate limits by current published figures (re-verify in AI
Studio before relying on them — this file is background, not a citation source, same as the
domain primer):

| Limit | Figure |
|---|---|
| RPM | ~30 |
| TPM | ~1,000,000 |
| RPD | ~1,500 |

**RPM is the binding constraint for two-pass extraction** — pace page-batch requests, don't fire
them in parallel. RPD is generous against the 7-document corpus for iterative dev.

**Free-tier content trains Google's models.** Acceptable for the Vardhman seed and the public
corpus prospectuses; not acceptable for a real issuer's PII or financials if this project ever
takes real intake data (D43). No paid fallback is in scope while that holds.

Three levers, in order, same reasoning as before the provider changed:

1. **Snapshot extraction results to fixtures.** Extract once, save the JSON, iterate against it. The difference between 300 API calls and 30 — and now also the difference in free-tier RPD budget.
2. **Two-pass page targeting.** Read the text layer locally to find relevant pages; send only those.
3. **Batch corpus work** where the SDK supports it, since S0-style mining has no latency requirement.
