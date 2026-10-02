'use client';

import { useState, useTransition } from 'react';
import { assignMemberRole } from '@/app/(app)/settings/members/actions';
import { ASSIGNABLE_ROLES, ROLE_LABELS, type Role } from '@/lib/review/types';

export interface MemberRoleRowData {
  userId: string;
  name: string;
  email: string;
  /** Clerk's own access role — 'Owner' is derived, never stored (lib/review/role.ts). */
  isOwner: boolean;
  /** The currently assigned domain role, or null if the Owner hasn't assigned one yet. */
  role: Role | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * One member row on the Members page's "Domain roles" table.
 *
 * `canAssign` is passed down from the server component rather than checked
 * here — a client component cannot call `isOwner()` itself (that needs
 * Clerk's server-only `auth()`), and trusting a client-side re-check would
 * be exactly the kind of confused-deputy bug this project's server actions
 * already guard against by re-checking `isOwner()` themselves regardless.
 * This prop only controls whether the DROPDOWN renders; `assignMemberRole`
 * is the real gate.
 */
export function MemberRoleRow({ member, canAssign }: { member: MemberRoleRowData; canAssign: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onChange = (role: Role) => {
    setError(null);
    startTransition(async () => {
      const result = await assignMemberRole(member.userId, member.name, role);
      if (!result.ok) setError(result.error ?? 'Could not save.');
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {member.isOwner ? (
          <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Owner</span>
        ) : canAssign ? (
          <select
            value={member.role ?? ''}
            disabled={pending}
            onChange={(e) => onChange(e.target.value as Role)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
          >
            {!member.role && (
              <option value="" disabled className="bg-background text-muted-foreground">
                Not assigned
              </option>
            )}
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r} className="bg-background text-foreground">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {member.role ? ROLE_LABELS[member.role] : 'Not assigned'}
          </span>
        )}
      </div>

      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </li>
  );
}
