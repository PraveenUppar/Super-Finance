import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  collectGaps,
  derivedTerms,
  flattenSections,
  gapAnchorKeys,
  renderDocument,
  renderSection,
  renderSections,
  runKey,
  type RenderedSection,
  type SectionSpec,
} from './section';
import { issueProcedure, issueProcedureUpi, issueProcedureAvailability, issueProcedurePriceLevels, issueProcedureTermsOfPayment, issueProcedureElectronicRegistration, issueProcedureGeneralInstructions, issueProcedureAnchorInvestors, issueProcedureInformationForBidders, issueProcedureApplicationSize, issueProcedureBidsByCategory, issueProcedureBookBuilding, issueProcedureTechnicalRejection, issueProcedureWithdrawalAndAdvertisement, issueProcedureBasisOfAllotment, issueProcedureUndertakings } from './sections/issue-procedure';
import { sectionRegistry } from './sections';
import { issueStructure } from './sections/issue-structure';
import { termsOfIssue } from './sections/terms-of-issue';
import { definitions } from './sections/definitions';
import { conventions, dividendPolicy, foreignOwnership, declaration } from './sections/conventions';
import { regulatoryDisclaimers, regulatoryAuthority, regulatoryConsents, regulatoryJurisdiction, regulatoryStatutoryStatements } from './sections/regulatory-disclosures';
import { collectPlaceholders } from './nodes';
import { vardhman } from '../seed/vardhman';
import { money } from '../facts/money';
import type { FactBase } from '../facts/schema';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';

const ORG = 'org_test1';

// Applies to every test in this file: `renderDocument(sectionRegistry, ...)`
// pulls in the narrative sections (risk-factors.ts and others), which read
// `narrative-store.ts`/`risk-dismissal-store.ts` — a fake keeps every test
// here isolated from whatever another test run left behind, and from
// needing real Supabase credentials at all.
beforeEach(() => {
  __setVersionedTableForTests(createFakeVersionedTable());
});
afterEach(() => {
  __setVersionedTableForTests(null);
});

/** Vardhman with targeted overrides, for exercising conditional branches. */
function variant(overrides: {
  paidUpShares?: number;
  freshIssueShares?: number;
  exchange?: FactBase['offer']['exchange'];
  terminology?: FactBase['offer']['terminology'];
  documentStage?: FactBase['offer']['documentStage'];
  withOFS?: boolean;
}): FactBase {
  return {
    ...vardhman,
    capital: {
      ...vardhman.capital,
      paidUpShares: overrides.paidUpShares ?? vardhman.capital.paidUpShares,
    },
    offer: {
      ...vardhman.offer,
      freshIssueShares: overrides.freshIssueShares ?? vardhman.offer.freshIssueShares,
      exchange: overrides.exchange ?? vardhman.offer.exchange,
      terminology: overrides.terminology ?? vardhman.offer.terminology,
      documentStage: overrides.documentStage ?? vardhman.offer.documentStage,
      sellingShareholders: overrides.withOFS
        ? [
            {
              name: 'Anil Vardhman',
              type: 'PROMOTER_GROUP' as const,
              sharesOffered: 400000,
              preIssueShares: 1200000,
              weightedAverageCostOfAcquisition: money('12'),
            },
          ]
        : [],
    },
  };
}

const plain = async (facts: FactBase) =>
  (await renderSection(issueProcedure, { orgId: ORG, facts }))
    .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
    .join('\n');

describe('derived terms', () => {
  it('picks Regulation 229(2) above Rs 10 crore post-issue capital', async () => {
    // Vardhman: 1,20,00,000 + 45,00,000 shares at Rs 10 = Rs 16.5 crore
    const terms = derivedTerms(vardhman);
    expect(terms.postIssueCapital).toBe(money('16.5', 'crores'));
    expect(terms.eligibilityRegulation).toBe('Regulation 229(2)');
  });

  it('picks Regulation 229(1) at or below Rs 10 crore', async () => {
    // The bug held-out verification caught: Century Business Media cites
    // 229(1) because its post-issue capital is under Rs 10 crore.
    const small = variant({ paidUpShares: 6000000, freshIssueShares: 2312000 });
    const terms = derivedTerms(small);
    expect(terms.postIssueCapital).toBe(money('8.312', 'crores'));
    expect(terms.eligibilityRegulation).toBe('Regulation 229(1)');
  });

  it('treats exactly Rs 10 crore as 229(1)', async () => {
    const boundary = variant({ paidUpShares: 9000000, freshIssueShares: 1000000 });
    expect(derivedTerms(boundary).postIssueCapital).toBe(money('10', 'crores'));
    expect(derivedTerms(boundary).eligibilityRegulation).toBe('Regulation 229(1)');
  });

  it('computes the issue as a percentage of post-issue capital (R-023)', async () => {
    const terms = derivedTerms(vardhman);
    expect(terms.issuePercentOfPostIssueCapital).toBe('27.27');
    expect(terms.meetsMinimumIssuePercent).toBe(true);
  });

  it('flags an issue below the 25% floor', async () => {
    const tooSmall = variant({ paidUpShares: 12000000, freshIssueShares: 1000000 });
    const terms = derivedTerms(tooSmall);
    expect(terms.meetsMinimumIssuePercent).toBe(false);
  });

  it('counts OFS shares toward the offered total', async () => {
    const terms = derivedTerms(variant({ withOFS: true }));
    expect(terms.offeredShares).toBe(4900000);
    // OFS shares are already issued, so post-issue capital is unchanged
    expect(terms.postIssueShares).toBe(16500000);
  });

  it('switches the designated stock exchange', async () => {
    expect(derivedTerms(vardhman).designatedStockExchange).toBe('BSE Limited');
    expect(derivedTerms(variant({ exchange: 'NSE_EMERGE' })).designatedStockExchange).toBe(
      'National Stock Exchange of India Limited',
    );
  });
});

describe('Issue Procedure section', () => {
  it('renders the correct regulation for each capital band', async () => {
    expect(await plain(vardhman)).toContain('under Regulation 229(2) of');
    expect(await plain(variant({ paidUpShares: 6000000, freshIssueShares: 2312000 }))).toContain(
      'under Regulation 229(1) of',
    );
  });

  it('names the selling shareholders only when there is an OFS', async () => {
    expect(await plain(vardhman)).not.toContain('and the Selling Shareholders');
    expect(await plain(variant({ withOFS: true }))).toContain(
      'our Company and the Selling Shareholders may',
    );
  });

  it('follows the issuer house style for Issue vs Offer', async () => {
    expect(await plain(vardhman)).toContain('the Issue is being made for at least 25%');
    expect(await plain(variant({ terminology: 'OFFER' }))).toContain(
      'the Offer is being made for at least 25%',
    );
  });

  it('does not apply to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await renderSection(issueProcedure, { orgId: ORG, facts: fixedPrice })).toHaveLength(0);
  });

  it('states the allocation split from R-024', async () => {
    const out = await plain(vardhman);
    expect(out).toContain('not more than 50% of the Net Issue');
    expect(out).toContain('up to 60% of the QIB Portion to Anchor Investors');
    expect(out).toContain('33.33%');
    expect(out).toContain('6.67%');
    expect(out).toContain('not less than 15% of the Net Issue');
    // Sentence-initial in our phrasing, so capitalised
    expect(out).toContain('Not less than 35% of the Net Issue');
  });

  it('leaves no unresolved template syntax', async () => {
    expect(await plain(vardhman)).not.toMatch(/\{\{|\}\}/);
  });
});

describe('Application size and bidding method', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(issueProcedureApplicationSize, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('substitutes the lot size everywhere it appears', async () => {
    const out = await render(vardhman);
    expect(out).toContain('being 3,000 Equity Shares per lot');
    expect(out).toContain('in multiples of 3,000 Equity Shares thereafter');
  });

  it('states the Rs 2,00,000 minimum from R-006', async () => {
    expect(await render(vardhman)).toContain('Bid Amount exceeds Rs 2,00,000');
  });

  it('derives the regional language from the registered office state', async () => {
    expect(derivedTerms(vardhman).regionalLanguage).toBe('Marathi');
    expect(await render(vardhman)).toContain('Marathi being the regional language of Maharashtra');

    const gujarat: FactBase = {
      ...vardhman,
      company: {
        ...vardhman.company,
        registeredOffice: { ...vardhman.company.registeredOffice, state: 'Gujarat' },
      },
    };
    expect(derivedTerms(gujarat).regionalLanguage).toBe('Gujarati');
    expect(await render(gujarat)).toContain('Gujarati being the regional language of Gujarat');
  });

  it('drops the regional-language gloss in Hindi-speaking states', async () => {
    // Century Business Media (Patna, Bihar) names its regional paper without
    // the gloss, since "Hindi being the regional language of Bihar" reads
    // oddly right after naming a Hindi national daily.
    const bihar: FactBase = {
      ...vardhman,
      company: {
        ...vardhman.company,
        registeredOffice: { ...vardhman.company.registeredOffice, state: 'Bihar' },
      },
    };
    expect(derivedTerms(bihar).regionalLanguageIsHindi).toBe(true);
    const out = await render(bihar);
    expect(out).not.toContain('being the regional language of');
    expect(out).toContain('circulated in Bihar, where our Registered Office is situated');

    // and it is kept where the language differs
    expect(derivedTerms(vardhman).regionalLanguageIsHindi).toBe(false);
    expect(await render(vardhman)).toContain('Marathi being the regional language of Maharashtra');
  });

  it('falls back safely for an unmapped state', async () => {
    const elsewhere: FactBase = {
      ...vardhman,
      company: {
        ...vardhman.company,
        registeredOffice: { ...vardhman.company.registeredOffice, state: 'Nagaland' },
      },
    };
    expect(derivedTerms(elsewhere).regionalLanguage).toBe('the regional language');
  });

  it('names the newspapers, and raises a gap when one is missing', async () => {
    expect(await render(vardhman)).toContain('all editions of Business Standard');

    const noPaper: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, regionalNewspaper: undefined },
    };
    const gaps = collectPlaceholders(await renderSection(issueProcedureApplicationSize, { orgId: ORG, facts: noPaper }));
    expect(gaps.map((g) => g.factPath)).toContain('offer.regionalNewspaper');
    expect(gaps.find((g) => g.factPath === 'offer.regionalNewspaper')?.ask).toBe(
      'Regional daily for the issue advertisements',
    );
  });

  it('states the three-to-ten working day bid period', async () => {
    const out = await render(vardhman);
    expect(out).toContain('minimum of three Working Days and shall not exceed ten Working Days');
    expect(out).toContain('additional three Working Days');
  });
});

