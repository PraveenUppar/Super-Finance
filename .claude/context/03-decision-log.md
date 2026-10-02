# Decision log

**Append-only.** Never rewrite an entry. To change a decision, add a new one that supersedes it by number.

Format: what was decided · why · what it rules out.

---

## D1 — Target fixed-price SME issues first

The more common SME route and a materially simpler document: no book-building, anchor investors, or price-band machinery. Roughly 20 pages and 60 questions lighter.

**Rules out:** book-built support in v1. Section specs carry `appliesIf` so the branch can be added later without restructuring.

---

## D2 — Classify sections by producer, not chapter order

Boilerplate ~50–60% (template, no LLM) · computed ~15% (pure TS) · narrative 25–30% (grounded LLM) · external ~20% (auditor/CA).

Only ~25% of the document needs a model at all. This is what makes the output defensible to a regulator.

**Rules out:** building Section I → II → III. Build in producer waves.

---

## D3 — Specs are data; engines are code

One module engine and one document engine. Modules 3–10 and sections 12–35 become content, not engineering.

**Rules out:** hand-built pages per module. Adding a disclosure requirement must be adding one object to an array.

---

## D4 — All TypeScript, no Python service

Claude reads PDFs natively, which deletes the document-parsing service that would otherwise force a second language and deployment. What remains — Zod schema reuse across client validation, server validation, Claude tool-use schema, and types — is worth more than Python's document libraries, because a form-heavy app lives in the frontend and Pydantic can't cross that boundary.

**Rules out:** FastAPI, PyMuPDF, pdfplumber, Tesseract, python-docx.

**Refined in D12.**

---

## D5 — Hybrid Postgres: JSONB fact base, relational everything else

Fact base is nested, 400+ fields, evolving — relational modelling means ~40 tables and a migration per new disclosure field. Everything queryable (gaps, section status, comments, audit log) goes in real tables.

**Rules out:** all-relational (drowns in migrations) and all-JSONB (slow, awkward dashboard).

---

## D6 — Never invent

Missing fact → `[TO BE PROVIDED: <ask>]` **and** a gap, from the same check. Companies Act s.34/35 makes a misstatement in an offer document a real liability.

**Rules out:** any "best guess" fill, any prose generated outside a `factSlice`.

---

## D7 — DOCX is the primary export

Merchant bankers redline in Word. A PDF-only deliverable is dead on arrival.

**Rules out:** LaTeX, Puppeteer HTML→PDF as the primary path. Chose `docx` (npm) over docxtemplater (template-fill, wrong for 280 dynamic pages), Pandoc (needs a binary, loses ToC/table control).

---

## D8 — No real auth for the hackathon

Role-switcher dropdown over one seeded org. Saves ~1.5 days, costs nothing in the demo.

**Rules out:** Supabase Auth wiring, session management, invite flows in v1. Module *assignment* is still modelled in the DB so the workflow demo is real.

---

## D9 — Preserve the intermediary explicitly

Section-level review workflow; exports watermarked `UNSIGNED DRAFT — NOT FOR FILING` until merchant-banker certification. The MB's due diligence certificate is statutory — we could not remove it even if we wanted to.

Also the honest answer to "aren't you replacing bankers?": no, their job moves from writing to reviewing.

**Rules out:** any "file directly with the exchange" flow.

---

## D10 — Regulatory numbers require a citation

Every threshold entering the rule pack needs clause + verbatim text + URL + date checked, recorded in `05-rule-sources.md`. SME norms were amended materially in 2025.

**Rules out:** thresholds from model memory, from the domain primer, or from any planning document. The primer is orientation only.

---

## D11 — Reverse the corpus for test data

A published prospectus contains its own inputs. Split restated-financials pages → test input; capital-structure pages → ground truth. Twenty prospectuses = twenty labelled pairs, free.

**Rules out:** "we have no test data" as a reason to skip verification. S5 and S7 gates both depend on these pairs.

---

## D12 — Hybrid PDF handling, refining D4

Claude processes PDF pages as **both text and image** (~1,500–3,000 tokens/page vs ~500–800 for plain text). Route by document type:

