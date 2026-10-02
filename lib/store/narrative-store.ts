import { versionedTable } from './versioned-table';

/**
 * Drafted narrative prose — one append-only version history PER id, now in
 * `versioned_records` (kind `'narrative'`, key = the id) rather than local
 * JSON. Same reason as ever: "who drafted this paragraph, and when" is a
 * question a merchant banker asks about a document carrying their
 * signature, same as a figure. An id is a risk archetype
 * (`risk.customer-concentration`) or a whole narrative section
 * (`aboutCompany.ourBusiness`) — whatever `draftNarrative()` was asked to
 * write prose for.
 *
 * `renderSection()` and `risk-factors.ts`'s `compute()` are both
 * synchronous over the RENDER step; an LLM call cannot happen inline at
 * render time. A draft is generated ahead of time by an explicit action,
 * LANDS HERE, and rendering reads whatever is here — present or not —
 * exactly the way `renderTemplate` reads the fact base: usable, or a gap.
 * (`readNarrative` itself IS now async, since it is a real network read —
 * every one of its callers already awaits it, since `renderSection` and the
 * whole render pipeline are async by the time this file changed.)
 */

const KIND = 'narrative';

export interface NarrativeVersion {
  id: string;
  version: number;
  savedAt: string;
  savedBy: string;
  /** The drafted prose, ready to render. */
  text: string;
  /** The model's untouched output, in case `text` is ever post-processed from it later. */
  raw: string;
  /** What the model was allowed to see, kept alongside the draft it produced from it. */
  factSlice: object;
}

interface StoredData {
  text: string;
  raw: string;
  factSlice: object;
}

function toVersion(id: string, row: { version: number; savedAt: string; savedBy: string; data: unknown }): NarrativeVersion {
  const data = row.data as StoredData;
  return { id, version: row.version, savedAt: row.savedAt, savedBy: row.savedBy, ...data };
}

/**
 * The draft for `id`, but ONLY if it was drafted from EXACTLY the facts
 * being rendered right now.
 *
 * D51 caught the reason the hard way: `general.riskFactors.narrative` and
 * `keyManInsuranceAbsent` fire on almost every issuer (D48's default-false
 * boolean), so a draft written for one issuer's facts could be served,
 * unchanged, to a different issuer, because the store was keyed by
 * archetype id ALONE (now archetype id + organization — the org boundary
 * removes the cross-ISSUER version of this risk, but not the underlying
 * one: an org's OWN facts changing under a stale draft is still exactly the
 * failure this guard exists for). Wrong facts, or no facts at all: read as
 * if nothing has been drafted, same as never having called
 * `writeNarrative` — never a stale or mismatched paragraph.
 */
export async function readNarrative(orgId: string, id: string, currentFactSlice: object): Promise<NarrativeVersion | null> {
  const row = await versionedTable().readLatest(orgId, KIND, id);
  if (!row) return null;
  const stored = toVersion(id, row);
  return JSON.stringify(stored.factSlice) === JSON.stringify(currentFactSlice) ? stored : null;
}

export async function listNarrativeVersions(orgId: string, id: string): Promise<number[]> {
  return versionedTable().listVersions(orgId, KIND, id);
}

export async function readNarrativeVersion(orgId: string, id: string, version: number): Promise<NarrativeVersion> {
  const row = await versionedTable().readVersion(orgId, KIND, id, version);
  if (!row) throw new Error(`narrative: no version ${version} for id ${id}`);
  return toVersion(id, row);
}

/** Write a new draft as the next version. Regenerating keeps every prior draft, never overwrites one. */
export async function writeNarrative(
  orgId: string,
  id: string,
  text: string,
  raw: string,
  factSlice: object,
  savedBy: string,
): Promise<NarrativeVersion> {
  const row = await versionedTable().write(orgId, KIND, id, { text, raw, factSlice }, savedBy);
  return toVersion(id, row);
}
