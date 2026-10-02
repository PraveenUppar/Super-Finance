import Decimal from 'decimal.js';
import { otherFinancialInformation, type YearRatios } from '../../financials/ratios';
import { fiscal, rupees } from '../format';
import { readNarrative } from '../../store/narrative-store';
import type { FactBase } from '../../facts/schema';
import type { DocumentNode } from '../nodes';
import type { RenderContext, SectionSpec } from '../section';
import { gap, h2, h3, para, table } from './helpers';

/**
 * BASIS FOR ISSUE PRICE — section map #12, producer "N + C", the second of
 * S9's two originally-blocked sections (D54's note). Unblocked by D64: the
 * issuer's own EPS, RoNW and NAV were already computed
 * (`lib/financials/ratios.ts`, S8) — the genuinely missing ingredient was
 * the PEER side, `offer.industryPeers`, which cannot be derived from the
 * issuer's own facts at all and needed a real new question (M9).
 *
 * Same "computed section that embeds a per-section narrative draft" shape
 * `risk-factors.ts` established (D50): the opening paragraph is drafted
 * through the S9 harness and read back here, with the honest computed
 * fallback where no draft exists yet; everything below it — the ratio
 * tables, the P/E computation, the peer comparison — is pure TS, because a
 * wrong number here is exactly the kind of thing MM4 exists to prevent.
 *
 * Deliberately does NOT draft "qualitative factors" as prose. A real
 * prospectus's qualitative factors are the company's own claimed strengths
 * ("experienced promoters," "established customer relationships"), which
 * this fact base has no honest way to state without either inventing a
 * strength or duplicating Our Business's own restraint about not
 * overclaiming (D51). Instead it points to where the reader can judge that
 * for themselves — Our Business and Risk Factors — the same restraint this
 * project already applies everywhere it does not have grounded material.
 */

function priceRow(label: string, price: string | null, latestEps: string): string[] {
  if (price === null || latestEps === '-') return [label, '[TO BE PROVIDED: price band]'];
  return [label, new Decimal(price).dividedBy(latestEps).toFixed(2)];
}

function basisFactSlice(facts: FactBase) {
  const ratios = otherFinancialInformation(facts);
  const latest: YearRatios | undefined = ratios?.[0];
  return {
    companyName: facts.company.name,
    latestBasicEps: latest?.basicEps ?? null,
    latestReturnOnNetWorthPercent: latest?.returnOnNetWorthPercent ?? null,
    latestNetAssetValuePerShare: latest?.netAssetValuePerShare ?? null,
    floorPrice: facts.offer.floorPrice,
    capPrice: facts.offer.capPrice,
    industryPeerCount: facts.offer.industryPeers.length,
  };
}

export const basisForIssuePrice: SectionSpec = {
  id: 'particulars.basisForIssuePrice',
  partOf: '12. Basis for Issue Price',
  title: 'Basis for Issue Price',
  producer: 'computed',
  order: 2200,
  group: 'SECTION - PARTICULARS OF THE OFFER',
  clause: 'ICDR Schedule VI Part A, item 11',
  compute: async ({ orgId, facts }: RenderContext): Promise<DocumentNode[]> => {
    const nodes: DocumentNode[] = [h2('Basis for Issue Price')];

    const ratios = otherFinancialInformation(facts);
    // `otherFinancialInformation` returns null when there is no allotment
    // history to weight the shares by, but an EMPTY array when there is an
    // allotment history and simply no financial year on file yet — both are
    // "nothing to compute from" here, so both must gap the same way.
    if (!ratios || ratios.length === 0) {
      nodes.push(
        gap(
          'financials.years',
          'The restated financial figures from which the accounting ratios supporting the Issue Price are computed',
        ),
      );
      return nodes;
    }

    const slice = basisFactSlice(facts);
    const drafted = await readNarrative(orgId, basisForIssuePrice.id, slice);
    // D68 — S9 register-and-structure audit: Om Galaxy and Photonics Watertech both open this
    // section with "on the basis of an assessment of market demand ... through the Book Building
    // Process AND on the basis of the qualitative and quantitative factors" — the fallback was
    // missing the book-building clause entirely. Book-building boilerplate, not an issuer fact, and
    // only true for a book-built issue — a fixed-price issue has no book-building step to cite.
    const marketDemandClause =
      facts.offer.issueType === 'BOOK_BUILT'
        ? 'on the basis of an assessment of market demand for the Equity Shares through the Book Building Process, and '
        : '';
    nodes.push(
      para(
        drafted?.text ??
          `The Issue Price has been determined by our Company in consultation with the Book Running Lead Manager, ${marketDemandClause}on the basis of the qualitative and quantitative factors set out below. Prospective investors should read the qualitative factors together with the sections titled "Our Business" and "Risk Factors", and the financial information set out below, before deciding to invest in this Issue.`,
      ),
    );

    nodes.push(h3('Quantitative Factors'));

    nodes.push(
      table(
        ['Particulars', ...ratios.map((r) => fiscal(r.yearEnding))],
        [
          ['Basic Earnings per Equity Share (Rs)', ...ratios.map((r) => r.basicEps)],
          ['Return on Net Worth (%)', ...ratios.map((r) => r.returnOnNetWorthPercent)],
          ['Net Asset Value per Equity Share (Rs)', ...ratios.map((r) => r.netAssetValuePerShare)],
        ],
        { caption: 'Accounting ratios, from the Restated Financial Information (see Other Financial Information)', numericColumns: ratios.map((_, i) => i + 1) },
      ),
    );

    const latestEps = ratios[0].basicEps;
    nodes.push(
      table(
        ['Particulars', 'P/E ratio'],
        [priceRow('At the Floor Price', facts.offer.floorPrice, latestEps), priceRow('At the Cap Price', facts.offer.capPrice, latestEps)],
        { caption: `Price to Earnings ratio, based on Basic EPS for ${fiscal(ratios[0].yearEnding)}` },
      ),
    );

    nodes.push(h3('Comparison with Listed Industry Peers'));
    const peers = facts.offer.industryPeers;
    if (peers.length === 0) {
      nodes.push(
        gap(
          'offer.industryPeers',
          'Two or three listed companies in the same line of business, with their own latest EPS, P/E ratio, return on net worth and NAV per share',
        ),
      );
    } else {
      nodes.push(
        table(
          ['Company', 'Face Value (Rs)', 'EPS (Rs)', 'P/E', 'RoNW (%)', 'NAV per Share (Rs)'],
          [
            ...peers.map((p) => [p.name, rupees(p.faceValue), p.basicEps, p.peRatio, p.returnOnNetWorthPercent.toFixed(2), p.netAssetValuePerShare]),
            [
              facts.company.name,
              rupees(facts.capital.faceValue),
              ratios[0].basicEps,
              facts.offer.capPrice ? new Decimal(facts.offer.capPrice).dividedBy(ratios[0].basicEps === '-' ? '1' : ratios[0].basicEps).toFixed(2) : '[dot]',
              ratios[0].returnOnNetWorthPercent,
              ratios[0].netAssetValuePerShare,
            ],
          ],
          { caption: 'Our Company’s own row is computed at the Cap Price; the peers’ figures are as stated by them and are not independently verified by us.', numericColumns: [1, 2, 3, 4, 5] },
        ),
      );
    }

    return nodes;
  },
};
