import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/sidebar";
import { OrgGate } from "@/components/org-gate";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

/**
 * The app's own chrome, as a route group so it never wraps `/sign-in` or
 * `/sign-up` — those live outside `(app)` at the root, sharing only
 * `app/layout.tsx`'s `<ClerkProvider>` and fonts.
 *
 * Two of this group's own routes are public (`proxy.ts`): `/` (the pitch)
 * and `/eligibility` (the no-signup pre-check). An anonymous visitor can
 * therefore reach THIS layout without a session — the sidebar, which lists
 * nav destinations they can't use yet, would be confusing, and `OrgGate`'s
 * "create or join a project" bridge makes no sense without an identity to
 * attach a project to. So: no session at all -> a bare public shell, no
 * sidebar, no org check. A session but no active organization -> `OrgGate`'s
 * existing bridge. Both -> the full app chrome, unchanged.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="min-h-svh">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <Link href="/" className="font-heading text-sm font-semibold tracking-tight">
            Super Finance
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
              Sign in
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
              Create an account
            </Button>
          </div>
        </header>
        {children}
      </div>
    );
  }

  return (
    <OrgGate>
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </OrgGate>
  );
}
