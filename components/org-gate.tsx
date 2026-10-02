import type { ReactNode } from 'react';
import { auth } from '@clerk/nextjs/server';
import { OrganizationList } from '@clerk/nextjs';

/**
 * Sits between `<ClerkProvider>` and the app's own chrome. A signed-in user
 * with no ACTIVE organization sees a bridge screen — create or select one —
 * instead of the app itself.
 *
 * Every store this app writes to is scoped by organization (see the
 * decision-log entry superseding D8/D71 in 03-decision-log.md): there is no
 * meaningful "no org" state for `/`, `/intake`, `/document` etc. to render,
 * the way there was no meaningful state for those pages to render before any
 * sign-in existed at all. `proxy.ts` already keeps a signed-OUT user off
 * every route but sign-in/sign-up; this covers the gap in between —
 * authenticated, but not yet inside a project.
 */
export async function OrgGate({ children }: { children: ReactNode }) {
  const { userId, orgId } = await auth();

  if (userId && !orgId) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            One more step
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Create or join a project
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every draft prospectus lives inside a project. Create one to start a new issuer, or
            select one you&apos;ve already been invited to.
          </p>
          <div className="mt-6 flex justify-center">
            <OrganizationList
              hidePersonal
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
