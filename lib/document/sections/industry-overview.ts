import { readNarrative } from '../../store/narrative-store';
import type { FactBase } from '../../facts/schema';
import type { DocumentNode } from '../nodes';
import type { RenderContext, SectionSpec } from '../section';
import { gap, h2, para } from './helpers';

/**
 * INDUSTRY OVERVIEW — section map #14, the last of S9's two originally-
 * blocked sections (D54's note). Deliberately NOT unblocked with a new
 * intake question the way Basis for Issue Price was: a real Industry
 * Overview chapter states market size, growth rate and competitive dynamics
 * this fact base has no source for, and inventing a question asking an SME
 * issuer to self-report an addressable-market figure would be asking them
 * to state something they typically do not know. MM4 (never invent) applies
 * to what we ASK for, not only what we draft.
 *
 * D68 CORRECTION, from the S9 register-and-structure audit: the ORIGINAL
 * framing here said a real Industry Overview needs a "commissioned report
 * (CRISIL, CARE, D&B)". Checked against the corpus and found WRONG, not just
 * imprecise — Ideas Electricals states outright, as risk factor #67: "We
 * have not commissioned an industry report for the disclosures made in the
 * section titled 'Industry Overview'. These disclosures are based on
 * publicly available data, which may be inaccurate, incomplete or not
 * comparable." Both Ideas Electricals and Maxwell open the actual chapter
 * with a standing disclaimer to this effect before any content: extracted
 * from public websites and industry publications, not independently
 * verified, investors should not rely on it alone. Real SME issuers do NOT
 * typically commission a paid report — the underlying reasoning (this app
 * has no source for market size, growth rate or competitive data, and must
 * not invent one) still holds, but the FRAMING now matches what the corpus
 * actually does: state the sourcing honestly, not promise a commissioned
 * report that most real prospectuses never get either.
 *
 * What this section legitimately can draft, from facts already on file
 * (`company.sector`, `company.businessDescription`, `business.productLines`,
 * `business.primaryMarketDescription`): a short, plainly-scoped paragraph
 * naming the sector the issuer operates in and what it makes, in the same
 * restrained register `Our Business` already uses (D51) — no market size,
 * no growth rate, no competitive claim the factSlice cannot support.
 *
 * The standing gap is not a byproduct of missing facts, the way every other
 * gap in this document is — it is permanent by design. It stays even once
 * every other fact here is filled in, because no fact this app collects can
 * satisfy it: the actual industry data (market size, growth, competitive
 * landscape) has to come from public industry sources or a commissioned
 * report, cited properly, whichever the merchant banker chooses — not from
 * this app inventing either.
 */

function industryFactSlice(facts: FactBase) {
  return {
    companyName: facts.company.name,
    sector: facts.company.sector,
    businessDescription: facts.company.businessDescription,
    productLines: facts.business.productLines ?? null,
    primaryMarketDescription: facts.business.primaryMarketDescription ?? null,
  };
}

export const industryOverview: SectionSpec = {
  id: 'aboutCompany.industryOverview',
  partOf: '14. Industry Overview',
  title: 'Industry Overview',
  producer: 'computed',
  // 2300, immediately before Our Business (2350) — real prospectuses open the
  // "About the Company" chapter with Industry Overview. Placing it anywhere
  // else in the order breaks the group into two non-contiguous runs, which
  // the DOCX renderer reads as a second "SECTION - ABOUT THE COMPANY" page
  // break (`body()` in docx.ts opens a new Heading 1 on every group CHANGE
  // between consecutive sections, not once per unique group name) — caught
  // by docx.test.ts's heading-count assertion, not by inspection.
  order: 2300,
  group: 'SECTION - ABOUT THE COMPANY',
  clause: 'ICDR Schedule VI Part A',
  compute: async ({ orgId, facts }: RenderContext): Promise<DocumentNode[]> => {
    const nodes: DocumentNode[] = [
      h2('Industry Overview'),
      {
        type: 'paragraph',
        runs: [
          {
            text:
              'This section is a PRELIMINARY DRAFT, scoped to the facts on file for this issuer. A real Industry ' +
              'Overview chapter — market size, growth rate, competitive landscape and demand drivers — must be ' +
              'sourced from public industry data or a commissioned report (for example CRISIL, CARE or D&B), cited ' +
              'properly, and MUST replace this draft before the document is filed. Real SME prospectuses commonly ' +
              'state such data is drawn from publicly available sources rather than a commissioned report, with a ' +
              'standard disclaimer that it has not been independently verified — either path is acceptable; what ' +
              'this tool cannot do is invent the underlying figures.',
            italic: true,
          },
        ],
      },
    ];

    const slice = industryFactSlice(facts);
    const drafted = await readNarrative(orgId, industryOverview.id, slice);
    nodes.push(
      para(
        drafted?.text ??
          `${facts.company.name} operates in the ${facts.company.sector} sector. ${facts.company.businessDescription}`,
      ),
    );

    nodes.push(
      gap(
        'aboutCompany.industryOverview.commissionedReport',
        'Real industry data (market size, growth rate, competitive landscape and demand drivers) from a cited public source or a commissioned report, to replace this preliminary draft',
      ),
    );

    return nodes;
  },
};