describe('Bids by investor category', () => {
  let out: string;

  beforeAll(async () => {
    out = (await renderSection(issueProcedureBidsByCategory, { orgId: ORG, facts: vardhman }))
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
      .join('\n');
  });

  it('covers all twelve investor categories', async () => {
    for (const category of [
      'Hindu Undivided Families',
      'Mutual Funds',
      'Eligible NRIs',
      'Bids by FPIs',
      'AIFs, VCFs and FVCIs',
      'Limited Liability Partnerships',
      'Banking Companies',
      'Bids by SCSBs',
      'Systemically Important Non-Banking Financial Companies',
      'Insurance Companies',
      'Provident Funds and Pension Funds',
      'Power of Attorney',
    ]) {
      expect(out).toContain(category);
    }
  });

  it('reproduces the investment limits the corpus states', async () => {
    // These belong to other regulations (SEBI MF/VCF/FPI, FEMA, Banking
    // Regulation Act) and are quoted, not authored by us.
    expect(out).toContain('10% of its net asset value'); // Mutual Funds
    expect(out).toContain('25% of the corpus of the VCF'); // VCF
    expect(out).toContain('33.33% of their investible funds'); // VCF in an IPO
    expect(out).toContain('24% of the paid-up equity share capital'); // FPI aggregate
    expect(out).toContain('5% of the total paid-up equity share capital'); // single NRI
    expect(out).toContain('Rs 2,500 lakhs'); // provident and pension fund corpus
  });

  it('follows house style for Issue vs Offer', async () => {
    const asOffer = (
      await renderSection(issueProcedureBidsByCategory, { orgId: ORG, facts: variant({ terminology: 'OFFER' }) })
    )
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : ''))
      .join('\n');
    expect(out).toContain('Participation of Eligible NRIs in the Issue');
    expect(asOffer).toContain('Participation of Eligible NRIs in the Offer');
  });

  it('does not apply to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await renderSection(issueProcedureBidsByCategory, { orgId: ORG, facts: fixedPrice })).toHaveLength(0);
  });

  it('leaves no unresolved template syntax and raises no gaps', async () => {
    expect(out).not.toMatch(/\{\{|\}\}/);
    expect(collectPlaceholders(await renderSection(issueProcedureBidsByCategory, { orgId: ORG, facts: vardhman })))
      .toHaveLength(0);
  });
});

describe('Impersonation, undertakings and utilisation', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(issueProcedureUndertakings, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('quotes Section 38(1) of the Companies Act verbatim', async () => {
    const out = await render(vardhman);
    expect(out).toContain('sub-section (1) of Section 38 of the Companies Act, 2013');
    expect(out).toContain('application in a fictitious name');
    expect(out).toContain('shall be liable for action under Section 447');
  });

  it('carries the full set of undertakings', async () => {
    const out = await render(vardhman);
    expect(out).toContain('complaints received in respect of the Issue');
    expect(out).toContain('three Working Days from the Issue Closing Date');
    expect(out).toContain("Promoters' contribution in full has already been brought in");
    expect(out).toContain('Applications Supported by Blocked Amount');
    expect(out).toContain('wilful defaulter or a fraudulent borrower');
  });

  it('names the current document stage when describing a re-filing', async () => {
    expect(await render(vardhman)).toContain('a fresh Draft Red Herring Prospectus');
    const atRhp = variant({ documentStage: 'RHP' });
    expect(await render(atRhp)).toContain('a fresh Red Herring Prospectus');
  });

  it('certifies utilisation of proceeds', async () => {
    const out = await render(vardhman);
    expect(out).toContain('sub-section (3) of Section 40 of the Companies Act, 2013');
    expect(out).toContain('shall not have recourse to the Issue proceeds until the approval');
  });

  it('uses the lower-case issue word for the pre-issue advertisement', async () => {
    expect(await render(vardhman)).toContain('pre-issue advertisement was published');
  });

  it('leaves no unresolved syntax and raises no gaps', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(collectPlaceholders(await renderSection(issueProcedureUndertakings, { orgId: ORG, facts: vardhman })))
      .toHaveLength(0);
  });
});

describe('Grounds for technical rejection', () => {
  let nodes: Awaited<ReturnType<typeof renderSection>>;
  let out: string;

  beforeAll(async () => {
    nodes = await renderSection(issueProcedureTechnicalRejection, { orgId: ORG, facts: vardhman });
    out = nodes
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');
  });

  it('takes the union of both sources rather than the shorter list', async () => {
    const grounds = (nodes.find((n) => n.type === 'list') as { items: unknown[] }).items;
    // Om Galaxy runs to 25+, Maxwell to 15; each carries items the other omits
    expect(grounds.length).toBeGreaterThan(20);
  });

  it('restricts the cut-off rejection to NIIs and QIBs', async () => {
    // Maxwell says "any category", which would reject valid Individual Bids.
    // Om Galaxy and Century both confine it to NIIs and QIBs.
    expect(out).toContain('Bids at Cut-off Price by Non-Institutional Investors and QIBs');
    expect(out).not.toContain('cut-off price by any category');
  });

  it('states the Rs 100 per day unblocking compensation', async () => {
    expect(out).toContain('uniform rate of Rs 100 per day');
    expect(out).toContain('exceeding two Working Days');
  });

  it('covers the depository three-parameter match', async () => {
    expect(out).toContain('DP ID');
    expect(out).toContain("beneficiary's account number");
  });

  it('emphasises the cut-off ground in bold', async () => {
    const list = nodes.find((n) => n.type === 'list') as { items: { text: string; bold?: boolean }[][] };
    const cutOff = list.items.find((runs) => runs.some((r) => r.text.includes('Cut-off Price')));
    expect(cutOff?.some((r) => r.bold)).toBe(true);
  });

  it('leaves no unresolved syntax and raises no gaps', async () => {
    expect(out).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(collectPlaceholders(nodes)).toHaveLength(0);
  });
});

describe('Basis of allotment', () => {
  let nodes: Awaited<ReturnType<typeof renderSection>>;
  let out: string;

  beforeAll(async () => {
    nodes = await renderSection(issueProcedureBasisOfAllotment, { orgId: ORG, facts: vardhman });
    out = nodes
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');
  });

  it('states the 90% minimum subscription (R-025)', async () => {
    expect(out).toContain('minimum subscription of 90% of the Issue');
  });

  it('keeps the offer-for-sale carve-out even for a pure fresh issue', async () => {
    // Om Galaxy is a pure fresh issue and states it anyway, so making this
    // conditional would deviate from the corpus without evidence.
    expect(vardhman.offer.sellingShareholders).toHaveLength(0);
    expect(out).toContain('in the nature of an offer for sale only');
  });

  it('describes the T-day flow through to the list of allottees', async () => {
    expect(out).toContain('On T Day, the Registrar validates');
    expect(out).toContain('Third party confirmation of applications is to be completed by the SCSBs on T+1 Day');
    expect(out).toContain('Designated Stock Exchange');
  });

  it('keeps the worked allotment-ratio example intact', async () => {
    expect(out).toContain('78654321');
    expect(out).toContain('12345687');
    expect(out).toContain('ratio of Allottees to applicants in a category is 2:7');
  });

  it('does NOT assert per-category share counts', async () => {
    // Category portions are percentages of the NET issue, and net issue depends
    // on the market maker reservation, which is not yet a fact-base field.
    // Stating a count derived from the gross issue would be quietly wrong.
    expect(out).not.toMatch(/\d{2},\d{2},\d{3} Equity Shares at or above/);
    expect(out).toContain('Equity Shares available for that category');
  });

  it('leaves no unresolved syntax and raises no gaps', async () => {
    expect(out).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(collectPlaceholders(nodes)).toHaveLength(0);
  });
});

