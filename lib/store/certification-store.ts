import type { Role } from '../review/types';
import { versionedTable } from './versioned-table';

/**
 * The merchant banker's certification — the one flag every export reads to
 * decide whether to print `UNSIGNED DRAFT — NOT FOR FILING` (D35).
 *
 * Now `versioned_records` (kind `'certification'`, key `'_singleton'`: one
 * document overall per organization, not per-section) — see
 * `lib/store/versioned-table.ts`'s doc comment.
 *
 * A revocation (the MB un-certifying after a late change) is a new version
 * with `certified: false`, never a delete — same reversal discipline as a
 * risk dismissal's `dismissed: false` reinstatement.
 */

const KIND = 'certification';
const KEY = '_singleton';

export interface CertificationRecord {
  version: number;
  certified: boolean;
  certifiedBy: Role | null;
  certifiedAt: string | null;
}

export async function readCertification(orgId: string): Promise<CertificationRecord> {
  const row = await versionedTable().readLatest(orgId, KIND, KEY);
  if (!row) return { version: 0, certified: false, certifiedBy: null, certifiedAt: null };
  return {
    version: row.version,
    certified: (row.data as { certified: boolean }).certified,
    certifiedBy: row.savedBy as Role,
    certifiedAt: row.savedAt,
  };
}

export async function listCertificationVersions(orgId: string): Promise<number[]> {
  return versionedTable().listVersions(orgId, KIND, KEY);
}

export async function readCertificationVersion(orgId: string, version: number): Promise<CertificationRecord> {
  const row = await versionedTable().readVersion(orgId, KIND, KEY, version);
  if (!row) throw new Error(`certification: no version ${version} for org ${orgId}`);
  return {
    version: row.version,
    certified: (row.data as { certified: boolean }).certified,
    certifiedBy: row.savedBy as Role,
    certifiedAt: row.savedAt,
  };
}

async function write(orgId: string, certified: boolean, by: Role): Promise<CertificationRecord> {
  const row = await versionedTable().write(orgId, KIND, KEY, { certified }, by);
  return { version: row.version, certified, certifiedBy: by, certifiedAt: row.savedAt };
}

export async function certify(orgId: string, by: Role): Promise<CertificationRecord> {
  return write(orgId, true, by);
}

export async function revokeCertification(orgId: string, by: Role): Promise<CertificationRecord> {
  return write(orgId, false, by);
}
