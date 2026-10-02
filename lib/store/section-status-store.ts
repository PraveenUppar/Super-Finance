import type { Role, SectionStatus } from '../review/types';
import { versionedTable } from './versioned-table';

/**
 * Section review status — Draft -> Ready for Review -> Reviewed -> Locked.
 *
 * Now `versioned_records` (kind `'section_status'`, key = the section id) —
 * see `lib/store/versioned-table.ts`'s doc comment. Still append-only,
 * versioned per section: a section moving backward (a reviewer reopening a
 * "Reviewed" section to Draft after a fact changed under it) is itself a
 * real, logged event, not an overwrite of the fact that it was once marked
 * Reviewed.
 */

const KIND = 'section_status';

export interface SectionStatusRecord {
  sectionId: string;
  version: number;
  status: SectionStatus;
  changedBy: Role;
  changedAt: string;
}

/** Every section defaults to Draft until someone touches it — no record is not a gap, it's the starting state. */
export async function readStatus(orgId: string, sectionId: string): Promise<SectionStatusRecord> {
  const row = await versionedTable().readLatest(orgId, KIND, sectionId);
  if (!row) return { sectionId, version: 0, status: 'DRAFT', changedBy: 'PROMOTER', changedAt: '' };
  return {
    sectionId,
    version: row.version,
    status: (row.data as { status: SectionStatus }).status,
    changedBy: row.savedBy as Role,
    changedAt: row.savedAt,
  };
}

export async function listStatusVersions(orgId: string, sectionId: string): Promise<number[]> {
  return versionedTable().listVersions(orgId, KIND, sectionId);
}

export async function readStatusVersion(orgId: string, sectionId: string, version: number): Promise<SectionStatusRecord> {
  const row = await versionedTable().readVersion(orgId, KIND, sectionId, version);
  if (!row) throw new Error(`section_status: no version ${version} for section ${sectionId}`);
  return {
    sectionId,
    version: row.version,
    status: (row.data as { status: SectionStatus }).status,
    changedBy: row.savedBy as Role,
    changedAt: row.savedAt,
  };
}

export async function writeStatus(
  orgId: string,
  sectionId: string,
  status: SectionStatus,
  changedBy: Role,
): Promise<SectionStatusRecord> {
  const row = await versionedTable().write(orgId, KIND, sectionId, { status }, changedBy);
  return { sectionId, version: row.version, status, changedBy, changedAt: row.savedAt };
}