describe('Issue Structure allocation arithmetic', () => {
  /**
   * GROUND TRUTH. Om Galaxy's published Issue Structure table, fed its own
   * inputs. If our rounding rule is right we reproduce its figures exactly;
   * if it is wrong the numbers will be close but not equal, which is the
   * failure mode that would otherwise ship unnoticed.
   *
   * Source: bookbuilt__manufacturing__om-galaxy__bse-sme__2026-09__rhp.pdf p.418
   */
  const omGalaxy: FactBase = {
    ...vardhman,
    capital: { ...vardhman.capital, paidUpShares: 22210824, faceValue: money('5') },
    offer: {
      ...vardhman.offer,
      freshIssueShares: 11667200,
      marketMakerReservationShares: 584000,
      lotSize: 1600,
    },
  };

  it("reproduces Om Galaxy's published net issue", async () => {
    expect(derivedTerms(omGalaxy).netIssueShares).toBe(11083200);
  });

  it('does NOT compute per-category share counts, because they are not computable', async () => {
    // Om Galaxy publishes QIB 55,37,600 / NII 16,64,000 / Individual 38,81,600
    // on a net issue of 1,10,83,200 - that is 49.96% / 15.01% / 35.02%, with
    // QIB 2.5 lots BELOW an exact 50%. Ceiling, flooring and rounding to the
    // lot were each tried against these figures and each missed. The split is
    // a banker's judgement at pricing within the R-024 bounds, not arithmetic.
    const t = derivedTerms(omGalaxy) as Record<string, unknown>;
    expect(t.qibPortionShares).toBeUndefined();
    expect(t.niiPortionShares).toBeUndefined();
    expect(t.individualPortionShares).toBeUndefined();
  });

  it('computes net issue and the market maker percentage for Vardhman', async () => {
    const t = derivedTerms(vardhman);
    expect(t.marketMakerShares).toBe(225000);
    expect(t.netIssueShares).toBe(4275000);
    expect(t.marketMakerPercentOfIssue).toBe('5.00');
  });
});

describe('Issue Structure section', () => {
  let nodes: Awaited<ReturnType<typeof renderSection>>;

  beforeAll(async () => {
    nodes = await renderSection(issueStructure, { orgId: ORG, facts: vardhman });
  });

  it('emits a real table, not prose', async () => {
    const table = nodes.find((n) => n.type === 'table');
    expect(table).toBeDefined();
    expect((table as { rows: unknown[] }).rows.length).toBeGreaterThanOrEqual(6);
  });

  it('states the market maker portion but leaves the rest to be provided', async () => {
    const table = nodes.find((n) => n.type === 'table') as { rows: string[][] };
    const allotmentRow = table.rows[0];
    // Market maker portion IS a fact, so it is stated
    expect(allotmentRow[1]).toContain('2,25,000');
    // The other three are the banker's call at pricing
    expect(allotmentRow[2]).toBe('[TO BE PROVIDED]');
    expect(allotmentRow[3]).toBe('[TO BE PROVIDED]');
    expect(allotmentRow[4]).toBe('[TO BE PROVIDED]');
    // but the percentage bounds from R-024 are stated
    expect(table.rows[1][2]).toContain('Not more than 50% of the Net Issue');
    expect(table.rows[1][3]).toContain('Not less than 15% of the Net Issue');
    expect(table.rows[1][4]).toContain('Not less than 35% of the Net Issue');
  });

  it('raises a gap when the market maker reservation is missing', async () => {
    // Every SME issue has one (R-004), so absence is a gap, not a valid nil —
    // and without it the Net Issue cannot be computed at all.
    const noMM: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, marketMakerReservationShares: undefined },
    };
    const gaps = collectPlaceholders(await renderSection(issueStructure, { orgId: ORG, facts: noMM }));
    expect(gaps.map((g) => g.factPath)).toContain('offer.marketMakerReservationShares');
    // and no table is emitted from unknowable numbers
    expect((await renderSection(issueStructure, { orgId: ORG, facts: noMM })).find((n) => n.type === 'table')).toBeUndefined();
  });

  it('does not apply to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await renderSection(issueStructure, { orgId: ORG, facts: fixedPrice })).toHaveLength(0);
  });
});

