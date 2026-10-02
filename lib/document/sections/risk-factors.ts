import { riskArchetypes, selectRisks, type RiskCategory } from '../../risk';
import { readNarrative } from '../../store/narrative-store';
import { readDismissal } from '../../store/risk-dismissal-store';
import type { DocumentNode } from '../nodes';
import type { RenderContext, SectionSpec } from '../section';
import { gap, h2, h3, h4, para } from './helpers';

/**
 * RISK FACTORS — section map #4, the hardest section (29-42pp observed,
 * producer N). This is NOT a Wave 1 extraction: unlike Forward Looking
 * Statements or Offer Procedure, the corpus fixtures on disk hold only the
 * restated-financials half of each document (D0's reversed corpus), so there
 * is no locally-verified Risk Factors boilerplate to extract from. Nothing
 * here is presented as corpus-sourced prospectus language.
 *
 * What IS real: `selectRisks()` (S10, lib/risk/) is a deterministic,
 * grounded selection over the fact base, and each archetype's `detail()`
 * states the issuer's own numbers — the same "show the arithmetic" standard
 * `Rule.detail` holds elsewhere (D44). So this section is legitimately
 * `producer: 'computed'`, not `'narrative'`: the SELECTION and the terse
 * statement of each risk is pure TS, and only the bespoke, corpus-styled
 * prose expansion is the S9/S10 LLM's job.
 *
 * D50: that LLM job now has a harness (`lib/llm/narrative.ts`) and a
 * per-risk draft store, keyed `risk.<archetype id>`. `compute()` is
 * synchronous — a draft cannot be generated inline at render time — so it
 * reads whatever `readNarrative()` finds: a drafted paragraph where one has
 * been generated ahead of time, the terse computed `detail()` sentence
 * otherwise. Same fallback shape D45 already established for the section as
 * a whole: real content where it exists, an honest placeholder where it
 * does not, never a blend that looks more finished than it is.
 *
 * Deliberately does not claim completeness. Sixteen archetypes exist against
 * a ~40 design target (D44/D49/D57), so a trailing gap says so explicitly
 * rather than letting an issuer read a short list as an exhaustive one — the
 * same instinct that keeps the readiness score from reading as more done than
 * it is (D22).
 *
 * D58: a triggered archetype can be REVIEWED AND EXCLUDED, not only accepted.
 * `readDismissal()` (`lib/store/risk-dismissal-store.ts`) holds the reviewing
 * merchant banker's call on a false-positive trigger, with a reason. A
 * dismissed risk is dropped from the printed section entirely — the same way
 * a real prospectus prints only the risks the banker actually stands behind,
 * not a list of everything a screening tool once flagged — but the exclusion
 * itself is never silent: the intro note states how many were reviewed and
 * excluded, and the full reasoning is on record in the dismissal store for
 * the diligence file (`/review/risks` reads and writes it). MM4's "never
 * invent, and never silently omit" cuts both ways here: a suppressed risk
 * with no visible trace would be exactly the kind of omission the project
 * exists to prevent.
 */

const CATEGORY_HEADING: Record<RiskCategory, string> = {
  business: 'Risks Relating to Our Business and Operations',
  financial: 'Risks Relating to Our Financial Condition',
  legal: 'Risks Relating to Legal and Regulatory Matters',
  promoter: 'Risks Relating to Our Promoters and Promoter Group',
  industry: 'Risks Relating to Our Industry',
  offer: 'Risks Relating to this Issue and Our Equity Shares',
};

const CATEGORY_ORDER: RiskCategory[] = ['business', 'financial', 'legal', 'promoter', 'industry', 'offer'];

export const riskFactors: SectionSpec = {
  id: 'general.riskFactors',
  partOf: '4. Risk Factors',
  title: 'Risk Factors',
  producer: 'computed',
  order: 400,
  group: 'SECTION - RISK FACTORS',
  clause: 'ICDR Schedule VI Part A',
  compute: async ({ orgId, facts }: RenderContext): Promise<DocumentNode[]> => {
    const allRisks = selectRisks(riskArchetypes, facts);
    const dismissals = new Map(
      await Promise.all(allRisks.map(async (r) => [r.id, await readDismissal(orgId, r.id)] as const)),
    );
    const dismissedCount = allRisks.filter((r) => dismissals.get(r.id)?.dismissed === true).length;
    const risks = allRisks.filter((r) => dismissals.get(r.id)?.dismissed !== true);
    const nodes: DocumentNode[] = [
      h2('Risk Factors'),
      {
        type: 'paragraph',
        runs: [
          {
            text:
              'The risks below are identified from the facts on file for this issuer, ranked by materiality, ' +
              'and stated with the underlying figures. This list is preliminary and MACHINE-GENERATED: it is not ' +
              'yet the drafted narrative a merchant banker would certify, and it does not yet cover every category ' +
              'of risk a real prospectus would address.' +
              (dismissedCount > 0
                ? ` ${dismissedCount} additional ${dismissedCount === 1 ? 'risk was' : 'risks were'} auto-flagged and subsequently reviewed and excluded — see the risk review page for the reasoning on file.`
                : ''),
            italic: true,
          },
        ],
      },
    ];

    for (const category of CATEGORY_ORDER) {
      const inCategory = risks.filter((r) => r.category === category);
      if (inCategory.length === 0) continue;

      nodes.push(h3(CATEGORY_HEADING[category]));
      for (const risk of inCategory) {
        nodes.push(h4(risk.title));
        const drafted = await readNarrative(orgId, `risk.${risk.id}`, risk.factSlice);
        nodes.push(para(drafted?.text ?? risk.detail));
      }
    }

    const flagged =
      risks.length === 0
        ? 'no risks have been identified yet'
        : `only the ${risks.length} identified above`;
    nodes.push(
      gap(
        'general.riskFactors.narrative',
        `Full narrative drafting of the risk factors, and identification of further risks beyond what an archetype currently covers — ${flagged}`,
      ),
    );

    return nodes;
  },
};
