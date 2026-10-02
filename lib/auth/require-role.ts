import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Access control — a genuinely new thing for this app (see the
 * decision-log entry superseding D8/D71 in `.claude/context/03-decision-log.md`).
 *
 * This is deliberately a SEPARATE, simpler system from `lib/review/role.ts`'s
 * Promoter/CS/CFO/Legal/Auditor/Merchant-Banker/Owner picker. That picker
 * answers "who is acting in the document workflow" and stays a cosmetic
 * label with no bearing on access. This file answers a different question —
 * "is the signed-in person the org's Owner" — and by the user's explicit,
 * later decision it gates exactly ONE thing: assigning a member's domain
 * role (`isOwner()`, used by `assignMemberRole`,
 * app/(app)/settings/members/actions.ts). Editing the fact base, the review
 * workflow, and downloading exports are open to every org member — Admin
 * and Member alike; a first pass at this file gated those on access level
 * too, and the user reversed that: only role ASSIGNMENT stays Owner-only.
 *
 * Two tiers, both Clerk built-ins — no dashboard configuration required:
 *   - `org:admin`  — Clerk's role for whoever created the organization, and
 *                    for anyone promoted to it. The Owner.
 *   - `org:member` — Clerk's default role for anyone invited without being
 *                    promoted.
 */

export type AccessLevel = 'OWNER' | 'EDITOR' | 'VIEWER';

/** The signed-in user's access level in their active organization. */
export async function currentAccessLevel(): Promise<AccessLevel> {
  const { has } = await auth();
  if (has({ role: 'org:admin' })) return 'OWNER';
  if (has({ role: 'org:editor' })) return 'EDITOR';
  return 'VIEWER';
}

/** Is this person the org's Owner (Clerk `org:admin`)? Assigning a member's domain role is Owner-only — everything else in the app is not. */
export async function isOwner(): Promise<boolean> {
  return (await currentAccessLevel()) === 'OWNER';
}

/**
 * The real, signed-in identity — for the audit log, never for access
 * control. Kept separate from `lib/review/role.ts`'s `currentRole()` on
 * purpose: an audit entry now carries BOTH — who really did it (this) and
 * which domain role they had while doing it (that) — rather than either one
 * replacing the other.
 */
export async function currentIdentity(): Promise<{ name: string; email: string } | null> {
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || email || 'Unknown';
  return { name, email };
}
