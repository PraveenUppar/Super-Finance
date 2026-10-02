import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Paperclip, AlertTriangle, Building2 } from 'lucide-react';
import { ModuleForm } from '@/components/module-form';
import { MODULE_ICONS } from '@/components/module-icons';
import { allProgress, feedsIntoTitles, findModule } from '@/lib/modules';
import { capitalConsistency } from '@/lib/capital/tables';
import { withAnswers } from '@/lib/seed/empty';
import { applicableFields, fieldStatus, toFieldView } from '@/lib/modules/types';
import { getFact } from '@/lib/facts/provenance';
import { readFactBase } from '@/lib/store/fact-store';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const module = findModule(moduleId);
  if (!module) notFound();

  const orgId = await currentOrgId();
  const { facts } = await readFactBase(orgId);
  const fields = applicableFields(module, facts);

  /**
   * Everything the form needs is resolved HERE, into plain data.
   *
   * A Field carries a Zod schema and two functions, and neither crosses the
   * server/client boundary. Validation and showIf both run on this side, where
   * the schema and the whole fact base already live, so the browser never
   * carries Zod or the section registry.
   */
  const views = fields.map((f) => {
    const value = getFact(facts, f.path);
    return toFieldView(f, value, feedsIntoTitles(f.feedsInto), fieldStatus(f, facts, value).issues);
  });

  /**
   * Live capital consistency, computed here and shown above the form.
   *
   * The same arithmetic the rule engine reports to the gap dashboard, surfaced
   * where the issuer is actually typing — a shareholding register that reaches
   * 99.4% should be visible on the screen that caused it, not in week nine.
   */
  const consistency = module.id === 'M2' ? capitalConsistency(withAnswers(facts)) : [];

  const progress = allProgress(facts).find((p) => p.moduleId === module.id)!;
  const percent = progress.applicable > 0 ? Math.round((progress.answered / progress.applicable) * 100) : 0;
  const Icon = MODULE_ICONS[module.id] ?? Building2;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Link
        href="/intake"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All modules
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4.5 w-4.5 text-foreground" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {module.id}
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{module.title}</h1>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{module.purpose}</p>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {progress.answered} of {progress.applicable}
        </span>
        {progress.withIssues > 0 && (
          <span className="shrink-0 text-xs text-amber-500">{progress.withIssues} need attention</span>
        )}
      </div>

      {module.requestsDocuments.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Worth having to hand
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {module.requestsDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {consistency.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            These numbers do not agree yet
          </p>
          <ul className="mt-2 space-y-2">
            {consistency.map((c) => (
              <li key={c.message} className="text-sm">
                <span className="font-medium">{c.message}</span>
                <span className="block text-muted-foreground">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-card px-6 py-2 shadow-sm">
        <ModuleForm moduleId={module.id} fields={views} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Every answer saves as you leave the field, and each save is a new version — nothing is
        overwritten. Leave and come back whenever you like.
      </p>
    </div>
  );
}
