import { auth } from '@clerk/nextjs/server';

/**
 * The active organization's id — every org-scoped store function takes this
 * as an explicit parameter (see `lib/store/versioned-table.ts`'s doc
 * comment for why: testability, the same reasoning that keeps `currentRole`
 * self-contained but callers threading `actor` through explicitly).
 *
 * Call this exactly ONCE per request, at the top of a Server Component,
 * Server Action, or Route Handler — the same place `currentRole()` is
 * already called — and pass the result down. `OrgGate` (components/org-gate.tsx)
 * already guarantees every route reachable past it has an active
 * organization, so this only throws somewhere that guarantee was bypassed,
 * which is a bug to fix, not a case to handle gracefully.
 */
export async function currentOrgId(): Promise<string> {
  const { orgId } = await auth();
  if (!orgId) throw new Error('currentOrgId() called with no active organization — OrgGate should have prevented this.');
  return orgId;
}