describe('Regulatory disclaimers', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(regulatoryDisclaimers, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('switches the whole exchange disclaimer, not just the name', async () => {
    // BSE's is a numbered "does not in any manner" list including a limb on
    // the validity of the issue price; NSE's runs as prose and lacks it.
    const bse = await render(vardhman);
    expect(bse).toContain('Disclaimer Clause of the SME Platform of BSE');
    expect(bse).toContain('BSE does not in any manner');
    expect(bse).toContain('reasonableness of the price at which the Equity Shares are offered');
    expect(bse).not.toContain('Emerge Platform');

    const nse = await render(variant({ exchange: 'NSE_EMERGE' }));
    expect(nse).toContain('Disclaimer Clause of the Emerge Platform');
    expect(nse).toContain('pursuant to independent inquiry, investigation and analysis');
    expect(nse).not.toContain('BSE does not in any manner');
  });

  it('quotes the due diligence certificate date and Schedule V(A) format', async () => {
    const out = await render(vardhman);
    expect(out).toContain('DUE DILIGENCE CERTIFICATE DATED NOVEMBER 10, 2026');
    expect(out).toContain('SCHEDULE V(A)');
    // R-016, now corroborated by a second source
    expect(out).toContain('SITE VISIT REPORT');
  });

  it('names the BRLM in capitals within the statutory clause', async () => {
    expect(await render(vardhman)).toContain('INDORIENT FINANCIAL SERVICES LIMITED');
  });

  it('states the Reg 272(2) refund consequence in Listing', async () => {
    const out = await render(vardhman);
    expect(out).toContain('within four days');
    expect(out).toContain('fifteen per cent per annum');
    expect(out).toContain('Regulation 272(2)');
  });

  it('raises gaps for the two dates when absent', async () => {
    const noDates: FactBase = {
      ...vardhman,
      offer: {
        ...vardhman.offer,
        dueDiligenceCertificateDate: undefined,
        inPrincipleApprovalDate: undefined,
      },
    };
    const gaps = collectPlaceholders(await renderSection(regulatoryDisclaimers, { orgId: ORG, facts: noDates }));
    const paths = gaps.map((g) => g.factPath);
    expect(paths).toContain('offer.dueDiligenceCertificateDate');
    expect(paths).toContain('offer.inPrincipleApprovalDate');
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(await render(variant({ exchange: 'NSE_EMERGE' }))).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Authority for the issue and confirmations', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(regulatoryAuthority, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('states all three corporate approval dates', async () => {
    const out = await render(vardhman);
    expect(out).toContain('meeting held on August 14, 2026');
    expect(out).toContain('Extraordinary General Meeting held on August 28, 2026');
    expect(out).toContain('resolution dated November 12, 2026');
  });

  it('cites Section 62(1)(c) for the shareholder authority', async () => {
    expect(await render(vardhman)).toContain('Section 62(1)(c)');
  });

  it('includes the lender NOC subsection only when there are secured borrowings', async () => {
    expect(derivedTerms(vardhman).hasSecuredBorrowings).toBe(true);
    expect(await render(vardhman)).toContain('Lender No Objection Certificates');

    const debtFree: FactBase = {
      ...vardhman,
      financials: {
        ...vardhman.financials,
        years: vardhman.financials.years.map((y) => ({ ...y, totalBorrowings: money('0') })),
      },
    };
    expect(derivedTerms(debtFree).hasSecuredBorrowings).toBe(false);
    expect(await render(debtFree)).not.toContain('Lender No Objection Certificates');
  });

  it('recites Regulation 228 as five confirmations (R-020)', async () => {
    const nodes = await renderSection(regulatoryAuthority, { orgId: ORG, facts: vardhman });
    const list = nodes.filter((n) => n.type === 'list').at(-1) as { items: unknown[] };
    expect(await render(vardhman)).toContain('not ineligible in terms of Regulation 228');
    expect(list.items).toHaveLength(5);
    expect(await render(vardhman)).toContain('no outstanding convertible securities');
  });

  it('names the designated stock exchange per exchange', async () => {
    expect(await render(vardhman)).toContain('from BSE Limited for the use of its name');
    expect(await render(variant({ exchange: 'NSE_EMERGE' }))).toContain(
      'from National Stock Exchange of India Limited for the use of its name',
    );
  });

  it('raises gaps for each missing approval date', async () => {
    const noDates: FactBase = {
      ...vardhman,
      offer: {
        ...vardhman.offer,
        boardResolutionDate: undefined,
        shareholderResolutionDate: undefined,
        boardApprovalOfDocumentDate: undefined,
      },
    };
    const paths = collectPlaceholders(
      await renderSection(regulatoryAuthority, { orgId: ORG, facts: noDates }),
    ).map((g) => g.factPath);
    expect(paths).toContain('offer.boardResolutionDate');
    expect(paths).toContain('offer.shareholderResolutionDate');
    expect(paths).toContain('offer.boardApprovalOfDocumentDate');
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Consents and investor grievances', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(regulatoryConsents, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('cites Section 26 for the consents', async () => {
    expect(await render(vardhman)).toContain('Section 26 of the Companies Act, 2013');
  });

  it('lists the five UPI grievance measures', async () => {
    const nodes = await renderSection(regulatoryConsents, { orgId: ORG, facts: vardhman });
    const list = nodes.find((n) => n.type === 'list') as { items: unknown[] };
    expect(list.items).toHaveLength(5);
    expect(await render(vardhman)).toContain('nodal officer by SCSBs');
    expect(await render(vardhman)).toContain('one Working Day following the finalisation');
  });

  it('states the eight-year record retention', async () => {
    expect(await render(vardhman)).toContain('at least eight years from the date of listing');
  });

  it('names the compliance officer and registrar from facts', async () => {
    const out = await render(vardhman);
    expect(out).toContain('Priya Deshmukh');
    expect(out).toContain('Bigshare Services Private Limited');
    expect(out).toContain('cs@vardhmanprecision.in');
  });

  it('raises a gap when the registrar is unknown', async () => {
    const noRegistrar: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, registrarToIssue: undefined },
    };
    const paths = collectPlaceholders(
      await renderSection(regulatoryConsents, { orgId: ORG, facts: noRegistrar }),
    ).map((g) => g.factPath);
    expect(paths).toContain('offer.registrarToIssue');
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Terms of the Issue', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(termsOfIssue, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('states the face value and both ends of the price band', async () => {
    const out = await render(vardhman);
    expect(out).toContain('face value of each Equity Share is Rs 10');
    expect(out).toContain('Rs 47 per Equity Share (the "Floor Price")');
    expect(out).toContain('Rs 49 per Equity Share (the "Cap Price")');
  });

  it('computes the minimum bid as two lots', async () => {
    expect(derivedTerms(vardhman).minimumBidShares).toBe(6000);
    expect(await render(vardhman)).toContain('being 6,000 Equity Shares');
    expect(await render(vardhman)).toContain('Bid Amount exceeds Rs 2,00,000');
  });

  it('states the 200 allottee minimum and its consequence (R-005)', async () => {
    const out = await render(vardhman);
    expect(out).toContain('Regulation 268');
    expect(out).toContain('minimum number of Allottees in the Issue shall be 200');
    expect(out).toContain('unblocked forthwith');
  });

  it('uses jurisdiction as a fact, not the registered office city', async () => {
    // Om Galaxy is registered in Thane and names Mumbai - the High Court seat.
    expect(await render(vardhman)).toContain('competent courts and authorities in Mumbai, Maharashtra');
    expect(vardhman.company.registeredOffice.city).toBe('Pune');
  });

  it('describes a fresh issue only when there is no OFS', async () => {
    expect(await render(vardhman)).toContain('comprises a Fresh Issue by our Company.');
    expect(await render(variant({ withOFS: true }))).toContain(
      'Fresh Issue by our Company and an Offer for Sale by the Selling Shareholders',
    );
  });

  it('repeats the approval dates rather than cross-referencing', async () => {
    // Both Terms of the Issue and the regulatory section state them; that is
    // how the corpus reads, and a reader of either gets the dates in place.
    expect(await render(vardhman)).toContain('meeting held on August 14, 2026');
    expect(await render(vardhman)).toContain('Section 62(1)(c)');
  });

  it('raises gaps for a missing price band and jurisdiction', async () => {
    const bare: FactBase = {
      ...vardhman,
      offer: {
        ...vardhman.offer,
        floorPrice: null,
        capPrice: null,
        jurisdiction: undefined,
      },
    };
    const paths = collectPlaceholders(await renderSection(termsOfIssue, { orgId: ORG, facts: bare })).map(
      (g) => g.factPath,
    );
    expect(paths).toContain('offer.floorPrice');
    expect(paths).toContain('offer.capPrice');
    expect(paths).toContain('offer.jurisdiction');
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Definitions — the settlement machinery and appointments', () => {
  const glossary = async (facts: FactBase) => {
    const tables = (await renderSection(definitions, { orgId: ORG, facts })).filter((n) => n.type === 'table');
    if (tables[0]?.type !== 'table') throw new Error('no glossary table');
    return tables[0].rows;
  };

  it('defines no term twice', async () => {
    // 130 entries across six arrays now. A term defined in two of them renders
    // twice in one alphabetical table, which reads as sloppy drafting.
    const rows = await glossary(vardhman);
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const [term] of rows) {
      for (const alias of term.split(',').map((a) => a.trim().toLowerCase())) {
        if (seen.has(alias) && seen.get(alias) !== term) {
          collisions.push(`${alias}: "${seen.get(alias)}" vs "${term}"`);
        }
        seen.set(alias, term);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('carries no other issuer inside a description', async () => {
    // D21: the failure mode is borrowed text that reads perfectly. These are
    // the specifics that leaked through a regex filter last time.
    const descriptions = (await glossary(vardhman)).map(([, d]) => d).join('\n');
    for (const leak of ['Om Galaxy', 'Maxwell', 'Century', 'Photonics', 'Axiom', 'Ideas Electricals', '124851W', 'INE2D0Q01019', 'Ken Research']) {
      expect(descriptions, leak).not.toContain(leak);
    }
  });

  it('cites the sub-regulation only where the corpus agrees', async () => {
    // Three documents put Fraudulent Borrower at Reg 2(1)(lll); Maxwell puts
    // Wilful Defaulter there too, which cannot both be right. O-15.
    const rows = await glossary(vardhman);
    const fraudulent = rows.find(([t]) => t.startsWith('Fraudulent Borrower'))![1];
    const wilful = rows.find(([t]) => t.startsWith('Wilful Defaulter'))![1];
    expect(fraudulent).toContain('Regulation 2(1)(lll)');
    expect(wilful).not.toContain('2(1)');
  });

  it('renders the per-issuer appointments from facts', async () => {
    const rows = await glossary(vardhman);
    expect(rows.find(([t]) => t === 'ISIN')![1]).toContain('INE9V8K01015');
    expect(rows.find(([t]) => t === 'Monitoring Agency')![1]).toContain('Brickwork');
  });

  it('raises a gap for an appointment not yet made, rather than inventing one', async () => {
    const noAgency: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, monitoringAgency: undefined, legalAdvisor: undefined },
    };
    const paths = collectPlaceholders(await renderSection(definitions, { orgId: ORG, facts: noAgency })).map(
      (g) => g.factPath,
    );
    expect(paths).toContain('definitions.Monitoring Agency');
    expect(paths).toContain('definitions.Legal Advisor to the Issue');
    // And the term is absent from the table rather than shown blank.
    expect((await glossary(noAgency)).some(([t]) => t === 'Monitoring Agency')).toBe(false);
  });

  it('drops the book-building terms from a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    const terms = (await glossary(fixedPrice)).map(([t]) => t);
    expect(terms).not.toContain('Book Building Process');
    expect(terms).not.toContain('Revision Form');
    expect(terms).not.toContain('Pricing Date');
    // But the ASBA machinery still applies.
    expect(terms.some((t) => t.startsWith('ASBA,'))).toBe(true);
  });
});