- Scanned, or complex financial tables → send PDF blocks (the vision is what you're paying for)
- Digital-born and text-heavy (MOA/AOA, resolutions, litigation lists) → extract text locally and send text

`unpdf` / `pdf-parse` are pure JS, so D4 still holds — no Python.

Also: two-pass page targeting. Read the text layer to find relevant page ranges, then send only those (~4x reduction).

**Supersedes** the "always send the whole PDF to Claude" reading of D4.

---

## D13 — Corrected PDF limits

Earlier planning assumed 100 pages and a 200k context window. Actual: **32MB per request, 600 pages**; the 100-page cap applies only to 200k-context models. Opus 5 and Sonnet 5 both have **1M context**.

A 300-page prospectus fits in one request. Use the Files API to sidestep the 32MB ceiling.

**Rules out:** splitting prospectuses for context reasons. Page targeting remains worthwhile for cost and rate limits, not necessity.

---

## D14 — Fixtures over re-extraction

Every extraction result is snapshotted to `fixtures/`. Downstream work (rule engine, renderers, dashboard) iterates against fixtures, never the live API.

Primary cost control — the difference between ~300 API calls and ~30 during development — and it makes tests deterministic.

**Rules out:** tests that call the API.

---

## D15 — Book-built first. SUPERSEDES D1.

**Evidence, 2026-09-09.** Of 8 SME prospectuses in `corpus/prospectus/`, **7 are book-built and 1 is fixed price** (Quanto Agroworld). All cite ICDR Chapter IX Reg 229(1)/229(2), so all are genuine SME-platform issues.

D1's premise — "fixed price is the more common SME route" — was **wrong**, or at least outdated. SME issue sizes have grown and book-building has followed.

**Two reasons to switch:**

1. The evidence says book-built is the common case now.
2. Template extraction needs ~5 documents of the same type to diff. With 7 book-built documents that can start immediately; with 1 fixed-price document the fixed-price-specific templates cannot be extracted at all.

**This is a narrow change, not a fork.** Comparing Quanto against the book-built documents, ~85–90% of the content is identical. Differences concentrate in five places:

| Section | How it differs |
|---|---|
| Cover page | Price band + floor/cap vs stated issue price |
| Basis for Issue Price | Book-building demand assessment vs fixed justification |
| Offer Structure | QIB / NII / RII allocation vs fixed-price split |
| Offer Procedure | Bidding, bid lots, ASBA bidding vs straight application |
| Terms of the Offer | Partial differences |

`Section.appliesIf` already handles this by design. The fixed-price branch stays cheap to add later.

**Also changes:** the document is now **DRHP → RHP → Prospectus**, not Draft Prospectus → Prospectus. "Red herring" is correct terminology again.

**Rules out:** fixed-price-specific template extraction until the corpus has 5+ fixed-price documents. Keep `appliesIf` branch points on all five sections above so the branch can be added without restructuring.

---

## D16 — Rules are effective-date scoped, evaluated against the DRHP filing date

**Evidence, 2026-09-09.** Four 2026 SME prospectuses contradict each other on minimum allottees: Om Galaxy (BSE), Maxwell (NSE) and Ideas (NSE) all say **200**; Shakti Polytarp (BSE) says **50**.

Shakti is not wrong. SEBI's SME amendments apply to **draft offer documents filed after the notification date**, so an issue whose DRHP predates notification stays under the old regime for its whole life. Shakti's eligibility section corroborates this throughout — it states operating profit with no rupee threshold and attaches Rs 1 crore to net worth instead, which is the pre-amendment shape.

**Consequence.** A rule cannot carry a single current value:

```ts
type Rule = {
  // ...
  effectiveFrom?: string   // ISO date; applies to DRHPs filed on/after
  effectiveTo?: string     // ISO date; superseded after this
}
```

The eligibility engine takes the issuer's **intended or actual DRHP filing date** as an input and selects the applicable rule set. An issuer being advised today is under current rules; one already filed may not be.

This makes D10's "rule pack is versioned data" concrete rather than aspirational.

**Also affected:** Reg 230(1)(d)'s scope differs by vintage — Shakti states only "held by the promoters", Ideas lists the full class (promoter group, selling shareholders, directors, KMP, senior management, QIBs, employees, SR shareholders, financial-sector-regulated entities).

**Rules out:** a single flat rule registry. **Add `effectiveFrom` to the `Rule` type in S6** — retrofitting it later means re-auditing every rule.

**Blocked on:** O-7 — the exact notification date of the 2025 SME amendment. Every `effectiveFrom` depends on it.

**RESOLVED 2026-09-09 by user decision — see D17.**

---

## D17 — Build for current rules only. Minimum allottees is 200.

**User decision, 2026-09-09:** "it is 200".

The tool advises issuers preparing a DRHP **now**, so current rules always apply. The pre-amendment regime (50 allottees, unquantified operating profit, narrow Reg 230(1)(d) scope) is not a case we serve.

**What this changes from D16:**
- Rule values are the current ones. **200 allottees**, Rs 1 crore operating profit, 15% GCP cap, 3-year MPC lock-in, 20%/50% OFS caps.
- No date-selection logic in the eligibility engine, and no need for O-7's notification date.
- **Keep `effectiveFrom` on the `Rule` type anyway.** It costs nothing now, it documents which regime a rule belongs to, and regulations will change again. Populate it when a date is known; leave it undefined meaning "current".

**Rules out:** evaluating an issuer against a historical rule set; any UI asking for a DRHP filing date in order to pick rules.

**Note for the corpus:** Shakti Polytarp remains a pre-amendment document. Do not use it as a source for rule *values* — only for template text, where the boilerplate is unaffected.

---

## D18 — Provenance lives beside the facts, not wrapped around them

The plan (MM5) described `Fact<T> = { value, source, ref, ... }` wrapping every field. **Implementing it that way is wrong**, for a concrete reason discovered while writing the schemas.

The same Zod schemas drive form validation *and* Claude's extraction tool schema (MM3). If every field were a provenance wrapper, the extraction schema would ask the model to report its own `source`, `confidence` and `updatedBy` — inviting it to fabricate provenance. We want plain values back and attach provenance ourselves, from what we know about the call.

**Shape:**

```ts
type IssuerRecord = {
  facts: FactBase          // plain, exactly matching the Zod schemas
  provenance: ProvenanceMap // flat, keyed by FactPath
  version: number
}
```

`lib/facts/provenance.ts` implements `getFact`/`setFact`/`listPaths` over dotted paths with array indices (`capital.allotments[2].issuePrice`). `setFact` is immutable and structure-sharing, since the fact base is append-only.

MM5 still holds — every fact still has provenance. It is stored parallel, not nested.

**Also:** `isUsable(value, provenance)` is the single gate. An extracted fact with `confirmed !== true` is **not usable** and renders as a placeholder plus a gap. That enforces "extraction never lands silently" in one place rather than at every call site.

---

## D19 — Zod 4 native JSON Schema; `zod-to-json-schema` removed

The installed Zod is **4.5.4**, which has native `z.toJSONSchema()`. The separate `zod-to-json-schema` package is redundant and has been uninstalled.

**Gotcha worth remembering:** `io: 'input'` omits `additionalProperties: false`; the default `output` mode includes it but also marks defaulted fields as `required`.

For extraction we want **input semantics** — a field with a default must not be `required`, or the model is forced to invent values it could not find. So `extractionSchemaFor()` generates in input mode and then walks the tree adding `additionalProperties: false` to every object node, which Claude's strict tool use requires.

Covered by `lib/facts/schema.test.ts`.

---

## D20 — Computed sections must be verified against published ground truth, and some figures are not computable at all

**Evidence, 2026-09-10.** Building Issue Structure, I inferred a rule for the QIB / NII / Individual share counts from Om Galaxy's own figures: NII and Individual round UP to a whole lot (they are "not less than"), QIB absorbs the remainder (it is "not more than"). It was plausible and it summed correctly.

Tested against Om Galaxy's published table, **it missed by one lot.**

Its net issue of 1,10,83,200 splits as QIB 55,37,600 / NII 16,64,000 / Individual 38,81,600 — 49.96% / 15.01% / 35.02%, with QIB sitting **2.5 lots below** an exact 50% and Individual 1.5 lots above. Ceiling, flooring and rounding to the lot were each tried; each missed.

**There is no rule.** The split is a discretionary judgement the merchant banker makes at pricing, within the R-024 bounds.

### Two standing consequences

**1. Every computed section gets a ground-truth test.** Feed a corpus issuer its own inputs and assert we reproduce its published table exactly. "Close" is a failure — a number that looks right and is wrong is worse than a visible gap, especially in an allotment table.

**2. Distinguish derived from discretionary.** Some figures follow deterministically from facts (net issue = issue less market maker reservation; issue as a percentage of post-issue capital). Others are professional judgement inside regulatory bounds. **Only the first may be computed.** The second is a gap, however tempting it is to fill because the corpus leaves it blank too.

The pull here is real and worth naming: computing something the published documents show as `[dot]` makes our output look better than theirs. That is exactly when to check whether it is computable at all.

**Rules out:** deriving category allotment counts. A test asserts `derivedTerms` does not expose them, so it cannot creep back.

**Note:** the same conclusion was reached for Basis of Allotment one commit earlier and then talked out of. The ground-truth test is what held the line.

---

## D21 — There is no safe bulk-copy tier for glossary text

**Evidence, 2026-09-10.** Definitions is ~200 entries and 17 pages, and most of it looks like standard regulatory boilerplate. The obvious move is to extract a corpus glossary, filter out the issuer-specific entries, and bulk import the rest.

I wrote that filter (`scripts/build-glossary.mjs`). It rejects any proper noun that is not a statute, regulator or standard market term, plus anything carrying a date. Of 207 merged entries it passed 31.

**Three of those 31 still carried Om Galaxy's own facts:**

| Term | Leaked |
|---|---|
| Equity Shares | "...of face value of **5** each" — its face value |
| Auditor | "...firm registration number **124851W**" — its auditor |
| Stock Exchange | "...refers to, **BSE Limited**" — its exchange |

They slipped through because issuer specifics are **not always capitalised proper nouns**. They are bare numbers, registration codes and two-word names. No regex separates them reliably.

**And the failure is invisible.** The text reads perfectly while carrying another company's facts into a legal document. That is MM4 — never invent — wearing a different hat: not fabricated text, but *borrowed* text, which is arguably worse because it is specific and plausible.

### Consequence

**Every glossary entry is either fact-driven or deliberately authored.** Fact-driven means a template with substitution, as in `sections/definitions.ts` — `face value of Rs {{ capital.faceValue }} each`. The ~143 entries the filter rejects as issuer-specific mostly need to *become* fact-driven templates, not be filtered back in.

`build-glossary.mjs` is kept as a **triage tool** — it says which entries need attention and why. Its output is a review queue, not a product artifact, and is named so.

**Rules out:** copying glossary text from one issuer's prospectus into another's. The same caution applies to any section where the corpus text embeds issuer facts inline rather than in a table.

---

## D22 — The document keeps its section boundaries, and every link resolves or does not render

**Problem, 2026-09-10.** The gap dashboard listed what was wrong; the document rendered the same gaps highlighted; nothing connected them. A finding said "Holds up: Issue Structure" and left the reader to scroll 23 pages — later 280 — to find the sentence it was about.

Connecting them needs the section boundary, and `renderDocument` had already thrown it away by flattening every section into one `DocumentNode[]`. There is nothing in a flat tree to point at.

### Consequence

**`renderSections` is the primary output; the flat tree is derived from it.** `RenderedSection` carries `{ id, title, group, anchor, nodes }`, and `flattenSections` produces exactly what `renderDocument` produced before, so the DOCX renderer is unaffected — the boundaries exist for navigation, not for rendering.

**Three anchor namespaces, all derived from one identifier** (`lib/anchors.ts`): `sec-` from a section spec id, `gap-` from a fact path, `finding-` from a rule id. The dashboard and the document agree on where to point only because neither invents its own id. The prefixes are load-bearing: a completeness rule id embeds its fact path (`CM-company.website`), so without them the gap and its finding slug to the same string.

**One gap has exactly one anchor**, on its first occurrence in the document (`gapAnchorKeys`). A fact used in nine sections is one thing to provide and one finding, and duplicate DOM ids would send the link to whichever the browser found first.

**A finding links to the placeholder, not the top of the section.** Landing the reader at a section heading and leaving them to hunt for the highlight is barely better than not linking.

**A `blocks` entry that names a section which is not built stays plain text.** Rules name sections from the regulation, and 24 of 37 do not exist yet; a link that scrolls nowhere teaches the reader that the links do not work. The difference in appearance is the statement about which sections exist. `linkFindings` matches by subsection title, then by numbered-section group, then gives up.

**Rules out:** rules naming sections by spec id, which would bind a regulatory citation to the build order. `blocks` stays a list of human titles and is resolved afterwards.

### Second finding: a gap inside a table cannot report itself

Table cells are plain strings in the AST, so `[TO BE PROVIDED]` in one is invisible to `collectPlaceholders` and never becomes a finding. Issue Structure is right only because it also carries a placeholder in the paragraph above the table (D20). Nothing enforced that. A test now does: any section whose table holds a gap must also produce a placeholder. The alternative — placeholders inside cells — waits until a section actually needs it.

---

## D23 — Exchange criteria are seventeen separate rules, not one shared check

**Problem, 2026-09-10.** E-05 to E-18 (BSE SME) and N-05 to N-11 (NSE Emerge) sit on top of SEBI's requirements under Reg 229(3), and they overlap heavily. The tempting shape is one rule per *subject* — one insolvency rule, one regulatory-action rule, one six-month rule — switched internally by exchange.

That shape is wrong, and the six-month rule shows why. **E-10 asks whether the ISSUER's own application was rejected by the exchange in the last six months. N-08 asks whether the MERCHANT BANKER has had a draft offer document returned by NSE in the last six months.** Same window, different party, different fix — and the second is not even answerable at pre-check time, because there is no banker yet. Collapsed into one rule they would share a fact, and feeding one exchange the other's fact would produce a confident wrong answer.

### Consequence

**One rule per criterion per exchange**, each with its own `appliesTo`, its own citation and its own fact. EL-022 to EL-038. Where the two exchanges genuinely ask the same question — NCLT, winding-up, BIFR, delisted-company association — one rule serves both and says so in its clause.

**Facts follow the criterion's own shape.** The regulatory-action tests are DATES, not booleans, because BSE looks back three years at the company and one year at the promoters while NSE states no window at all and reaches group companies. A boolean could not answer either question, and inventing NSE a three-year window to match BSE would put a limit in the tool that is not in the source.

**Windows are measured from `offer.intendedFilingDate`, not from today.** An issuer planning to file in four months needs to know whether the window will still be open then.

**Three criteria deliberately have no rule:**

| Criterion | Why not |
|---|---|
| E-07 promoter shares in demat | Restates Reg 230(1)(d), already EL-014. Two findings for one defect teaches the reader the list is padded. |
| N-05 no promoter loan repayment | Restates Reg 230(1)(h), already EL-015. |
| E-14 board composition | "Compliant with Companies Act 2013" states no threshold, no citation row exists, and SME-listed entities are exempted from parts of LODR. Rule zero: no citation, no rule. Recorded as O-11. |

### The conversion trap

E-09 requires no change of name in the year before the application. **Every SME issuer changes its name in that year**, because s.23 requires converting to a public limited company first, and "Private Limited" becomes "Limited".

A blocker firing on the mandatory step is one no issuer can ever clear — the pattern that teaches a reader to skip the dashboard. Silently excluding conversions is worse: if BSE does read it as a change of name, the issuer hears that from the exchange instead of from us.

So it is **two rules**: EL-025 blocks on a genuine name change, and EL-038 reports the conversion at `minor` severity with what to confirm and why. Whether BSE reads it as a change of status or of name is O-12, and EL-038 is what that answer will settle.

**Rules out:** a check returning its own severity. The engine merges rule metadata into the finding precisely so a check cannot report a clause or a severity other than the one it is registered under, and needing two severities is a sign of needing two rules.

### The pre-check grew, and stayed short

24 of the 50 rules are now pre-check rules, but no issuer answers 24 questions: the exchange criteria diverge, so a BSE issuer never sees N-06 or N-10 and an NSE issuer never sees E-08, E-09, E-10 or E-18. The form gained a sixth step and shows only the criteria that govern the exchange selected in step one.

`preCheck` marks what a promoter can answer on day one — not everything that could be asked. E-05 needs a balance sheet, E-13 turns on whether an action was *material*, and N-08 is about a banker who has not been appointed. Those stay out.

---

## D24 — Close the corpus at 8, and corroborate every criterion before shipping it

**Decision, 2026-09-10.** The corpus target drops from 25 prospectuses to **8** (7 on disk plus the missing fixed-price document). MCA21 document sets are dropped entirely; annual reports stop at 4.

The reason is not budget. It is that reading the documents we already had, properly, was worth more than adding more of them — and we had not done that.

### What re-reading the corpus found

The exchange criteria were recorded from **one prospectus per exchange**. Reading a second BSE document (Century) and a second NSE document (Photonics) changed **five** criteria and added **four** that were missing:

| Criterion | Was recorded as | Actually |
|---|---|---|
| **E-09** name change | "No name change in the last 1 year" — a flat bar | One BSE source says that; the other applies a **50% revenue test** on the activity the new name indicates. Two documents, same vintage, different rules |
| **E-05** net tangible assets | "Positive" | One source says positive, the other says **"more than Rs 3 Crore"** |
| **E-13** regulatory action, 1 year | promoters only | promoters, **group companies and companies promoted by the promoters** |
| **N-06** IBC against promoting companies | NSE only | **stated at BSE too** — a BSE issuer would have been told nothing |
| **N-10** trading suspension | NSE only | **stated at BSE too** |
| **E-16 / N-11** delisted companies | BSE reaches every director, NSE carves out independent directors | The carve-out **varies by drafter, not by exchange** — two of four documents have it, one on each platform |
| **E-19, E-20** | missing | Trading suspension and the five-year SEBI-action test, both stated at both exchanges |
| **R-026, R-027** | missing | **Reg 229(4)** (a converted firm needs one full financial year) and **Reg 229(5)** (a majority promoter change starts a one-year wait) — two regulations nobody had read |

Photonics also quotes **Reg 229(6)** and **Reg 230(2)** by number, which turned R-002's operating profit threshold and R-010's GCP cap from "as-applied by two bankers" into actual sub-regulation citations. O-1 closed as a result.

### Consequence

**A single-sourced criterion does not ship.** Where the corpus disagrees with itself the rule says so in the finding text rather than picking a side — see EL-025 (name change), EL-039 (net tangible assets) and EL-033 (independent directors). An issuer being told "two documents state this differently, confirm with the exchange" is better served than one told a confident wrong thing.

**The corpus is closed because it did its job**, not because it is complete. What remains open — Schedule VI Part A (O-5), the amendment notification date (O-7), and the three formulation disputes — needs SEBI's or BSE's own text, and no number of additional prospectuses will settle them.

### The paired dataset

`fixtures/corpus/` splits each prospectus into restated financials (INPUT) and Capital Structure (TRUTH): the expensive half of an extraction test set, free, already reconciled by a merchant banker. All 7 documents yield both halves.

Building it taught three things now recorded in `fixtures/corpus/README.md`: section headings are not stable across drafters, **the auditor's examination report is a far more reliable anchor than the section heading above it** (it took the build from 4 of 7 to 7 of 7), and four of seven documents spell it "Authorized Share Capital" where the regulations say "Authorised".

---

## D25 — A resolved dispute becomes a decision, not a warning

**Decision, 2026-09-10.** The four open questions left by D24 are settled against the underlying rulebooks, and the rules that were hedging now give a clean pass or fail.

| Was | Now | Authority |
|---|---|---|
| **E-14** unruled — "compliant with the Companies Act" states no threshold | **EL-044.** Minimum 3 directors; at least one third independent once post-issue capital reaches Rs 10 crore or turnover Rs 100 crore | Companies Act s.149(1), s.149(4) and Rule 4. **LODR Reg 15(2)(b) exempts SME-listed entities from Reg 17–27**, which is what makes the Companies Act the whole test (R-028) |
| **E-05** "positive net tangible assets", with a minor finding about a disputed Rs 3 crore figure | **EL-022 blocks below Rs 3 crore**, and **EL-039 blocks where more than half of it is monetary assets** | BSE SME revised entry norms, January 2024 (R-029) |
| **E-09** major finding stating two readings and asking the issuer to confirm | **EL-025 blocks** on failing the 50% revenue test. The flat-bar reading is gone | BSE SME criteria, per ICDR Reg 5(1)(e) (R-030) |
| **E-16 / N-11** finding saying the independent-director carve-out was unsettled | **EL-033 states the carve-out.** The fact itself is now defined to exclude independent directorships | BSE SME disciplinary criteria (R-031) |

**EL-038 is deleted.** It existed to flag that the private-to-public conversion might count as a change of name. Under the revenue test the question dissolves: a conversion changes the name but not the activity the name indicates, so it passes by definition. The exclusion moved into `nameChangesInWindow` with a comment explaining why.

### Why hedging was the wrong output

A finding that says "two sources disagree, ask the exchange" is honest about our evidence and useless to the reader. The issuer still does not know whether they pass, and the one thing they came for is that answer. Hedging is the right position while a dispute is genuinely open; it is the wrong position the moment it is not.

**`DETERMINED` is a new confidence level** in `05-rule-sources.md` for exactly this: a criterion that two corpus documents stated differently and that has since been settled against the rulebook, with the clause recorded. The superseded reading stays in the row, so the change is auditable rather than silently overwritten — which is also why the file's append-only discipline still holds.

### What did not change

**Rule zero still applies.** Each of these got a citation row (R-028 to R-031) before the rule was written, and the row names the specific provision — not "the BSE rulebook" but s.149(4), Reg 15(2)(b), the January 2024 revision. **E-14 was unruled for a week precisely because it had no such row**, and that was the correct behaviour until one existed.

**Two limitations are recorded rather than papered over.** The woman-director requirement is not ruled: Rule 3 triggers at Rs 100 crore paid-up capital, four times the SME ceiling, so it cannot bind through capital, and the fact base carries no director gender for the turnover limb. The monetary-assets test is silent where the split has not been disclosed, since a default of zero would silently pass a test that never ran.

---

## D26 — Held-out verification has to check WHERE a match sits, not just whether it matches

**Two findings from verifying the Wave 1 sections added on 2026-09-10.**

### One paragraph was single-sourced, and only the held-out check caught it

The Disclaimer in Respect of Jurisdiction was extracted from Om Galaxy and Photonics, which are word-for-word identical for three paragraphs. Om Galaxy carries a **fourth**:

> "No person outside India is eligible to bid for Equity Shares in the Issue unless that person has received the preliminary offering memorandum..."

It is in **Om Galaxy alone** — not in Century, not in any of the four NSE filings. It had been written into the template because the surrounding paragraphs matched so cleanly that the block read as one unit.

**Removed.** One source is not extraction, it is copying, and copying one issuer's paragraph into another issuer's offer document is D21's finding wearing different clothes.

### The mirror-image mistake: a match that proves nothing

Checking the withdrawal rules, Century appeared to **contradict** both extraction sources. They say Individual Investors may withdraw until the closing date and QIBs and NIIs may not withdraw at all; Century appeared to say "Any of the Bidders are not permitted to withdraw or lower their Bids at any stage".

That sentence is **risk factor 58**, about price movement between bidding and allotment. Century's actual Issue Procedure text says exactly what the extraction sources say.

**A grep hit is not a verification.** The same phrase carries different meaning in the risk factors, the definitions and the procedure, and "present in the held-out document" is only evidence when it is present *in the same section*. The first pass over the exchange criteria made the same class of error in reverse — concluding E-09 and E-10 had no corpus support because they sit in Om Galaxy's *second* eligibility list rather than its Reg 229(3) list (D24).

**Both directions are now part of the checklist**: a clause needs two extraction sources before it is written, and a held-out mismatch needs its context read before it is believed.

---

## D27 — The held-out document is a question, not a verdict

**Finding, 2026-09-10, extracting the UPI subsection.** Century Business Media describes UPI Phase III as a future timeline, "as may be prescribed by SEBI". Five other documents state it as **mandatory for public issues opening on or after December 1, 2023**.

The held-out document is the one that is wrong. Its banker used boilerplate written before the phase was notified, exactly as Shakti Polytarp carries pre-amendment allottee figures (D16).

**So the rule is not "the held-out document decides".** It is:

1. A clause needs **two extraction sources** before it is written.
2. A **held-out mismatch is a question**, and the question has to be answered by reading the context and weighing the sources — not by deferring to the held-out document.

Both failure modes are now on record. D26 caught the first: believing a mismatch without reading it, when Century's apparent contradiction on withdrawal rights turned out to be a risk factor. This is the opposite one: a genuine mismatch where the held-out document loses 5 to 1.

### Single-source sentences cluster in one document

Three sentences have now been caught being drafted from a single source, and **all three were Om Galaxy's**:

| Sentence | Section |
|---|---|
| "No person outside India is eligible to bid..." | Jurisdiction disclaimer |
| The four entity types with whom a UPI ID may be lodged | UPI |
| "All SCSBs offering the facility ... shall also provide the facility to apply using the UPI Mechanism" | UPI |

That is not chance. Om Galaxy is the longest document in the corpus at 509 pages and the primary BSE extraction source, so it carries more text that no one else carries, and its extra sentences sit inside blocks whose other paragraphs match word for word. **The risk is concentrated, not evenly spread**, and every extraction from it needs the per-clause source count run explicitly rather than eyeballed.

### What was deliberately left out, and why

The UPI Phase I and Phase II history — three paragraphs of 2019 and 2020 circular numbers and extended deadlines — is **omitted**. It has no effect on an issue opening in 2026, since every such issue is Phase III mandatory, and the circular numbers are corroborated by only two documents. Omitting is safe; quoting a circular number that may be wrong is not. A merchant banker who wants the history can add it.

---

## D28 — A convention that varies is a fact, not a derivation

**Finding, 2026-09-10, extracting Terms of Payment.** Anchor Investors pay into named escrow accounts, and the document states the names. The obvious move is to build them from the company name, the way the corpus appears to:

> "OM GALAXY LIMITED-ANCHOR RESIDENT ACCOUNT"

Three corpus documents state it three different ways:

| Document | Resident anchor escrow account |
|---|---|
| Om Galaxy | `OM GALAXY LIMITED-ANCHOR RESIDENT ACCOUNT` |
| Axiom Gas | `AXIOM GAS ENGINEERING LIMITED - ANCHOR R ACCOUNT` |
| Century Business Media | `CENTURY BUSINESS MEDIA LIMITED-ANCHOR ACCOUNT-R` |
| Ideas Electricals | `[dot]` — blank at draft stage |

Hyphen, spaced hyphen, suffix order, "RESIDENT" versus "R" — no two agree, and the fourth document tells us why: **the name is whatever the bank actually opened the account as**, which at draft stage nobody knows yet.

**So both names are facts and render as gaps.** Deriving them would produce a string that reads perfectly and matches no bank's records — and a wrong account name in a prospectus misdirects anchor money.

This is D20's finding in a new place. There, the category allotment counts looked computable and were a banker's judgement. Here the account name looks derivable and is a bank's record. **The tell is the same both times: several documents, several answers, no rule that reproduces any of them.** When that happens, stop deriving and ask.

The issue price in the same subsection is the honest version of the same shape: all four documents print "[dot]" because the price is not fixed until the book closes, so it is a gap that closes at pricing rather than a number to invent.

---

## D29 — Two sources agreed, both were wrong, and it had already shipped

**The most serious extraction defect found so far, 2026-09-10.**

Extracting the Do's and Don'ts turned up this item:

| Document | Wording |
|---|---|
| Om Galaxy | "Do not Bid for a Bid Amount exceeding Rs 200,000 for Bids by Individual Bidders" |
| Maxwell | "Do not Bid for a Bid Amount exceeding Rs 200,000 and 2 lots (for Bids by IIs)" |
| Century (held out) | "Do not Bid for a Bid Amount exceeding Rs 500,000 (for Bids by UPI Bidders)" |

Two extraction sources agree on a Rs 2,00,000 cap for individual bidders. **Both are wrong for an SME issue**, and they contradict their own documents: R-006 requires the Bid Amount to EXCEED Rs 2,00,000, which both state elsewhere in the same Issue Procedure. It is main-board retail boilerplate that survived a copy-paste into an SME document.

The held-out document has the rule that actually exists — the **UPI ceiling**, Rs 5,00,000, which all five extraction sources state with the circular reference (SEBI/HO/CFD/DIL2/CIR/P/2022/45, applications up to Rs 5,00,000 must use UPI). It is a threshold at which UPI becomes mandatory, not a cap on what an individual may bid.

### It had already shipped

Checking the rendered document rather than the new section, the same wrong figure was **already in Grounds for Technical Rejection**, extracted in an earlier session:

> "Bids by Individual Bidders with a Bid Amount exceeding Rs 2,00,000."

As a REJECTION ground that is materially worse than as a Don't. Followed literally it tells the issuer to reject **every valid SME retail bid**, because every one of them exceeds Rs 2,00,000 by definition. It has no support in any rejection-grounds list in the corpus — three documents state only the generic "amounts greater than the maximum permissible amounts prescribed by the regulations". It was carried across from the Don'ts list during that earlier extraction.

**Removed.** This is the second time this exact failure mode has been caught in this one section: the cut-off price ground had the same shape, where following Maxwell would have rejected valid retail bids.

### What changes

**Section-local assertions are not enough.** Every test written for these sections checked the section under test, and the defect sat in a different section rendering into the same document. The guard is now a whole-document check: R-006 says the Bid Amount must exceed Rs 2,00,000, so nothing anywhere in the document may cap or reject an individual bid at that figure.

**Two extraction sources is a floor, not a proof.** The rule has always been "two sources agreeing is not enough" — three of the earlier held-out findings were cases where both sources agreed and were wrong. This is the first where both sources were wrong *and internally inconsistent with their own documents*, which is a signal worth looking for directly: **when an extracted clause contradicts a figure the same document states elsewhere, the clause is copied, not drafted.**

---

## D30 — Do not promote the held-out document to a source, even for one clause

**Decision, 2026-09-10, finishing Issue Procedure.** Two clauses came up with exactly one extraction source plus the held-out document:

- "In case of Bidders (excluding NIIs and QIBs) Bidding at cut-off price, the Bidders may instruct the SCSBs to block Bid Amount based on the Cap Price less Discount" — Om Galaxy and Century.
- The Rs 5,00,000 UPI ceiling *as a Don't* — Century's phrasing, though the underlying rule has five extraction sources.

Two independent documents state each. The temptation is to count Century and move on, since holding it out is a methodology choice rather than a claim that it is unreliable.

**The answer is no, and the reason is that the check is worth more than the clause.** Using the held-out document as a source for a clause means that clause has no independent verifier, permanently — and Century has now caught a real defect six times. Spending that on a sentence about discount mechanics, in an issue with no discount, is a bad trade.

Both were handled by looking for the substance elsewhere. The cut-off blocking rule is already covered by `issueProcedurePriceLevels` from two extraction sources. The UPI ceiling is stated from the five sources that carry the underlying rule, phrased as a Don't — which is a different thing from copying Century's sentence.

**The rule stands as: two EXTRACTION sources, and the held-out document only ever votes against.**

### While there: caught myself inventing

The anchor investor draft carried "the allotment is made at the Anchor Investor Allocation Price **and the excess is not refunded**". The first half is in three documents. The second half was an inference — plausible, unstated, and exactly the kind of sentence that MM4 exists to stop. Replaced with what the three sources actually say: "Allotment to successful Anchor Investors will be at the higher price, that is, at the Anchor Investor Allocation Price."

The inference may even be correct. It is still not extraction.

---

## D31 — Re-extract before authoring, and diff the glossaries rather than the entries

**2026-09-10, taking the Definitions glossary from 79 authored entries to 130.**

The stored fixture, `fixtures/definitions/om-galaxy-definitions.json`, turned out to be **one entry per LINE** rather than per term — every description truncated at the first line wrap. It was fine as the review queue it was built to be, and useless for authoring.

Re-extracting with the `-table` recipe plus **continuation merging** — an empty left column continues the previous description, and a term with no description at all is a wrapped term — produced 220 whole pairs from Om Galaxy and 436 from Maxwell.

**Diffing the two glossaries is what made the batch safe.** The 46 settlement-machinery definitions agree almost word for word across both documents, which is the signal that they describe SEBI's process rather than the issuer. That is a much stronger test than reading one document carefully: D21's filter failed precisely because issuer facts hide as bare numbers, and a second document makes them visible as differences.

Every entry was still rewritten rather than pasted. Om Galaxy's "Bidding Centers" description ends by naming its own Registered Office; its "Chairman", "ISIN", "Banker to our Company", "Material Subsidiary" and "Auditor" entries are pure issuer facts — those became fact-driven entries that render a gap when the appointment has not been made.

### A citation conflict the glossary surfaced

Om Galaxy, Maxwell and Axiom define **Fraudulent Borrower** as Regulation 2(1)(lll) of the SEBI ICDR Regulations. Maxwell **also** defines **Wilful Defaulter** as Regulation 2(1)(lll), and so does Century. The same sub-regulation cannot define both.

The glossary cites it for Fraudulent Borrower, where three independent documents agree, and defines Wilful Defaulter **without a sub-regulation number**. Recorded as O-15. No rule depends on it — EL-010 cites Reg 228(c) — so this is a disclosure-accuracy question rather than an engine one, but shipping a confident wrong citation in a glossary that a merchant banker will read is not free.

### What the tests now hold

- **No term is defined twice.** 130 entries across six arrays; a term in two of them renders twice in one alphabetical table.
- **No other issuer's name, auditor registration number or ISIN appears in any description** — the specific strings D21's filter let through.
- **Book-building terms disappear from a fixed-price issue** while the ASBA machinery stays.

---

## D32 — Wave 1 extraction is finished, and the single-source pattern held to the end

**2026-09-10.** The last four extractable boilerplate subsections are built: Certain Conventions (#2), Dividend Policy (#22), Restrictions on Foreign Ownership (#34) and Declaration (#37). Wave 1 extraction is complete.

**10 of the 37 numbered subsections, 42 rendered pages.** What remains in S4 is not extraction work: computed sections wait on S3/S5/S8, narrative on S9/S10 and API credits, Main Provisions of AoA on S7 upload, and two subsections are external deliverables from the auditor and the CA.

### Three decisions in this batch worth keeping

**Page cross-references are dropped.** The corpus writes 'see "Definitions and Abbreviations" on page 1'. We do not paginate until DOCX export, so any page number written here is invented and wrong in every document. Section names are kept; a test asserts no `on page N` survives.

**No sectoral cap is recited.** Restrictions on Foreign Ownership describes the FDI regime, which is identical for every issuer, but the permitted foreign investment percentage varies by sector. The corpus documents point at the FDI Policy rather than stating a number, and so does this — a cap recited for the wrong sector is worse than silence.

**The Declaration signature block is computed, not typed.** It is the page that carries personal liability under Section 26, signed by every Director plus the Company Secretary and the Chief Financial Officer. Building it from `management.directors` means it cannot silently omit someone; where no board is recorded it raises a gap rather than printing an empty list.

### The fourth single-sourced sentence, in the fourth different section

Dividend Policy carried "all Equity Shareholders whose names appear in the register of members on the record date are entitled to be paid". Om Galaxy alone; Maxwell's only mention of a record date is in an unrelated context.

That is now **four for four** — every single-sourced sentence caught across four separate sections has been Om Galaxy's. At 509 pages it is the longest document in the corpus and the primary BSE extraction source, so it carries more text nobody else carries, and that text sits inside blocks whose other paragraphs match word for word. **Running the per-clause source count is no longer a precaution when extracting from it; it is the method.**

---

## D33 — An invalid answer is saved, and a real issuer never starts from the seed

**Two decisions from building S3, both about what honesty means in a form.**

### An invalid value is stored, not rejected

`saveField` writes whatever the issuer typed and reports the problems alongside it. Refusing to store a value that fails its schema would lose their work every time they typed a half-finished date — and it would make the gap dashboard lie by omission.

**A field that is WRONG is a different state from a field that is EMPTY**, and the document has to be able to show the difference. An empty field is a question nobody has answered; a wrong one is an answer somebody needs to look at again. Collapsing them into "not answered" hides the second.

### A real issuer's answers go over an EMPTY fact base, never over the demo seed

The obvious implementation is to start every issuer on the Vardhman seed and let them overwrite it field by field. It renders beautifully from the first keystroke.

It is also the exact failure D21 records, moved from text into product: a document that reads as complete while carrying another company's face value, another company's auditor, another company's registered office in every place the issuer has not reached yet. The reader cannot tell which figures are theirs.

So `withAnswers` lays the issuer's answers over `emptyFactBase()`. Everything unanswered renders as a visible gap and appears in the findings list. Typing one company name produces **56 findings and 29/100 readiness**, which looks discouraging and is correct — that IS the state of a document with one fact in it.

### While there: two things the browser found that types did not

**Zod schemas and functions cannot cross the server/client boundary.** Passing a `Field` to the form is a runtime error, not a type error, so it reached the browser before it failed. The fix is a `FieldView` of plain data built on the server — which is the better shape anyway: validation and `showIf` both run where the schema and the whole fact base already are, and the browser carries neither Zod nor the section registry.

**React's `onBlur` listens for `focusout`, not `blur`.** `blur` does not bubble, so a synthetic one never reaches the handler. Worth knowing for any future browser verification of a form.

---

## D34 — The bug the unit tests could not see

**2026-09-10, building the repeater.** `parsePaste` had eight passing tests: tab separation, grouping separators stripped, empty numeric cells left undefined rather than zero, short rows padded instead of shifted, Windows line endings, single-cell pastes ignored. All green.

The bug was one line away, in the code that put the parsed rows into the list:

```ts
const before = rows.slice(0, i);
const after = rows.slice(i + 1);          // wrong
commit([...before, ...parsed, ...after]);
```

Pasting five rows into row 0 of a five-row table gave **nine rows** — the pasted five, plus the four the paste should have covered. An issuer pasting their full allotment history over a partly typed list gets every row twice and a cumulative total that silently doubles.

Only the browser found it. The parser was never wrong; the splice was, and no test of the parser could have reached it.

**`applyPaste` now follows spreadsheet semantics:** pasting N rows at row i overwrites rows i through i+N-1 and leaves anything beyond intact. Pasting the same block twice is now idempotent, which is the property that actually matters — a nervous issuer will paste again to be sure.

### The general lesson, which has now appeared twice in this session

D29 was the same shape: every test written for a section checked that section, and the defect sat one section away in the same document. Here every test written for the parser checked the parser, and the defect sat one function away in the caller.

**Test the seam, not just the part.** Where a pure function feeds a stateful caller, the caller is where the interesting mistakes live.

### Two smaller things worth keeping

**`revalidatePath('/intake')` does not reach `/intake/m2`.** It needs `revalidatePath('/intake', 'layout')`. Without it the live consistency banner appears only after a manual reload — and a consistency check the issuer has to go looking for is not live.

**The running total is a mitigation, not a fix.** It made the doubled figure visible immediately, which is why the bug was caught in seconds rather than in week nine. But a mistake the issuer has to notice is worse than one that cannot happen, and the fix was still the right call.

---

## D35 — No page watermark; the draft state lives in the running header

**User decision, 2026-09-11, on seeing the first DOCX export.**

D9 recorded the export as "watermarked `UNSIGNED DRAFT — NOT FOR FILING` until merchant-banker
certification". The first S11 build did that with a text frame in the header, and the render
showed why it was wrong before the user did: a frame is a layout object, so with wrapping off it
painted OVER the body, and a Definitions row underneath it was unreadable. A redline the banker
cannot read is not a deliverable.

The second build used Word's own watermark markup — a WordArt text path at a negative z-index,
behind the text — which rendered correctly. The user asked for it to be removed regardless.

**What carries the draft state now:** the notice in the running header, on every page, in red,
beside the company and document name. It goes when `certified` is set, exactly as the watermark
would have. The `certified` option, the filename suffix and the `Cache-Control: no-store` on the
route are unchanged; S12's certification action is still what lifts them.

**Supersedes** the watermark half of D9. The certification gate itself stands.

---

## D36 — The table of contents is written into the field, not left for Word to fill

**2026-09-11.** A ToC in Word is a field, and a field is empty until something computes it.
Word does on open (the document sets `updateFields`) or on F9; LibreOffice, Google Docs and any
PDF conversion never do. The first export opened with a "TABLE OF CONTENTS" heading and nothing
under it, and the user asked whether it had been missed.

The entries are now written into the field as cached content: every numbered section and every
heading down to level 3, each an internal hyperlink to its bookmark, styled with `toc 1` to
`toc 3` so the levels indent. Word replaces them with its own on update, using the same styles,
so the ToC looks the same before and after — except for page numbers, which nothing can supply
before Word paginates and which are blank until the field updates.

**Also from this build:**

- **`renderSections` is what the DOCX consumes, not a second tree.** The renderer walks the same
  `RenderedSection[]` as the HTML view, so the gaps, bookmarks and headings agree by
  construction. `lib/issuer.ts` is the one place that decides which issuer both render.
- **Word bookmarks are not DOM ids.** 40 characters, letters, digits and underscores. `bookmarkName`
  in `lib/anchors.ts` maps the existing anchors rather than inventing a second vocabulary; long
  ones keep a readable prefix and a hash.
- **Tables are fixed-layout with explicit widths that sum to the text width.** Autofit lets a
  nine-column shareholding table run past the right margin; fixed widths cannot.
- **Rendering caught a data defect the tests had not.** The EXIM abbreviation carried U+FFFD
  where the corpus has an en dash. The source PDF was checked and the character corrected.

---

## D37 — "None" is an answer, and the store must be able to hold it

**2026-09-11, building M3 to M10.** The S8 gate is "Vardhman completable start to finish", and it
failed on the first run for a reason that was not a bug in the seed: `promoters.pledgedSharesDetails`
is null, meaning no pledged shares, and `isAnswered(null)` was false. Every "date of the last
regulatory action, if any" and every "details, if any" had the same problem, and so did every
table whose empty state is meaningful — no litigation, no disassociations, no selling shareholders.
A form that cannot say "none" cannot complete, and an issuer would be asked "any pledged shares?"
forever after answering no.

The wrong fix was to type "none" into the box, which then reads as a disclosure. The wrong fix for
tables was a boolean beside each one. The right fix is that the store distinguishes THREE states:

| Stored value | Means |
|---|---|
| absent (`undefined`) | nobody has reached this question |
| `null`, or `[]` for a table | someone chose **None** |
| a value | an answer |

`isAnswered` now counts null and an empty array as answered. That is safe only because nothing
writes them by accident: the form offers "None / not applicable" on fields whose schema takes null
(`isNullable`, derived from the Zod schema, not declared), and the repeater writes `[]` only from
its own "None / no entries" button or when the last row is removed — a table someone merely clicked
into is never saved. D33 said empty and wrong are different states; this adds that empty and none
are too.

**The seed is not padded to pass the gate.** Vardhman is a DRHP, and three M9 answers cannot exist
at that stage — the two anchor escrow account names (D28) and the expert consents. The gate now
states exactly those three as the only unanswered fields across all ten modules, which is a
stronger claim than 100% and a true one.

---

## D38 — Columns live on the field; the repeater knows money, yes/no and lists

**2026-09-11.** Two things S5 left that S8 could not build on.

**The page held a map from fact path to repeater columns.** Three entries for M2, and every new
table would have been a fourth line of UI code, against the rule that a module is content. Columns
are now `Field.columns`, declared with the field, and the page reads them. `feedsInto` gained the
same treatment for the other direction: a field may name a section that is in the map but not yet
built (`plannedSections`), and the form says "Our Business (not yet drafted)" rather than either
promising a place that does not exist (D22) or hiding where the answer goes. A test holds that a
planned id is removed the day the section is built.

**Every money cell in M2 was a `number` column.** Typing a face value stored `10`, `zMoney` wanted
`"10"`, and the row failed as "expected string, received number" — the browser gate had pasted the
seed's strings, so it never saw it. The plain form had the same defect on `currency` fields. The
repeater now has `money` (a decimal string, commas and "Rs" stripped), `boolean` (a Yes/No select,
reading yes/no/y/n/1/0 from a paste) and `list` (semicolons, for other directorships and committee
members), and empty text cells save as absent rather than `""` so an optional DIN left blank does
not fail the DIN pattern. `parseCell` is the one place a cell becomes a value, for typing and for
paste alike — D34's lesson about the seam, applied before the seam existed.

---

## D39 — What Wave 2 computes, and what it deliberately still asks

**2026-09-11.** Ten computed sections landed from M3 to M10. The line between derived and asked
(D20, D28) was drawn per figure:

**Computed, never asked:** the promoters' aggregate holding and the directors' shareholding (from
the M2 register, so the three sections cannot disagree); the board composition sentence and every
age (from flags and dates of birth); each committee member's nature of directorship (looked up on
the board); the litigation materiality threshold and the material creditor threshold (from M6,
with the arithmetic both corpus documents print); the indebtedness summary by category (from the
facility list); the capitalisation totals and ratios; the contingent liability and RPT totals.

**Asked, because no rule reproduces it:** the materiality policy DATE (a board resolution); the
group company threshold and its BASE (10% of PAT in one document, 10% of revenue in the other);
the borrowings "as on" date and the auditor's certificate; the post-issue capitalisation column,
which every corpus document prints as "[dot]" because it depends on the issue price.

**Checked, and said so where it fails:** the fund-based outstanding against the balance sheet's
total borrowings; each year's contingent liability items against the year's total; each year's RPT
lines against the year's total; every transaction party against the related party list. A mismatch
is a highlighted reconciliation placeholder, not a silent choice of one figure over the other.

**Summary of Financial Information is external.** It is the auditor's summary statements, which
both sources reproduce in full; a condensed table of our key figures would be a different thing
wearing the section's name.

**Left for later, and listed:** the committees' terms of reference, "Interest of Directors" and
"Interest of Promoters" and the promoter undertakings — boilerplate the fact base does not carry
and Wave 1 extraction has not reached; Other Financial Information (EPS, RoNW, NAV) and Material
Contracts, both computable from facts already held.

---

## D40 — PDF is a print of the DOCX, never a third renderer

**2026-09-11, finishing S11.** The document has one AST and two renderers, and D7 makes the DOCX
the deliverable. A PDF export could have been a third renderer over the same AST; it would have
drifted from the DOCX exactly the way the architecture note warns HTML and DOCX would have, and a
banker comparing the two would find differences that are ours, not theirs.

So `/export/pdf` prints the DOCX through LibreOffice — the same conversion the S11 verification
used — and returns a plain 501 when LibreOffice is not installed (`SETU_SOFFICE` overrides the
search). The vault ships without the PDF in that case and its manifest says so. An honest absence
over a lookalike.

**Also from this build:**

- **The gap report is the dashboard in a spreadsheet**, because the banker's diligence tracker IS
  a spreadsheet and a list they cannot paste is a list they retype. Findings, Placeholders and
  Provenance sheets; "Where to fix" resolved by fact path to the module and the question, so a
  row names a place a person can go. A `Banker notes` column comes back filled in.
- **One assembly for every export.** `lib/export/bundle.ts` loads the issuer, renders and assesses
  once; the DOCX, PDF, workbook and vault routes all call it. Four routes loading facts for
  themselves would eventually describe four different versions.
- **The vault carries the fact base and the provenance map** beside the document, because a figure
  in a table traces to a fact path and the fact path traces to a person and a date, and diligence
  wants that chain in the same folder.

---

## D41 — EPS is computed, and the share-weighting convention is the one the corpus reproduces

**2026-09-11, building Other Financial Information.** Earnings per share needs the weighted
average number of shares for each year, restated for bonus issues under AS-20. That is derivable
from the allotment build-up — but D20 says a computed figure gets a ground-truth test, and D28
says a convention that varies by drafter is a fact to ask for, not a derivation.

Maxwell prints its weighted counts beside its EPS: 1,00,50,275 / 1,00,07,133 / 1,00,06,775 for
Fiscals 2026 to 2024, from four allotments including a rights issue on March 29, 2025 and two
bonus issues. One rule reproduces all three exactly: **cash allotments count for the days they
were outstanding, inclusive; every bonus issue's total shares are added in full to every earlier
year.** The March 29 rights issue counts three days of 365. The test holds it.

Om Galaxy's history — eighteen allotments, preference capital, and implied weighted counts above
its current share count — could not be reconstructed reliably from layout text and is not used.
One corpus reproduction is thinner than the two-source rule wants; the arithmetic is AS-20's own,
and the method is printed in the note beneath the table so a banker can see it.

**Two conventions vary and are stated, not hidden.** Return on net worth is on closing net worth
(Maxwell) rather than the average of opening and closing (Om Galaxy); EBITDA margin is on revenue
from operations (Maxwell) rather than total income (Om Galaxy). Both documents print their
formula under the table, which is what makes either acceptable; the note here does the same.

**Material Contracts** needed six agreement dates the fact base did not hold. They are M9
questions now, and the two signed before the RHP — banker to the issue, market making — join the
DRHP-stage unknowns the seed leaves open, as Maxwell's DRHP prints them: "dated [dot]".

---

## D42 — The standing boilerplate inside computed sections is extracted, and a fact decides which way each statement prints

**2026-09-11.** Our Management, Our Promoters and the litigation section carried tables and
connecting sentences but not the pages of standing text around them: the committees' terms of
reference, "Interest of our Directors", "Interest of our Promoters", the promoter undertakings,
the creditors table. These were extracted from Om Galaxy and Maxwell clause by clause under the
two-source rule, checked against Century, and live in `lib/document/sections/standing-statements.ts`.

**What the two-source rule removed, named so a banker can add it knowingly.** Audit committee:
Om Galaxy's RPT-policy, omnibus-review, subsidiary-loan and KPI items; Maxwell's end-use item,
its two provisos, its powers and quorum paragraphs. Interest of directors: Om Galaxy's
similar-business, net-proceeds, intermediary-appointment, non-salary-benefit and contingent
compensation paragraphs. Undertakings: Om Galaxy's supplier/lessor conflict, struck-off list and
SEBI-action items; Maxwell's securities-law violations. Where the sources differed on a window,
Century decided: **two years** for promoter interest in contracts and property (Om Galaxy said
two, Maxwell three; Century two).

**A confirmation is a statement about a fact, so the fact decides it.** Each undertaking is
switched by the flag M3 or M7 already collects — debarred by SEBI, fugitive economic offender,
wilful defaulter, regulatory action in the past year, debt-security defaults. Where the flag is
set, the negative is NOT printed and a gap asks for the particulars; the alternative — a
boilerplate "none" over a flag that says otherwise — is the exact contradiction the exchange reads
for. The personal-guarantee sentence is derived from whether any facility's security mentions a
guarantee, and disappears where none does.

**Two things were kept out of the extracted text on purpose.** The intro sentences cite Sections
177 and 178 of the Companies Act and not LODR Regulations 18 to 20, because the corporate
governance paragraph two lines above states that Regulations 17 to 27 do not apply to an SME
issuer; citing them as the committees' scope would have contradicted it. And the audit item on
interim statements says "quarterly", the intersection, though Om Galaxy adds "half-yearly".

**Also:** the creditors table needed six figures — MSME and other creditors by count and
amount, material creditors by count and amount — now in `financials.creditors` and M6. The two
amounts are checked against trade payables and a mismatch renders as a reconciliation placeholder
(D39). The material creditors' names go on the website in both sources, not in the document, so
only the count and total are asked.

---

## D43 — S7/S9/S10 use Gemini free tier, not Claude. SUPERSEDES the provider assumption in D19 and 02-architecture.md.

**2026-09-11, user decision.** This is a hobby project, not a production one, and the user will not
pay for API access. Gemini's Flash-Lite free tier (30 RPM / 1M TPM / 1500 RPD by current published
figures — re-check in AI Studio before relying on them, same discipline `05-rule-sources.md`
demands of regulatory numbers) removes the credits blocker for S7 (extraction), S9 (narrative) and
S10 (risk narrative) without cost.

