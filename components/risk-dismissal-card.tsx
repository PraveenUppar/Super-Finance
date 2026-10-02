'use client';

import { useState, useTransition } from 'react';
import { CircleHelp, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setRiskDismissal } from '@/app/(app)/review/risks/actions';
import type { RiskCategory } from '@/lib/risk';
import { formatTimestamp } from '@/lib/review/timestamp';

export interface RiskDismissalCardData {
  id: string;
  title: string;
  category: RiskCategory;
  materiality: number;
  materialityRank: number;
  totalFired: number;
  groundedIn: string;
  sourceModules: string[];
  detail: string;
  dismissed: boolean;
  storedReason: string;
  dismissedAt: string | null;
}

/**
 * D59 — "why this was flagged": corpus grounding, source module(s) and
 * materiality rank. Review-page-only, deliberately never printed in the
 * document itself (`risk-factors.ts` prints only `detail()`/the drafted
 * paragraph) — an investor reads a disclosure, a reviewer reads why a
 * screening tool raised it, and those are different documents.
 */
function WhyFlagged({ risk }: { risk: RiskDismissalCardData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <CircleHelp className="h-3.5 w-3.5" />
        {open ? 'Hide' : 'Why this was flagged'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border-l-2 border-border bg-muted/40 py-2 pl-3 pr-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="text-muted-foreground/70">Grounded in: </span>
            {risk.groundedIn}
          </p>
          <p className="mt-2">
            <span className="text-muted-foreground/70">Source module{risk.sourceModules.length > 1 ? 's' : ''}: </span>
            {risk.sourceModules.join(', ')}
          </p>
          <p className="mt-2">
            <span className="text-muted-foreground/70">Materiality rank: </span>
            {risk.materialityRank} of {risk.totalFired} fired risks (value {risk.materiality.toFixed(2)})
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * One risk, with the reviewing merchant banker's call on it (S10's
 * "dismiss-with-reason, logged" gate). A dismissed risk drops out of the
 * printed document (`risk-factors.ts`) but stays visible and reversible here
 * — the review record, not the document, is where a false-positive trigger
 * gets adjudicated.
 *
 * The dismiss form stays collapsed until asked for — showing a full reason
 * textarea on all 16+ cards by default, most of which nobody intends to
 * exclude, was the main source of clutter on this page.
 */
export function RiskDismissalCard({ risk, index }: { risk: RiskDismissalCardData; index: number }) {
  const [reason, setReason] = useState(risk.dismissed ? risk.storedReason : '');
  const [error, setError] = useState<string | null>(null);
  const [excluding, setExcluding] = useState(false);
  const [pending, startTransition] = useTransition();

  const act = (dismissed: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setRiskDismissal(risk.id, dismissed, reason);
      if (!result.ok) setError(result.error ?? 'Could not save.');
      else if (dismissed) setExcluding(false);
    });
  };

  return (
    <li className={`py-4 ${risk.dismissed ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-foreground">
          {index + 1}. {risk.title}
        </span>
        {risk.dismissed && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Excluded
          </span>
        )}
      </div>

      <div>
        <p className="mt-1.5 text-sm text-muted-foreground">{risk.detail}</p>
        <WhyFlagged risk={risk} />

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        {risk.dismissed ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => act(false)}>
              <RotateCcw className="h-3 w-3" />
              Reinstate
            </Button>
            {risk.storedReason && (
              <p className="text-xs text-muted-foreground">
                &ldquo;{risk.storedReason}&rdquo;
                {risk.dismissedAt && <> &middot; {formatTimestamp(risk.dismissedAt)}</>}
              </p>
            )}
          </div>
        ) : excluding ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              autoFocus
              placeholder="Reason to exclude this from the printed document (required)"
              rows={2}
              className="w-full max-w-lg rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pending || reason.trim().length === 0}
                onClick={() => act(true)}
              >
                Confirm exclude
              </Button>
              <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => setExcluding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="xs" className="mt-3" onClick={() => setExcluding(true)}>
            <EyeOff className="h-3 w-3" />
            Exclude from document
          </Button>
        )}
      </div>
    </li>
  );
}
