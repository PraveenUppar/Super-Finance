'use server';

import { revalidatePath } from 'next/cache';
import { isOwner, currentIdentity } from '@/lib/auth/require-role';
import { currentOrgId } from '@/lib/auth/org-context';
import { ASSIGNABLE_ROLES, ROLE_LABELS, type Role } from '@/lib/review/types';
import { writeMemberRole } from '@/lib/store/member-role-store';
import { appendAudit } from '@/lib/store/audit-log';

/**
 * Assigning a member's domain role (Promoter/CS/CFO/Legal/Auditor/Merchant
 * Banker) — the ONE thing in this app that stays Owner-only, per the user's
 * explicit ask; editing the document and the review workflow is open to
 * every member. Deciding who plays which part on the team is the Owner's
 * call alone, the same way only Clerk's own `org:admin` can invite or
 * remove a member in the first place.
 */
export async function assignMemberRole(
  targetUserId: string,
  targetLabel: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) {
    return { ok: false, error: 'Only the Owner can assign roles.' };
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { ok: false, error: 'Not an assignable role.' };
  }

  const orgId = await currentOrgId();
  const identity = await currentIdentity();
  await writeMemberRole(orgId, targetUserId, role, identity?.email ?? 'owner');
  await appendAudit(orgId, {
    actor: 'OWNER',
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: 'assign-role',
    detail: `${targetLabel} -> ${ROLE_LABELS[role]}`,
  });

  revalidatePath('/settings/members');
  revalidatePath('/intake', 'layout');
  return { ok: true };
}
