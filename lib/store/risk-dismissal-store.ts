import { versionedTable } from './versioned-table';

/**
 * Risk dismissal record — S10's "dismiss-with-reason, logged" gate.
 *
 * A triggered archetype is a machine SELECTION, not yet a certified
 * disclosure — the reviewing merchant banker may determine a flagged risk
 * genuinely does not apply to this issuer (a false positive against the
 * archetype's trigger, or one already covered elsewhere) and exclude it from
 * the printed section. That decision, and why, is exactly the shape D9's
 * review model exists for: the MB's job moves from writing to reviewing, and
 * a reviewing decision with no reason attached is not one a diligence file
 * can rely on later — same reasoning MM4 (never invent) applies in reverse to
 * never silently DELETE either.
 *
 * Now `versioned_records` (kind `'risk_dismissal'`, key = the archetype id)
 * — same append-only, versioned-per-id shape as `narrative-store.ts`, same
 * reason: "who excluded this risk, and when, and why" matters for a
 * document carrying a signature.
 */

const KIND = 'risk_dismissal';

export interface RiskDismissal {
  /** The risk archetype id, e.g. "customer-concentration" — not the store key `risk.<id>` narrative-store uses. */
  id: string;
  version: number;
  /** False means "reinstated" — a real state, not the absence of a record, so a reversal is itself logged. */
  dismissed: boolean;
  reason: string;
  dismissedBy: string;
  dismissedAt: string;
}

interface StoredData {
  dismissed: boolean;
  reason: string;
}

function toRecord(id: string, row: { version: number; savedAt: string; savedBy: string; data: unknown }): RiskDismissal {
  const data = row.data as StoredData;
  return { id, version: row.version, dismissed: data.dismissed, reason: data.reason, dismissedBy: row.savedBy, dismissedAt: row.savedAt };
}

/** The current dismissal state for `id`, or null if it has never been touched. */
export async function readDismissal(orgId: string, id: string): Promise<RiskDismissal | null> {
  const row = await versionedTable().readLatest(orgId, KIND, id);
  return row ? toRecord(id, row) : null;
}

export async function listDismissalVersions(orgId: string, id: string): Promise<number[]> {
  return versionedTable().listVersions(orgId, KIND, id);
}

export async function readDismissalVersion(orgId: string, id: string, version: number): Promise<RiskDismissal> {
  const row = await versionedTable().readVersion(orgId, KIND, id, version);
  if (!row) throw new Error(`risk_dismissal: no version ${version} for id ${id}`);
  return toRecord(id, row);
}

/** Every archetype id with a dismissal record on file, dismissed or reinstated — for the review page and the audit trail. */
export async function listDismissalIds(orgId: string): Promise<string[]> {
  return versionedTable().listKeys(orgId, KIND);
}

/** Record a dismissal or a reinstatement (`dismissed: false`) as the next version. Never overwrites the history. */
export async function writeDismissal(
  orgId: string,
  id: string,
  dismissed: boolean,
  reason: string,
  dismissedBy: string,
): Promise<RiskDismissal> {
  const row = await versionedTable().write(orgId, KIND, id, { dismissed, reason }, dismissedBy);
  return toRecord(id, row);
}