**The trade-off, accepted knowingly:** free-tier Gemini content is used to improve Google's
products. Fine for the Vardhman seed and the public corpus prospectuses. Would NOT be fine for a
real issuer's PAN, Aadhaar, DIN, passport numbers, litigation or financials — but there is no real
issuer here, so the question does not currently arise. **If this project ever takes real intake
data, this decision must be revisited before that data reaches the API** — paid-tier Gemini does
not train on submitted content.

**What survives from the Claude-oriented design:** the one-schema-many-uses model (MM3) still
holds — `extractionSchemaFor()` still starts from `z.toJSONSchema()`. What does NOT survive:
`closeObjects()`'s `additionalProperties: false` pass in `lib/facts/schema/index.ts` exists
specifically for Claude's strict tool use; Gemini's schema dialect (OpenAPI-3.0-based, now also
plain JSON Schema) needs its own adapter, unverified until a real call is made against it.

**Mechanical changes, done the same session:** `@google/genai` installed; CLAUDE.md and
02-architecture.md's stale Claude references fixed; `lib/llm/client.ts` built — `LlmClient`
interface, `createGeminiClient()`, and `createFakeClient()` for tests (D14 made mechanical rather
than a rule to remember); `lib/llm/snapshot.ts` for the fixture-snapshot discipline. Confirmed
against the SDK's own type definitions that `responseSchema` takes a plain JSON Schema object
(routed internally to `responseJsonSchema`), so `extractionSchemaFor()`'s output should pass
through without a Gemini-specific closing pass — still unverified against a real call.
**Still open:** `GEMINI_API_KEY` in `.env.local` (needs the user's own key from AI Studio); the
stale "Claude" comments in `lib/facts/provenance.ts`, `lib/facts/schema/index.ts`,
`lib/facts/schema/shared.ts` and `lib/facts/schema.test.ts` (flagged, not yet fixed — small, and
out of scope for the session that found them).

---

## D44 — Risk archetypes report `detail`, not a static `fallbackTemplate`. Refines the RiskArchetype sketch in 02-architecture.md.

**2026-09-11, building the first slice of `lib/risk/archetypes.ts` (S10).** 02-architecture.md's
original sketch gave `RiskArchetype` a `fallbackTemplate: string` — text shown before the drafting
harness writes bespoke prose. Building the first six archetypes surfaced the same problem D18 found
in `Fact<T>`: a static template cannot "show the arithmetic". The customer-concentration archetype
existed specifically to name Vardhman's real 61.3% and the five customers behind it — a fixed
string can't carry that. `detail: (facts) => string` does what `Rule.check`'s `detail` already does
elsewhere in the codebase; `RiskArchetype` now matches that convention instead of introducing a
second one.

**Grounding discipline for the registry, six archetypes in:** every trigger either reuses a
threshold already established elsewhere in the codebase (`materialityThreshold()` from
`lib/legal/materiality.ts`, cited to Om Galaxy p.306 and Maxwell p.244, for the two financial/legal
archetypes) or the Vardhman seed's own stated convention (the 50% customer-concentration bar, per
the seed's comment), or is a plain structural count with no threshold to invent at all (single
facility). Two archetypes — supplier concentration and high leverage — use a threshold that is
**not** independently corpus-verified and say so in their own file comments, at the same
`PROPOSAL-ONLY` honesty level a rule gets in `05-rule-sources.md` when its citation is thin.

**What fires on Vardhman today, and why that is a feature, not a bug:** four of the six archetypes
fire — customer concentration (61.3%), single facility, material contingent liabilities (Rs 0.90
cr against a computed threshold of ~Rs 12.08 lakh) and material litigation against the company (the
Rs 0.34 cr GST claim, against the same threshold). The seed was built to be a realistic issuer with
real exposures, not a clean pass-every-check fixture the way `allRules` treats it (D-none — see
`rules.test.ts`, "the clean seed passes every rule"). A risk-factor engine that found nothing to
say about a real SME issuer would be the actual bug.

**Not yet built:** the remaining ~34 archetypes toward the 02-architecture.md design target,
harvested by clustering the S0 corpus's risk sections rather than invented from the schema alone;
`promoter`, `industry` and `offer` categories have no archetype yet. The prose-writing step (S9's
harness, reused here) waits on a Gemini key.

---

## D45 — Risk Factors is `producer: 'computed'`, not `'narrative'`. Registered, closing subsection #4 of 37 — 25 built.

