import {
  ArrowRightLeft,
  MessageSquarePlus,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  EyeOff,
  History,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { readAuditLog, type AuditEntry } from '@/lib/store/audit-log';
import { ROLE_LABELS } from '@/lib/review/types';
import { formatTimestamp } from '@/lib/review/timestamp';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  'section-status': 'Section status changed',
  comment: 'Comment posted',
  'resolve-comment': 'Comment resolved',
  'reopen-comment': 'Comment reopened',
  certify: 'Document certified',
  'revoke-certification': 'Certification revoked',
  dismiss: 'Risk excluded from document',
  reinstate: 'Risk reinstated',
  'assign-role': 'Role assigned',
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  'section-status': ArrowRightLeft,
  comment: MessageSquarePlus,
  'resolve-comment': CheckCircle2,
  'reopen-comment': RotateCcw,
  certify: ShieldCheck,
  'revoke-certification': ShieldAlert,
  dismiss: EyeOff,
  reinstate: RotateCcw,
  'assign-role': UserCog,
};

/** Some actions carry enough weight to earn a warmer accent than the default muted one. */
const ACTION_ACCENT: Record<string, string> = {
  certify: 'bg-emerald-500/10 text-emerald-500',
  'revoke-certification': 'bg-amber-500/10 text-amber-500',
  dismiss: 'bg-amber-500/10 text-amber-500',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function AuditRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const Icon = ACTION_ICONS[entry.action] ?? History;
  const accent = ACTION_ACCENT[entry.action] ?? 'bg-muted text-muted-foreground';
  const who = entry.actorName ?? entry.actorEmail ?? 'Unknown';

  return (
    <li className="relative flex gap-4 px-5 py-4">
      {/* The connecting line behind the icon column — a real timeline, not just a list. */}
      {!isLast && <span className="absolute top-11 bottom-0 left-[35px] w-px bg-border" aria-hidden />}

      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accent}`}>
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</p>
          <p className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(entry.at)}</p>
        </div>
        {entry.detail && <p className="mt-0.5 text-sm text-muted-foreground">{entry.detail}</p>}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
            {initials(who)}
          </span>
          <span className="text-xs text-muted-foreground">
            {who} <span className="text-muted-foreground/60">&middot; {ROLE_LABELS[entry.actor] ?? entry.actor}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

/**
 * The audit trail — every review action, who really did it (the signed-in
 * Clerk identity) and when, newest first. Read-only by nature: an audit
 * trail's job is to be trusted, not edited.
 */
export default async function AuditLogPage() {
  const entries = await readAuditLog(await currentOrgId());

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Audit log</p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">Every review action, in order</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {entries.length === 0
          ? 'Nothing recorded yet.'
          : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, newest first.`}
      </p>

      <div className="mt-8">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <History className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No review actions recorded yet — changing a section&apos;s status, commenting, certifying or
              dismissing a risk will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
            {entries.map((e, i) => (
              <AuditRow key={e.id} entry={e} isLast={i === entries.length - 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
