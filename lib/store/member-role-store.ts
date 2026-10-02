import type { Role } from '../review/types';
import { versionedTable } from './versioned-table';

/**
 * Which domain role (Promoter/CS/CFO/Legal/Auditor/Merchant Banker) each
 * ORG MEMBER has been assigned — new alongside real auth (the decision-log
 * entry superseding D8/D71). Previously this was a single `setu-role`
 * browser cookie anyone could set for themselves; now it is per-person,
 * assigned by the Owner (`lib/auth/require-role.ts`'s access-level
 * `OWNER`), and every member sees the role actually assigned to THEM, not
 * whatever they last clicked.
 *
 * `versioned_records` (kind `'member_role'`, key = the Clerk user id) — same
 * shape as five of this project's other org-scoped stores, same reason: an
 * Owner reassigning someone is itself worth keeping a record of, not an
 * overwrite of who held the role before.
 *
 * `OWNER` itself is never stored here — it is derived live from Clerk's
 * `org:admin` role (see `lib/review/role.ts`'s `currentRole()`), which is
 * always the true, current answer and cannot drift the way a cached
 * assignment could.
 */

const KIND = 'member_role';

export interface MemberRoleRecord {
  userId: string;
  version: number;
  role: Role;
  assignedBy: string;
  assignedAt: string;
}

/** The role assigned to `userId`, or null if the Owner has never assigned one. */
export async function readMemberRole(orgId: string, userId: string): Promise<Role | null> {
  const row = await versionedTable().readLatest(orgId, KIND, userId);
  return row ? (row.data as { role: Role }).role : null;
}

/** Every user id with an assignment on file, for the members page to join against Clerk's own member list. */
export async function listAssignedUserIds(orgId: string): Promise<string[]> {
  return versionedTable().listKeys(orgId, KIND);
}

export async function writeMemberRole(orgId: string, userId: string, role: Role, assignedBy: string): Promise<MemberRoleRecord> {
  const row = await versionedTable().write(orgId, KIND, userId, { role }, assignedBy);
  return { userId, version: row.version, role, assignedBy: row.savedBy, assignedAt: row.savedAt };
}