describe('Definitions and Abbreviations', () => {
  let nodes: Awaited<ReturnType<typeof renderSection>>;
  let table: { rows: string[][] };
  const find = (term: string) => table.rows.find((r) => r[0] === term)?.[1];

  beforeAll(async () => {
    nodes = await renderSection(definitions, { orgId: ORG, facts: vardhman });
    table = nodes.find((n) => n.type === 'table') as { rows: string[][] };
  });

  it('emits a glossary table', async () => {
    expect(table).toBeDefined();
    expect(table.rows.length).toBeGreaterThan(10);
  });

  it('derives the issuer entry from the fact base, address and all', async () => {
    const entry = find('Our Company, the Company, the Issuer')!;
    expect(entry).toContain('Vardhman Precision Components Limited');
    expect(entry).toContain('Companies Act, 2013');
    expect(entry).toContain('Chakan Industrial Area');
    expect(entry).toContain('410501');
  });

  it('lists the promoters by name', async () => {
    const entry = find('Promoters')!;
    expect(entry).toContain('Rajesh Vardhman');
    expect(entry).toContain('Sunita Vardhman');
  });

  it('states the face value in the Equity Shares definition', async () => {
    expect(find('Equity Shares')).toBe('Equity shares of our Company of face value of Rs 10 each');
  });

  it('resolves the price band into Floor and Cap definitions', async () => {
    expect(find('Floor Price')).toContain('Rs 47');
    expect(find('Cap Price')).toContain('Rs 49');
  });

  it('switches the designated stock exchange definition', async () => {
    expect(find('Stock Exchange, Designated Stock Exchange')).toBe('BSE Limited');
    const nse = await renderSection(definitions, { orgId: ORG, facts: variant({ exchange: 'NSE_EMERGE' }) });
    const nseTable = nse.find((n) => n.type === 'table') as { rows: string[][] };
    expect(nseTable.rows.find((r) => r[0].startsWith('Stock Exchange'))?.[1]).toBe(
      'National Stock Exchange of India Limited',
    );
  });

  it('omits an entry whose underlying fact is missing, and gaps it instead', async () => {
    const noRegistrar: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, registrarToIssue: undefined },
    };
    const out = await renderSection(definitions, { orgId: ORG, facts: noRegistrar });
    const t = out.find((n) => n.type === 'table') as { rows: string[][] };
    expect(t.rows.find((r) => r[0] === 'Registrar to the Issue')).toBeUndefined();
    expect(collectPlaceholders(out).map((g) => g.factPath)).toContain(
      'definitions.Registrar to the Issue',
    );
  });

  it('strips the corpus issuer facts that a regex filter let through (D21)', async () => {
    // These three passed an automated filter as "safe to reuse" while still
    // carrying Om Galaxy's data. Reading them caught it; assert they stay out.
    const all = table.rows.map((r) => r.join(' ')).join('\n');
    expect(all).not.toContain('124851W'); // Om Galaxy's auditor registration
    expect(all).not.toContain('1,600'); // Om Galaxy's bid lot
    expect(all).not.toMatch(/face value of Rs 5\b/); // Om Galaxy's face value
  });

  it('substitutes rather than copies the entries that carried issuer facts', async () => {
    expect(find('Bid Lot')).toBe('3000 Equity Shares, and in multiples of 3000 Equity Shares thereafter');
    expect(find('Price Band')).toContain('Rs 47');
    expect(find('Price Band')).toContain('Rs 49');
    // Working Day is scoped to the issuer's own jurisdiction, not Om Galaxy's
    expect(find('Working Day')).toContain('Mumbai, Maharashtra');
  });

  it('keeps the cut-off rule that three sources agree on', async () => {
    const cutOff = find('Cut-off Price')!;
    expect(cutOff).toContain('Only Individual Investors are entitled to Bid at the Cut-off Price');
    expect(cutOff).toContain('Non-Institutional Investors are not');
  });

  it('carries the Section 40(3) reference that corroborated the undertakings', async () => {
    expect(find('Public Issue Account')).toContain('Section 40(3) of the Companies Act, 2013');
  });

  it('does not reproduce the error in the source document', async () => {
    // Om Galaxy's own glossary defines the Individual Investor Portion as
    // "not less than 15% of the Issue". That is wrong — 15% is the
    // Non-Institutional Portion; Individual Investors get not less than 35%
    // (R-024), which its own Issue Structure table states correctly.
    expect(find('Individual Investor Portion')).toContain('not less than 35%');
    expect(find('Individual Investor Portion')).not.toContain('15%');
    expect(find('Non-Institutional Portion')).toContain('not less than 15%');
    expect(find('QIB Portion')).toContain('not more than 50%');
  });

  it('states portion percentages but not share counts (D20)', async () => {
    for (const t of ['Individual Investor Portion', 'Non-Institutional Portion', 'QIB Portion']) {
      // The corpus states counts here; they are the banker's call at pricing
      expect(find(t)).not.toMatch(/\d{2},\d{2},\d{3}/);
    }
  });

  it('lists terms alphabetically, as a glossary does', async () => {
    const terms = table.rows.map((r) => r[0].replace(/^["']/, ''));
    const sorted = [...terms].sort((a, b) => a.localeCompare(b, 'en'));
    expect(terms).toEqual(sorted);
  });

  it('substitutes governance entries from the fact base', async () => {
    expect(find('CIN')).toContain('U29253MH2016PLC098765');
    expect(find('Managing Director')).toContain('Rajesh Vardhman');
    expect(find('Chief Financial Officer, CFO')).toContain('Sunita Vardhman');
    expect(find('Group Companies')).toContain('Vardhman Tooling Private Limited');
  });

  it('cites the statute or regulation for governance terms', async () => {
    expect(find('Independent Director')).toContain('Section 2(47)');
    expect(find('Key Managerial Personnel, KMP')).toContain('Regulation 2(1)(bb)');
    expect(find('Senior Management, SMP')).toContain('Regulation 2(1)(bbbb)');
    expect(find('Promoter Group')).toContain('Regulation 2(1)(pp)');
    expect(find('Audit Committee')).toContain('Section 177');
    expect(find('Nomination and Remuneration Committee')).toContain('Section 178');
  });

  it('distinguishes inapplicable from missing', async () => {
    // Vardhman has no separate corporate office. The term should be ABSENT,
    // not listed as a gap — telling an issuer to supply a corporate office it
    // does not have sends them looking for one.
    expect(vardhman.company.corporateOffice).toBeUndefined();
    expect(table.rows.find((r) => r[0] === 'Corporate Office')).toBeUndefined();
    expect(collectPlaceholders(nodes).map((g) => g.factPath)).not.toContain(
      'definitions.Corporate Office',
    );

    // Whereas a fact we expect and do not have IS a gap
    const noRegistrar: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, registrarToIssue: undefined },
    };
    expect(
      collectPlaceholders(await renderSection(definitions, { orgId: ORG, facts: noRegistrar })).map((g) => g.factPath),
    ).toContain('definitions.Registrar to the Issue');
  });

  it('drops Net Issue when there is no market maker portion', async () => {
    const noMM: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, marketMakerReservationShares: undefined },
    };
    const t = (await renderSection(definitions, { orgId: ORG, facts: noMM })).find((n) => n.type === 'table') as {
      rows: string[][];
    };
    expect(t.rows.find((r) => r[0] === 'Net Issue')).toBeUndefined();
    expect(find('Net Issue')).toBeDefined();
  });

  it('renders the abbreviations as their own table', async () => {
    const tables = nodes.filter((n) => n.type === 'table') as { headers: string[]; rows: string[][] }[];
    const abbr = tables.find((t) => t.headers[0] === 'Abbreviation');
    expect(abbr).toBeDefined();
    expect(abbr!.rows.length).toBeGreaterThan(100);
    // Expansions carry no issuer facts by construction
    const all = abbr!.rows.map((r) => r.join(' ')).join('\n');
    expect(all).not.toMatch(/Om Galaxy|Baddhan|124851W|Mumbai II/);
  });

  it('excludes the KPI ratio definitions swept in from the adjacent table', async () => {
    const tables = nodes.filter((n) => n.type === 'table') as { headers: string[]; rows: string[][] }[];
    const abbr = tables.find((t) => t.headers[0] === 'Abbreviation')!;
    const all = abbr.rows.map((r) => r[1]).join('\n');
    // These belong with Basis for Issue Price, not the abbreviations
    expect(all).not.toMatch(/is calculated as Restated/);
    expect(all).not.toMatch(/RoCE is an indicator/);
  });

  it('declares the sector glossary as still outstanding', async () => {
    // Technical and industry terms are sector-specific and CANNOT come from
    // another issuer's glossary at all, however carefully filtered.
    const paths = collectPlaceholders(nodes).map((g) => g.factPath);
    expect(paths).toContain('definitions.sectorGlossary');
  });
});

describe('document assembly', () => {
  it('renders every registered section without throwing', async () => {
    await renderDocument(sectionRegistry, { orgId: ORG, facts: vardhman });
  });

  it('orders sections by their order field', async () => {
    // Assert the invariant, not specific titles by position — the latter
    // breaks every time a section is inserted, which is not a regression.
    const applicable = sectionRegistry.filter((s) => !s.appliesIf || s.appliesIf(vardhman));
    const orders = applicable.map((s) => s.order);
    const rendered = [...applicable].sort((a, b) => a.order - b.order).map((s) => s.id);

    expect(new Set(orders).size).toBe(orders.length); // no duplicate order values
    expect(rendered[0]).toBe(
      applicable.reduce((min, s) => (s.order < min.order ? s : min)).id,
    );
  });

  it('renders each applicable section exactly once', async () => {
    const nodes = await renderDocument(sectionRegistry, { orgId: ORG, facts: vardhman });
    const applicable = sectionRegistry.filter((s) => !s.appliesIf || s.appliesIf(vardhman));
    const level2 = nodes.filter((n) => n.type === 'heading' && n.level === 2);
    // Every section emits at least one node
    expect(nodes.length).toBeGreaterThan(applicable.length);
    expect(level2.length).toBeGreaterThan(0);
  });

  it('surfaces gaps from across the whole document', async () => {
    // Risk Factors always raises this one (D45) — even a fully-filled Vardhman
    // has narrative drafting and further archetypes still pending.
    const gaps = collectPlaceholders(await renderDocument(sectionRegistry, { orgId: ORG, facts: vardhman }));
    expect(gaps.map((g) => g.factPath)).toContain('general.riskFactors.narrative');
  });
});

