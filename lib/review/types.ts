/**
 * S12 — shared review-workflow types.
 *
 * Deliberately pure (no `node:fs`, no `next/headers`): `role-picker.tsx` is
 * a client component and needs `Role`/`ROLES`/`ROLE_LABELS` without dragging
 * in server-only code, the same reason `lib/modules/types.ts` keeps `Field`
 * (server-only: a Zod schema and two functions) separate from `FieldView`
 * (plain data the client can hold).
 */

/**
 * Who is "acting" right now — cosmetic, unrelated to access (see the
 * decision-log entry superseding D8/D71: `lib/auth/require-role.ts` is the
 * real access-control system now).
 *
 * `OWNER` is never assigned by anyone — it's derived automatically for
 * whoever holds Clerk's `org:admin` role (`currentRole()`,
 * `lib/review/role.ts`), the same person `lib/auth/require-role.ts` calls
 * access-level `OWNER`. The other six are assigned, one per member, by that
 * Owner (`ASSIGNABLE_ROLES` below) — `MERCHANT_BANKER` is the only one with
 * no module `assignableTo` default (see `lib/modules/types.ts`'s
 * `Assignee`): the MB reviews and certifies, never fills a module.
 */
export type Role = 'OWNER' | 'PROMOTER' | 'CS' | 'CFO' | 'LEGAL' | 'AUDITOR' | 'MERCHANT_BANKER';

export const ROLES: Role[] = ['OWNER', 'PROMOTER', 'CS', 'CFO', 'LEGAL', 'AUDITOR', 'MERCHANT_BANKER'];

/** The roles an Owner can hand to a member — everything except `OWNER` itself, which is never assigned. */
export const ASSIGNABLE_ROLES: Role[] = ROLES.filter((r) => r !== 'OWNER');

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  PROMOTER: 'Promoter',
  CS: 'Company Secretary',
  CFO: 'Chief Financial Officer',
  LEGAL: 'Legal counsel',
  AUDITOR: 'Auditor',
  MERCHANT_BANKER: 'Merchant Banker',
};

/** Unknown, missing, or unassigned input defaults to Promoter — the coordinator, and the role a not-yet-assigned member shows as. */
export function parseRole(raw: string | undefined | null): Role {
  return (ASSIGNABLE_ROLES as string[]).includes(raw ?? '') ? (raw as Role) : 'PROMOTER';
}

/**
 * A section's place in the review workflow. Independent of the fact base —
 * a section can be Reviewed while its underlying facts keep changing; that
 * mismatch is exactly what a reviewer re-opening it to Draft is for.
 */
export type SectionStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'REVIEWED' | 'LOCKED';

export const SECTION_STATUSES: SectionStatus[] = ['DRAFT', 'READY_FOR_REVIEW', 'REVIEWED', 'LOCKED'];

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  DRAFT: 'Draft',
  READY_FOR_REVIEW: 'Ready for review',
  REVIEWED: 'Reviewed',
  LOCKED: 'Locked',
};
