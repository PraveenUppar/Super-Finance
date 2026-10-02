/**
 * The one shared loading skeleton for every page under `(app)`. Placed once
 * as `app/(app)/loading.tsx`, Next.js uses it as the Suspense fallback for
 * whichever route is navigated to — home, intake, document, review, export,
 * settings — while that page's own server-side data fetch (the fact base,
 * Clerk's member list, etc.) is still in flight. One file, one component,
 * instead of a bespoke skeleton per route.
 */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-8 py-12">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-3 h-7 w-72 rounded bg-muted" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
