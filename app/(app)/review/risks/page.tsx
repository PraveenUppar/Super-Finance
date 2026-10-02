import { riskArchetypes, selectRisks } from '@/lib/risk';
import { readDismissal } from '@/lib/store/risk-dismissal-store';
import { loadIssuer } from '@/lib/issuer';
import { findModule } from '@/lib/modules';
import { RiskDismissalCard } from '@/components/risk-dismissal-card';
import { currentOrgId } from '@/lib/auth/org-context';

/** "M5" -> "M5 · Business Operations", falling back to the bare id if a module was ever renumbered. */
const moduleLabel = (id: string) => {
  const m = findModule(id);
  return m ? `${id} · ${m.title}` : id;
};

export const dynamic = 'force-dynamic';

/**
 * The review page behind S10's "dismiss-with-reason, logged" gate.
 *
 * Every archetype that FIRES for this issuer is listed here — dismissed or
 * not — because reviewing a false-positive trigger is exactly the workflow
 * the printed Risk Factors section cannot host (it only ever shows what the
 * reviewer stands behind, per `risk-factors.ts`'s D58 note). This page is
 * the diligence-file view; the document is the deliverable view.
 */
export default async function RiskReviewPage() {
  const orgId = await currentOrgId();
  const { facts } = await loadIssuer(orgId);
  const risks = selectRisks(riskArchetypes, facts);

  const cards = await Promise.all(
    risks.map(async (risk) => {
      const record = await readDismissal(orgId, risk.id);
      return {
        id: risk.id,
        title: risk.title,
        category: risk.category,
        materiality: risk.materiality,
        materialityRank: risk.materialityRank,
        totalFired: risks.length,
        groundedIn: risk.groundedIn,
        sourceModules: risk.sourceModules.map(moduleLabel),
        detail: risk.detail,
        dismissed: record?.dismissed === true,
        storedReason: record?.reason ?? '',
        dismissedAt: record?.dismissed === true ? record.dismissedAt : null,
      };
    }),
  );

  const excludedCount = cards.filter((c) => c.dismissed).length;

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Risk review
      </p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
        {facts.company.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {risks.length} archetype{risks.length === 1 ? '' : 's'} fired against the current facts
        {excludedCount > 0 && `, ${excludedCount} excluded from the printed document`}.
      </p>

      <div className="mt-8">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No archetype fires against the current facts.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card px-5 shadow-sm">
            {cards.map((risk, i) => (
              <RiskDismissalCard key={risk.id} risk={risk} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
