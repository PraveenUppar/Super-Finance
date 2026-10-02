'use server';

import { revalidatePath } from 'next/cache';
import { writeDismissal } from '@/lib/store/risk-dismissal-store';
import { appendAudit } from '@/lib/store/audit-log';
import { currentRole } from '@/lib/review/role';
import { currentIdentity } from '@/lib/auth/require-role';
import { currentOrgId } from '@/lib/auth/org-context';

/**
 * The S10 "dismiss-with-reason, logged" action.
 *
 * `dismissedBy` records whoever the domain-role switcher says is acting
 * (`currentRole()`, cosmetic — see lib/review/types.ts), same as every S12
 * action. Reversing a dismissal is `setRiskDismissal(id, false, reason)`,
 * not a delete — the store is append-only (`risk-dismissal-store.ts`) so a
 * reversal is itself a logged event, not an erasure of the first one. Also
 * appends to the shared audit log (`lib/store/audit-log.ts`), now with the
 * real signed-in identity alongside the domain role. Open to both Admin and
 * Member — only assigning a member's ROLE is Owner-only.
 */
export async function setRiskDismissal(
  id: string,
  dismissed: boolean,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (dismissed && reason.trim().length === 0) {
    return { ok: false, error: 'A reason is required to exclude a flagged risk from the document.' };
  }

  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  await writeDismissal(orgId, id, dismissed, reason.trim(), actor);
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: dismissed ? 'dismiss' : 'reinstate',
    detail: `${id}${reason.trim() ? ` — ${reason.trim()}` : ''}`,
  });

  // The document reads dismissal state at render time (risk-factors.ts), and
  // the review page shows the same records — both need to see the write.
  revalidatePath('/review/risks');
  revalidatePath('/document', 'layout');

  return { ok: true };
}
