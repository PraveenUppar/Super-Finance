import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Auth gate for the whole app — Next 16 renamed `middleware.ts` to
 * `proxy.ts` (same mechanism, new file/export name; see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md). Clerk's
 * `clerkMiddleware()` still returns a plain `(request, event) => Response`
 * function, which is all this file's own naming convention cares about — the
 * default export just has to be a function.
 *
 * The sign-in/sign-up pages, the home page, and the standalone eligibility
 * pre-check are public. Everything else — including the API/export routes —
 * requires a session; `auth.protect()` redirects an unauthenticated browser
 * request to sign-in and 404s an unauthenticated API-style request (Clerk's
 * own distinction, not something this file has to implement itself).
 *
 * `/` and `/eligibility` are deliberately public: the home page is the
 * app's own pitch (it should never bounce a first-time visitor straight to
 * Clerk's sign-in screen before they've seen what this is), and the
 * eligibility pre-check was always meant to work with "no account, nothing
 * saved" — gating it behind sign-in contradicted that pitch. Neither page
 * reads or writes anything org-scoped when signed out; see `app/(app)/page.tsx`
 * and `app/(app)/layout.tsx` for how they stay safe to render unauthenticated.
 *
 * This only proves "someone is signed in" — editing and downloading are
 * open to every org member (Admin and Member alike; only assigning a
 * member's ROLE is Owner-only, `lib/auth/require-role.ts`'s `isOwner()`).
 * `OrgGate` (components/org-gate.tsx) is what this file leans on for "and
 * they're actually in an organization" — the thing every store under
 * lib/store/ is scoped by.
 */
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/', '/eligibility(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, but always run for API-shaped routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
