import { OrganizationProfile } from '@clerk/nextjs';
import { clerkClient, auth } from '@clerk/nextjs/server';
import { Users } from 'lucide-react';
import { MemberRoleRow, type MemberRoleRowData } from '@/components/member-role-row';
import { isOwner } from '@/lib/auth/require-role';
import { currentOrgId } from '@/lib/auth/org-context';
import { readMemberRole } from '@/lib/store/member-role-store';

export const dynamic = 'force-dynamic';

/**
 * The sidebar's "Members" destination.
 *
 * Two concerns, two halves of the page: WHO can get in and edit/download at
 * all (Clerk's own `<OrganizationProfile />` — invite, remove, Admin/Member
 * access — `lib/auth/require-role.ts`) versus WHICH domain role
 * (Promoter/CS/CFO/Legal/Auditor/Merchant Banker) each of them plays in the
 * document workflow (this page's own "Domain roles" table, new alongside
 * real auth — see the decision-log entry superseding D8/D71). Clerk's
 * widget has no way to embed a custom per-member field, so the second half
 * is hand-built, reading the org's real member list from Clerk's server SDK
 * and each one's assignment from `lib/store/member-role-store.ts`.
 *
 * Only the Owner sees an editable dropdown — `assignMemberRole` re-checks
 * `isOwner()` itself regardless, since a client-side gate alone is never
 * the real one.
 */
export default async function MembersPage() {
  const orgId = await currentOrgId();
  const { userId: viewerId } = await auth();
  const canAssign = await isOwner();

  const client = await clerkClient();
  const { data: memberships } = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
  });

  const members: MemberRoleRowData[] = await Promise.all(
    memberships.map(async (m) => {
      const userId = m.publicUserData?.userId ?? '';
      const name =
        [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ').trim() ||
        m.publicUserData?.identifier ||
        'Unknown';
      return {
        userId,
        name,
        email: m.publicUserData?.identifier ?? '',
        isOwner: m.role === 'org:admin',
        role: m.role === 'org:admin' ? null : await readMemberRole(orgId, userId),
      };
    }),
  );

  // The signed-in viewer first, then everyone else alphabetically — you
  // always know at a glance which row is you.
  members.sort((a, b) => {
    if (a.userId === viewerId) return -1;
    if (b.userId === viewerId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Project</p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Who has access, and which part of the document workflow each person plays.
      </p>

      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          Domain roles
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canAssign
            ? 'Assign each member the part they play — only you, as Owner, can change this.'
            : 'Only the Owner can assign roles.'}
        </p>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
          {members.map((m) => (
            <MemberRoleRow key={m.userId} member={m} canAssign={canAssign} />
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-foreground">Access &amp; invites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite by email, remove someone, or change who&apos;s an Admin — Clerk sends the invite itself.
        </p>
        <div className="mt-3 flex justify-center">
          <OrganizationProfile routing="hash" />
        </div>
      </div>
    </div>
  );
}
