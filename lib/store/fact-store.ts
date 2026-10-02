import { getFact, setFact, userProvenance, type FactPath, type Provenance, type ProvenanceMap } from '../facts/provenance';
import type { PartialFactBase } from '../facts/schema';
import { versionedTable } from './versioned-table';

/**
 * The fact base — now one organization's row history in `versioned_records`
 * (kind `'fact_base'`, key `'_singleton'`: one document per organization),
 * not a local JSON file. This is the swap `fact-store.ts`'s own original
 * comment anticipated: "the shape is chosen so that swap is a change of
 * driver, not of callers" — every function here keeps its old name and
 * meaning, only gaining an `orgId` parameter and an `async` keyword.
 *
 * **APPEND-ONLY**, same as before. Every write is a new version; nothing is
 * ever overwritten, because "who changed this figure, and when" is a
 * question a merchant banker will ask about a document that carries their
 * signature — and because an offer document is evidence.
 *
 * `orgId` is always the caller's job to supply, resolved from Clerk's
 * `auth()` exactly once per request (see `lib/auth/org-context.ts`) — kept
 * as an explicit parameter here, rather than read internally the way
 * `currentRole()` reads its cookie, specifically so this file (and the
 * chain above it: `lib/issuer.ts`, `lib/export/bundle.ts`) stays testable
 * with `lib/store/versioned-table.ts`'s fake, with no Clerk session needed.
 */

const KIND = 'fact_base';
const KEY = '_singleton';

export interface FactBaseVersion {
  version: number;
  savedAt: string;
  savedBy: string;
  /** The paths this version changed, so a diff needs no comparison pass. */
  changed: FactPath[];
  facts: PartialFactBase;
  provenance: ProvenanceMap;
}

interface StoredData {
  changed: FactPath[];
  facts: PartialFactBase;
  provenance: ProvenanceMap;
}

/** The empty starting point. An issuer begins with nothing, not with defaults. */
const EMPTY: FactBaseVersion = {
  version: 0,
  savedAt: new Date(0).toISOString(),
  savedBy: 'system',
  changed: [],
  facts: {},
  provenance: {},
};

export async function readFactBase(orgId: string): Promise<FactBaseVersion> {
  const row = await versionedTable().readLatest(orgId, KIND, KEY);
  if (!row) return EMPTY;
  const data = row.data as StoredData;
  return { version: row.version, savedAt: row.savedAt, savedBy: row.savedBy, ...data };
}

export async function listVersions(orgId: string): Promise<number[]> {
  return versionedTable().listVersions(orgId, KIND, KEY);
}

export async function readVersion(orgId: string, version: number): Promise<FactBaseVersion> {
  const row = await versionedTable().readVersion(orgId, KIND, KEY, version);
  if (!row) throw new Error(`fact_base: no version ${version} for org ${orgId}`);
  const data = row.data as StoredData;
  return { version: row.version, savedAt: row.savedAt, savedBy: row.savedBy, ...data };
}

/**
 * Write one or more facts as a new version.
 *
 * Returns the version written. Writing the same value a field already holds is
 * a no-op — autosave fires on every keystroke pause, and a version per
 * keystroke would bury the real edits.
 *
 * `provenanceFor` defaults to `userProvenance(savedBy)` for every path — the
 * module form's autosave, which is who wrote every prior call site. S7
 * (`lib/llm/extraction.ts`) is the first caller that needs something else:
 * `extractedProvenance(documentId, page, confidence)`, `confirmed: false`,
 * so `isUsable()` refuses to render the fact until a human confirms it
 * against the source page. Passing the override IN, rather than adding a
 * second write function, keeps one place that appends a version.
 */
export async function writeFacts(
  orgId: string,
  updates: Record<FactPath, unknown>,
  savedBy: string,
  provenanceFor: (path: FactPath) => Provenance = () => userProvenance(savedBy),
): Promise<FactBaseVersion> {
  const previous = await readFactBase(orgId);

  const changed = Object.entries(updates).filter(
    ([path, value]) => JSON.stringify(getFact(previous.facts, path)) !== JSON.stringify(value),
  );
  if (changed.length === 0) return previous;

  let facts = previous.facts;
  const provenance: ProvenanceMap = { ...previous.provenance };
  for (const [path, value] of changed) {
    facts = setFact(facts, path, value);
    provenance[path] = provenanceFor(path);
  }

  const data: StoredData = { changed: changed.map(([path]) => path), facts, provenance };
  const row = await versionedTable().write(orgId, KIND, KEY, data, savedBy);
  return { version: row.version, savedAt: row.savedAt, savedBy: row.savedBy, ...data };
}

/** Seed an empty store, so the demo has something to show. Never overwrites. */
export async function seedIfEmpty(orgId: string, facts: PartialFactBase, by = 'seed'): Promise<FactBaseVersion> {
  const current = await readFactBase(orgId);
  if (current.version > 0) return current;
  return writeFacts(orgId, flatten(facts), by);
}

/**
 * Load a whole fact base on demand, regardless of what is already stored —
 * the "Load demo data" button's write path. Unlike `seedIfEmpty`, this is
 * meant to be pressed more than once (before each demo), so it does not
 * check the current version first. Still append-only: this is a normal
 * write, so every version already on disk survives underneath it.
 */
export async function loadWholeFactBase(orgId: string, facts: PartialFactBase, by: string): Promise<FactBaseVersion> {
  return writeFacts(orgId, flatten(facts), by);
}

/**
 * Reset to empty — the "Reset" button's write path, symmetric with
 * `loadWholeFactBase`. Appends a new version with no facts at all, rather
 * than touching what is already on disk: every prior version, demo data
 * included, is still there under it and still reachable by version number.
 * `writeFacts` can't do this directly (it only ever diffs and merges onto
 * what is already stored, never clears a path), so this builds the empty
 * version the same way `writeFacts` builds a normal one.
 */
export async function resetFactBase(orgId: string, by: string): Promise<FactBaseVersion> {
  const previous = await readFactBase(orgId);
  if (previous.version === 0) return previous;

  const data: StoredData = { changed: Object.keys(previous.facts), facts: {}, provenance: {} };
  const row = await versionedTable().write(orgId, KIND, KEY, data, by);
  return { version: row.version, savedAt: row.savedAt, savedBy: row.savedBy, ...data };
}

/**
 * Flatten a nested fact object to the top-level domain paths.
 *
 * Deliberately shallow: domains are written whole when seeding, and
 * field-by-field when a person is typing. Flattening all the way down would
 * make a seed produce hundreds of provenance entries claiming a human typed
 * each one.
 */
function flatten(facts: PartialFactBase): Record<FactPath, unknown> {
  return Object.fromEntries(Object.entries(facts));
}
