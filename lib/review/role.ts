import { auth } from '@clerk/nextjs/server';
import { currentAccessLevel } from '../auth/require-role';
import { readMemberRole } from '../store/member-role-store';
import { parseRole, type Role } from './types';

/**
 * The acting role for this request, server-only.
 *
 * No longer a self-picked browser cookie — see the decision-log entry
 * superseding D8/D71. Whoever holds Clerk's `org:admin` access (see
 * `lib/auth/require-role.ts`'s `currentAccessLevel()`) always reads as
 * `OWNER`, live from Clerk, never from a stored assignment that could go
 * stale. Everyone else reads whatever the Owner assigned them in
 * `lib/store/member-role-store.ts`, falling back to Promoter (the
 * coordinator) if the Owner hasn't assigned anything yet — the same
 * "unassigned still needs a usable default" reasoning `parseRole` already
 * used for a missing cookie.
 */
export async function currentRole(): Promise<Role> {
  const level = await currentAccessLevel();
  if (level === 'OWNER') return 'OWNER';

  const { userId, orgId } = await auth();
  if (!userId || !orgId) return 'PROMOTER';

  const assigned = await readMemberRole(orgId, userId);
  return assigned ? parseRole(assigned) : 'PROMOTER';
}
