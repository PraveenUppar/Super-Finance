import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * One shared service-role client for every org-scoped store — mirrors
 * `document-storage.ts`'s `supabaseAdminClient()` (same env var names, same
 * SECRET-not-PUBLISHABLE key, same fallback to `NEXT_PUBLIC_SUPABASE_URL`),
 * just exported for reuse instead of redeclared per file.
 *
 * Runs server-side only. This key is never exposed to the client, and
 * nothing here relies on Postgres RLS to enforce organization isolation —
 * see the migration file's own comment for why: every caller already
 * verified a Clerk session and org before reaching this point, and every
 * query below filters by that org id explicitly.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local. Project Settings -> API in the Supabase dashboard -> "Connect" gives you both, already named this way.',
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
