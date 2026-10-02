import type { Role } from '../review/types';
import { supabaseAdmin } from './supabase-client';

/**
 * The append-only audit log — S12's "who did what, when" gate, now the
 * `audit_log` table (see the migration file) instead of one growing local
 * JSON array. There is no natural "id" an entry replaces — every entry is
 * its own event, forever — so this is a flat table, not a `versioned_records`
 * wrapper the way five of the other six stores are.
 *
 * Every review-workflow action (`app/(app)/review/actions.ts`) appends here
 * after its own store write, and so does the risk-dismissal action and every
 * intake write — see `lib/auth/require-role.ts`'s `currentIdentity()` for
 * where `actorName`/`actorEmail` come from.
 *
 * Interface + real Supabase implementation + fake in-memory implementation,
 * same shape as `document-storage.ts` and `versioned-table.ts` — see either
 * for why.
 */

export interface AuditEntry {
  id: string;
  at: string;
  /** The Promoter/CS/CFO/.../Merchant-Banker label chosen on /intake — cosmetic, see lib/review/types.ts. */
  actor: Role;
  /** The real, signed-in identity (lib/auth/require-role.ts's currentIdentity()) — absent for entries logged before Clerk existed. */
  actorName?: string;
  actorEmail?: string;
  action: string;
  detail?: string;
}

export interface NewAuditEntry {
  actor: Role;
  actorName?: string;
  actorEmail?: string;
  action: string;
  detail?: string;
}

export interface AuditLog {
  append(orgId: string, entry: NewAuditEntry): Promise<AuditEntry>;
  /** Newest first — an audit log is read backwards, from "what just happened". */
  readAll(orgId: string): Promise<AuditEntry[]>;
}

function createSupabaseAuditLog(): AuditLog {
  const client = supabaseAdmin();
  return {
    async append(orgId, entry) {
      const row = {
        org_id: orgId,
        actor: entry.actor,
        actor_name: entry.actorName ?? null,
        actor_email: entry.actorEmail ?? null,
        action: entry.action,
        detail: entry.detail ?? null,
      };
      const { data, error } = await client.from('audit_log').insert(row).select().single();
      if (error) throw new Error(`audit_log append failed: ${error.message}`);
      return {
        id: String(data.id),
        at: data.at,
        actor: data.actor,
        actorName: data.actor_name ?? undefined,
        actorEmail: data.actor_email ?? undefined,
        action: data.action,
        detail: data.detail ?? undefined,
      };
    },
    async readAll(orgId) {
      const { data, error } = await client.from('audit_log').select('*').eq('org_id', orgId).order('at', { ascending: false });
      if (error) throw new Error(`audit_log readAll failed: ${error.message}`);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        at: r.at,
        actor: r.actor,
        actorName: r.actor_name ?? undefined,
        actorEmail: r.actor_email ?? undefined,
        action: r.action,
        detail: r.detail ?? undefined,
      }));
    },
  };
}

function createFakeAuditLog(): AuditLog {
  const entries: (AuditEntry & { orgId: string })[] = [];
  return {
    async append(orgId, entry) {
      const next: AuditEntry & { orgId: string } = { id: `a${entries.length + 1}`, at: new Date().toISOString(), orgId, ...entry };
      entries.push(next);
      return next;
    },
    async readAll(orgId) {
      return entries.filter((e) => e.orgId === orgId).slice().reverse();
    },
  };
}

let active: AuditLog | null = null;
function auditLog(): AuditLog {
  if (!active) active = createSupabaseAuditLog();
  return active;
}
export function __setAuditLogForTests(log: AuditLog | null): void {
  active = log;
}

export async function appendAudit(orgId: string, entry: NewAuditEntry): Promise<AuditEntry> {
  return auditLog().append(orgId, entry);
}

export async function readAuditLog(orgId: string): Promise<AuditEntry[]> {
  return auditLog().readAll(orgId);
}

export { createFakeAuditLog };
