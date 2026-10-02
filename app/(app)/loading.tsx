import { PageSkeleton } from '@/components/page-skeleton';

/**
 * One file covers every route under `(app)` — Next.js wraps whichever
 * page is being navigated to in a Suspense boundary and shows this while
 * that page's own server-side data fetch is in flight, unless a more
 * specific `loading.tsx` exists closer to that route. None currently do,
 * so this is the loading state for `/`, `/intake`, `/document`, `/review`,
 * `/export`, `/settings/members` and everything else in the group alike.
 */
export default function Loading() {
  return <PageSkeleton />;
}
