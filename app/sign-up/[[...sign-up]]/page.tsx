import { SignUp } from '@clerk/nextjs';

/**
 * Also the landing page for an invited member accepting an email invite —
 * Clerk completes the invitation as part of this same sign-up flow. Without
 * an explicit fallback redirect, a fresh account with nothing else to fall
 * back to lands on Clerk's own generic "start building" screen instead of
 * this app; `fallbackRedirectUrl` is what sends them to `/` instead, where
 * `OrgGate` already recognizes they're in an organization now and shows the
 * real app.
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <SignUp fallbackRedirectUrl="/" />
    </div>
  );
}
