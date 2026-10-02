import Link from 'next/link';
import { Building2, UserCircle2 } from 'lucide-react';
import { allProgress, moduleRegistry } from '@/lib/modules';
import { readFactBase } from '@/lib/store/fact-store';
import { currentOrgId } from '@/lib/auth/org-context';
import { currentRole } from '@/lib/review/role';
import { isOwner } from '@/lib/auth/require-role';
import { ROLE_LABELS } from '@/lib/review/types';
import { MODULE_ICONS } from '@/components/module-icons';
import { LoadDemoDataButton } from '@/components/load-demo-data-button';
import { ResetDataButton } from '@/components/reset-data-button';

/**
 * The module list — the issuer's home page during intake.
 *
 * It answers three questions at a glance: what is left, who should do it, and
 * how long it takes. The time estimates are honest rather than encouraging;
 * M2 really does run to three or four hours, and a promoter who plans for
 * forty minutes and hits hour three stops trusting the tool.
 */

export const dynamic = 'force-dynamic';

function hoursMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default async function IntakePage() {
  const orgId = await currentOrgId();
  const { facts } = await readFactBase(orgId);
  const progress = allProgress(facts);
  const byId = new Map(progress.map((p) => [p.moduleId, p]));

  const totalApplicable = progress.reduce((n, p) => n + p.applicable, 0);
  const totalAnswered = progress.reduce((n, p) => n + p.answered, 0);
  const overallPercent =
    totalApplicable > 0 ? Math.round((totalAnswered / totalApplicable) * 100) : 0;

  /**
   * S12's module scoping: the current role sees only what it would be
   * handed to fill (`assignableTo`, unchanged from S3/S8 — no per-issuer
   * override was built, per the user's decision). A role no module
   * defaults to (Merchant Banker, sometimes Auditor, and now Owner) would
   * otherwise see an empty list and nowhere to go, so it falls back to
   * showing everything. `role` itself now comes from the Owner's assignment
   * (`lib/review/role.ts`), not a self-picked cookie — see the decision-log
   * entry superseding D8/D71.
   */
  const role = await currentRole();
  const scoped = moduleRegistry.filter((m) => m.assignableTo === role);
  const visibleModules = scoped.length > 0 ? scoped : moduleRegistry;
  const canAssignRoles = await isOwner();

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Intake
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
            {typeof facts.company?.name === 'string' && facts.company.name
              ? facts.company.name
              : 'Pending company details'}
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <ResetDataButton />
          <LoadDemoDataButton />
        </div>
      </div>

      {/* The one number that matters most, made hard to miss. */}
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <p className="font-heading text-3xl font-semibold tabular-nums">
              {totalAnswered}
              <span className="text-lg font-normal text-muted-foreground"> / {totalApplicable}</span>
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Questions answered
            </p>
          </div>
          <p className="font-heading text-2xl font-semibold tabular-nums text-muted-foreground">
            {overallPercent}%
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Acting as <span className="font-medium text-foreground">{ROLE_LABELS[role]}</span>
          </span>
        </div>
        {canAssignRoles && (
          <Link
            href="/settings/members"
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Assign roles to your team
          </Link>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {visibleModules.map((m) => {
          const p = byId.get(m.id)!;
          const done = p.answered === p.applicable && p.withIssues === 0;
          const Icon = MODULE_ICONS[m.id] ?? Building2;
          return (
            <Link
              key={m.id}
              href={`/intake/${m.id.toLowerCase()}`}
              className={`block rounded-lg border bg-card p-5 shadow-sm transition-colors ${
                p.unlocked
                  ? 'border-border hover:border-foreground/30'
                  : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4.5 w-4.5 text-foreground" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-heading font-semibold">
                      <span className="mr-2 text-muted-foreground">{m.id}</span>
                      {m.title}
                    </h3>
                    <span
                      className={`text-sm tabular-nums ${
                        done ? 'text-emerald-500' : 'text-muted-foreground'
                      }`}
                    >
                      {done ? 'Complete' : `${p.percent}%`}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">{m.purpose}</p>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <span className="text-muted-foreground/70">For: </span>
                      {ROLE_LABELS[m.assignableTo]}
                    </span>
                    <span>
                      <span className="text-muted-foreground/70">About: </span>
                      {hoursMinutes(m.estimatedMinutes)}
                    </span>
                    <span>
                      <span className="text-muted-foreground/70">Questions: </span>
                      {p.answered} of {p.applicable}
                    </span>
                    {p.withIssues > 0 && (
                      <span className="text-amber-500">{p.withIssues} need attention</span>
                    )}
                    {!p.unlocked && (
                      <span className="text-muted-foreground/70">
                        Needs {m.dependsOn.join(', ')} first
                      </span>
                    )}
                  </dl>

                  {/* Progress bar, because a percentage alone is easy to skim past. */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full ${done ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
        Each module can be handed to the person who holds the facts. A module opens once the ones
        it depends on are complete; the time shown is what it actually takes.
      </p>
    </div>
  );
}
