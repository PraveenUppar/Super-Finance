-- Setu — org-scoped persistence, replacing the local-JSON stores under .data/.
--
-- Run this once in the Supabase SQL Editor (Database > SQL Editor > New query,
-- paste, Run), or via the Supabase CLI (`supabase db push`) if you use it.
--
-- Two shapes cover all seven stores:
--
-- 1. `versioned_records` — a generic append-only "org + kind + key -> next
--    version" table. Five of the seven local-JSON stores (the fact base,
--    section status, certification, narrative drafts, risk dismissals) were
--    ALREADY this exact shape on disk — one growing version history per id,
--    "read latest" as the common query. One table, one set of indexes,
--    instead of five near-identical ones; `lib/store/versioned-table.ts` is
--    the one place that knows how to read/write it, and each of the five
--    stores stays a thin wrapper mapping its own field names onto `data`.
--
-- 2. Two genuinely different shapes get their own table: `audit_log` (a
--    flat, ever-growing log with no per-id "current" state — nothing to
--    version) and `comment_events` (append-only too, but many events belong
--    to one SECTION rather than one id having its own linear history).
--
-- Every table carries `org_id text not null` — the Clerk organization id.
--
-- RLS is turned ON below, with NO policies. This app only ever talks to
-- Supabase with the SECRET/service-role key, from server code that has
-- already verified a Clerk session and an active organization (proxy.ts +
-- OrgGate) and filters every query by that verified org_id itself — the
-- service-role key bypasses RLS regardless of what policies exist, so this
-- changes nothing about how the app behaves. What it buys: Supabase's own
-- dashboard otherwise flags a public table with RLS off as exposed to the
-- anon/public key, which this app never uses for these tables but some
-- future addition might reach for by habit — "on, no policies" closes that
-- gap for free (deny-all for anon/authenticated) without needing Supabase's
-- Clerk third-party-auth/JWT integration, which stays a real option later,
-- not needed now, per the "still a hobby project" decision.

create table if not exists versioned_records (
  org_id text not null,
  kind text not null,
  key text not null,
  version integer not null,
  saved_at timestamptz not null default now(),
  saved_by text not null,
  data jsonb not null,
  primary key (org_id, kind, key, version)
);

-- The only query shape this table serves: "give me every version for this
-- (org, kind, key), newest first" (for readLatest/listVersions) — the
-- primary key itself already sorts this way, so no extra index is needed.

create table if not exists audit_log (
  id bigserial primary key,
  org_id text not null,
  at timestamptz not null default now(),
  actor text not null,        -- the cosmetic Promoter/CS/CFO/.../Merchant-Banker label
  actor_name text,            -- the real, signed-in Clerk identity
  actor_email text,
  action text not null,
  detail text
);

create index if not exists audit_log_org_at_idx on audit_log (org_id, at desc);

create table if not exists comment_events (
  event_seq bigserial primary key,
  id text not null,           -- the comment's own id, shared by its post event and every resolve/reopen event
  org_id text not null,
  section_id text not null,
  author text not null,
  text text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create index if not exists comment_events_org_section_idx on comment_events (org_id, section_id, event_seq);

-- RLS on, no policies — see the comment at the top of this file. Safe to
-- re-run: enabling RLS (or re-enabling it) on a table that already has it
-- on is a no-op, not an error.
alter table versioned_records enable row level security;
alter table audit_log enable row level security;
alter table comment_events enable row level security;
