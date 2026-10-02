'use server';

import { revalidatePath } from 'next/cache';
import { currentRole } from '@/lib/review/role';
import { SECTION_STATUS_LABELS, type SectionStatus } from '@/lib/review/types';
import { currentIdentity } from '@/lib/auth/require-role';
import { currentOrgId } from '@/lib/auth/org-context';
import { appendAudit } from '@/lib/store/audit-log';
import { writeStatus } from '@/lib/store/section-status-store';
import { addComment as storeAddComment, resolveComment as storeResolveComment } from '@/lib/store/comment-store';
import { certify, revokeCertification } from '@/lib/store/certification-store';

/**
 * S12's server actions. Every write action in this org is open to both
 * Admin and Member — the user's explicit decision: only assigning a
 * member's ROLE is Owner-only (`assignMemberRole`,
 * app/(app)/settings/members/actions.ts); editing and reviewing the
 * document itself is not. Each one still appends a real actor to the audit
 * entry (`currentIdentity()`, the signed-in Clerk user) alongside
 * `currentRole()`'s Promoter/CS/CFO/Legal/Auditor/Merchant-Banker/Owner
 * label — no longer a self-picked cookie, now the Owner's assignment, but
 * still a cosmetic label unrelated to access.
 */

export async function setSectionStatus(
  sectionId: string,
  sectionTitle: string,
  status: SectionStatus,
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  await writeStatus(orgId, sectionId, status, actor);
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: 'section-status',
    detail: `${sectionTitle} -> ${SECTION_STATUS_LABELS[status]}`,
  });
  revalidatePath('/review');
  return { ok: true };
}

export async function addComment(
  sectionId: string,
  sectionTitle: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (text.trim().length === 0) return { ok: false, error: 'Comment cannot be empty.' };

  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  await storeAddComment(orgId, sectionId, actor, text.trim());
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: 'comment',
    detail: `On ${sectionTitle}`,
  });
  revalidatePath('/review');
  return { ok: true };
}

export async function resolveComment(
  sectionId: string,
  sectionTitle: string,
  commentId: string,
  resolved: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  const result = await storeResolveComment(orgId, sectionId, commentId, resolved);
  if (!result) return { ok: false };
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: resolved ? 'resolve-comment' : 'reopen-comment',
    detail: `On ${sectionTitle}`,
  });
  revalidatePath('/review');
  return { ok: true };
}

export async function certifyDocument(): Promise<{ ok: boolean; error?: string }> {
  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  await certify(orgId, actor);
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: 'certify',
    detail: 'Draft notice lifted on all exports',
  });
  revalidatePath('/review');
  revalidatePath('/export');
  return { ok: true };
}

export async function revokeDocumentCertification(): Promise<{ ok: boolean; error?: string }> {
  const orgId = await currentOrgId();
  const actor = await currentRole();
  const identity = await currentIdentity();
  await revokeCertification(orgId, actor);
  await appendAudit(orgId, {
    actor,
    actorName: identity?.name,
    actorEmail: identity?.email,
    action: 'revoke-certification',
    detail: 'Draft notice restored on all exports',
  });
  revalidatePath('/review');
  revalidatePath('/export');
  return { ok: true };
}