**2026-09-11, wiring `selectRisks()` into the document.** 02-architecture.md's section map lists
Risk Factors (#4) as pure `N` — narrative, LLM-drafted, the hardest section, 29-42pp observed. That
is still true for the FULL section a real prospectus carries. But `selectRisks()` and each
archetype's `detail()` (D44) are pure TS producing real, grounded sentences today — the same
"computed, not narrative" distinction the codebase already draws everywhere else (a section is
`computed` when a function derives it from facts; `narrative` only where an LLM must write
judgement-laden prose). Treating the whole subsection as blocked on S9/S10 credits would have left
a `[TO BE DRAFTED]` placeholder sitting on top of a working, tested selection engine.

**`lib/document/sections/risk-factors.ts`** — `general.riskFactors`, order 400 (between Forward
Looking Statements at 300 and The Issue at 500), group `SECTION - RISK FACTORS`. Groups triggered
risks under six category headings in a fixed order, each risk as its `title` + `detail()` sentence.
Moved out of `plannedSections` into the registry, per that file's own stated convention — enforced
by an existing test (`modules.test.ts`, a planned id must not also be built).

**What is deliberately NOT claimed.** No corpus-extracted Risk Factors boilerplate exists locally
to open with (`fixtures/corpus/input/*.txt` holds only the restated-financials half of each
document, per D0's reversed-corpus design — there is no Risk Factors intro paragraph on disk to
extract, so none is invented). The section opens with an ITALICISED tool note, visibly distinct
from prospectus body text, saying the list is preliminary and machine-generated. It always ends
with a gap — `general.riskFactors.narrative` — naming that full narrative drafting and further
risk identification are still pending, worded so it reads correctly whether zero or several risks
fired (a sparse issuer must not see "beyond the 0 archetypes flagged").

**Counts move from 24 to 25 of 37 subsections.** Three hardcoded test expectations updated
(`section.test.ts`, `wave2.test.ts`, `export.test.ts`) — the same honesty discipline the
"25 of 37 was wrong" episode established: a number the reader trusts must not flatter, and must
also not undercount real, tested progress once it exists.

**Closed the same session.** `renderSection`'s template branch now merges a `riskFactors` overlay
alongside `terms` (`riskFactorsOverlay()` in `lib/document/section.ts`), so Forward Looking
Statements' `{{ riskFactors.summaryOfMaterialFactors }}` resolves to the fired risk titles joined
inline — not as list markup, since `toRuns` collapses whitespace inside a substituted value, so a
literal `\n- ` bullet would render as flattened text with stray hyphens rather than a real list
node. Reads as continuous prose instead. Always resolves to a non-empty, usable string, even at
zero risks fired (falls back to naming the Risk Factors section by title, no invented page number —
page cross-references were dropped project-wide for the same reason), so the placeholder in
Forward Looking Statements stops rendering the moment ANY archetype exists, not only once the
registry is complete. The now-dead `asks` entry in `general.ts` was removed.

**Four tests updated** (`section.test.ts` ×2, `rules.test.ts` ×2) that had asserted
`riskFactors.summaryOfMaterialFactors` was a standing gap — it no longer is, by design. Each was
repointed at `general.riskFactors.narrative`, which now plays that role (a gap that stands even for
a fully-filled Vardhman) — same test intent, correct fixture.

---

## D46 — Three archetypes grown from the real corpus, not the schema. `management.directors` gains a fact.

**2026-09-11.** D44/D45's six archetypes were each grounded in a field already sitting in the fact
base — real, but risk-shaped by what the schema happened to hold, not by what real SME prospectuses
actually disclose. This pass inverted that: `pdftotext -layout` on three corpus PDFs (Om Galaxy,
Maxwell Engineering, Ideas Electricals — `corpus/prospectus/`, gitignored but on disk), the numbered
Risk Factors chapter of each (85, ~76 and ~40+ items respectively), cross-referenced for themes that
recur across at least two documents AND map to something the fact base can already answer or can
reasonably be asked. Same two-source discipline as `template-extraction` and as the exchange
criteria corroboration (D24).

**Two archetypes needed no schema change:**
- `exportRevenueDependency` — Om Galaxy #38 (exports ~9% of revenue, worded "certain portion") and
  Maxwell #3/#8 (exports ~85%, worded "substantial portion" plus a dedicated FX risk). Both
  magnitudes carry the SAME risk, which rules out a percentage floor as the trigger — unlike
  customer concentration's 50% bar, this one fires on any export revenue at all, and the wording
  itself scales with the number. `business.exportRevenueShare` already existed.
- `leasedFacilities` — Om Galaxy #29 and Ideas Electricals, both on leased/licensed premises with no
  assurance of renewal. Distinct from `singleManufacturingFacility`: that one fires on COUNT, this
  one fires on OWNERSHIP (`business.facilities[].owned`, already existed) — independent signals, an
  issuer can trip either, neither or both.

**One needed a fact the schema didn't have.** Om Galaxy #60, Maxwell #52 and Ideas Electricals all
carry a board-experience risk — three of the first four documents checked, the strongest corpus
support of the batch — but `management.directors[].otherDirectorships` is free text with no "was
any of these listed" signal, and inferring it would be exactly the kind of guess D44/D45 refuse to
make. Added `zDirector.hasListedCompanyExperience: boolean` (default false), a column in
`DIRECTOR_COLUMNS`, and `general.riskFactors` to `management.directors`' `feedsInto` — the module
field's help text already explains why it's asked. The Vardhman seed's five directors were updated:
four false, one (Arvind Joshi) true — his own `experienceSummary` already said "two listed component
manufacturers", so this is the fixture catching up to its own prose rather than a new assumption.

**The trigger takes the weaker framing on purpose.** Om Galaxy says "none of our directors"; Maxwell
says "majority of the directors." A majority-lack trigger covers Om Galaxy's stricter "none" case as
a subset, rather than requiring both sources to agree on where exactly the line sits — the same
reasoning D25 used to settle disputed exchange criteria: don't manufacture false precision where the
sources genuinely differ on the bar, pick the one that is defensible from either.

**Verified:** 10 new tests (30 total in `lib/risk/`), `tsc` clean, 558 tests passing overall. Vardhman
now fires 7 of 9 archetypes — customer concentration, single facility, contingent liabilities,
litigation, export dependency (8.4%, "portion" not "substantial portion" — the wording-scales-with-
number test would have caught a copy-paste of Maxwell's phrasing), and now board experience (4 of 5
directors). `leasedFacilities` and `supplierConcentration` correctly do not fire — Vardhman's one
facility is owned, and its supplier concentration (31%) sits below the (provisional) 50% bar.

**Not yet built:** ~31 more archetypes toward the ~40 target. Corpus-visible themes seen this pass
that were deliberately NOT turned into archetypes because the fact base cannot ground them without
inventing a new signal on thin justification: statutory-dues compliance history, insurance adequacy,
key-person dependency on named individuals, working-capital sufficiency. Each would need its own
fact, module field, and a clearer single-source-vs-two-source case than this session had time to
build — worth a dedicated pass, not a fourth archetype squeezed into this one.

---

## D47 — The extraction tool schema must never mark a field `required`, even one required for a usable fact base. Found by the first real Gemini call, not by a test.

**2026-09-11.** The user supplied a real `GEMINI_API_KEY` in `.env.local`. First live call (`lib/llm/client.ts`'s `generateText`) worked immediately — model answered correctly, connectivity fine. Second call (`generateStructured` with `extractionSchemaFor('company')`, against one sentence naming only the company, with an explicit system instruction: "Never invent a value for a fact not present in the text — omit the field instead") **failed the project's own first rule.** The model returned a complete `company` object: a fabricated CIN (`L00000MH0000PLC000000`), a fabricated incorporation date, `"website": "https://www.example.com"`, `"email": "info@example.com"`, a fabricated company secretary block — none of it in the source text, all of it plausible-looking.

**Root cause, found by reading `extractionSchemaFor()` against what actually happened, not by guessing.** D19's `closeObjects()` comment said input-mode JSON Schema "keeps fields that have defaults out of `required`, so the model is not forced to invent values it could not find" — true, but incomplete. `company.cin`, `dateOfIncorporation`, `isPublicLimited` and `registeredOffice` have neither `.optional()` nor `.default()` in `zCompany` — they are genuinely mandatory FOR A COMPLETE FACT BASE, which is correct for form validation, but `z.toJSONSchema` carries that same mandatoriness into the tool schema's `required` array. A strict-schema model has no legal way to produce valid JSON while omitting a `required` property, so the prompt-level "omit, don't invent" instruction was structurally unsatisfiable — the schema itself forced the fabrication, and no amount of system-prompt wording could have prevented it. `lib/facts/schema.test.ts`'s own test (`expect(schema.required).toContain('name')`) had encoded this exact assumption as correct and passing, because a mocked test never actually asked a model to fill the schema in.

**Fix:** `closeObjects()` renamed `loosenObjects()` (`lib/facts/schema/index.ts`), now strips `required` to `[]` on every object node, not only `additionalProperties`. "Required for the document" is `isUsable()`'s and the gap dashboard's job, downstream of extraction — a single extraction TURN must never be required to supply a fact its source text does not contain. The test that encoded the wrong assumption now asserts the opposite: `expect(schema.required).toEqual([])`, at every nesting level.

**Re-verified against the same live call, after the fix.** Same prompt, same sentence, same schema: the model now returns `{"name": "Vardhman Precision Components Limited"}` and nothing else — every unmentioned field genuinely omitted rather than invented. Snapshotted to `fixtures/llm-verification/company-extraction-smoke-test.json` (D14) as the before/after proof.

**What this changes about S7, going forward.** The extraction harness's system prompt ("omit, don't invent") is necessary but was NOT sufficient on its own — the schema has to agree with the prompt, not just the prompt with itself. Any future extraction schema (for AoA clause text, S7's other planned shape — see the S7 plan from earlier this session) needs the same audit: check `required` against a real call, not against what the Zod source looks like it should produce. **This is exactly the class of bug `template-extraction` and the corpus verification pass exist to catch for boilerplate text — it just turned out to apply to schema plumbing too.** The lesson the project has learned four times already for rendered documents (D26, D29, D34, and the S11 "render and look at the pages" rule) generalises: nothing that talks to a model is verified until it has actually talked to a model.

---

## D48 — A tenth archetype, and why insurance adequacy and key-person dependency generally were NOT turned into archetypes

**2026-09-11, following on from D46.** The user asked specifically to resolve two themes D46 had
flagged as spotted-but-not-built: insurance adequacy and key-person dependency. Rechecking both
against Om Galaxy, Maxwell, Century and Ideas Electricals found the same pattern in both: the
SURROUNDING paragraph in each is near-universal boilerplate ("we believe our insurance is
adequate, but cannot guarantee it"; "our success depends on our Promoters and KMP") — every SME
issuer states some version of it regardless of its own facts, which is exactly the "dividend
policy" / "no monitoring agency" problem D46 already ruled out archetypes for. Turning universal
boilerplate into a "materiality-triggered" archetype would be dishonest about what materiality
means here: it would always fire, for every issuer, carrying no information.

**But one specific, binary, genuinely-varying fact sits inside the key-person paragraph in three of
the four documents.** Om Galaxy and Century both close it with the same line: they do NOT maintain
key man insurance for their Promoters, KMP and Senior Management. Ideas Electricals' restated
financials carry an actual "Keyman Insurance" expense line — evidence a real SME issuer CAN and
does hold this cover, which is what makes it a genuine fact to ask rather than a foregone
conclusion. Added `management.hasKeyManInsurance: boolean` (default false, matching the more common
corpus pattern), a module field in M4, and `keyManInsuranceAbsent` — the tenth archetype.

**A real design question the new archetype's own test surfaced, not a bug.** Its trigger is
`!hasKeyManInsurance`, which — unlike every other archetype so far, all of which need actual array
DATA to exist before they can fire — fires on the mere unanswered DEFAULT for a completely sparse
issuer. Checked against precedent before "fixing" anything: EL-037 (tripartite depository
agreements) already fires as a BLOCKER for an unanswered issuer on exactly this same shape of
default, and it is not alone — every required boolean in this codebase is read at face value by
whatever consumes it, with the "was this actually answered" question left entirely to `isUsable()`
and the form layer, never to the rule or archetype itself. Vardhman's own current answer is `false`
(matching the more common corpus pattern), so it fires there too, honestly. The test that assumed a
sparse issuer would trigger nothing was the outdated part, not the archetype — updated to expect
this one archetype and explain why, rather than suppressing a legitimate, consistent finding to
preserve a test written before this archetype existed.

**Registry now stands at ten.** Verified: 3 new tests here, 1 pre-existing test corrected for the
reason above, `tsc` clean, 561 tests passing overall.

---

## D49 — Two more archetypes, both zero-schema-change: one reuses a computed table, one is pure presence

**2026-09-11, continuing the corpus-growth pass.** Looked for themes with two-source corroboration
that reuse something already computed, rather than something new to ask. Found two.

**`promoterMajorityControl`** — Om Galaxy #56 and Maxwell #44 both carry the same risk (Promoters
retaining majority/significant control post-Issue), both worded around "majority"/"significant
control" rather than a fixed percentage, and both leave the actual number blank in their own text
("[]%", fixed only at pricing). The 50% trigger matches their own "majority" framing, same reasoning
as `customerConcentration`'s 50% matching the seed's stated convention (D44). No new fact at all:
`shareholding()` (`lib/capital/tables.ts`, built at S5) already computes post-issue percentage per
holder from `capital.shareholders` and `offer.freshIssueShares` — the exact table Capital Structure
prints. The archetype sums `PROMOTER` + `PROMOTER_GROUP` rows from a table that already exists.

**`relatedPartyTransactionsPresent`** — three of the four documents checked (Om Galaxy #22, Century
#32, Ideas Electricals #54) carry the same structural risk factor: the company has entered into RPTs
and expects to continue to. None of the three states a percentage bar — the risk is EXISTENCE, not
size — so the trigger is presence (`groupCompanies.relatedPartyTransactions.length > 0`), matching
`exportRevenueDependency`'s "any amount, not a floor" pattern rather than the threshold pattern D44's
provisional archetypes use. `groupCompanies.relatedPartyTransactions` and
`financials.years[].relatedPartyTransactionsTotal` already existed from M10.

**A rounding-order note, not a bug, caught by the test:** `promoterMajorityControl` sums each
holder's ALREADY-ROUNDED `postIssuePercent` string (Vardhman: 28.36 + 18.91 + 7.27 = 54.54), not the
raw share counts summed then rounded once (54.545... → 54.55 by naive hand arithmetic, which is what
the test first asserted and had to be corrected against the actual output). This matches what a real
prospectus table does too — it reprints the same per-row rounded percentages a reader can foot-check
by hand, so summing the rounded values is the more defensible choice, not merely the one the code
already did.

**Registry now stands at twelve.** Promoter is now a populated category — the risk-factors category-
ordering test updated accordingly (Vardhman fires business, financial, legal, AND promoter; industry
and offer remain empty, correctly absent from the rendered headings). Verified: 8 new tests, `tsc`
clean, 566 tests passing overall.

**Still not built, and why:** auditor qualification opinions and statutory-dues compliance history
were both seen with two-source support this pass (Om Galaxy, Maxwell) but need a new fact each with
no existing computed table or M-module field to lean on, unlike this pass's two — worth a dedicated
look rather than squeezing a third new fact into this one. Geographic sales concentration (Maxwell's
Gujarat concentration) stayed single-sourced against the four documents checked so far.

---

## D50 — S9's drafting harness exists, proven against a real call, and lives beneath the risk section rather than replacing it

**2026-09-11.** Built the harness 02-architecture.md's "Drafting harness" section specified, applied
first to the smallest unit that already had everything else it needed: one risk archetype's prose.

**`lib/llm/narrative.ts`** — `draftNarrative(client, { factSlice, instructions, wordTarget })`, one
no-invention system prompt shared by every caller (a second, differently-worded prompt path is how
"never invent" quietly stops being enforced somewhere), and `untraceableNumbers()` — the mechanical
subset of the architecture doc's "20 random sentences, every one must trace" gate: every number the
draft states must appear in the factSlice's own JSON. Deliberately narrower than the full gate —
prose fabrication ("substantial", "significant") still needs a human read — but numbers are where a
wrong claim reads as confidently as a right one, and the only claim type a substring check can grade
without a model grading its own homework.

**`lib/store/narrative-store.ts`** — append-only, versioned per id, same shape as `fact-store.ts`
and the same reason (D-none stated there, but the logic is identical: "who drafted this paragraph,
and when" matters for a document carrying a signature). `renderSection()` and `risk-factors.ts`'s
`compute()` are both synchronous, so a draft cannot be generated inline at render time — it is
generated ahead of time by an explicit call and read back, present or not, the same way the template
engine reads the fact base: usable, or a gap. Tests isolate `SETU_DATA_DIR` to a temp dir, same
pattern `modules.test.ts`'s fact-store block already established — otherwise a test would read
whatever this machine has actually drafted.

**Risk Factors now reads a per-risk draft, keyed `risk.<archetype id>`, in place of the terse
`detail()` sentence when one exists** — real content where it exists, the honest computed fallback
where it does not, same shape D45 already established for the section as a whole.

**Verified against a real call**, not only fakes: drafted `customer-concentration`'s paragraph for
Vardhman from its factSlice alone (five customers, five percentages, the company name — nothing
else). Every number in the returned prose traced to the factSlice; the gate passed on the first try.
Snapshotted to `fixtures/narrative/risk.customer-concentration.json` (D14) and written into the real
`.data/narratives/` store as version 1. One stylistic wrinkle, not a factual one: asked for
consistent third person, the model still slipped into the company's own name once
("Vardhman Precision Components Limited relies heavily...") after several sentences of "our" — worth
tightening the instructions before this scales past one archetype, not worth blocking on.

**Known limitation, not yet a problem:** the draft store is keyed by archetype/section id alone, not
by issuer — correct for now (D-none: one seeded org, no real auth, per 02-architecture.md), and
would need revisiting the moment a second real issuer's drafts could collide with the first's.

**Verified:** 23 new tests across `lib/llm/`, `lib/store/`, and `lib/document/sections/`, `tsc`
clean, 578 tests passing overall. Not yet built: the same harness applied to a whole narrative
SECTION (Our Business, Industry Overview) rather than one risk's paragraph — the `promptSpec`
concept 02-architecture.md sketched for `SectionSpec` is still just this session's `NarrativeRequest`
shape, not yet wired onto `SectionSpec` itself.

---

## D51 — `promptSpec` wired onto `SectionSpec`; the first real narrative section; two real bugs a live batch run caught that no fake-client test could have

**2026-09-11, same session as D50, continuing it.** Three things happened in order, each found by
actually running the harness rather than by reasoning about it.

**1. Batch-drafted all nine risks that fire on Vardhman, and the traceability gate itself was
wrong.** Three of nine came back "GATE FAILED" — `export-revenue-dependency` (`8.40` vs the
factSlice's `8.4`), `material-contingent-liabilities` and `related-party-transactions-present`
(`1600000.` and `21000000.`, each a real number with a sentence-ending period glued onto it by a
regex that allowed a bare trailing dot). Checked the actual factSlices before touching the code:
all three numbers WERE present, correctly — the gate was wrong, not the model. Fixed
`untraceableNumbers()` in `lib/llm/narrative.ts` to parse every number to a float and compare
VALUES (so `8.40` and `8.4` match) rather than substrings, and to require a digit after a decimal
point before including it in a match at all (so a sentence-ending period is never mistaken for a
decimal one). Regression-tested both cases directly, then re-ran the full batch: all nine passed.
Also tightened the system prompt itself while here — the D50 draft had slipped from "our Company"
into the company's own name once; the prompt now says explicitly not to substitute the company's
own name for "our Company" partway through, even where the factSlice states it for identification.

**2. A real cross-issuer content leak, caught by an EXISTING test, not a new one.** Once real drafts
existed in `.data/narratives/`, `wave2.test.ts`'s "no seed text leaks into a real issuer" test
failed: rendering a fact-free sparse issuer's document produced the literal string "Vardhman",
because `keyManInsuranceAbsent` (D48) fires on almost every issuer — including a completely
fact-free one, by design — and the store was keyed by archetype id ALONE. A draft genuinely
generated for Vardhman was being served, unchanged, to a different issuer under test. D50 had
already flagged this exact risk as a "known limitation, not yet a problem" one turn earlier; it
took one real batch of drafts to turn it into an actual problem. **Fix, not a patch:**
`readNarrative(id, currentFactSlice)` now takes the CURRENT facts' factSlice as a required
parameter and returns the stored draft ONLY if it matches EXACTLY (`JSON.stringify` equality, same
comparison `fact-store.ts` already uses for change detection) — otherwise treated as no draft at
all, falling back to the honest computed sentence or placeholder. Not a per-issuer key (this app
still has no issuer identity to key by, D-none, one seeded org) — a correctness guard that needs no
identity concept at all: wrong facts, or no facts, means don't trust it, regardless of why they're
wrong. Every caller updated (`risk-factors.ts`, `renderSection`'s `narrative` case), a dedicated
regression test added reproducing the exact leak, and the pre-existing `wave2.test.ts` failure this
surfaced now passes without needing to isolate `SETU_DATA_DIR` — the guard fixes it at the source.

**3. `promptSpec` now exists on `SectionSpec` for real, and the first section drafted through it is
History and Corporate Matters (#17).** Deliberately the easiest possible first section: incorporation,
name changes, conversion to public limited, registered office — all facts M1 already collects with
no commercial judgement call left to the model, unlike Our Business or Industry Overview. `renderSection`'s
`narrative` case reads `readNarrative(spec.id, spec.promptSpec.factSlice(ctx.facts))` and, for the first
time, prints a HEADING for a narrative section (every other producer already had one; this path
never had a real section exercise it before). Drafted for real: gate passed immediately, reads as a
genuine prospectus opening. **Registry: 26 of 37 subsections.**

**Verified:** 2 real live calls (9 risks + 1 section), all passing the fixed gate; a targeted
regression test for the leak; `tsc` clean; **584 tests passing**, progress-count tests updated
25→26 the same way every prior honest increment has been.

**What this session's three-part arc says about the harness overall:** every one of D47, and now
this entry's two findings, was invisible to a test using `createFakeClient()` — a fake client
returns exactly what you tell it to, so it cannot catch a schema that forces fabrication, a checker
that misparses its own output, or a store that mixes up whose facts a paragraph came from. The
fake-client tests remain right to exist (deterministic, D14, no quota spent) — they just are not
sufficient on their own, and the project's now-established discipline (D47, D51, and the DOCX/render
lessons before them) is the same discipline every time: build it, test it against fakes, THEN run it
for real before calling anything about it verified.

---

## D52 — A thirteenth archetype needing no new fact; Our Business, the flagship narrative section, scoped to what M5 can honestly support

**2026-09-11, continuing S9/S10 straight through D51.**

**`statutoryDuesDefaultHistory`** — corroborated at three of the five corpus documents now checked
(Om Galaxy #21, Maxwell #10/#15, Photonics Watertech #16). Flagged in D49 as needing a new fact; it
did not — `legal.statutoryDuesDefaults` already exists, asked as a closing statement of the
litigation section ("null if none"), and is the same fact under a name nobody had connected back to
a risk archetype yet. Vardhman's is null, so it correctly does not fire — not every archetype needs
to fire on the demo issuer to be worth having. **Registry: 13.**

**`aboutCompany.ourBusiness`** — the flagship narrative section 02-architecture.md names alongside
Risk Factors, and the first one that is genuinely commercial description rather than a restatement
of structured facts (History is the latter). Scoped the same way History was: only the "Overview"
opening a real Our Business chapter starts with — what the company makes, where, at what scale, for
whom — not Manufacturing Process, Competitive Strengths or Strategy, none of which this fact base
has the raw material to draft honestly. `promptSpec` instructs the model explicitly not to use risk
language ("risk", "adversely affect", "cannot assure") anywhere in it — Our Business describes, Risk
Factors warns, and the same paragraph must not do both.

**The first draft caught its own real quality bug, not a fabrication one.** `business.orderBook` is
stored as a raw rupee string (`"316000000"`); the first live draft printed exactly that into a
sentence — "an order book valued at 316,000,000" — technically traceable (the gate passed) but not
how any other section in this document states money. Every other computed section formats through
`formatAs()` before a number reaches a renderer; this factSlice had skipped that and trusted the
model to reformat a number it was explicitly told never to alter. Fixed in `our-business.ts` itself
— `orderBook: formatAs(b.orderBook, 'crores')` — and re-drafted: "an order book standing at Rs 31.60
Crores." The traceability gate cannot catch a formatting problem, only a fabrication one; this one
needed a human read of the actual sentence, the same lesson S11's DOCX render caught for tables.

**Registry: 27 of 37 subsections.** Verified: 3 new risk tests, 2 real live narrative calls (one
discarded for the formatting bug, both preserved as versions 1 and 2 — append-only, never
overwritten), progress-count tests moved 26→27, `tsc` clean, 586 tests passing.

---

## D53 — A fourteenth archetype needing one new fact, corroborated at three more documents; Objects of the Issue, the third narrative section

**2026-09-11, mining the last two corpus documents (Shakti Polytarp, Axiom Gas) not yet checked.**

**`promoterPersonalGuarantees`** — corroborated at three documents (Om Galaxy #26, Photonics
Watertech #17, Shakti Polytarp #35). `financials.borrowings[].security` already carried this fact
as free text where it applied — Vardhman's own two guaranteed facilities already stated it in full
sentences ("personal guarantees of Rajesh Vardhman and Sunita Vardhman") before this session ever
started. Added `personalGuaranteeByPromoter: boolean` to `zBorrowing`, a repeater column in M6, and
the archetype. Fires on Vardhman for exactly the two facilities whose `security` text already said
so — the fixture catching up to its own prose, same shape as D46's Arvind Joshi finding. **Registry:
14.** Also found, corroborated at 2 documents now (Maxwell's Gujarat concentration, Shakti's Madhya
Pradesh concentration) but not built: single-state revenue concentration, which would need a new
`business` fact this session did not have time to design well — noted for the next corpus pass.

**`particulars.objectsOfTheIssue`** — the third narrative section, and the first genuinely mixed
"N + C" one (02-architecture.md's own label for it): the computed half (means-of-finance tables, the
GCP cap check against R-010, a deployment schedule) is not built here, only the narrative opening
every corpus document's chapter starts with — naming each object and its earmarked amount before
the tables. `offer.objects` already carries description, amount and the GCP/project flags per
object; nothing here is invented, the model is describing a structure that already exists. Learned
from D52's order-book bug and pre-formatted every amount through `formatAs()` in the factSlice
itself, so the first draft did not need a second pass this time — gate passed immediately, and the
money reads as "Rs 12.00 Crores," not a raw rupee integer.

**Registry: 28 of 37 subsections.** One more test fixed along the way: `rules.test.ts`'s "leaves a
section not drafted yet as a plain label" test had been exercising exactly the title Objects of the
Issue now resolves for real — swapped to a section still genuinely unbuilt (Industry Overview),
same reasoning as every prior progress-count correction: the test's job is to prove the behavior,
not to freeze a section in "not built" for its own convenience. Verified: 3 new risk tests, 1 real
live narrative call (passed on the first attempt), `tsc` clean, 589 tests passing overall.

---

## D54 — A fifteenth archetype (a new fact this time, but a small one); MD&A, and the seed getting more realistic on purpose

**2026-09-11, mining the last two corpus documents (Shakti Polytarp, Axiom Gas).**

**`geographicRevenueConcentration`** — corroborated at three documents once Axiom Gas's own numbered
list was checked: Maxwell's Gujarat exposure, Shakti Polytarp's Madhya Pradesh exposure ("majority
of our revenues"), Axiom Gas's Karnataka/Telangana/Maharashtra cluster. Unlike every archetype since
D46, this one genuinely needed a NEW fact with no existing table or field to lean on —
`business.primaryMarketDescription` and `business.primaryMarketRevenueSharePercent`, added as two
FLAT fields rather than the nested object first drafted, because the module engine's `Field` type
has no object kind, only scalars and tables (caught before it shipped, not after). Both optional,
not default-false, since unlike export share this concentration may genuinely not apply to a
diversified issuer at all.

**Vardhman got more realistic, not just more complete.** The new fields broke S8's "nine modules
complete" gate — Vardhman had never answered a question that did not exist an hour earlier. Rather
than leave the field blank (which the helpText explicitly allows: "leave blank if diversified"),
added `primaryMarketDescription: 'the State of Maharashtra'` at 64.5%, grounded in something true
about the fixture's own facility, not merely convenient: Chakan sits in the same auto cluster as
several of Vardhman's own principal customers' plants (Tata Motors, Bajaj, Mahindra all have
Maharashtra operations), so a Maharashtra-heavy revenue base follows from data the seed already
had. Same reasoning as D46's Arvind Joshi finding — the fixture catching up to what was already
implied by its own facts, not a new invented number dropped in to make a test pass.

**`financial.mdna`** — the fourth narrative section, and the first with genuinely computed content
in its factSlice: year-on-year revenue and profit-after-tax growth, computed with `Decimal` before
the model ever sees the prompt (same discipline `derivedTerms()` already follows — never let the
model do arithmetic that a wrong answer would read as confidently as a right one). **The first
draft failed the gate for a reason worth keeping**: asked to discuss "Fiscal 2026", the model wrote
"the financial year ended March 31, 2026" — correct, universally-true knowledge about Indian fiscal
years, and still untraceable, since the factSlice only ever stated the bare year `2026`. Not fixed
by loosening the gate (a wrong calendar date would look exactly as confident as this correct one,
and the gate cannot tell them apart) — fixed by instructing the model to use "Fiscal 2026" instead,
matching what the corpus itself actually calls these years throughout. Re-drafted: passed
immediately.

**Registry: 29 of 37 subsections.** Verified: 6 new/updated risk tests, 2 real live narrative calls
(one instruction fix in between, both preserved as separate concerns — schema shape caught before
shipping, prompt wording caught by the gate), progress-count tests moved 28→29, `tsc` clean, 593
tests passing overall.

**S9/S10 status after five archetype passes and four narrative sections:** 15 archetypes toward the
~40 target, all seven corpus documents mined at least once. Remaining plannable narrative work
(`particulars.basisForIssuePrice`, `aboutCompany.industryOverview`) needs data this fact base does
not carry yet (peer comparables, a commissioned industry report) — the next three narrative
sections need new intake, not just new prompts.

---

## D55 — Render and look caught a systemic bug five archetypes had been carrying since before D52's lesson existed

**2026-09-11.** Generated Vardhman's real DOCX (`SETU_DOCX_OUT`), converted to PDF via LibreOffice,
rasterised with pypdfium2 in a scratchpad venv, and read the actual pages — S11's rule, applied to
S9/S10 output for the first time. It caught exactly what it is supposed to catch.

**Five archetypes were printing raw rupee integers**, in both their computed `detail()` fallback
AND the `factSlice` fed to the model: `highLeverage`, `materialContingentLiabilities`,
`materialLitigationAgainstCompany`, `relatedPartyTransactionsPresent`, `promoterPersonalGuarantees`.
All five predate D52 (built in D44/D46/D48/D49/D53), before that session's Our Business draft
surfaced the same class of bug and the lesson was learned — nobody had gone back and retrofitted
the earlier archetypes. On the page: "the aggregate value of these related party transactions
stands at **21000000**," and worse, a materiality threshold rendered as
`1208333.3333333333333333334` — `materialityThreshold()`'s own `.toFixed()` with no argument,
returning full Decimal precision as if it were display text. The traceability gate could not have
caught any of this — every one of these numbers WAS in the factSlice, verbatim; correctly traced,
badly presented.

**Fixed at the source, not patched in the LLM prompt.** Every affected `detail()` and `factSlice()`
now runs its money through `formatAs()` — lakhs for threshold- and litigation-scale figures
(matching the corpus's own convention for these, and the litigation section's own existing
`formatAs(l.amount, 'lakhs')`), crores for balance-sheet-scale figures (borrowings, net worth,
guarantee aggregates), matching D52's `our-business.ts` fix exactly. `highLeverage` also gained a
pre-computed `debtToEquityRatio` in its factSlice, so the model states a ratio rather than being
asked to infer one from two raw figures — same "never let the model do the arithmetic" discipline
as D54's MD&A growth percentages.

**Re-drafted all eleven risks now firing on Vardhman** (nine plus D53/D54's two, which had never
had a narrative pass at all) through the fixed pipeline — traceability gate passed on all eleven,
no manual retries needed. Re-rendered the DOCX and re-read the same pages: every figure now prints
correctly — "Rs 210.00 Lakhs," "Rs 12.08 Lakhs," "Rs 4.20 Crores" — and the corrected debt-guarantee
paragraph reads BETTER than the original template, breaking the two guaranteed facilities out by
name rather than only stating an aggregate.

**Verified:** one test corrected for the new (correct) format, `tsc` clean, 593 tests passing, and —
for the first time this session — actual rendered pages read start to finish rather than only
tested at the node level. **The check that started this pass (D55) is now itself the reason to
repeat it before the next batch of archetypes ships**: nothing that produces money for a document
is verified until someone has looked at the page it lands on.

---

## D56 — S7 opened: Supabase Storage, a two-pass extraction pipeline, and a real upload-through-confirm proof

**2026-09-12.** The third leg of S7/S9/S10, untouched all last session, now has a working first
slice: upload a document, extract one domain's facts, review and confirm before anything reaches
the fact base. Two infrastructure choices were the user's to make up front — Supabase Storage over
local files (CLAUDE.md's original plan, now acted on) and a pure-JS PDF library (`unpdf`, a modern,
serverless-safe, zero-native-dependency alternative to the unmaintained `pdf-parse`) over shelling
out to `pdftotext` the way the corpus work did all last session.

**A real credential mix-up, caught before it caused a silent failure.** Supabase is retiring
`anon`/`service_role` in favour of `sb_publishable_...` and `sb_secret_...` keys through 2026. The
user's first paste was the publishable key in a service-role-shaped variable — would not have
errored at read time, only at the first RLS-guarded write, or worse, under-permissioned silently.
Caught by checking the key prefix before wiring it in. Once corrected, `document-storage.ts` was
written to read `SUPABASE_URL` / `SUPABASE_SECRET_KEY` — the exact names the Supabase dashboard's
own "Connect" panel exports — rather than inventing project-specific variable names a fresh
copy-paste would never match.

**`ensureDocumentsBucket()`** provisions the private bucket idempotently rather than asking for a
manual dashboard click — the secret key already has the rights to do it, and there is no reason to
make a human do by hand what one function call does safely and repeatably.

**The pipeline, each piece interface-first and fake-testable the same way `LlmClient` is:**
- `lib/document-intake/pdf-text.ts` — `pdfPageTexts()`, one string per page via `unpdf`.
- `lib/document-intake/page-targeting.ts` — keyword-based two-pass targeting per domain (the
  architecture doc's "~4x" cost lever), deliberately approximate for a first pass, same posture as
  D44's first six risk archetypes — real headings can replace guessed ones as documents get run
  through it.
- `lib/llm/extraction.ts` — `extractFacts()`, the same harness shape as `narrative.ts`: one shared
  no-invention system prompt, this time naming the specific fields a model reaches for under schema
  pressure (a CIN, a date, a website — D47's exact list) so the lesson does not have to be
  relearned per caller.
- `lib/store/document-storage.ts` — `DocumentStorage` interface, Supabase-backed and fake
  implementations, `remove()` added after using it in anger to clean up test uploads.
- `lib/store/fact-store.ts` — `writeFacts()` gained an optional `provenanceFor` override (default
  unchanged: `userProvenance`), the one change needed for extraction to write
  `extractedProvenance(documentId, page)` with `confirmed: false` instead. `isUsable()` already
  refused to render an unconfirmed extracted fact before this session touched anything — the
  review-and-confirm mental model (#4) was already fully designed, just never had a caller.

**`app/extract/`** — the first real UI for this, deliberately the plainest version that is still
honest: a domain picker, a file input, then one checkbox per TOP-LEVEL extracted field (not
per-nested-value) with the targeted page numbers shown as "look here," not a rendered page image
beside each value. Confirming writes only the checked fields. A real gap, named rather than hidden:
this is not yet review-against-a-rendered-source-page: `ref.page` is approximated as the first
targeted page, since the model returns one object per domain, not one page number per field, and
asking it for one would be one more thing it could invent.

**A real Next.js gotcha, not a logic bug:** a `'use server'` file may export ONLY async functions.
`DOMAINS`, a plain constant, was originally in `actions.ts` alongside the server actions — Next.js's
client/server transform does not reject this at build time, it silently replaces the export with
something that is not the array it looks like, surfacing as `DOMAINS.map is not a function` on the
client with no clue where the real problem was. Fixed by moving `DOMAINS` to its own plain module
(`app/extract/domains.ts`) that both the actions and the page import.

**Verified twice, at two different scales, both for real:**
1. A script-level run against an actual corpus document (Om Galaxy, 509 pages) — two-pass targeting
   correctly narrowed to 109 of 509 pages for "company," and the extraction correctly pulled the
   real CIN, two name changes with dates, and the registered office, leaving `nameChanges[0].reason`
   out entirely rather than guessing one, since the source did not state it.
2. **The actual UI, end to end**, including a real Supabase upload — browser automation cannot drive
   a native file picker, so a minimal synthetic PDF was constructed in-page and injected via
   `DataTransfer` (a legitimate technique, not a workaround for something broken) to exercise
   upload → storage → `pdfPageTexts` → targeting → a real Gemini call → the review UI → confirm →
   `writeFacts`. Caught the `DOMAINS` bug this way, on the first attempt.

**A real mistake made and reversed, in keeping with the project's own append-only rule.** The UI
proof's "Confirm" step wrote synthetic test data into the REAL persisted fact base
(`.data/`, version 16) — the same class of incident the gotchas doc already warned about ("anything
typed into it during verification must be taken back out, as a new version"). Reverted immediately
as version 17, `company.name`/`cin`/`registeredOffice` restored to their pre-test (absent) state.
The synthetic-PDF's fixture snapshot and its Supabase upload were removed too; the real Om Galaxy
extraction fixture was kept.

**Verified overall:** 12 new tests (page-targeting, the extraction harness, document storage
including the real credential-shape and path-join fixes), `tsc` clean, 609 tests passing.

**Not yet built:** an upload/review UI wired into the actual module pages (currently a standalone
`/extract` route, not reachable from `/intake`); per-field source pages, rather than one page number
for the whole domain; a way to re-run extraction against a previously uploaded document without
re-uploading it (the storage layer already supports `list()`/`download()` for this, nothing calls
them yet); nested-field review (an object like `registeredOffice` is confirmed as a whole, not
field by field within it).

---

## D57 — A sixteenth archetype, the strongest corpus corroboration since the initial six

**2026-09-12, resuming S9/S10** (D56's S7 work from the prior session was left uncommitted and
untouched — this pass is purely S9/S10, per the user's explicit ask).

**`unsecuredLoansRepayableOnDemand`** — corroborated at FOUR of the seven corpus documents, the
strongest support any archetype has had since D44's original six: Axiom Gas #8 ("Unsecured loans
taken by us can be recalled by the lenders thereof at any time... these unsecured loans are
repayable on demand"), Photonics Watertech #38 ("Our Company has availed unsecured loans which are
repayable on demand"), Shakti Polytarp #23 (same), Century Business Media #40 (same). All four state
it as its own standalone numbered risk factor, not folded into a broader liquidity risk — the
clearest possible signal that this belongs in the registry, and a theme the session-handoff had
already flagged as "seen, not yet built" back in D-none (the S9/S10 "Not yet built" note carried
across several session handoffs).

**Zero schema change, again.** `financials.borrowings[].category` already distinguishes
`UNSECURED_LOAN_FROM_DIRECTORS` and `UNSECURED_LOAN_OTHER` from every secured facility — added at
S8, long before this archetype existed to read it. Vardhman's own director loan (Rajesh Vardhman,
Rs 1.50 Cr, "Repayable on demand") already stated this exact fact in the seed before this session
touched anything — the same "the fixture was already catching up to its own facts" shape as D46's
Arvind Joshi finding and D53's personal-guarantee archetype it sits beside in the Financial category.

**One design correction caught by the test, not by review.** The first draft of `materiality` summed
`outstanding` in raw rupees (a `Decimal`, `.toNumber()`) — correct arithmetic, wrong scale. Every
other archetype's materiality is a percentage, a ratio, or a small count (`promoterPersonalGuarantees`
uses `.length`), so a raw rupee figure in the tens of millions would always sort above every
percentage-based risk regardless of actual severity — a claim this archetype does not make. Fixed by
dividing by `1e7` to express materiality in crores, matching the scale `detail()` and `factSlice()`
already format to.

**D55's lesson applied from the start, not retrofitted.** Every money figure in `detail()` and
`factSlice()` goes through `formatAs(..., 'crores')` from the first commit — no raw-rupee-integer bug
to catch this time, because the discipline is now habitual rather than something a render-and-look
pass has to surface after the fact.

**Registry: 16.** Drafted for real through the S9 harness: gate passed on the first attempt ("We have
outstanding unsecured borrowings aggregating to Rs 1.50 Crores from a director, Rajesh Vardhman,
which are repayable on demand..."), snapshotted to
`fixtures/narrative/risk.unsecured-loans-repayable-on-demand.json`, written into `.data/narratives/`
as version 1. **Rendered and read** (D55's standing rule, applied again before calling this done):
regenerated the Vardhman DOCX, converted via LibreOffice, rasterised with pypdfium2, read page 21 —
the paragraph prints correctly under "Risks Relating to Our Financial Condition," properly formatted,
correctly ordered by materiality below the higher-ratio financial risks above it.

**Verified:** 4 new tests (`lib/risk/archetypes.test.ts`, 51 total in the risk suite), `tsc` clean,
**613 tests passing overall.**

**Still not built, and why:** auditor qualification opinions were checked again this pass — Ideas
Electricals carries a genuine, detailed audit-qualification table, but no second document in the
corpus states an equivalent qualification (Om Galaxy and Maxwell's "Emphasis of Matter" mentions
flagged in earlier sessions turned out, on this re-check, to be near-universal "material uncertainty
related to going concern is not applicable" boilerplate, not a qualification) — single-sourced, so it
does not ship (D30's standing rule). Single-state revenue concentration and statutory-dues history are
both already built (D52, D54); the remaining corpus themes not yet turned into archetypes are the ones
already named in D46/D49 as needing a new fact this session did not have reason to add one for.

---

## D58 — Dismiss-with-reason, logged: the S10 gate item that had no code behind it at all

**2026-09-12, same session as D57.** TODO.md's S10 checklist has carried "Dismiss-with-reason, logged"
since before this stage opened, and a repo-wide search for `dismiss` found nothing in `lib/risk/` or
anywhere else — unlike every other gap identified this pass, this one had zero code, not a partial
version needing extension.

**The design question this raised, and how it was settled.** A triggered archetype is a machine
SELECTION, not a certified disclosure (D45's own framing) — the reviewing merchant banker may
determine a flagged risk is a false positive for this specific issuer and want it out of the printed
document. Two shapes were possible: (a) keep the risk printed but annotate it as "reviewed, excluded"
inline, or (b) drop it from the print entirely and keep the reasoning only in a review record. **(b)
is what a real prospectus actually does** — a document only ever carries the risks the banker stands
behind, never a visible trail of what a screening tool once flagged and someone later waved off. So a
dismissed risk vanishes from the rendered Risk Factors section completely, the same as if it had never
fired — but MM4's "never invent" cuts the other way here too: a silent removal with no trace anywhere
would be exactly the kind of undisclosed omission the project exists to prevent. The intro paragraph's
existing MACHINE-GENERATED note now states the count excluded and points to where the reasoning lives,
so the omission is never invisible, only not printed as investor-facing prose.

**What was built, following existing conventions exactly rather than inventing new ones:**
- `lib/store/risk-dismissal-store.ts` — append-only, versioned per archetype id, same shape as
  `narrative-store.ts` for the same reason ("who excluded this, and why, and when" matters for a
  document carrying a signature). A reinstatement (`dismissed: false`) is a new version, never a
  delete — a reversal is itself a logged event.
- `risk-factors.ts`'s `compute()` filters `selectRisks()`'s output through `readDismissal()` before
  grouping by category, and the intro note gains one sentence when the excluded count is above zero.
  Zero new fields on `RiskArchetype` itself — dismissal is a property of the SELECTION step, not the
  archetype definition.
- `app/review/risks/` — a page listing every archetype that fires for the current issuer (dismissed or
  not, since reviewing a false positive is exactly the workflow the printed document cannot host),
  `actions.ts` with `setRiskDismissal()` (`'use server'`, same shape as `app/intake/actions.ts`'s
  `saveField`), and `components/risk-dismissal-card.tsx` (`'use client'`, `useTransition`, matching
  `module-form.tsx`'s pattern) for the reason textarea and the exclude/reinstate toggle. A reason is
  required to dismiss — enforced server-side, not just in the UI — but not to reinstate, since undoing
  a mistake needs no justification the way making one does.

**No real auth (D8), so `dismissedBy` is the fixed string `'merchant-banker'`** — the same posture
`writeFacts` already takes with `'issuer'`. Revisit once S12's role switcher exists.

**Verified twice.** Unit tests first (5 for the store, 4 for the filtering behavior in
`risk-factors.test.ts`), then the real thing in the browser against the actual `.data/` store (not a
fixture) — the current real issuer is the post-D56-cleanup empty one (fact-base version 17, not the
Vardhman seed), so only `key-man-insurance-absent` fires there. Dismissing it with no reason correctly
refused server-side; dismissing it with one correctly removed it from the home page's rendered Risk
Factors section and added "1 additional risk was auto-flagged and subsequently reviewed and
excluded..." to the intro note; reinstating it correctly restored the original render. **Reinstated
before ending the session**, same "verification leaves no residue in real data" discipline D56's own
gotcha states — the store now holds a two-version audit trail (dismissed, then reinstated) rather than
a clean zero, which is the correct and honest record of what actually happened during this check, not
an artifact to scrub.

**Verified overall:** 9 new tests, `tsc` clean, **622 tests passing overall.** Re-rendered the Vardhman
DOCX afterward (D55's standing rule) — unaffected, since the Vardhman fixture's dismissal store (via
`SETU_DATA_DIR`-isolated test runs) holds no dismissals; confirms the feature is additive and does not
regress the existing render.

**Still not built:** the "why this was flagged" UI element the TODO also names (rule/threshold/source
module/materiality rank) was deliberately NOT attempted this session. `RiskArchetype` carries no
structured citation field — only `lib/risk/archetypes.ts`'s own prose comments state which corpus
documents ground each one — and fabricating a uniform "threshold" or "rule" field across sixteen
archetypes that don't all have one (a count-based archetype like `singleManufacturingFacility` has no
threshold at all) would be inventing structure the project's own discipline argues against. Doing this
properly needs a real design pass on what `RiskArchetype` should carry, not a quick UI addition.

---

## D59 — "Why this was flagged," built without fabricating a citation that doesn't exist

**2026-09-12, same session as D57/D58.** D58 explicitly deferred this rather than bolt on a shallow
version. The design pass promised there: what can `RiskArchetype` honestly carry, given a risk factor
is a disclosure judgement, not a SEBI clause — there is no `Rule.clause` equivalent to reuse.

**Two fields added, both already true today, neither invented for the occasion:**
- **`groundedIn: string`** — the corpus corroboration every archetype's file comment already states in
  prose (D44 onward: which documents, which numbered risk factors, what wording). Promoted to a real
  field rather than left as a comment a human has to go read. Every one of the sixteen archetypes'
  existing comment was the source text — nothing paraphrased into a stronger claim than the comment
  already made, and the two PROVISIONAL archetypes (`supplierConcentration`, `highLeverage`) keep
  saying so in the field itself, not just the comment.
- **`sourceModules: string[]`** — which M-module(s) the trigger/factSlice actually read, mapped by
  hand against each archetype's own fact-path references (e.g. `customerConcentration` reads
  `business.topCustomers` → `M5`; `promoterMajorityControl` reads `capital.shareholders` AND
  `offer.freshIssueShares` → `M2` and `M9`). This is the "where to fix" a rule's `Finding.fix.module`
  already gives, extended to risks — a reviewer questioning why something fired now knows where to go
  verify or correct the underlying fact.

**Deliberately NOT added:** a "rule" or "threshold" field. Half the registry has no single clean
threshold (a count-based archetype like `singleManufacturingFacility`, a presence-based one like
`relatedPartyTransactionsPresent`) — forcing one would mean writing a fabricated number into a field
whose whole purpose is citation discipline. `groundedIn`'s free text already carries whatever
threshold DOES exist, in the same prose form the corpus itself uses.

**Materiality rank is computed, not stored.** `selectRisks()` now resolves `TriggeredRisk.materialityRank`
(1-based, matching the sort order) after sorting the fired set — a property of the SELECTION, not the
archetype, so it can never drift from the actual order shown.

**Kept strictly off the printed document.** `risk-factors.ts`'s `compute()` is unchanged by this
entry — it never reads `groundedIn`, `sourceModules` or `materialityRank`. These live only on
`/review/risks` (`components/risk-dismissal-card.tsx`'s new `WhyFlagged` disclosure, mirroring
`module-form.tsx`'s "Why we ask" pattern), because an investor reads a disclosure and a reviewer reads
why a screening tool raised it — conflating the two would put internal tooling language into an offer
document. Verified directly: fetched the rendered home page's HTML and confirmed none of
"Why this was flagged", "Materiality rank" or "Grounded in:" appear in it.

**Verified:** 3 new tests (every archetype has non-empty grounding and at least one well-formed module
id; `selectRisks` assigns rank correctly; the fields survive onto `TriggeredRisk`) — **625 tests
passing overall**, `tsc` clean. Exercised live in the browser: opened the disclosure on the one risk
firing against the current (still mostly-empty, post-D56) real issuer, read back the exact grounding
text, the resolved module title ("M4 · Board and Management", resolved via `findModule` rather than a
second hardcoded map), and "1 of 1" for materiality rank. Re-rendered the Vardhman DOCX afterward
(D55's standing rule) — exactly one match for the risk's own title text, zero leakage of the new
review-only fields.

---

## D60 — A seventeenth archetype, and the first with a genuinely negative underlying figure — which surfaced a new class of the D55 bug on the first live draft

**2026-09-12, same session.** Mining the corpus for un-covered themes, "negative cash flow from
operating activities" appeared as a numbered risk factor in FOUR documents by heading alone — but D26's
own lesson (a matching title is not evidence the underlying trigger matches) turned out to matter here
immediately.

**Century Business Media carries the identical risk-factor title but does not belong.** Its own cash
flow table shows operating activities POSITIVE in all three reported years (605.02 / 540.49 / 15.83
Lakhs) — only its investing activities are consistently negative, the ordinary signature of a capex-
funding growth company, not a liquidity risk. Checked before counting it, not after: **excluded**, the
same discipline that caught Century's apparent withdrawal-rights contradiction (D26) and the
independent-director carve-out dispute (D24). The three that DO belong all show a genuinely negative
figure: Ideas Electricals #18 (Rs -1,158.16 Lakhs in FY2026, after two positive years), Photonics
Watertech #27 (Rs -302.84 Lakhs for the nine-month stub to December 2025, Rs -53.48 Lakhs in FY2023),
Shakti Polytarp #7 (Rs -1,078.51 Lakhs in FY2025, Rs -205.12 Lakhs in FY2024, recovering to positive in
FY2026).

**Zero schema change** — `financials.years[].cashFlowFromOperations` already existed (S8, Other
Financial Information). Vardhman's three years are all positive, so `negativeOperatingCashFlowHistory`
correctly does not fire on the seed, same precedent as `statutoryDuesDefaultHistory` (D52): not every
archetype needs to fire on the demo issuer to justify existing.

**A new class of the D55 bug, caught on the FIRST live draft, before it ever reached a real document.**
Every archetype so far has an intrinsically positive underlying figure — D55 fixed *scale* (raw
integers vs. `formatAs()`), never *sign*. Feeding `formatAs()` a negative money string directly prints
"Rs -315.00 Lakhs", technically correct and traceable, but not how any corpus document phrases a
negative Rupee figure (never a bare minus sign — Ideas Electricals prints "(1,158.16)" in parentheses,
the standard accounting convention, and the prose around it always states "negative" in words rather
than relying on the sign to carry it). A synthetic variant run through the real drafting harness
(one bad year spliced into Vardhman's own three, "Rs -3.15 Cr" replacing "Rs 5.20 Cr") reproduced it
immediately: the model copied `factSlice`'s signed string verbatim into "amounting to Rs -315.00
Lakhs." Fixed the same way D52/D55 fixed scale — at the source, not the prompt: `factSlice()` now
carries the ABSOLUTE value, formatted, with a `negative: boolean` doing all the sign-carrying work;
`detail()` was already doing this correctly (written that way from the first draft of the archetype,
this session's actual habit-forming payoff from D55). Re-drafted with instructions naming the
convention explicitly ("never print a minus sign on a Rupee amount") — passed cleanly: "we recorded a
negative cash flow of Rs 315.00 Lakhs."

**Verified:** 4 new tests (58 total in `lib/risk/`), a real live Gemini call against a synthetic
variant (not a fixture — this archetype needed one since it never fires on Vardhman, so there is no
real factSlice to draft from otherwise) confirming the sign fix, `tsc` clean, **629 tests passing
overall.** Re-rendered the Vardhman DOCX (D55's standing rule) — zero occurrences of the new risk's
text, correctly, since it does not fire on the seed.

**Registry: 17.**

---

## D61 - An eighteenth archetype (litigation against Promoters), and a grammar bug caught by reading a real draft out loud

**2026-09-12, same session.** `materialLitigationAgainstCompany` already existed; the corpus also
corroborates the same test applied to litigation against Promoters personally, at Om Galaxy #27
("outstanding legal proceedings against our Company, Promoters, Directors") and Ideas Electricals #17
("adverse legal proceedings initiated against our company or its promoters, directors and KMP's").
Zero schema change - `legal.litigation[].party` already distinguishes `PROMOTER` from `COMPANY` (S8).
Built as a direct sibling: same materiality threshold, same structure, `category: 'promoter'` instead
of `'financial'`, filtered to `party: 'PROMOTER'`.

**Does not fire on Vardhman** (no litigation against a promoter on file) - verified instead with a real
Gemini call against a synthetic variant, same method as D60.

**A real grammar bug, caught only by reading the live draft, not by any test.** The computed sentence
read "1 legal proceeding ... totalling Rs 12.08 Lakhs, **meet** or exceed our litigation materiality
threshold" - a subject-verb disagreement, present in `materialLitigationAgainstCompany` since D44 and
copied verbatim into the new sibling. No test caught it because no test asserts on grammatical number,
only substring presence. Fixed in both archetypes with a `singular` flag: "meets or exceeds" for one
proceeding, "meet or exceed" for more than one. Confirmed the fix does not currently change the
rendered Vardhman DOCX - the Company-side risk already reads from a stored LLM draft written in an
earlier session (D51), not the computed fallback, so the bug was never visible in the actual document.
Still correctly fixed for: a fresh render before any draft exists, the new Promoter-side sibling (which
has no draft yet), and the fallback path generally, should a fact change ever invalidate a stored draft.

**Verified:** 4 new tests (62 total in `lib/risk/`), `tsc` clean, **633 tests passing overall**. Live
Gemini call against a synthetic Rajesh-Vardhman-personal-litigation variant: gate passed, and the
computed fallback now reads grammatically ("meets or exceeds"). Re-rendered the Vardhman DOCX - the
Company-side section is unaffected (drafted narrative, not the fallback); the Promoter-side risk
correctly does not appear (does not fire on the seed).

**Registry: 18.**

---

## D62 - A nineteenth archetype (trademark not registered), and telling apart a specific fact from its boilerplate neighbour

**2026-09-12, same session.** Mining the corpus for the "statutory approvals" risk chapter turned up
two adjacent but very different things. The first, "we require various statutory and regulatory
approvals and any failure to obtain or renew them may adversely affect us," reads as near-universal
boilerplate every SME states almost identically regardless of its own facts - the same shape D48 ruled
insurance-adequacy and key-person-dependency OUT for. The second, sitting right next to it in three
documents, is a specific, binary, genuinely-varying fact: whether the Company's OWN logo or trademark
is registered. Om Galaxy #20 ("The logo used by our Company is not registered under the Trade Marks
Act, 1999"), Century #10 (same, "is not registered as on date"), Photonics Watertech #42 (identical
wording). Built the second, not the first - matching D48's exact reasoning.

**Zero schema change** - `approvals.licences[].category` already has `INTELLECTUAL_PROPERTY` and
`.status` already distinguishes `OBTAINED` from `APPLIED`/`RENEWAL_APPLIED` (S8). Vardhman's own
trademark application ("VARDHMAN PRECISION" device mark, Class 12) was already on file at `APPLIED` -
the fixture catching up to its own facts again, same shape as D46 and D53.

**Fires for real on Vardhman**, so this one got a genuine live draft rather than a synthetic variant.
First attempt echoed the raw status code awkwardly ("which currently holds the status of applied") -
not wrong, not ungrounded, just clumsy prose. Not a gate failure (the traceability gate passed on the
first attempt too), a quality read the same way D50's "slipped into the company's own name" wrinkle
was - refined the instructions to say "our application is pending" instead of surfacing the schema's
own status vocabulary, redrafted, kept both versions (append-only, version 1 then version 2).

**Verified:** 5 new tests (67 total in `lib/risk/`), `tsc` clean, **638 tests passing overall**. Real
Gemini draft, gate passed, re-rendered the Vardhman DOCX and read the actual page: the risk prints
correctly under "Risks Relating to Our Business and Operations," and the Forward Looking Statements
summary sentence picked it up automatically through the existing `riskFactorsOverlay()` mechanism
(D45) with no extra work needed.

**Registry: 19.**

---

## D63 - A twentieth archetype (trade receivables concentration), the first new fact added this session

**2026-09-12, same session.** Corroborated at two documents, both with real quantified figures: Ideas
Electricals #44 (trade receivables at 19.54% / 24.85% / 10.53% of revenue across three years) and
Photonics Watertech #6 (51.01% of total current assets, plus 183 receivable days). The two state the
percentage against DIFFERENT bases - revenue versus total current assets - and this fact base has no
"total current assets" figure to lean on. Followed Ideas Electricals' convention (against revenue, the
base every other percentage-of-revenue archetype already uses) rather than averaging two conventions
into a third invented one - the same reasoning D25 and D54 both used when sources differ on where a
line sits.

**The first NEW fact this session** (D57 through D62 all reused existing ones):
`financials.years[].tradeReceivables`, mirroring the `tradePayables` field already on the same year
record - same shape, same module (M6), same "at year end" convention. Along the way, corrected a
pre-existing gap: `financials.years`' `feedsInto` never listed `general.riskFactors`, even though
`highLeverage`, `materialContingentLiabilities` and `negativeOperatingCashFlowHistory` already read
from it - fixed, since it is now directly relevant to what this session added.

**Flagged PROVISIONAL, honestly** - a 15% threshold near the low end of Ideas Electricals' own
disclosed range, not independently settled the way `customerConcentration`'s 50% is (grounded in the
Vardhman seed's own comment). Same honesty level as `supplierConcentration` and `highLeverage`: two
sources support the THEME, not yet a settled bar.

**Fires for real on Vardhman** (added trade receivables to the seed at ~19% of revenue across all three
years, a realistic addition consistent with a manufacturing SME extending normal trade credit) - real
Gemini draft, gate passed on the first attempt. Rendered and read the actual DOCX page: prints correctly
under "Risks Relating to Our Financial Condition," and the Forward Looking Statements summary sentence
picked it up automatically (D45's existing overlay).

**Verified:** 4 new tests (71 total in `lib/risk/`), `tsc` clean, **642 tests passing overall**.

**Registry: 20.**

---

## D64 - S9 closes its fifth section: Basis for Issue Price, unblocked by one real new question

**2026-09-12, same session, at the user's explicit direction to finish S9.** D54 flagged
`particulars.basisForIssuePrice` and `aboutCompany.industryOverview` as blocked on data the fact base
did not carry. Checked what was ACTUALLY missing rather than assuming both needed the same fix: the
issuer's own EPS, RoNW and NAV were already computed (`lib/financials/ratios.ts`, S8's Other Financial
Information) - the genuinely missing half was the PEER side, "Comparison with Listed Industry Peers,"
which cannot be derived from the issuer's own facts under any circumstance.

**One new fact, `offer.industryPeers[]`** (`zIndustryPeer`: name, faceValue, basicEps, peRatio,
returnOnNetWorthPercent, netAssetValuePerShare), one new M9 field with a real repeater. Vardhman seeded
with two FICTIONAL peer companies (Precitech Forgings Limited, Chakan Auto Components Limited) - never
a real, identifiable listed company with invented financials attached to its name, same discipline the
whole seed already follows.

**Built as `producer: 'computed'`, not `'narrative'`** - same shape `risk-factors.ts` established
(D50): a manually-invoked `readNarrative()` inside `compute()` supplies the opening paragraph (drafted
or the honest fallback), and everything after it - the accounting-ratio table, the P/E computation at
the floor and cap price, the peer comparison table with the issuer's own computed row appended - is
pure TS. Deliberately did NOT draft "qualitative factors" as prose: a real prospectus's qualitative
factors are the issuer's own claimed strengths, which this fact base has no honest way to state without
inventing one, so the section points to "Our Business" and "Risk Factors" instead, matching the
restraint those sections already established (D51).

**A real bug the tests caught, not review**: `otherFinancialInformation()` returns `null` when there is
no allotment history, but an EMPTY ARRAY when allotments exist and simply no financial year is on file
yet - the section's original `if (!ratios)` guard missed the second case, `[]` being truthy in JS, and
crashed on `ratios[0].basicEps`. A dedicated test for "no financial year on file" caught it before it
ever reached a real render.

**Verified:** drafted for real through the S9 harness (gate passed first attempt, deliberately
instructed to state no figures in the opening paragraph itself, since the tables immediately following
state every figure precisely); 10 new tests; rendered the actual DOCX page and read it - both tables
correctly formatted despite `pdftotext -layout` garbling the narrow P/E table into nonsense text (a
false alarm caught by looking at the actual rendered page, not the extracted text - the exact D34/S11
lesson, again). **Registry: 30 of 37 subsections.**

---

## D65 - S9 closes its sixth section: Industry Overview, deliberately left permanently incomplete

**2026-09-12, same session, finishing S9.** Unlike Basis for Issue Price, deliberately did NOT add a
new intake question for Industry Overview. A real Industry Overview chapter states market size, growth
rate and competitive dynamics from a COMMISSIONED report (CRISIL, CARE, D&B or equivalent) -
TODO.md's own out-of-scope list already says so. Asking an SME issuer to self-report a total-addressable-
market figure would be asking them to state something they typically do not know and cannot honestly
answer without commissioning exactly that report - MM4 (never invent) applies to what the app ASKS for,
not only what it drafts.

**What the section legitimately CAN draft, from facts already on file**
(`company.sector`, `company.businessDescription`, `business.productLines`,
`business.primaryMarketDescription`, all pre-existing): a short paragraph naming the sector and what the
issuer makes, in Our Business's own restrained register (D51) - no market size, no growth rate, no
competitive claim the factSlice cannot support. The drafting instructions explicitly forbade the model
from stating any industry statistic, and the live draft complied without needing a second attempt.

**The standing gap is permanent by design**, the only one in the whole document that is. Every other
gap here closes once the missing fact is answered; `aboutCompany.industryOverview.commissionedReport`
never can, because no fact this app collects satisfies it - it stays even once the sector, the business
description and everything else about this section is completely filled in, exactly matching TODO.md's
own framing: "marked 'draft — to be replaced by commissioned report.'" A dedicated test holds this: the
gap still fires even after a real draft is written and stored.

**A real ordering bug, caught by an existing test, not a new one.** The first `order` value chosen
(1450) placed "SECTION - ABOUT THE COMPANY" between the introduction and capital structure groups,
while Our Business/History/Management/Promoters/Group Companies/Conventions (2350-2700) already used
the SAME group name later in the sequence - splitting one group into two non-contiguous runs.
`docx.ts`'s `body()` opens a new Heading 1 every time the group CHANGES between consecutive sections,
not once per unique group name (a per-group heading, not a per-group-NAME heading) - so the existing
heading-count test in `docx.test.ts` failed by exactly one, correctly, before this ever reached a real
document. Fixed by moving Industry Overview to order 2300, immediately before Our Business - which is
also where a real prospectus opens the "About the Company" chapter, so the fix and the correct
structure were the same move.

**Verified:** 6 new tests, `tsc` clean, **658 tests passing overall** (up from 622 at the start of this
session: D57-D65 in total added 36 tests). Drafted for real, gate passed first try, rendered and read
the actual DOCX page - Industry Overview now opens the "About the Company" chapter exactly where a real
prospectus does, immediately before Our Business.

**All six of S9's planned narrative sections now exist** (History, Our Business, Objects of the Issue,
MD&A, Basis for Issue Price, Industry Overview), each scoped honestly to what the fact base can
support, and a real exhaustive audit across every drafted sentence on file passed (20 drafts, 82
sentences, 0 untraceable — see the gate note above). **Not the same as closing S9's gate fully**: the
third gate item, matching the S0 corpus in register and structure, has only ever been checked
informally per-section, never as one systematic diff — left honestly open in TODO.md rather than
ticked on the strength of the other two. **Registry: 31 of 37 subsections.**

---

## D66 - S7's checklist was never updated to match what D56 actually built, and the gap was bigger than D56's own prose suggested

**2026-09-12, later the same day, at the user's direct question ("is S7 complete?").** D56 described a
real, working slice of S7 enthusiastically and honestly for what it covered - but TODO.md's own S7
checklist (written before D56, describing the full original S7 scope) was never touched, so it still
showed eight unchecked boxes despite real progress underneath some of them. Nobody had gone back to
reconcile the two.

**Checked every checklist and gate item against the actual code, not the write-up.** Two of eight
checklist items and one of four gate items are genuinely done (two-pass page targeting; the
never-enters-the-fact-base-without-confirmation guarantee, verified by tracing `confirmExtraction` as
the only write path and `isUsable()`'s refusal of any unconfirmed extracted fact). Several items D56's
own prose did not dwell on turned out to be completely unbuilt, not merely rough: no async job pattern
(`uploadAndExtract` does everything inline in one request - no `pending` row, no polling, contradicting
the plan's explicit "never block a request"); no text/image routing at all (every PDF is read as its
text layer; there is no path for a scanned document, which the original plan called out as the reason
to route at all); no confidence flagging (the `Provenance.confidence` field exists and nothing sets it
- an unwired field is easy to mistake for "half-built" when it is actually "not started"); the
ground-truth gate calls for three documents and one has been run.

**TODO.md's S7 section rewritten with the verified state, item by item**, each line naming which file
was checked and what it actually does - not a re-statement of the plan, a record of what exists.
Session handoff's S7 note updated the same way, and now points at TODO.md's checklist directly rather
than summarizing it, since a second summary is a second thing that can drift out of sync with reality.

**The general lesson, matching a pattern this project has hit before (D29, D34, D45's "25 of 37 was
wrong"):** a decision-log entry written by whoever just built something describes intent and effort
honestly, but is not a substitute for checking the checklist it was supposed to update. A build session
should update BOTH the log (what happened) and the plan (what's now true), and this one only did the
first.

---

## D67 - S7 (document upload and AI extraction) is paused permanently. Hand-typed form fields only.

**2026-09-12, user decision, immediately after D66's honest S7 status check.** Told the real gap (async
processing, text/image routing, per-fact page numbers, confidence flagging, click-to-source, only 1 of
3 ground-truth documents run), the user's call was direct: uploading a document and extracting facts
from it adds more complexity than it is worth for this project. Every issuer's facts will be typed into
the module forms (S3's engine, M1-M10) by hand, permanently — not as a stopgap while S7 gets finished
later.

**This is exactly the fallback TODO.md's own S7 section already named as acceptable** ("Time-boxed
hard - if it slips, seed the fact base directly and move on"), just reached by explicit choice rather
than by running out of time. The module engine was always the load-bearing path; S7 was always meant to
sit on top of it as a shortcut, not underneath it as a dependency. Nothing else in the app assumes S7
exists - `writeFacts`, the module forms, the document renderer and every rule all already work from
hand-typed answers, which is the whole reason D33 built `withAnswers()` to lay real answers over an
EMPTY fact base rather than the seed in the first place.

**Nothing is deleted.** `app/extract/`, `lib/document-intake/`, `lib/llm/extraction.ts`,
`lib/store/document-storage.ts` and their tests all stay in the tree, committed, passing. The
`provenanceFor` override `writeFacts` gained for S7 (D56) is harmless dead capability, not dead code to
clean up - removing it would be removing something that works, for no reason. If a future session or a
future version of this project wants extraction back, D56's foundation (two-pass page targeting, the
no-invention harness, the confirm-before-fact-base guarantee) is real and does not need re-doing.

**What changes going forward:**
- TODO.md's S7 marked `⏸` (paused by explicit decision) rather than `[~]` (in progress) - a new symbol
  introduced specifically because neither existing state was honest. `[~]` implies someone is still
  advancing it; `[ ]` implies it never started. Neither is true.
- No session should pick up an S7 checklist item without the user asking again, and no session should
  delete S7 code without the user asking either - both directions of unrequested action are out of
  scope now.
- The "MVP dies without it" 🔴 marking on S7 is now historical, not current - the user's own hand
  overrode it. Left visible in the section heading (`was 🔴`) rather than erased, so the record shows
  the original plan and the actual decision both, not just the second one.

**Rules out:** any future session resuming or extending S7 work on its own initiative; any future
session treating the presence of `app/extract/` etc. as evidence the feature is live or maintained.

---

## D68 - The S9 register-and-structure audit, done for real: three fixes and one corrected assumption

**2026-09-12, at the user's direct request to complete the one honestly-open S9 gate item.** Every
prior section had been checked informally, per-section, at the moment it was built (D50-D65) - never
side by side against the corpus as one deliberate pass. Did that pass: pulled the current drafted
text for all six narrative sections from `.data/narratives/`, pulled the equivalent opening from 2+
corpus documents (`pdftotext -layout` on the full PDFs, not just the reversed-corpus fixtures) for
each, and read them side by side for register (tone, phrasing, formality) and structure (what comes
first, in what shape).

**Two sections matched cleanly, no fix needed.** History and Our Business both track their corpus
counterparts closely in both register and structure - confirmed, not just assumed.

**Three real, evidenced, fixable gaps found and fixed:**

1. **Objects of the Issue was folding the objects into one prose sentence** ("...as follows: object
   one amounting to X; object two amounting to Y..."). Every corpus document checked (Om Galaxy,
   Maxwell) states the objects as a real NUMBERED LIST, never inline prose. Fixed structurally, not
   just by asking the model to format better: converted the section from `producer: 'narrative'` to
   `producer: 'computed'` (matching the shape `risk-factors.ts` and `basis-for-issue-price.ts` already
   use) so the objects render as a genuine ordered `DocumentNode` - real Word list numbering, not text
   a model was asked to punctuate correctly. The drafted narrative is now scoped to the ONE framing
   sentence that introduces the list, matching how the corpus's own prose introduces its list rather
   than restating it component by component.

2. **Basis for Issue Price was missing the book-building clause.** Om Galaxy and Photonics Watertech
   both open with "...on the basis of an assessment of market demand for the Equity Shares through the
   Book Building Process, AND on the basis of qualitative and quantitative factors" - the draft only
   had the second half. Fixed in the fallback text and the drafting instructions, conditioned on
   `issueType === 'BOOK_BUILT'` since a fixed-price issue has no book-building step to cite.

3. **MD&A was missing its opening cross-reference.** Ideas Electricals opens with "You should read the
   following discussion in conjunction with our restated financial statements... You should also read
   ... 'Risk Factors' ... and 'Forward Looking Statements'" before any figures. The draft went straight
   to revenue and PAT numbers. Fixed in the drafting instructions to open with the cross-reference
   first, matching the corpus's own sequencing.

**One corrected design assumption, not just a phrasing gap.** The Industry Overview section's original
framing (D65) said a real Industry Overview needs a "commissioned report (CRISIL, CARE, D&B)." Checked
against the corpus and found this OVERSTATED: Ideas Electricals states, as its own risk factor #67,
"We have not commissioned an industry report for the disclosures made in the section titled 'Industry
Overview'. These disclosures are based on publicly available data, which may be inaccurate, incomplete
or not comparable" - and both Ideas Electricals and Maxwell open the actual chapter with a standing
disclaimer to that effect (extracted from public sources, not independently verified) before any
content. Real SME issuers commonly do NOT commission a paid report. The underlying reasoning survives
unchanged (this app has no source for market size, growth rate or competitive data, and must not
invent one) - only the FRAMING was corrected, from "must be replaced by a commissioned report" to
"must be replaced by real industry data from a cited public source or a commissioned report, whichever
the merchant banker chooses." Updated the section's own code comment, its rendered notice, its gap
text, and TODO.md's "Out of scope" line, which had stated the same overstatement.

**All three fixes redrafted through the live harness, not just fallback text changed.** Objects of the
Issue's factSlice genuinely shrank (no longer carries per-object detail, since the list itself is
computed, not drafted) so its old stored draft correctly went stale and needed a fresh one; Basis for
Issue Price and MD&A kept the same factSlice shape but needed fresh drafts to pick up the corrected
instructions, since a stored draft takes priority over an improved fallback. All three gates passed on
the first attempt. Re-ran the full traceability audit across every narrative on file afterward: 20
drafts, 80 sentences, 0 untraceable numbers (down from 82 sentences pre-fix, since Objects of the
Issue's redraft is deliberately 1 sentence now rather than 4 - the list carries what the prose used
to).

**Rendered and read the actual DOCX pages for all four changes** (D55's standing rule) - the numbered
list renders as real Word numbering, the book-building clause and MD&A cross-reference both print
correctly, and the corrected Industry Overview notice reads accurately.

**A new test file added** (`objects-of-the-issue.test.ts`, 6 tests) - this section had never had one,
despite being a real narrative section since D52; the structural rewrite was the forcing function to
add it, following the same pattern `basis-for-issue-price.test.ts` and `industry-overview.test.ts`
already established this session.

**Verified:** 6 new tests (664 total), `tsc` clean. **S9's gate now passes fully — all three items —
and TODO.md marks S9 CLOSED.**

---

## D69 - Main Provisions of the Articles of Association: the AoA gap closed with hand-typed fields, not S7

**2026-09-12, user decision, immediately after D67 paused S7.** The AoA section (#35, 25-38pp in a
real prospectus) was the one piece of S4 genuinely blocked by S7's pause - it needs the company's own
Articles, which was always meant to come via upload-and-extract. Two options were on the table: a new
hand-typed field, or a permanent external gap like the auditor's and CA's own deliverables. **User
chose the hand-typed field, matching every other fact in this project.**

**Scoped to what the regulation actually requires, not the whole real chapter.** A real prospectus
often reproduces the FULL Articles under ~22 topic headings (Interpretation, Share Capital, Calls,
Transfer, Transmission, Forfeiture, Alteration of Capital, Capitalisation of Profits, Buy-Back, General
Meetings, Proceedings at Meetings, Adjournment, Voting Rights, Board of Directors, Proceedings of the
Board, Dividends, Beneficial Ownership, Pledge of Locked-in Securities, Free Transferability,
Dematerialization, Retirement by Rotation - the full list read directly from Ideas Electricals'
extracted chapter, 25 corpus pages). ICDR Schedule VI Part A and the corpus's OWN opening line to this
chapter ask for far less: "the Main provisions of the Articles of Association relating to voting
rights, dividend, lien, forfeiture, restrictions on transfer and transmission of equity shares or
debentures, their consolidation or splitting" - six topics, named explicitly. Scoped to exactly those
six, the same "build what's required, not the whole real document" discipline Our Business and Objects
of the Issue already follow.

**New schema**, `company.articlesProvisions` (`zArticlesProvisions`: votingRights, dividend, lien,
forfeiture, transferAndTransmission, consolidationAndSplitting, all optional strings). **Six new M1
`longtext` fields**, each explicit that the Company Secretary must paste or type the clause VERBATIM
from the company's own Articles - never summarised, never touched by an LLM. This is the one place in
the whole document where a narrative producer would be actively wrong: AoA clause text carries the
same personal-liability weight as any other disclosure (MM4, Companies Act s.34/35), so
`lib/document/sections/articles-of-association.ts` is `producer: 'computed'`, a pure template that
prints exactly what was typed, one topic at a time, gapping any topic left blank INDIVIDUALLY (not the
whole section at once) so a partially-answered AoA still shows exactly what's missing.

**Seeded Vardhman with real, grounded text** - paraphrased from the corpus's own AoA chapters (Ideas
Electricals), not invented. This is defensible precisely because these six topics are Table F
(Companies Act 2013, Schedule I) MODEL articles: virtually every Indian company's Articles state them
near-identically, the same "shared boilerplate, not an issuer fact" category the glossary's
settlement-machinery definitions already occupy (D31). Paraphrased rather than copied verbatim from any
single corpus document, to avoid the D21/D26 single-source-copying failure mode even though the
underlying content is standard.

**Ordering got it right the first time**, unlike D65's Industry Overview mistake: placed at order 3790,
immediately before Material Contracts (3800) - both `'SECTION - OTHER INFORMATION'` - checked the full
order sequence in that range before placing it, rather than discovering the group-contiguity rule the
hard way again.

**Verified:** 6 new tests, `tsc` clean, **670 tests passing overall** (31 to 32 numbered subsections).
Rendered and read the actual DOCX page (D55's standing rule) - all six topics print correctly under
"Main Provisions of the Articles of Association," verbatim, in the right place, immediately followed by
Material Contracts as a real prospectus's ToC has them.

**This closes the AoA gap without reversing D67.** S7 itself remains paused; this is the module-form
answer D67 always implied AoA would eventually need, now built.

---

## D70 - A real bug only the browser could find: the eligibility pre-check couldn't load at all

**2026-09-12, found live while walking the user through the running app.** Every other page (home,
intake, risk review) worked; `/eligibility` failed outright with a Turbopack build error: "the
chunking context does not support external modules (request: node:fs)". Every one of the 670 Vitest
tests runs in Node, where `node:fs` always works - this class of bug is invisible to the whole test
suite by construction, and only exists in a real browser bundle. The exact lesson D34 and D65 already
taught in different shapes, generalising again: nothing that touches a bundler is verified until it has
actually been loaded in a browser.

**Root cause, traced import by import.** `app/eligibility/page.tsx` is `'use client'` and imports
`runPreCheck` from `lib/rules/precheck.ts`, which imports `preCheckRules` from `lib/rules/index.ts`.
That file ALSO imported `collectGaps` from `lib/document/section.ts` at its top level - needed only by
`completenessFindings`/`assess`, functions `precheck.ts` never calls - and `lib/document/section.ts`
imports `readNarrative` from `lib/store/narrative-store.ts`, which reads `node:fs` for the local JSON
narrative store. ES modules bundle at the file level: importing ANY export from `lib/rules/index.ts`
pulled in its entire top-level import graph, including a Node-only file-system module, into a page that
must run in the browser.

**Fixed by splitting the file, not by patching around it.** `lib/rules/document-assess.ts` (new) now
holds `completenessFindings`, `linkFindings` and `assess` - everything that needs the rendered document
- and is the only thing in `lib/rules/` that imports `lib/document/section.ts`. `lib/rules/index.ts`
keeps `allRules`, `preCheckRules` and the pure eligibility/consistency rule data, genuinely safe for a
client component to import. Every server-side caller (`app/page.tsx`, `lib/export/bundle.ts`, both test
files) now imports `assess` from `./rules/document-assess` instead of `./rules` — a one-line change
each, since none of them needed anything else from the old combined export.

**Verified twice.** Vitest first (670 tests, unchanged - this bug was never visible there), then the
real thing: reloaded `/eligibility` in the actual browser after the fix and it rendered correctly, then
reloaded the home page to confirm `assess()` still works from its new location. Neither check alone
would have been sufficient — the whole reason this shipped in the first place was that no automated test
touches a browser bundle at all.

**The general lesson, stated once more because it keeps needing restating differently:** a page that
imports a "just data and pure functions" module can still drag in server-only code transitively, and
`tsc`/Vitest cannot see the difference between a safe and an unsafe import graph for a CLIENT bundle -
only an actual bundler, building for an actual browser target, can.

---

## D71 - S12 built: role switcher, section status, comments, audit log, real certification - and a real hydration bug the browser pass caught

**2026-09-12.** S12 was the last unstarted core stage. Two decisions made explicit with the user before
writing anything: **no server-side permission enforcement** (any role can do any action; the audit log
just honestly records who - "no real auth, one seeded org" was never meant to be a security boundary),
and **no new module-assignment override store** (intake scoping filters by each module's existing fixed
`assignableTo` from S3/S8, not a new per-issuer reassignment record). Both kept the stage to what the
TODO gate actually asks for rather than what a fuller feature could have grown into.

**The first real (if unauthenticated) actor concept in the app.** Every write action before this session
hardcoded its actor as a fixed string (`'issuer'`, `'merchant-banker'`). `lib/review/types.ts` (`Role`,
`SectionStatus`, pure - no `node:fs`/`next/headers`, importable from client components after D70's
lesson about client bundles) plus `lib/review/role.ts` (`currentRole()`/`setRoleCookie()`, a `setu-role`
cookie, defaulting to Promoter) is the whole identity model. `app/review/risks/actions.ts`'s D58 dismissal
action now records the real acting role too, not a hardcoded string - "every action" in the audit log
gate means every action, not every action except the review feature that shipped first.

**Four new stores, all in the established append-only shape** (`risk-dismissal-store.ts`'s pattern):
`audit-log.ts` (one growing array, never truncated - there is no "id" an audit entry replaces, every
entry is its own event forever), `section-status-store.ts` (per-section, versioned, defaults to Draft),
`comment-store.ts` (per-section array of comment events; resolving is a NEW event carrying the same
comment id, never an edit of the original post - same reversal discipline as everywhere else, and
`readThread` orders by first-posted so resolving a comment doesn't jump it in the conversation), and
`certification-store.ts` (one document, not per-id - closer to `fact-store.ts`'s single pointer; a revoke
is a new version with `certified: false`, never a delete).

**`certified` is real now.** It was hardcoded `false` in three places (`lib/export/bundle.ts` twice,
`app/export/docx/route.ts`) - nothing in the whole app could ever turn the watermark off. `assemble()`
now reads `readCertification().certified`; every export route and the vault manifest's `state` field
read it from there. `app/page.tsx`'s footer and the new `/review` hub both show who certified it and when.

**A real hydration bug, caught only by the browser pass this project always insists on** (D34, D55, D64,
D70's lesson, again, in a new shape). `certification-banner.tsx` and `review-section-card.tsx` called
`new Date(...).toLocaleString()` directly in render - which formats using the RUNNING ENVIRONMENT's own
default locale/timezone, different between the Node process that renders the initial HTML and the
browser that hydrates it. React threw a real "Hydration failed because the server rendered text didn't
match the client" error, visible only in the browser console, invisible to `tsc` and all 692 Vitest
tests (all of which run in one Node process, so the mismatch this bug depends on cannot occur inside
them). Fixed at the source with `lib/review/timestamp.ts`'s `formatTimestamp()` - a fixed locale AND a
fixed timezone (`en-IN`, `Asia/Kolkata`, right for an Indian merchant banker's audit trail on its own
merits too) so server and client always agree regardless of either one's own settings. While tracing it,
found `risk-dismissal-card.tsx` (D58) already had the IDENTICAL bug, shipped and never caught because it
was never exercised in a way that surfaced the mismatch - fixed at the same time, same helper.

**Verified live, not just against Vitest.** Switched role to CFO in the running app - `/intake` narrowed
from ten modules to the two CFO defaults to (M6, M10). Marked a section Ready for Review, posted a
comment, certified as one role, confirmed nothing blocked a different role from having done the same
(the chosen "track only" behavior) - then downloaded the real `/export/docx` and unzipped it to confirm
`word/header1.xml` no longer contains "UNSIGNED", checked `/export/vault`'s manifest read `CERTIFIED`,
revoked and confirmed the notice returned in a fresh download, and read `/review/audit` to confirm every
one of those actions was logged with the right actor and timestamp. Test-verification writes were taken
back out of the shared `.data/` store afterward (section status back to Draft, certification revoked),
same discipline as every other session's browser pass against the real store.

**TODO.md's S12 gate is fully met**: module scoping by role, status + comments logged and reviewable,
certification lifts the notice on every export, the audit log shows every action with actor and
timestamp. 692 tests passing (22 new), `tsc` clean.

---

## D72 - S10 grown to 22 archetypes, closing the industry and offer categories TODO.md had named empty

**2026-09-12, later the same night.** Mined the full corpus again with a specific target: TODO.md's S10
checklist had stood at "promoter has 2, industry and offer have 0" since D49 — this session closed both
empty categories in one pass, rather than adding another business/financial archetype to an already
well-covered pair of categories.

**`objectsNotIndependentlyAppraised` (offer) — the strongest single corroboration of any fact this
registry reads.** All seven corpus documents state, in near-identical language, that the objects of the
Issue and the deployment of Net Proceeds have not been appraised by any bank, financial institution or
independent agency, and rest on management's own estimates — stronger even than D57's four-of-seven
record holder. Considered and rejected building this as a pure boilerplate exclusion the way D48 ruled
out "we require various statutory approvals": unlike that tautological claim, independent appraisal is a
real process that either happened or did not — a larger issuer with a bank-funded, appraised project
could genuinely answer "yes" — the corpus simply shows "no" seven times over because a formal appraisal
rarely justifies its cost against an SME-sized raise. New fact: `offer.objectsAppraisedByBankOrAgency`,
`.default(false)` matching `hasKeyManInsurance`'s D48 precedent, asked directly in M9.

**`rawMaterialPriceExposure` (industry) — present in every document, each in sector-specific language.**
Raw material price fluctuation for the manufacturers (Maxwell #63, Om Galaxy #6, Shakti Polytarp,
Photonics Watertech, Century), global LPG pricing for Axiom Gas (#10). The generic "our industry is
highly competitive" framing seen in several of the same documents' risk chapters was deliberately NOT
built — a pure rhetorical hedge with no checkable per-issuer fact behind it, the same D48 boilerplate
test the general "insurance coverage may not be adequate" framing (also present in all seven, also
rejected) fails for the same reason: universally true regardless of an issuer's actual facts, so not a
selection a fact-driven engine can honestly make. Raw material pricing clears that bar because Maxwell
names the operative, checkable fact directly: "we do not have long-term supply agreements or fixed
pricing arrangements with our suppliers." New fact: `business.hasFixedPriceSupplyContracts`, same
`.default(false)` precedent. First archetype categorised 'industry' rather than 'business' — the risk
itself (commodity/input price volatility) is a sector-wide exposure, not a claim about the issuer's own
operations the way `leasedFacilities` or `supplierConcentration` are.

**Both fire for real on Vardhman** (steel bought purchase-order by purchase-order from Jindal Stainless
and Sunflag Iron and Steel, no bank appraisal of its own raise) — real Gemini drafts, second attempt for
the raw-material one after the first echoed the company's own proper name mid-paragraph ("As Vardhman
Precision Components Limited does not maintain..."), a violation of the shared system prompt's explicit
"never restate the company's name as a stylistic variation" instruction that the model produced anyway on
the first pass — same "a model told not to will still do it sometimes, verify the actual output" lesson
as D54. Both gates passed on their kept attempt (0 untraceable numbers each), rendered and read on the
actual DOCX page: "Risks Relating to Our Industry" and "Risks Relating to this Issue and Our Equity
Shares" both print for the first time ever, in the right position in `CATEGORY_ORDER`, and the Forward
Looking Statements summary sentence picked up both automatically with no extra work (D45's overlay
mechanism, same as D62 before it). Also verified against the real (non-Vardhman) fact base in the running
dev server, on both `/` and `/review/risks` — renders correctly, no crash, falls back to the honest
computed sentence rather than Vardhman's stored draft, exactly as D51's exact-factSlice-match requires.

**Test updates, not just additions.** `risk-factors.test.ts` had a test literally named "...and only for
categories that fired" asserting industry and offer must NOT appear — correct when written, now updated
to expect both, in `CATEGORY_ORDER` position. The sparse-issuer test's hardcoded single-title expectation
grew to three, the same boolean-default-fires-conservatively precedent it already documented for
`keyManInsuranceAbsent`, extended to the two new ones without changing the reasoning. 698 tests passing (6
new), `tsc` clean. **Registry: 22, 16 of which fire on Vardhman.**

---

## D73 - S4 CLOSED: all 37 of 37 numbered subsections now exist

**2026-09-12, later the same night.** The five remaining subsections (#9, #13, #16, #18, #23) aren't
equally "remaining work" - two are permanently the auditor's/CA's deliverable, one is conditional on a
fact most SME issuers don't have, and two were genuinely unbuilt content. Also corrected a second stale
TODO.md line found along the way: the S8 "stragglers" (committee terms of reference, Interest of
Directors/Promoters, promoter undertakings) were ALL already built and tested
(`lib/document/sections/standing-statements.ts`, called from `management.ts`/`promoters.ts`,
corpus-corroborated at two sources per `lib/document/standing.test.ts`) - the checklist line had simply
never been ticked.

**#13 Tax Benefits, #16 Key Industry Regulations, #23 Restated Financial Information - three new
`producer: 'external'` specs, zero new engine work.** The mechanism already existed:
`summaryOfFinancialInformation` (#6, `introduction.ts`) has used exactly this shape since S4/S8 - a
heading plus a `[TO BE PROVIDED: <externalNote>]` placeholder that is also a real gap-dashboard finding.
New file `lib/document/sections/scope-notes.ts`, each `externalNote` naming both the reason and WHO
supplies it (the user's explicit ask this session), not just that it's missing. #16's note is careful to
say the generic company/labour-law core is separately buildable later - the sector-specific half is what
actually needs Legal Counsel, not the whole section equally.

**#18 Our Subsidiaries, Associates and Joint Ventures - built for real, not stubbed, per the user's
correction of my own draft plan.** Unlike the other three, nothing external blocks it: it's a yes/no fact
most SME issuers (four of five ToC-mapped documents, Vardhman included) can just answer "none" to. New
fact `groupCompanies.subsidiaries` (`zSubsidiary`: name, CIN, relationship enum, shareholding, nature of
business) - legally distinct from `groupCompanies.companies` (a PROMOTER-group entity regardless of the
issuer's own control) even though both live in M10 and sit near each other in the section map. Zero rows
prints the plain "does not have any" sentence a real prospectus uses; populated rows print a table, with
`gap()` calls beside missing cells matching `group-companies.ts`'s own established pairing (a table cell
cannot carry a placeholder on its own).

**#9 General Information - the real content-build, and a real course-correction mid-session.** The
approved plan called for a new `offer.keyIntermediaries` repeater modeled on a fresh contact-card shape.
Building it, reading the REST of `offer.ts` (not just the narrow grep terms the plan's research pass used)
turned up that `bookRunningLeadManager`, `registrarToIssue`, `legalAdvisor`, `sponsorBank`,
`escrowCollectionBank` and `monitoringAgency` already existed as bare optional strings - and
`financials.auditorName`/`auditorFirmRegistrationNumber`/`auditorPeerReviewNumber` already existed too.
The repeater would have asked for most of these a second time, which is exactly what MM2's "ask once"
rule exists to prevent. Scrapped the repeater; added exactly one new fact,
`offer.bankerToCompany` (mirroring `sponsorBank`'s pattern), for the one genuinely missing name - the
Company's ordinary bank, distinct from the Issue-specific escrow/sponsor banking the other fields already
cover. `bookRunningLeadManager`'s and `legalAdvisor`'s own field comments, written before this section
existed, had promised SEBI registration numbers and address/contact detail would live in General
Information - no field for those was ever built, so the section deliberately does NOT print them (would
be exactly the fabrication MM4 forbids); only the Statutory Auditor's real FRN/peer-review numbers print,
because those facts genuinely exist. Cross-references "Our Management" for the Board rather than
duplicating its table, matching Om Galaxy's own convention.

**Ordering checked against every neighboring file's real `order`/`group` values before placing anything**
(D65's lesson, again) - #9 got its own new group (`SECTION - GENERAL INFORMATION`, order 800) in the wide
gap between the Introduction group (ending 750) and Capital Structure (starting 2000); the other four
slotted into existing groups at the exact gaps between their numeric neighbors. No group ended up split
across two runs.

**Five tests broke on the honest count moving 32 to 37, all fixed by updating the expected number, not
the code** - `section.test.ts`'s full sorted-subsection list, `wave2.test.ts` and `export.test.ts`'s
`.toBe(32)` assertions, and two tests in `modules.test.ts`/`rules.test.ts` whose examples of "a section
that isn't built yet" (`aboutCompany.keyRegulations`) stopped being true examples now that it's built -
repointed to a temporarily-injected planned id and a deliberately fictional title respectively, both with
comments explaining why the milestone forced the change.

**Rendered and read all five new sections on the actual DOCX page**, per this project's standing rule -
General Information's intermediary table and CFO/CS lookups, both Tax Benefits and Key Industry
Regulations' explained-gap text sitting correctly in their groups, Subsidiaries' "none" sentence right
before Our Management, and Restated Financial Information opening the Financial Information group before
Other Financial Information. Confirmed live in the running dev server too, against the real (non-Vardhman)
fact base: the home page's own "Subsections ... of 37" counter reads 37, and the two new module fields
(`offer.bankerToCompany` on M9, `groupCompanies.subsidiaries` on M10) render with the right control types.
718 tests passing (20 new), `tsc` clean.

---

## D74 — Real auth, organizations, and a Postgres migration. SUPERSEDES D8 and the "no real auth" half of D71.

**User decision, 2026-09-21.** The project moves from "one seeded org, a role-switcher cookie, no
signed-in identity" to real sign-in, real organizations, and real access control — because the user
wants a team (CFO, Company Secretary, a Merchant Banker) to actually use this together, not just
demo it solo. D8's original reasoning ("saves ~1.5 days, costs nothing in the demo") no longer
applies once a second real person needs to be kept out of what they shouldn't touch.

**Stack: Clerk for auth/organizations, Supabase for the database — both already provisioned** (Supabase
since D56/S7; Clerk newly added). **One Clerk organization = one project/issuer** — deliberately not a
second "projects inside an org" layer, since the app never had a multi-issuer concept to begin with and
inventing one wasn't asked for.

**Access is a genuinely separate system from the existing Promoter/CS/CFO/Legal/Auditor/Merchant-Banker
picker** (`lib/review/role.ts`), which stays exactly as it was — a cosmetic label with no bearing on
access, per the user's explicit choice. The new system (`lib/auth/require-role.ts`) is two-tier,
built on Clerk's own roles with zero dashboard configuration required: `org:admin` (the org creator,
or anyone promoted) can edit and download; `org:member` (Clerk's invite default) can only view. A
third tier (`org:editor`, an optional custom role) is checked for but not required — upgrading to
three tiers later needs a dashboard step, not a code change.

**`proxy.ts`, not `middleware.ts`** — this Next.js version (16) renamed the file/export convention
(confirmed against `node_modules/next/dist/docs/` before writing it, per `AGENTS.md`'s warning that
this Next build has breaking changes from training data). Same mechanism, new name.

**Route group `app/(app)/`** now holds every existing page/route, so `/sign-in` and `/sign-up` render
with neither the sidebar chrome nor the "you need an organization" gate (`components/org-gate.tsx`) —
both of those only make sense once someone is inside the app, not while they're signing in.

**Enforcement shipped ahead of the database migration**, once it became clear it didn't actually
depend on it — `canEditAndDownload()` only needs Clerk, so every write action
(`app/(app)/intake/actions.ts`, `app/(app)/review/actions.ts`, `app/(app)/review/risks/actions.ts`)
and every export route now rejects a Viewer server-side, with a real message surfaced in the UI, not
a silent failure or a raw error page. The audit log (`lib/store/audit-log.ts`) gained
`actorName`/`actorEmail` — the real signed-in identity — alongside the existing cosmetic `actor: Role`,
so "who did this" is finally a question with a trustworthy answer.

**The database migration: one generic table absorbs five of the seven local-JSON stores.** Reading
`fact-store.ts`, `section-status-store.ts`, `certification-store.ts`, `narrative-store.ts` and
`risk-dismissal-store.ts` side by side, all five were independently the same shape on disk — an
append-only version history keyed by an id, "read latest" as the dominant query. Rather than build
five near-identical Postgres tables, `lib/store/versioned-table.ts` is ONE generic
`(orgId, kind, key) -> next version` interface over a single `versioned_records` table
(`supabase/migrations/0001_org_scoped_stores.sql`), with `kind` keeping the five stores from
colliding and each store staying a thin wrapper mapping its own field names onto a `data` column.
`audit_log` and `comment_events` (genuinely different shapes — a flat log, and many events per
section rather than one linear history per id) got their own small tables.

**`orgId` is an explicit parameter on every store function, not read internally the way
`currentRole()` reads its cookie.** That was a deliberate reversal of the plan's original phrasing,
made once implementation exposed the reason: a store function that called Clerk's `auth()` itself
would be untestable outside a live Clerk session, and this project has no way to fake one in Vitest.
Keeping `orgId` explicit — resolved once per request via `lib/auth/org-context.ts`'s `currentOrgId()`,
the same place `currentRole()` is already called — kept every store testable against
`versioned-table.ts`'s fake in-memory implementation, the same interface-plus-fake shape
`document-storage.ts` already established for this project's other Supabase-backed store. Same
class of correction as D18's provenance-shape reversal: the plan was right in spirit, wrong in one
concrete detail implementation surfaced.

**No Postgres RLS policy is defined.** Every one of these tables is reached only through this app's
own Server Actions and Route Handlers, all of which already require a verified Clerk session and
org before they run (`proxy.ts` + `OrgGate`), and every query filters by that verified `orgId`
explicitly in application code. Wiring Supabase's Clerk third-party-auth integration for a second,
JWT-based enforcement layer was deliberately skipped — a real option later, not needed now, per the
"still a hobby project, avoid infrastructure to maintain" decision this project has made before.

**The full test suite was migrated alongside the stores, not left broken.** Every store gained a
`createFake*`/`__set*ForTests` pair; every test that touches `renderSection`/`renderSections`/
`renderDocument` (now async, since the narrative sections read the async stores) was updated —
732 tests passing, `tsc` clean, no regressions.

**Not yet done, and known:** the SQL migration has not been run against the user's live Supabase
project — this is entirely inert until that happens, still reading/writing nothing at runtime beyond
what `tsc`/Vitest can prove against the fake. The comment store's `addComment`/`resolveComment`
actions have no UI calling them (a pre-existing gap, unrelated to this migration — `/review` dropped
the comment thread UI in an earlier session's redesign). Postgres RLS, if ever added, is future work,
not a gap in what shipped.

**Follow-up, same day: RLS turned on, with zero policies.** The migration file didn't enable it —
this app only ever uses the Supabase SECRET key server-side, which bypasses RLS regardless of
whether it's on, so it changes nothing about how the app behaves either way. What it buys: Supabase's
own dashboard flags a public table with RLS off as exposed to the anon/public key, which this app
never uses for these tables but some future addition might reach for by habit. "On, no policies" —
deny-all for anon/authenticated — closes that warning for free, is safe to re-run on tables already
created, and needs none of the Clerk-Supabase JWT integration that a real per-row policy would.

---

## D75 — Domain-role self-pick retired; the Owner assigns each member's role instead

**User decision, 2026-09-21, the same day as D74.** D74 added real access control (who can edit/
download) but deliberately left the cosmetic Promoter/CS/CFO/Legal/Auditor/Merchant-Banker picker
(`lib/review/role.ts`) untouched — a self-service browser cookie anyone could set to anything. That
was fine for a solo demo; it stops being fine the moment a real team exists, because "who is the
Merchant Banker" should be a fact the Owner states, not a button anyone can click.

**`Role` gains a seventh value, `OWNER` — derived, never assigned.** Whoever holds Clerk's
`org:admin` access (D74's `currentAccessLevel() === 'OWNER'`) always reads as `OWNER`, live, every
request — not stored anywhere, so it can never go stale the way a cached assignment could. Labeled
"Owner" rather than "CEO": an SME issuer's Chairman and Managing Director, a Managing Partner, or
just "the promoter who owns the account" are all real shapes this project's own corpus and seed data
show, and "Owner" is the one label that fits all of them without presuming a corporate title the
issuer may not have. The other six values are `ASSIGNABLE_ROLES` (`lib/review/types.ts`) — what the
Owner can actually hand to someone else.

**New store, same shape as five others.** `lib/store/member-role-store.ts` wraps
`versioned-table.ts` exactly like `section-status-store.ts` does — `kind: 'member_role'`, `key` =
the Clerk user id, append-only, because an Owner reassigning someone is itself worth a record, not
an overwrite of who held the role before. `currentRole()` now reads this (falling back to Promoter
for a member the Owner hasn't gotten to yet — same "unassigned needs a usable default" reasoning
the old cookie's `parseRole` already used) instead of a cookie; `setRoleCookie` and the self-pick
`setRole` action are deleted, not deprecated — nothing else called them.

**Assignment is Owner-only, stricter than `canEditAndDownload()`.** `assignMemberRole`
(`app/(app)/settings/members/actions.ts`) checks the new `isOwner()` helper
(`lib/auth/require-role.ts`) — an Editor can change the DOCUMENT, but deciding who plays which part
on the team is the Owner's call alone, matching that only Clerk's own `org:admin` can invite or
remove a member in the first place. Logged to the audit trail as `assign-role`, actor `'OWNER'`,
with the real identity alongside (same shape every other action already uses).

**The Members page grew a second half.** Clerk's `<OrganizationProfile />` has no way to embed a
custom per-member field, so listing real members with their domain-role assignment is hand-built —
`clerkClient().organizations.getOrganizationMembershipList()` server-side for the real name/email/
Clerk-role list, joined against `readMemberRole()` per member. Only the Owner sees an editable
dropdown (`components/member-role-row.tsx`); everyone else sees a plain badge — the component prop
that controls this is explicitly documented as NOT the real gate, since `assignMemberRole` re-checks
`isOwner()` itself regardless, the same "never trust the client-side check alone" discipline
`lib/auth/require-role.ts` already established for `canEditAndDownload()`.

**`/intake`'s role picker became a read-only badge** ("Acting as: X"), with a link to the Members
page for the Owner only — `RolePicker` (`components/role-picker.tsx`) is deleted along with the
`counts`-per-role computation it needed, both now dead code with nothing left to call them.

**Also done the same round: the audit log page redesigned** to match the app's current shadcn
visual language (it had been left in the pre-redesign zinc-colored style from S12) — a vertical
timeline with a per-action icon and accent color, actor initials, and a real empty state, replacing
the plain HTML table. Gained an `assign-role` row shape and, separately, a sidebar link — it had
never had one, a leftover "fine for a solo demo" decision from S12 that stopped being fine for the
same reason the self-pick cookie did.

**Verified:** `tsc` clean, 737 tests passing (5 new, `member-role-store.test.ts`), no new lint
errors. Not yet verified live — needs the D74 migration run first (see that entry's own "not yet
done" note) before `currentRole()`'s Postgres read has anything real to read.

---

## D76 — Access-level gating narrowed to Owner-only role assignment. Partially reverses D74.

**User decision, same day, right after D75 shipped.** D74 gated every write action and every
download route on organization access level — Admin could edit/download, Member could only view.
The user reversed the Member half of that: editing the fact base, the review workflow, and
downloading exports are now open to BOTH Admin and Member. The only thing that stays Owner-only is
D75's role assignment (`assignMemberRole`) — deciding who plays which part on the team is a
different kind of decision from editing the document itself, and the user drew the line there, not
at edit-vs-view.

**Mechanically, this is `canEditAndDownload()` deleted, not disabled.** Every `if (!(await
canEditAndDownload()))` guard came out of the five write actions
(`app/(app)/intake/actions.ts`, `app/(app)/review/actions.ts`, `app/(app)/review/risks/actions.ts`)
and the four export routes, along with the `NOT_ALLOWED` messaging and `/export/page.tsx`'s
greyed-out-tiles-for-a-Viewer treatment — a function that would only ever return `true` is not a
guard worth keeping around to read. `isOwner()` (renamed intent, same `currentAccessLevel() ===
'OWNER'` check `canEditAndDownload()` used) is the only access check left anywhere in the app, and
it gates exactly one action.

**What this means for the earlier "Viewer" framing throughout the codebase's comments:** there is
no more Viewer tier in practice — `AccessLevel` still has three values (`OWNER`/`EDITOR`/`VIEWER`)
because `currentAccessLevel()` is still the thing `isOwner()` and `currentRole()`'s `OWNER`
derivation both read, but nothing gates on the `VIEWER` case reaching zero access anymore. Comments
in `proxy.ts` and `certification-banner.tsx` that described per-action Viewer gating were updated;
any other stale reference to "a Viewer can only..." elsewhere describes the D74 state, not the
current one.

**Verified:** `tsc` clean, 737 tests passing (no store-level behavior changed, only the app-layer
gate that called them), no new lint errors.