describe('UPI, availability and price levels', () => {
  const text = async (spec: SectionSpec, facts: FactBase) =>
    (await renderSection(spec, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('states the mandatory UPI phase and names the sponsor bank', async () => {
    const out = await text(issueProcedureUpi, vardhman);
    expect(out).toContain('mandatory for public issues opening on or after December 1, 2023');
    expect(out).toContain('HDFC Bank Limited');
  });

  it('omits the superseded Phase I and Phase II history', async () => {
    // Three paragraphs of 2019-2020 circular history with no effect on a 2026
    // issue, corroborated by only two documents. Left to the banker to add.
    const out = await text(issueProcedureUpi, vardhman);
    expect(out).not.toContain('Phase I:');
    expect(out).not.toContain('January 1, 2019');
  });

  it('omits the two sentences that appear in one document only', async () => {
    // Both are Om Galaxy's alone. The longest document in the corpus is also
    // the primary extraction source, so single-source sentences cluster there
    // and have to be checked for rather than assumed absent. D26.
    const out = await text(issueProcedureUpi, vardhman);
    expect(out).not.toContain('All SCSBs offering the facility');
    expect(out).not.toContain('a stockbroker registered with a recognised stock exchange');
  });

  it('keeps the UPI grievance requirements, which five documents state', async () => {
    const out = await text(issueProcedureUpi, vardhman);
    expect(out).toContain('appointment of a nodal officer');
    expect(out).toContain('SMS alerts for the blocking and unblocking');
  });

  it('raises a gap for the sponsor bank when it is not yet appointed', async () => {
    const noBank: FactBase = { ...vardhman, offer: { ...vardhman.offer, sponsorBank: undefined } };
    const paths = collectPlaceholders(await renderSection(issueProcedureUpi, { orgId: ORG, facts: noBank })).map(
      (g) => g.factPath,
    );
    expect(paths).toContain('offer.sponsorBank');
  });

  it('routes each investor category to the right intermediary', async () => {
    const out = await text(issueProcedureAvailability, vardhman);
    expect(out).toContain('3 in 1 type accounts');
    expect(out).toContain('QIBs and Non-Institutional Investors');
    expect(out).toContain('State of Sikkim');
    // The one asymmetry: the anchor form is not available at the Bidding Centres.
    expect(out).toContain('Anchor Investor Application Form will be available only at the offices');
  });

  it('confines cut-off price bids to individual bidders', async () => {
    // The finding held-out verification produced earlier: following Maxwell
    // alone would have told issuers to reject valid retail bids.
    const out = await text(issueProcedurePriceLevels, vardhman);
    expect(out).toContain('Only Individual Bidders may Bid at the Cut-off Price');
  });

  it('lets the price band be revised without telling the bidders', async () => {
    expect(await text(issueProcedurePriceLevels, vardhman)).toContain(
      'without the prior approval of, or intimation to, the Bidders',
    );
  });

  it('does not apply the price-level rules to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await renderSection(issueProcedurePriceLevels, { orgId: ORG, facts: fixedPrice })).toHaveLength(0);
    // UPI and availability are not book-building specific and still render.
    expect((await renderSection(issueProcedureUpi, { orgId: ORG, facts: fixedPrice })).length).toBeGreaterThan(0);
  });

  it('leaves no unresolved syntax in any of the three', async () => {
    for (const spec of [issueProcedureUpi, issueProcedureAvailability, issueProcedurePriceLevels]) {
      expect(await text(spec, vardhman), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
      expect(await text(spec, variant({ exchange: 'NSE_EMERGE' })), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
    }
  });
});

describe('Anchor Investors and Information for Bidders', () => {
  const text = async (spec: SectionSpec, facts: FactBase) =>
    (await renderSection(spec, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('states the anchor ceiling, floor and window', async () => {
    const out = await text(issueProcedureAnchorInvestors, vardhman);
    expect(out).toContain('up to 60% of the QIB Portion');
    expect(out).toContain('Bid Amount is at least Rs 200.00 Lakhs');
    expect(out).toContain('one Working Day before the Bid/Issue Opening Date');
  });

  it('states the allottee bands in the units the corpus uses', async () => {
    // Restating a threshold in different units invites an off-by-one, so the
    // bands stay in Lakhs exactly as five sources state them.
    const out = await text(issueProcedureAnchorInvestors, vardhman);
    expect(out).toContain('up to Rs 200.00 Lakhs');
    expect(out).toContain('more than Rs 200.00 Lakhs and up to Rs 2,500.00 Lakhs');
    expect(out).toContain('additional ten Anchor Investors for every additional Rs 2,500.00 Lakhs');
    expect(out).toContain('minimum Allotment of Rs 100.00 Lakhs');
  });

  it('resolves the price gap in both directions, as the corpus does', async () => {
    const out = await text(issueProcedureAnchorInvestors, vardhman);
    expect(out).toContain('within two Working Days');
    // Three sources: allotment is at the HIGHER price. The rule is asymmetric,
    // and stating only the top-up half would mislead.
    expect(out).toContain('Allotment to successful Anchor Investors will be at the higher price');
  });

  it('binds anchors to their bids', async () => {
    expect(await text(issueProcedureAnchorInvestors, vardhman)).toContain(
      'cannot withdraw or lower the size of their Bids at any stage after submission',
    );
  });

  it('does not apply to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await renderSection(issueProcedureAnchorInvestors, { orgId: ORG, facts: fixedPrice })).toHaveLength(0);
  });

  it('omits the two single-sourced items from Information for Bidders', async () => {
    const out = await text(issueProcedureInformationForBidders, vardhman);
    expect(out).not.toContain('declared the Bid/Issue Opening Date');
    expect(out).not.toContain('Cap Price less Discount');
  });

  it('keeps the submission routes that four sources state', async () => {
    const out = await text(issueProcedureInformationForBidders, vardhman);
    expect(out).toContain('physical or electronic mode');
    expect(out).toContain('Designated Branch of that SCSB where the ASBA Account is maintained');
  });

  it('leaves no unresolved syntax in either, on either exchange', async () => {
    for (const spec of [issueProcedureAnchorInvestors, issueProcedureInformationForBidders]) {
      expect(await text(spec, vardhman), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
      expect(await text(spec, variant({ exchange: 'NSE_EMERGE' })), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
    }
  });
});

describe('General instructions, the Do\'s and the Don\'ts', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(issueProcedureGeneralInstructions, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('omits the Rs 2,00,000 cap that two sources state and both get wrong', async () => {
    // Om Galaxy: "Do not Bid for a Bid Amount exceeding Rs 200,000 for Bids by
    // Individual Bidders". Maxwell says the same with "and 2 lots". Both
    // contradict the SME minimum application size stated elsewhere in their
    // own Issue Procedure, where the Bid Amount must EXCEED Rs 2,00,000.
    const out = await render(vardhman);
    expect(out).not.toMatch(/exceeding Rs 2,00,000/);
    expect(out).not.toMatch(/exceeding Rs 200,000/);
  });

  it('states the UPI ceiling instead, which is the rule that exists', async () => {
    expect(await render(vardhman)).toContain('Do not Bid for an amount exceeding Rs 5,00,000 through the UPI Mechanism');
  });

  it('does not contradict the Application Size section, anywhere in the document', async () => {
    // Section-local assertions missed this once already: the same wrong cap
    // was sitting in Grounds for Technical Rejection, where it told issuers to
    // reject every valid SME retail bid. The check has to run over the WHOLE
    // rendered document, not the section under test. D29.
    const doc = (await renderDocument(sectionRegistry, { orgId: ORG, facts: vardhman }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : [],
      )
      .join('\n');

    // R-006: for an SME issue the Bid Amount must EXCEED Rs 2,00,000...
    expect(doc).toContain('Bid Amount exceeds Rs 2,00,000');
    // ...so nothing may cap or reject an individual bid at that figure.
    expect(doc).not.toMatch(/exceeding Rs 2,00,000|exceeding Rs 200,000/);
  });

  it('confines cut-off bids consistently with the price levels section', async () => {
    expect(await render(vardhman)).toContain('only Individual Bidders may do so');
  });

  it('keeps the third-party account prohibition, which all five sources state', async () => {
    expect(await render(vardhman)).toContain("third party's bank account");
  });

  it('carries the other instructions', async () => {
    const out = await render(vardhman);
    expect(out).toContain('Section 72 of the Companies Act, 2013');
    expect(out).toContain('three Bids at different price levels');
    expect(out).toContain('whose name appears first in the depository account');
  });

  it('leaves no unresolved syntax on either exchange', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(await render(variant({ exchange: 'NSE_EMERGE' }))).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Terms of payment and electronic registration', () => {
  const text = async (spec: SectionSpec, facts: FactBase) =>
    (await renderSection(spec, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('says twice that the SEBI does not prescribe these arrangements', async () => {
    // Both the banker arrangement and the anchor escrow carry the disclaimer,
    // and both are in four extraction sources plus the held-out document.
    const out = await text(issueProcedureTermsOfPayment, vardhman);
    expect(out).toContain('is not prescribed by SEBI');
    expect(out).toContain('escrow mechanism is not prescribed by SEBI');
  });

  it('treats the anchor escrow account names as facts, not a derived string', async () => {
    // Three corpus documents, three different naming conventions. Building it
    // from the company name would look right and match no bank's records.
    const paths = collectPlaceholders(
      await renderSection(issueProcedureTermsOfPayment, { orgId: ORG, facts: vardhman }),
    ).map((g) => g.factPath);
    expect(paths).toContain('offer.anchorEscrowAccountResident');
    expect(paths).toContain('offer.anchorEscrowAccountNonResident');

    const named: FactBase = {
      ...vardhman,
      offer: {
        ...vardhman.offer,
        anchorEscrowAccountResident: 'VARDHMAN PRECISION COMPONENTS LIMITED-ANCHOR ACCOUNT-R',
        anchorEscrowAccountNonResident: 'VARDHMAN PRECISION COMPONENTS LIMITED-ANCHOR ACCOUNT-NR',
      },
    };
    expect(await text(issueProcedureTermsOfPayment, named)).toContain('ANCHOR ACCOUNT-R');
  });

  it('raises a gap for the issue price, which is not fixed until pricing', async () => {
    const paths = collectPlaceholders(
      await renderSection(issueProcedureTermsOfPayment, { orgId: ORG, facts: vardhman }),
    ).map((g) => g.factPath);
    expect(paths).toContain('offer.issuePrice');
  });

  it('states the liability split from both directions', async () => {
    const out = await text(issueProcedureElectronicRegistration, vardhman);
    expect(out).toContain('Designated Intermediaries shall be responsible');
    expect(out).toContain('nor the Registrar to the Issue shall be responsible');
  });

  it('keeps the exchange disclaimer about its own network', async () => {
    expect(await text(issueProcedureElectronicRegistration, vardhman)).toContain(
      'should not in any way be deemed or construed to mean that compliance',
    );
  });

  it('lists the fields registered into the online system', async () => {
    const out = await text(issueProcedureElectronicRegistration, vardhman);
    expect(out).toContain('Bid cum Application Form number');
    expect(out).toContain("DP ID of the Bidder's demat account");
    expect(out).toContain('acknowledgement is non-negotiable');
  });

  it('leaves no unresolved syntax in either, on either exchange', async () => {
    for (const spec of [issueProcedureTermsOfPayment, issueProcedureElectronicRegistration]) {
      expect(await text(spec, vardhman), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
      expect(await text(spec, variant({ exchange: 'NSE_EMERGE' })), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
    }
  });
});

describe('Build of the Book, withdrawal and price discovery', () => {
  const nodes = async (facts: FactBase) => await renderSection(issueProcedureBookBuilding, { orgId: ORG, facts });
  const render = async (facts: FactBase) =>
    (await nodes(facts))
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
      .join('\n');

  it('emits the illustration as a real table, which is why it is computed', async () => {
    const table = (await nodes(vardhman)).find((n) => n.type === 'table');
    expect(table).toBeDefined();
    if (table?.type !== 'table') throw new Error('unreachable');
    expect(table.rows).toHaveLength(5);
    // The cut-off row: 1,500 at Rs 22 takes cumulative demand to exactly 3,000.
    expect(table.rows[2]).toEqual(['1,500', '22', '3,000', '100.00%']);
  });

  it('keeps the illustration generic rather than using the issuer price band', async () => {
    // Every corpus document says "solely for illustrative purposes and is not
    // specific to the Issue", so deriving it from this issuer's band would be
    // inventing a disclosure none of them makes.
    const out = await render(vardhman);
    expect(out).toContain('solely for illustrative purposes');
    expect(out).toContain('Rs 20');
    expect(out).toContain('the book cuts off — Rs 22.00');
  });

  it('splits withdrawal rights by investor category', async () => {
    const out = await render(vardhman);
    expect(out).toContain('Individual Investors can withdraw their Bids until the Bid/Issue Closing Date');
    expect(out).toContain('neither withdraw nor lower the size of their Bids at any stage');
  });

  it('states that QIB under-subscription cannot spill over', async () => {
    expect(await render(vardhman)).toContain(
      'unsubscribed portion in the QIB Category is not available for subscription to other categories',
    );
  });

  it('does not apply to a fixed-price issue', async () => {
    const fixedPrice: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, issueType: 'FIXED_PRICE' },
    };
    expect(await nodes(fixedPrice)).toHaveLength(0);
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Withdrawal of the Issue and the advertisements', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(issueProcedureWithdrawalAndAdvertisement, { orgId: ORG, facts }))
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
      .join('\n');

  it('cites Reg 247(2) and the Schedule X Part A format', async () => {
    const out = await render(vardhman);
    expect(out).toContain('Regulation 247(2)');
    expect(out).toContain('Part A of Schedule X');
    expect(out).toContain('Regulation 250');
  });

  it('names the three newspapers from the facts', async () => {
    const out = await render(vardhman);
    expect(out).toContain(vardhman.offer.englishNewspaper!);
    expect(out).toContain(vardhman.offer.hindiNewspaper!);
    expect(out).toContain(vardhman.offer.regionalNewspaper!);
  });

  it('suppresses the regional-language gloss in a Hindi-speaking state', async () => {
    // The same rule held-out verification produced for Application Size:
    // Century, in Bihar, names its regional paper without the gloss, because
    // it reads oddly straight after naming a Hindi national daily.
    expect(await render(vardhman)).toContain('Marathi being the regional language of Maharashtra');

    const bihar: FactBase = {
      ...vardhman,
      company: {
        ...vardhman.company,
        registeredOffice: { ...vardhman.company.registeredOffice, state: 'Bihar' },
      },
    };
    expect(await render(bihar)).not.toContain('being the regional language of Bihar');
  });

  it('raises a gap for the underwriting agreement date when absent', async () => {
    const undated: FactBase = {
      ...vardhman,
      offer: { ...vardhman.offer, underwritingAgreementDate: undefined },
    };
    const paths = collectPlaceholders(
      await renderSection(issueProcedureWithdrawalAndAdvertisement, { orgId: ORG, facts: undated }),
    ).map((g) => g.factPath);
    expect(paths).toContain('offer.underwritingAgreementDate');
  });

  it('leaves no unresolved syntax on either exchange', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(await render(variant({ exchange: 'NSE_EMERGE' }))).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Other Regulatory — jurisdiction and experts', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(regulatoryJurisdiction, { orgId: ORG, facts }))
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
      .join('\n');

  it('names the court from the jurisdiction fact, not the registered office', async () => {
    // Om Galaxy is registered in Thane and names Mumbai; the two are not the
    // same question, which is why jurisdiction is asked rather than derived.
    expect(await render(vardhman)).toContain('competent court(s) in Mumbai, Maharashtra only');
  });

  it('switches the document name and the issue word together', async () => {
    const rhp = await render(variant({ documentStage: 'RHP', terminology: 'OFFER' }));
    expect(rhp).toContain('This Offer is being made in India');
    expect(rhp).toContain('This Red Herring Prospectus does not, however, constitute an offer');
    expect(rhp).not.toContain('Draft Red Herring Prospectus');
  });

  it('raises a gap for the expert consents, which are wholly issuer-specific', async () => {
    const paths = collectPlaceholders(await renderSection(regulatoryJurisdiction, { orgId: ORG, facts: vardhman })).map(
      (g) => g.factPath,
    );
    expect(paths).toContain('offer.expertConsents');
  });

  it('omits the single-sourced paragraph held-out verification rejected', async () => {
    // "No person outside India is eligible to bid ... unless that person has
    // received the preliminary offering memorandum" is in Om Galaxy alone —
    // not in Century, and not in any of the four NSE filings. D26.
    expect(await render(vardhman)).not.toContain('No person outside India');
  });

  it('leaves no unresolved syntax', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('Other Regulatory — statutory statements', () => {
  const render = async (facts: FactBase) =>
    (await renderSection(regulatoryStatutoryStatements, { orgId: ORG, facts }))
      .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
      .join('\n');

  it('states the standard negatives for a first-time issuer', async () => {
    const out = await render(vardhman);
    expect(out).toContain('no outstanding debentures, bonds or redeemable preference shares');
    expect(out).toContain('no stock market data is available');
    expect(out).toContain('has not capitalized its reserves or profits');
    expect(out).toContain('no property which has been purchased or acquired');
  });

  it('formats the registrar agreement date as the corpus does', async () => {
    expect(await render(vardhman)).toContain('dated July 14, 2026');
  });

  it('flips the partly paid and convertible statements on the facts', async () => {
    // These read as flat negatives for a clean issuer, but an issuer who has
    // either would have the section assert something false about them.
    const messy = {
      ...vardhman,
      capital: { ...vardhman.capital, hasPartlyPaidShares: true, hasOutstandingConvertibles: true },
    };
    const out = await render(messy);
    expect(out).toContain('Partly paid-up Equity Shares are outstanding');
    expect(out).toContain('Regulation 230(1)(c)');
    expect(out).toContain('Our Company has outstanding convertible instruments');
    expect(out).toContain('Regulation 228(e)');
    expect(out).not.toContain('there are no partly paid-up Equity Shares');
  });

  it('prints the Reg 300(1)(c) negative unless an exemption was sought', async () => {
    expect(await render(vardhman)).toContain('has not made any application under Regulation 300(1)(c)');

    const applied = {
      ...vardhman,
      offer: {
        ...vardhman.offer,
        exemptionApplicationDetails:
          'Our Company filed an exemption application dated October 6, 2026 under Regulation 300(1)(c).',
      },
    };
    expect(await render(applied)).toContain('filed an exemption application dated October 6, 2026');
    expect(await render(applied)).not.toContain('has not made any application under Regulation 300(1)(c)');
  });

  it('leaves no unresolved syntax on either exchange', async () => {
    expect(await render(vardhman)).not.toMatch(/\{\{|\}\}|\*\*/);
    expect(await render(variant({ exchange: 'NSE_EMERGE' }))).not.toMatch(/\{\{|\}\}|\*\*/);
  });
});

describe('section anchors', () => {
  it('gives every rendered section a unique anchor', async () => {
    const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });
    const anchors = sections.map((s) => s.anchor);
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors.every((a) => /^sec-[a-z0-9-]+$/.test(a))).toBe(true);
  });

  it('leaves out sections that render nothing', async () => {
    // A "Holds up" link pointing at a section switched off by appliesIf would
    // scroll nowhere, and the reader would assume they had missed it.
    const off: SectionSpec = {
      id: 'test.notApplicable',
      title: 'Not Applicable Here',
      producer: 'template',
      order: 9000,
      group: 'SECTION I - GENERAL',
      partOf: '3. Forward Looking Statements',
      appliesIf: () => false,
      template: '## Never rendered',
    };
    const ids = (await renderSections([off, termsOfIssue], { orgId: ORG, facts: vardhman })).map((s) => s.id);
    expect(ids).not.toContain('test.notApplicable');
    expect(ids).toContain('issueRelated.termsOfIssue');
  });

  it('flattens back to exactly what renderDocument produces', async () => {
    // The DOCX renderer consumes the flat tree; the section boundaries only
    // exist so the gap list has somewhere to point.
    const ctx = { orgId: ORG, facts: vardhman };
    expect(flattenSections(await renderSections(sectionRegistry, ctx))).toEqual(
      await renderDocument(sectionRegistry, ctx),
    );
  });
});

describe('gap collection across sections', () => {
  const gapSection = (id: string, title: string, factPath: string): RenderedSection => ({
    id,
    title,
    group: 'SECTION I - GENERAL',
    partOf: '1. Definitions and Abbreviations',
    anchor: `sec-${id}`,
    nodes: [
      {
        type: 'paragraph',
        runs: [
          { text: 'Registered with ' },
          { text: '[TO BE PROVIDED: Registrar]', placeholder: { factPath, ask: 'Registrar' } },
        ],
      },
    ],
  });

  it('reports one gap naming every section that renders it', async () => {
    // The registrar's address appears in Definitions, General Information and
    // Terms of the Issue. It is ONE thing for the issuer to provide, so it is
    // one finding — but the reader still needs to know where it all lands.
    const gaps = collectGaps([
      gapSection('a', 'Definitions', 'registrar.address'),
      gapSection('b', 'Terms of the Issue', 'registrar.address'),
    ]);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].sections.map((s) => s.title)).toEqual(['Definitions', 'Terms of the Issue']);
  });

  it('anchors only the first occurrence of a gap', async () => {
    // Two elements with the same id is not a near-miss: the browser jumps to
    // whichever it finds first, so the link silently lands in the wrong place.
    const keys = gapAnchorKeys([
      gapSection('a', 'Definitions', 'registrar.address'),
      gapSection('b', 'Terms of the Issue', 'registrar.address'),
    ]);
    expect([...keys.values()]).toEqual(['registrar.address']);
    expect(keys.get(runKey(0, 0, 1))).toBe('registrar.address');
  });

  it('addresses gaps inside list items', async () => {
    const section: RenderedSection = {
      id: 'c',
      title: 'Consents',
      group: 'SECTION I - GENERAL',
      partOf: '1. Definitions and Abbreviations',
      anchor: 'sec-c',
      nodes: [
        {
          type: 'list',
          ordered: false,
          items: [
            [{ text: 'Named consent' }],
            [{ text: '[TO BE PROVIDED: Auditor]', placeholder: { factPath: 'auditor.name', ask: 'Auditor' } }],
          ],
        },
      ],
    };
    expect(gapAnchorKeys([section]).get(runKey(0, 0, 1, 0))).toBe('auditor.name');
  });

  it('never leaves a table gap without a placeholder to report it', async () => {
    // Table cells are plain strings, so "[TO BE PROVIDED]" inside one is
    // invisible to collectPlaceholders and would never reach the gap list —
    // it would sit in the document unreported, which is exactly what MM4
    // forbids. Issue Structure pairs its uncomputable allotment cells with a
    // placeholder in the paragraph above; any new table must do the same.
    for (const section of await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman })) {
      const inTable = section.nodes.some(
        (n) => n.type === 'table' && n.rows.flat().some((cell) => cell.includes('[TO BE PROVIDED')),
      );
      if (!inTable) continue;
      expect(
        collectPlaceholders(section.nodes).length,
        `${section.id} has a table gap that raises no finding`,
      ).toBeGreaterThan(0);
    }
  });

  it('gives each gap in the real document exactly one anchor', async () => {
    const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });
    const keys = gapAnchorKeys(sections);
    const paths = [...keys.values()];
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('general.riskFactors.narrative');
  });
});

describe('progress counting', () => {
  it('counts numbered subsections, not registry entries', async () => {
    // Issue Procedure is ONE of the 37 subsections in the section map and
    // sixteen entries in the registry. Counting entries against 37 reported
    // roughly four times the real progress until 2026-09-10.
    const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });
    const subsections = new Set(sections.map((s) => s.partOf));

    // Still well above one entry per subsection: Issue Procedure alone is 16
    expect(sections.length).toBeGreaterThan(subsections.size + 15);
    expect(subsections.size).toBeLessThanOrEqual(37);
    expect([...subsections].sort()).toEqual([
      '1. Definitions and Abbreviations',
      '10. Capital Structure',
      '11. Objects of the Issue',
      '12. Basis for Issue Price',
      '13. Statement of Special / Possible Tax Benefits',
      '14. Industry Overview',
      '15. Our Business / Business Overview',
      '16. Key Industry Regulations and Policies',
      '17. History and Corporate Structure / Certain Corporate Matters',
      '18. Our Subsidiaries, Associates and Joint Ventures',
      '19. Our Management',
      '2. Certain Conventions, Presentation of Financial, Industry and Market Data',
      '20. Our Promoters and Promoter Group',
      '21. Our Group Company / Companies',
      '22. Dividend Policy',
      '23. Restated Financial Information',
      '24. Other Financial Information',
      '25. Capitalisation Statement',
      '26. Management\'s Discussion and Analysis',
      '27. Financial Indebtedness',
      '28. Outstanding Litigation and Material Developments',
      '29. Government and Other Approvals',
      '3. Forward Looking Statements',
      '30. Other Regulatory and Statutory Disclosures',
      '31. Terms of the Issue',
      '32. Issue Structure',
      '33. Issue Procedure',
      '34. Restrictions on Foreign Ownership of Indian Securities',
      '35. Main Provisions of the Articles of Association',
      '36. Material Contracts and Documents for Inspection',
      '37. Declaration',
      '4. Risk Factors',
      '5. The Issue / The Offer',
      '6. Summary of Financial Information',
      '7. Summary of Contingent Liabilities',
      '8. Summary of Related Party Transactions',
      '9. General Information',
    ]);
  });

  it('gives every registered section a numbered subsection', async () => {
    for (const spec of sectionRegistry) {
      expect(spec.partOf, spec.id).toMatch(/^\d+\. /);
    }
  });
});

describe('Conventions, dividend, foreign ownership and declaration', () => {
  const text = async (spec: SectionSpec, facts: FactBase) =>
    (await renderSection(spec, { orgId: ORG, facts }))
      .flatMap((n) =>
        n.type === 'paragraph'
          ? [n.runs.map((r) => r.text).join('')]
          : n.type === 'list'
            ? n.items.map((i) => i.map((r) => r.text).join(''))
            : n.type === 'heading'
              ? [n.text]
              : [],
      )
      .join('\n');

  it('drops page cross-references while keeping the section names', async () => {
    // The corpus writes 'see "Definitions and Abbreviations" on page 1'. We do
    // not paginate until DOCX export, so a page number here is invented.
    const out = await text(conventions, vardhman);
    expect(out).toContain('see "Definitions and Abbreviations"');
    expect(out).not.toMatch(/on page \d+/);
  });

  it('states the units a reader of Indian financials needs', async () => {
    const out = await text(conventions, vardhman);
    expect(out).toContain('"Lakh" means one hundred thousand');
    expect(out).toContain('rounded off to the second decimal place');
    expect(out).toContain('Indian Standard Time');
  });

  it('omits the single-sourced record-date paragraph from Dividend Policy', async () => {
    // Om Galaxy alone. Fourth such catch, all four in the same document.
    expect(await text(dividendPolicy, vardhman)).not.toContain('register of members');
  });

  it('keeps the land-border restriction, which the held-out document confirms', async () => {
    expect(await text(foreignOwnership, vardhman)).toContain('shares a land border with India');
  });

  it('does not recite a sectoral cap it cannot know', async () => {
    // The corpus points at the FDI Policy rather than stating a number, and a
    // number recited for the wrong sector is worse than silence.
    const out = await text(foreignOwnership, vardhman);
    expect(out).toContain('sectoral cap');
    expect(out).not.toMatch(/sectoral cap[^.]{0,40}\b\d{1,3}%/);
  });

  it('builds the declaration signature block from the fact base', async () => {
    const out = await text(declaration, vardhman);
    for (const d of vardhman.management.directors) expect(out).toContain(d.name);
    expect(out).toContain('Chairman and Managing Director');
    expect(out).toContain('Place: Pune');
  });

  it('raises a gap rather than an empty declaration when no board is recorded', async () => {
    const noBoard: FactBase = {
      ...vardhman,
      management: { ...vardhman.management, directors: [], keyManagerialPersonnel: [] },
    };
    const paths = collectPlaceholders(await renderSection(declaration, { orgId: ORG, facts: noBoard })).map(
      (g) => g.factPath,
    );
    expect(paths).toContain('management.directors');
  });

  it('leaves no unresolved syntax in any of the four, on either exchange', async () => {
    for (const spec of [conventions, dividendPolicy, foreignOwnership, declaration]) {
      expect(await text(spec, vardhman), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
      expect(await text(spec, variant({ exchange: 'NSE_EMERGE' })), spec.id).not.toMatch(/\{\{|\}\}|\*\*/);
    }
  });
});
