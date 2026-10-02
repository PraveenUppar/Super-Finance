@AGENTS.md

# Setu — SME IPO Draft Prospectus Builder

Takes an SME issuer from zero to a substantially complete, structurally correct **draft prospectus**, flags every gap and inconsistency with a clause citation, and hands it to a merchant banker for review and certification.

**SEBI Problem Statement 4.** Target: **book-built SME issues** (BSE SME / NSE Emerge) first — document flow DRHP -> RHP -> Prospectus. See D15; this supersedes the original fixed-price-first plan. Fixed price is a later branch on ~5 sections via `Section.appliesIf`.

**Positioning:** not replacing intermediaries — handing them a redline-ready draft on day one instead of month three.

---

## Current state

> **Stages S0–S3, S5, S6, S8, S11 closed; S4 Wave 1 and Wave 2 done.**
> All ten intake modules exist; 24 of 37 subsections render and export to Word, PDF, a gap workbook and a vault. 517 tests passing.
> Read `.claude/context/04-session-handoff.md` at the start of every session for live status —
> it is the source of truth; this block is a pointer and will lag.

---

## The five mental models

Everything follows from these. If a decision contradicts one, the decision is wrong.

1. **Classify by producer, not chapter order.** Boilerplate (50–60%, templates, no LLM) · Computed (~15%, pure TS) · Narrative (25–30%, grounded LLM) · External (auditor/CA, we don't produce). **Build in producer waves, never Section I → II → III.**

2. **Specs are data; engines are code.** One module engine + one document engine. After that, modules 3–10 and sections 12–35 are *content*, not engineering.

3. **One Zod schema, five uses.** Client validation · server validation · LLM structured-output schema (Gemini, via `z.toJSONSchema()`) · fact-base parse · TS types. This is why the stack is all-TypeScript.

4. **Never invent.** Missing fact → `[TO BE PROVIDED: <ask>]` **and** a gap, from the same check. A fabrication in an offer document is a Companies Act s.34/35 liability.

5. **Provenance on every fact.** `{ value, source, ref: {docId, page}, derivedFrom, updatedAt, updatedBy }`. Every sentence in 280 pages traces to a source.

---

## Non-negotiable rules

- **No regulatory number without a citation.** It must have an entry in `.claude/context/05-rule-sources.md`. Never from model memory — and note that SEBI's own board memo was wrong on 5 of 6 figures versus what was actually notified.
- **DOCX is the primary export.** Merchant bankers redline in Word.
- **Never floats for money.** `decimal.js` for every rupee and percent.
- **Extraction never lands silently.** Every extracted fact goes through review-and-confirm against its source page.
- **Fact base is append-only.** Write new versions; never overwrite.
- **Snapshot API results to fixtures.** Extract once, save the JSON, iterate against the fixture.
- **No emojis anywhere.** Plain text markers only.

---

## Stack

Next.js (App Router) + TypeScript · Tailwind · React Hook Form + Zod · `docx` npm · `decimal.js` · Vitest

**Persistence:** Supabase Postgres, org-scoped — see D74. Local JSON under `.data/` is retired now that the migration has landed; `SETU_DATA_DIR` and the old file-store code paths are gone.

**Auth: Clerk (D74, supersedes D8).** Real sign-in, real organizations (one org = one project/issuer), two access tiers (`org:admin` edits/downloads, `org:member` views only) — see `lib/auth/require-role.ts`. This is separate from the pre-existing Promoter/CS/CFO/Legal/Auditor/Merchant-Banker picker (`lib/review/role.ts`), which still just labels who's acting in the document workflow and has no bearing on access.

**S9/S10 use the Gemini free tier (D43) — a hobby-project decision, not paid API credits.** S1 through S6 and S11 need no LLM at all. Free-tier content trains Google's models, which is fine for the seed and the public corpus and would need revisiting before any real issuer's data reached it. (S7 itself remains paused — D67 — unaffected by D74.)

**Deliberately not used:** Python, LangChain, vector DB, Redis, Docker, GraphQL, monorepo, E2E suite, Postgres RLS (enforcement lives in the app layer — see D74).

---

## Where things live

| Need | File |
|---|---|
| **Live status, next action** | `.claude/context/04-session-handoff.md` |
| Build checklist | `TODO.md` |
| IPO / SEBI domain knowledge | `.claude/context/01-domain-primer.md` |
| Architecture detail, data shapes | `.claude/context/02-architecture.md` |
| Why we decided X | `.claude/context/03-decision-log.md` |
| **Verified regulatory citations** | `.claude/context/05-rule-sources.md` |
| **Section map (from 5 real ToCs)** | `.claude/context/07-section-map.md` |

Skills in `.claude/skills/`: `sme-domain`, `template-extraction`, `rule-authoring`.

---

## Session protocol

**Start:** read `04-session-handoff.md`. Work one build stage per session where possible.

**End:** update `04-session-handoff.md` (done / next / open questions / gotchas). Append any decision to `03-decision-log.md`. Commit.

Full context-management protocol: `.claude/context/06-context-management.md`.
