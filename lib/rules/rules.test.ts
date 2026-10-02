import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allRules, eligibilityRules, evaluate, summarise, operatingProfit, freeCashFlowToEquity } from './index';
import { assess, completenessFindings, linkFindings } from './document-assess';
import { vardhman } from '../seed/vardhman';
import { money } from '../facts/money';
import { gapAnchor, sectionAnchor } from '../anchors';
import { renderSections } from '../document/section';
import { sectionRegistry } from '../document/sections';
import type { FactBase } from '../facts/schema';
import type { Finding } from './types';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../store/versioned-table';

/** Deep-ish clone with one branch replaced. */
function broken(mutate: (f: FactBase) => void): FactBase {
  const f = structuredClone(vardhman) as FactBase;
  mutate(f);
  return f;
}

const ORG = 'org_test1';

beforeEach(() => {
  __setVersionedTableForTests(createFakeVersionedTable());
});
afterEach(() => {
  __setVersionedTableForTests(null);
});

const fires = (ruleId: string, facts: FactBase) =>
  evaluate(allRules, facts).some((x) => x.ruleId === ruleId);

const findingFor = (ruleId: string, facts: FactBase) =>
  evaluate(allRules, facts).find((x) => x.ruleId === ruleId);

/** Metadata a rule would have supplied, for exercising the linking pass alone. */
const stubFinding: Finding = {
  ruleId: 'TEST-1',
  clause: 'R-000',
  title: 'Stub',
  severity: 'major',
  category: 'consistency',
  detail: 'Stub',
};

describe('the clean seed passes every rule', () => {
  it('produces no findings at all', async () => {
    const findings = evaluate(allRules, vardhman);
    if (findings.length > 0) {
      console.error(findings.map((f) => `${f.ruleId}: ${f.detail}`).join('\n\n'));
    }
    expect(findings).toHaveLength(0);
  });

  it('scores 100 with no blockers', async () => {
    const s = summarise(allRules, vardhman);
    expect(s.blockers).toBe(0);
    expect(s.score).toBe(100);
    expect(s.passed).toBeGreaterThan(20);
  });

  it('counts rules that do not govern this issuer separately from passes', async () => {
    // Vardhman is BSE SME with no OFS, so the NSE and OFS rules do not apply.
    // They are neither passes nor gaps.
    const s = summarise(allRules, vardhman);
    expect(s.notApplicable).toBeGreaterThan(0);
  });
});

describe('eligibility rules each fire on their own breach', () => {
  it('EL-001 private limited company', async () => {
    expect(fires('EL-001', vardhman)).toBe(false);
    const f = broken((x) => { x.company.isPublicLimited = false; });
    expect(fires('EL-001', f)).toBe(true);
    expect(findingFor('EL-001', f)!.severity).toBe('blocker');
    expect(findingFor('EL-001', f)!.detail).toContain('45 to 60 days');
  });

  it('EL-002 post-issue capital above Rs 25 crore', async () => {
    expect(fires('EL-002', vardhman)).toBe(false);
    const f = broken((x) => { x.offer.freshIssueShares = 20000000; x.capital.authorisedShares = 99999999; });
    expect(fires('EL-002', f)).toBe(true);
    expect(findingFor('EL-002', f)!.detail).toContain('Rs 32.00 Crores');
  });

  it('EL-003 issue below 25% of post-issue capital', async () => {
    expect(fires('EL-003', vardhman)).toBe(false);
    const f = broken((x) => { x.offer.freshIssueShares = 1000000; });
    expect(fires('EL-003', f)).toBe(true);
    expect(findingFor('EL-003', f)!.detail).toMatch(/7\.\d\d% of post-issue capital/);
  });

  it('EL-004 operating profit below Rs 1 crore in 2 of 3 years', async () => {
    expect(fires('EL-004', vardhman)).toBe(false);
    const f = broken((x) => {
      x.financials.years[1].profitBeforeTax = money('0.1', 'crores');
      x.financials.years[2].profitBeforeTax = money('0.1', 'crores');
      x.financials.years[1].financeCosts = money('0');
      x.financials.years[2].financeCosts = money('0');
      x.financials.years[1].depreciationAndAmortisation = money('0');
      x.financials.years[2].depreciationAndAmortisation = money('0');
    });
    expect(fires('EL-004', f)).toBe(true);
    expect(findingFor('EL-004', f)!.detail).toContain('Only 1 of the last 3 years');
  });

  it('EL-005 track record under three years', async () => {
    expect(fires('EL-005', vardhman)).toBe(false);
    const f = broken((x) => { x.company.dateOfIncorporation = '2025-06-01'; });
    expect(fires('EL-005', f)).toBe(true);
  });

  it('EL-006 net worth applies to BSE and not to NSE', async () => {
    const thin = (x: FactBase) => {
      x.financials.years[1].netWorth = money('0.2', 'crores');
      x.financials.years[2].netWorth = money('0.2', 'crores');
    };
    expect(fires('EL-006', broken(thin))).toBe(true);
    // NSE Emerge does not state a net worth floor
    expect(fires('EL-006', broken((x) => { thin(x); x.offer.exchange = 'NSE_EMERGE'; }))).toBe(false);
  });

  it('EL-007 leverage above 3:1, BSE only', async () => {
    const levered = (x: FactBase) => { x.financials.years[0].totalBorrowings = money('80', 'crores'); };
    expect(fires('EL-007', broken(levered))).toBe(true);
    expect(findingFor('EL-007', broken(levered))!.detail).toContain(':1');
    expect(fires('EL-007', broken((x) => { levered(x); x.offer.exchange = 'NSE_EMERGE'; }))).toBe(false);
  });

  it('EL-008 free cash flow, NSE only', async () => {
    // Vardhman is BSE, so the rule does not govern it at all
    expect(fires('EL-008', vardhman)).toBe(false);
    const onNse = broken((x) => { x.offer.exchange = 'NSE_EMERGE'; });
    expect(fires('EL-008', onNse)).toBe(false); // its FCFE is positive
    const negative = broken((x) => {
      x.offer.exchange = 'NSE_EMERGE';
      for (const y of x.financials.years.slice(1)) y.netPurchaseOfFixedAssets = money('50', 'crores');
    });
    expect(fires('EL-008', negative)).toBe(true);
  });

  it('EL-009 to EL-012 the Reg 228 blockers', async () => {
    expect(fires('EL-009', broken((x) => { x.promoters.anyDebarredBySebi = true; }))).toBe(true);
    expect(fires('EL-010', broken((x) => { x.promoters.anyWilfulDefaulterOrFraudulentBorrower = true; }))).toBe(true);
    expect(fires('EL-011', broken((x) => { x.promoters.anyFugitiveEconomicOffender = true; }))).toBe(true);

    const convertibles = broken((x) => { x.capital.hasOutstandingConvertibles = true; });
    expect(fires('EL-012', convertibles)).toBe(true);
    // The long lead time is the point of surfacing this early
    expect(findingFor('EL-012', convertibles)!.detail).toContain('long lead time');
  });

  it('EL-013 partly paid shares', async () => {
    expect(fires('EL-013', broken((x) => { x.capital.hasPartlyPaidShares = true; }))).toBe(true);
  });

  it('EL-014 promoter holdings in physical form', async () => {
    expect(fires('EL-014', vardhman)).toBe(false);
    const f = broken((x) => { x.capital.shareholders[0].isDematerialised = false; });
    expect(fires('EL-014', f)).toBe(true);
    expect(findingFor('EL-014', f)!.detail).toContain('Rajesh Vardhman');
    // A public shareholder in physical form is not caught by Reg 230(1)(d)
    const publicPhysical = broken((x) => { x.capital.shareholders[4].isDematerialised = false; });
    expect(fires('EL-014', publicPhysical)).toBe(false);
  });

  it('EL-015 objects repaying promoter loans', async () => {
    expect(fires('EL-015', vardhman)).toBe(false);
    const f = broken((x) => { x.offer.objects[2].involvesPromoterLoanRepayment = true; });
    expect(fires('EL-015', f)).toBe(true);
    expect(findingFor('EL-015', f)!.severity).toBe('blocker');
  });

  it('EL-016 firm finance, unconfirmed, where an object is a project', async () => {
    // Vardhman has a plant and machinery object and has confirmed the finance
    expect(fires('EL-016', vardhman)).toBe(false);

    const unconfirmed = broken((x) => { x.offer.firmFinanceConfirmed = false; });
    expect(fires('EL-016', unconfirmed)).toBe(true);
    expect(findingFor('EL-016', unconfirmed)!.severity).toBe('major');

    // No project object means the rule does not govern the issuer at all,
    // confirmed or not
    const noProject = broken((x) => {
      x.offer.firmFinanceConfirmed = false;
      for (const o of x.offer.objects) o.isProject = false;
    });
    expect(fires('EL-016', noProject)).toBe(false);
  });

  it('EL-017 general corporate purposes above the cap', async () => {
    expect(fires('EL-017', vardhman)).toBe(false);
    const f = broken((x) => { x.offer.objects[3].amount = money('8', 'crores'); });
    expect(fires('EL-017', f)).toBe(true);
    // 15% of Rs 22.05 cr is the binding limit here, not the Rs 10 cr ceiling
    expect(findingFor('EL-017', f)!.detail).toContain('15% of gross proceeds');
  });

  it('EL-018 and EL-019 the OFS caps, only where there is an OFS', async () => {
    expect(fires('EL-018', vardhman)).toBe(false);
    expect(fires('EL-019', vardhman)).toBe(false);

    const bigOfs = broken((x) => {
      x.offer.sellingShareholders = [
        { name: 'Anil Vardhman', type: 'PROMOTER_GROUP', sharesOffered: 2000000, preIssueShares: 1200000, weightedAverageCostOfAcquisition: money('12') },
      ];
    });
    expect(fires('EL-018', bigOfs)).toBe(true); // over 20% of the issue
    expect(fires('EL-019', bigOfs)).toBe(true); // and over 50% of their holding

    const smallOfs = broken((x) => {
      x.offer.sellingShareholders = [
        { name: 'Anil Vardhman', type: 'PROMOTER_GROUP', sharesOffered: 400000, preIssueShares: 1200000, weightedAverageCostOfAcquisition: money('12') },
      ];
    });
    expect(fires('EL-018', smallOfs)).toBe(false);
    expect(fires('EL-019', smallOfs)).toBe(false);
  });

  it('EL-020 BRLM underwriting below 15%', async () => {
    expect(fires('EL-020', broken((x) => { x.offer.brlmUnderwritingPercent = 10; }))).toBe(true);
  });

  it('EL-021 market making missing or under three years', async () => {
    expect(fires('EL-021', vardhman)).toBe(false);
    expect(fires('EL-021', broken((x) => { x.offer.marketMakerName = undefined; }))).toBe(true);
    expect(fires('EL-021', broken((x) => { x.offer.marketMakingYears = 1; }))).toBe(true);
  });
});

/**
 * The exchange criteria stated under Reg 229(3). Vardhman is BSE SME with an
 * intended filing date of 2026-11-15, so every look-back window in these tests
 * is measured from that date, not from today — which is the point of measuring
 * from the filing date at all.
 */
describe('exchange criteria fire on their own breach and only at their own exchange', () => {
  const onNSE = (mutate: (f: FactBase) => void = () => {}) =>
    broken((x) => {
      x.offer.exchange = 'NSE_EMERGE';
      mutate(x);
    });

  it('EL-022 net tangible assets below Rs 3 crore, BSE only', async () => {
    // 42.60 - 22.90 - 0.18 - 0.12 = 19.40 crore for FY2026.
    expect(fires('EL-022', vardhman)).toBe(false);

    // R-029, closing O-13: the floor is Rs 3 crore, not merely positive. An
    // issuer at 2 crore is POSITIVE and still fails.
    const thin = (x: FactBase) => { x.financials.years[0].totalLiabilities = money('40.30', 'crores'); };
    expect(fires('EL-022', broken(thin))).toBe(true);
    expect(findingFor('EL-022', broken(thin))!.detail).toContain('shortfall of Rs 1.00 Crores');

    const negative = (x: FactBase) => { x.financials.years[0].totalLiabilities = money('45', 'crores'); };
    expect(findingFor('EL-022', broken(negative))!.detail).toContain('Rs -2.70 Crores');

    // NSE Emerge does not state a net tangible assets test.
    expect(fires('EL-022', onNSE(thin))).toBe(false);
  });

  it('EL-023 website missing or malformed, BSE only', async () => {
    expect(fires('EL-023', vardhman)).toBe(false);
    expect(fires('EL-023', broken((x) => { x.company.website = ''; }))).toBe(true);
    const bad = broken((x) => { x.company.website = 'vardhmanprecision'; });
    expect(fires('EL-023', bad)).toBe(true);
    expect(findingFor('EL-023', bad)!.severity).toBe('major');
    expect(fires('EL-023', onNSE((x) => { x.company.website = ''; }))).toBe(false);
  });

  it('EL-024 promoter control changed in the past year, BSE only', async () => {
    expect(fires('EL-024', vardhman)).toBe(false);
    const changed = (x: FactBase) => { x.promoters.controlChangedInPastYear = true; };
    expect(fires('EL-024', broken(changed))).toBe(true);
    expect(fires('EL-024', onNSE(changed))).toBe(false);
  });

  it('EL-025 a genuine change of name inside the one-year window', async () => {
    expect(fires('EL-025', vardhman)).toBe(false);

    // Filing 2026-11-15; a rebrand in June 2026 is five months before it.
    const rebrand = (x: FactBase) => {
      x.company.nameChanges.push({
        previousName: 'Vardhman Precision Components Limited',
        newName: 'Vardhman Precision Industries Limited',
        date: '2026-06-01',
        reason: 'Rebranding',
      });
    };
    const f = broken(rebrand);
    expect(fires('EL-025', f)).toBe(true);
    expect(findingFor('EL-025', f)!.detail).toContain('June 1, 2026');
    expect(findingFor('EL-025', f)!.detail).toContain('lapses once the change is a year old, on June 1, 2027');
    // R-030 closed O-12: the revenue test is the rule, and failing it is a
    // hard entry-norm failure rather than something to raise with the exchange.
    expect(findingFor('EL-025', f)!.severity).toBe('blocker');

    // The same change two years earlier is outside the window.
    const old = broken((x) => {
      x.company.nameChanges.push({
        previousName: 'A', newName: 'B', date: '2024-06-01',
      });
    });
    expect(fires('EL-025', old)).toBe(false);
  });

  it('EL-025 clears once half the revenue comes from the new activity', async () => {
    // S9's formulation: a name change inside the window is not a bar, it is a
    // revenue test. Without a pass state this rule could never be cleared.
    const withShare = (share: number | null) =>
      broken((x) => {
        x.company.nameChanges.push({
          previousName: 'Old Name Limited',
          newName: 'New Name Limited',
          date: '2026-06-01',
        });
        x.company.revenueShareFromNewNameActivity = share;
      });

    expect(fires('EL-025', withShare(null))).toBe(true);
    expect(findingFor('EL-025', withShare(null))!.detail).toContain('NOT YET COMPUTED');

    expect(fires('EL-025', withShare(42))).toBe(true);
    expect(findingFor('EL-025', withShare(42))!.detail).toContain('short by 8.00 percentage points');

    expect(fires('EL-025', withShare(50))).toBe(false);
    expect(fires('EL-025', withShare(88))).toBe(false);
  });

  it('EL-025 does not fire on the conversion to public limited', async () => {
    // Every SME issuer converts shortly before filing, and Section 23 requires
    // it. A blocker that fires on the mandatory step is one nobody can clear.
    const f = broken((x) => {
      x.company.conversionToPublicDate = '2026-08-01';
      x.company.nameChanges = [
        {
          previousName: 'Vardhman Precision Components Private Limited',
          newName: 'Vardhman Precision Components Limited',
          date: '2026-08-01',
          reason: 'Conversion to public limited company',
        },
      ];
    });
    // And nothing else fires either. Under R-030 the test is about the
    // ACTIVITY the new name indicates, which a conversion does not change, so
    // the conversion needs no separate rule — EL-038 was deleted when O-12
    // closed.
    expect(fires('EL-025', f)).toBe(false);
    expect(evaluate(allRules, f).map((x) => x.ruleId)).not.toContain('EL-038');
  });

  it('EL-026, EL-027 and EL-028 fire at both exchanges', async () => {
    for (const [id, mutate] of [
      ['EL-026', (x: FactBase) => { x.legal.referredToNCLT = true; }],
      ['EL-027', (x: FactBase) => { x.legal.windingUpPetitionAdmitted = true; }],
      ['EL-028', (x: FactBase) => { x.legal.referredToBIFR = true; }],
    ] as const) {
      expect(fires(id, vardhman)).toBe(false);
      expect(fires(id, broken(mutate))).toBe(true);
      expect(fires(id, onNSE(mutate))).toBe(true);
      expect(findingFor(id, broken(mutate))!.severity).toBe('blocker');
    }
  });

  it('EL-029 IBC against promoting companies fires at both exchanges', async () => {
    // Corrected 2026-09-10. This was scoped to NSE on the strength of one BSE
    // document that asks only about the issuer; S9 states the promoting-company
    // limb at BSE too, so scoping it to NSE told a BSE issuer nothing at all.
    const mutate = (x: FactBase) => { x.legal.ibcProceedingsAgainstPromotingCompanies = true; };
    expect(fires('EL-029', vardhman)).toBe(false);
    expect(fires('EL-029', onNSE(mutate))).toBe(true);
    expect(fires('EL-029', broken(mutate))).toBe(true);
  });

  it('EL-030 applies BSE windows: 3 years for the company, 1 for promoters', async () => {
    expect(fires('EL-030', vardhman)).toBe(false);

    // Filing 2026-11-15. Company action 2 years back is inside the 3-year window.
    const company = broken((x) => { x.legal.regulatoryActionAgainstCompanySince = '2024-11-15'; });
    expect(fires('EL-030', company)).toBe(true);
    expect(findingFor('EL-030', company)!.detail).toContain('inside the 3-year window');

    // Four years back is outside it.
    expect(fires('EL-030', broken((x) => { x.legal.regulatoryActionAgainstCompanySince = '2022-11-15'; }))).toBe(false);

    // A promoter action gets one year, not three: two years back is outside.
    expect(fires('EL-030', broken((x) => { x.legal.regulatoryActionAgainstPromotersSince = '2024-11-15'; }))).toBe(false);
    expect(fires('EL-030', broken((x) => { x.legal.regulatoryActionAgainstPromotersSince = '2026-06-01'; }))).toBe(true);

    expect(fires('EL-030', onNSE((x) => { x.legal.regulatoryActionAgainstCompanySince = '2024-11-15'; }))).toBe(false);
  });

  it('EL-031 applies NSE subjects with no stated window', async () => {
    // N-09 reaches group companies and states no look-back period, so an old
    // action still reports rather than being filtered out by a date we invented.
    const old = onNSE((x) => { x.legal.regulatoryActionAgainstGroupCompaniesSince = '2015-01-01'; });
    expect(fires('EL-031', old)).toBe(true);
    expect(findingFor('EL-031', old)!.detail).toContain('states no look-back period');
    // BSE does not reach group companies at all.
    expect(fires('EL-031', broken((x) => { x.legal.regulatoryActionAgainstGroupCompaniesSince = '2015-01-01'; }))).toBe(false);
  });

  it('EL-032 trading suspension fires at both exchanges', async () => {
    // Also corrected 2026-09-10 — both BSE documents state it (E-19).
    const mutate = (x: FactBase) => { x.legal.tradingSuspendedForPromoterCompanies = true; };
    expect(fires('EL-032', vardhman)).toBe(false);
    expect(fires('EL-032', onNSE(mutate))).toBe(true);
    expect(fires('EL-032', broken(mutate))).toBe(true);
  });

  it('EL-033 carves out independent directors at both exchanges', async () => {
    // R-031 closed O-14: the rulebook says "other than independent directors",
    // and the two documents that omit it are using shorthand. The rule states
    // the carve-out rather than hedging about which venue applies it.
    const mutate = (x: FactBase) => { x.promoters.anyAssociatedWithDelistedCompany = true; };
    expect(fires('EL-033', vardhman)).toBe(false);
    for (const facts of [broken(mutate), onNSE(mutate)]) {
      const detail = findingFor('EL-033', facts)!.detail;
      expect(detail).toContain('An INDEPENDENT directorship in such a company does not count');
      expect(detail).not.toMatch(/unsettled|not by exchange|worth putting to the exchange/);
    }
  });

  it('EL-034 pending debt security defaults, BSE only', async () => {
    const mutate = (x: FactBase) => { x.legal.pendingDebtSecurityDefaults = true; };
    expect(fires('EL-034', vardhman)).toBe(false);
    expect(fires('EL-034', broken(mutate))).toBe(true);
    expect(fires('EL-034', onNSE(mutate))).toBe(false);
  });

  it('EL-035 and EL-036 are the same six months about different parties', async () => {
    // The trap this pair exists to avoid: BSE looks at the ISSUER's rejected
    // application, NSE at the MERCHANT BANKER's returned drafts. Feeding each
    // exchange the other's fact must produce nothing.
    const rejected = (x: FactBase) => { x.offer.exchangeApplicationRejectedSince = '2026-09-01'; };
    const returned = (x: FactBase) => { x.offer.brlmDraftReturnedSince = '2026-09-01'; };

    expect(fires('EL-035', broken(rejected))).toBe(true);
    expect(fires('EL-035', broken(returned))).toBe(false);
    expect(fires('EL-036', onNSE(returned))).toBe(true);
    expect(fires('EL-036', onNSE(rejected))).toBe(false);

    // Neither rule governs the other exchange.
    expect(fires('EL-035', onNSE(rejected))).toBe(false);
    expect(fires('EL-036', broken(returned))).toBe(false);
  });

  it('EL-035 says when the six-month window clears', async () => {
    const f = broken((x) => { x.offer.exchangeApplicationRejectedSince = '2026-09-01'; });
    const detail = findingFor('EL-035', f)!.detail;
    expect(detail).toContain('September 1, 2026');
    expect(detail).toContain('clears on March 1, 2027');
    // Seven months before filing is outside the window.
    expect(fires('EL-035', broken((x) => { x.offer.exchangeApplicationRejectedSince = '2026-04-01'; }))).toBe(false);
  });

  it('EL-036 names the banker and says the fix is a different one', async () => {
    const f = onNSE((x) => { x.offer.brlmDraftReturnedSince = '2026-09-01'; });
    const detail = findingFor('EL-036', f)!.detail;
    expect(detail).toContain('Indorient Financial Services Limited');
    expect(detail).toContain('attaches to the BANKER');
  });

  it('EL-037 needs one depository agreement everywhere and two at BSE', async () => {
    expect(fires('EL-037', vardhman)).toBe(false);

    // One depository: enough for Reg 230(1)(b), not enough for BSE's E-15.
    const oneOnly = (x: FactBase) => { x.capital.depositoryAgreements = { nsdl: true, cdsl: false }; };
    expect(fires('EL-037', broken(oneOnly))).toBe(true);
    expect(findingFor('EL-037', broken(oneOnly))!.detail).toContain('No tripartite agreement with CDSL');
    expect(fires('EL-037', onNSE(oneOnly))).toBe(false);

    // Neither depository fails the regulation itself, at either exchange.
    const neither = (x: FactBase) => { x.capital.depositoryAgreements = { nsdl: false, cdsl: false }; };
    expect(fires('EL-037', broken(neither))).toBe(true);
    expect(fires('EL-037', onNSE(neither))).toBe(true);
    expect(findingFor('EL-037', onNSE(neither))!.detail).toContain('Regulation 230(1)(b)');

    // BSE also requires the registrar, since the agreements are tripartite.
    expect(fires('EL-037', broken((x) => { x.offer.registrarToIssue = undefined; }))).toBe(true);
  });

  it('EL-039 caps monetary assets at half the net tangible assets', async () => {
    // Vardhman: 4.20 crore monetary against 19.40 crore NTA.
    expect(fires('EL-039', vardhman)).toBe(false);

    // Clearing Rs 3 crore by sitting on cash does not satisfy the criterion.
    const cashHeavy = (x: FactBase) => { x.financials.years[0].monetaryAssets = money('12', 'crores'); };
    expect(fires('EL-039', broken(cashHeavy))).toBe(true);
    expect(findingFor('EL-039', broken(cashHeavy))!.detail).toContain('61.86% of them');
    expect(findingFor('EL-039', broken(cashHeavy))!.severity).toBe('blocker');

    // Exactly half passes — "not more than 50%".
    expect(fires('EL-039', broken((x) => { x.financials.years[0].monetaryAssets = money('9.70', 'crores'); }))).toBe(false);

    // Silent where the split was never disclosed, and at NSE, which does not
    // state a net tangible assets test at all.
    expect(fires('EL-039', broken((x) => { x.financials.years[0].monetaryAssets = null; }))).toBe(false);
    expect(fires('EL-039', onNSE(cashHeavy))).toBe(false);
  });

  it('EL-044 tests the board against the Companies Act, not LODR', async () => {
    // Vardhman: 5 directors, 3 independent, post-issue capital 16.5 crore.
    expect(fires('EL-044', vardhman)).toBe(false);

    // s.149(1): a public company needs three directors.
    const twoDirectors = broken((x) => { x.management.directors = x.management.directors.slice(0, 2); });
    expect(fires('EL-044', twoDirectors)).toBe(true);
    expect(findingFor('EL-044', twoDirectors)!.detail).toContain('Section 149(1) requires at least 3');

    // s.149(4): one third independent once post-issue capital reaches Rs 10
    // crore. Five directors need two; one is short.
    const oneIndependent = broken((x) => {
      x.management.directors[3].isIndependent = false;
      x.management.directors[4].isIndependent = false;
    });
    expect(fires('EL-044', oneIndependent)).toBe(true);
    expect(findingFor('EL-044', oneIndependent)!.detail).toContain('Independent directors: 1 of 5');
    expect(findingFor('EL-044', oneIndependent)!.detail).toContain('at or above Rs 10.00 Crores');

    // Below both triggers, only s.149(1) applies — three directors, none of
    // whom need be independent.
    const small = broken((x) => {
      x.offer.freshIssueShares = 300000;
      x.capital.paidUpShares = 500000;
      x.financials.years[0].revenue = money('20', 'crores');
      x.management.directors = x.management.directors.slice(0, 3).map((d) => ({ ...d, isIndependent: false }));
    });
    expect(fires('EL-044', small)).toBe(false);
  });

  it('EL-040 counts a full financial year, not twelve months from conversion', async () => {
    expect(fires('EL-040', vardhman)).toBe(false);

    // Converted from an LLP in February 2026: the first FULL financial year
    // ends 31 March 2027, so a November 2026 filing is too early even though
    // that is more than twelve months after the business started trading.
    const february = broken((x) => {
      x.company.convertedFromFirmType = 'LLP';
      x.company.conversionFromFirmDate = '2026-02-10';
    });
    expect(fires('EL-040', february)).toBe(true);
    expect(findingFor('EL-040', february)!.detail).toContain('March 31, 2027');

    // Converted in April 2024: the year to 31 March 2025 is complete.
    const earlier = broken((x) => {
      x.company.convertedFromFirmType = 'PARTNERSHIP';
      x.company.conversionFromFirmDate = '2024-04-20';
    });
    expect(fires('EL-040', earlier)).toBe(false);

    // A company that was never a firm is not governed by Reg 229(4) at all.
    expect(fires('EL-040', broken((x) => { x.company.conversionFromFirmDate = '2026-02-10'; }))).toBe(false);
  });

  it('EL-041 starts a one-year clock on a majority promoter change, at both exchanges', async () => {
    expect(fires('EL-041', vardhman)).toBe(false);
    const recent = (x: FactBase) => { x.promoters.majorityPromoterChangeDate = '2026-03-01'; };
    expect(fires('EL-041', broken(recent))).toBe(true);
    expect(fires('EL-041', onNSE(recent))).toBe(true);
    expect(findingFor('EL-041', broken(recent))!.detail).toContain('earliest filing date is March 1, 2027');
    // Reg 229(5) is a regulation, so switching exchange does not escape it.
    expect(findingFor('EL-041', onNSE(recent))!.detail).toContain('switching platforms does not avoid it');

    expect(fires('EL-041', broken((x) => { x.promoters.majorityPromoterChangeDate = '2024-03-01'; }))).toBe(false);
  });

  it('EL-042 applies a five-year window to SEBI action against directors', async () => {
    expect(fires('EL-042', vardhman)).toBe(false);
    // Filing 2026-11-15; action in 2023 is inside five years.
    const inside = (x: FactBase) => { x.legal.sebiActionAgainstDirectorsSince = '2023-01-10'; };
    expect(fires('EL-042', broken(inside))).toBe(true);
    expect(fires('EL-042', onNSE(inside))).toBe(true);
    expect(findingFor('EL-042', broken(inside))!.severity).toBe('major');
    expect(fires('EL-042', broken((x) => { x.legal.sebiActionAgainstDirectorsSince = '2019-01-10'; }))).toBe(false);
  });

  it('measures every window from the intended filing date, not from today', async () => {
    // An issuer planning to file in four months needs to know whether the
    // window will still be open THEN, not whether it is open now.
    // One rejection date, two filing plans. The same fact clears in the first
    // and does not in the second.
    const rejected = '2026-06-01';

    const patient = broken((x) => {
      x.offer.intendedFilingDate = '2026-12-15';
      x.offer.exchangeApplicationRejectedSince = rejected;
    });
    expect(fires('EL-035', patient)).toBe(false); // 6 months and 14 days by then

    const hurried = broken((x) => {
      x.offer.intendedFilingDate = '2026-10-15';
      x.offer.exchangeApplicationRejectedSince = rejected;
    });
    expect(fires('EL-035', hurried)).toBe(true); // only 4 months and 14 days
  });
});

describe('consistency rules each fire on their own breach', () => {
  it('CO-001 allotments not summing to paid-up shares', async () => {
    const f = broken((x) => { x.capital.allotments[0].shares = 9000; });
    expect(fires('CO-001', f)).toBe(true);
    expect(findingFor('CO-001', f)!.detail).toContain('Short by');
  });

  it('CO-002 shareholding register not summing to 100%', async () => {
    const f = broken((x) => { x.capital.shareholders[0].shares -= 72000; });
    expect(fires('CO-002', f)).toBe(true);
    expect(findingFor('CO-002', f)!.detail).toContain('99.40%');
  });

  it('CO-003 paid-up capital not matching shares times face value', async () => {
    expect(fires('CO-003', broken((x) => { x.capital.paidUpCapital = money('11', 'crores'); }))).toBe(true);
  });

  it('CO-004 promoter tranches not reconciling with the register', async () => {
    const f = broken((x) => { x.capital.promoterHoldings[0].shares = 400000; });
    expect(fires('CO-004', f)).toBe(true);
    expect(findingFor('CO-004', f)!.detail).toContain('lock-in');
  });

  it('CO-005 objects not reconciling with the issue size', async () => {
    const f = broken((x) => { x.offer.objects[0].amount = money('11', 'crores'); });
    expect(fires('CO-005', f)).toBe(true);
    const detail = findingFor('CO-005', f)!.detail;
    // Show the arithmetic, not just the verdict
    expect(detail).toContain('Objects listed');
    expect(detail).toContain('Issue expenses');
    expect(detail).toContain('Issue size');
    expect(detail).toContain('Unaccounted');
  });

  it('CO-006 net tangible assets not tying to net worth', async () => {
    expect(fires('CO-006', broken((x) => { x.financials.years[0].intangibleAssets = money('2', 'crores'); }))).toBe(true);
  });

  it('CO-007 market maker reservation not a whole number of lots', async () => {
    expect(fires('CO-007', vardhman)).toBe(false);
    expect(fires('CO-007', broken((x) => { x.offer.marketMakerReservationShares = 225001; }))).toBe(true);
  });

  it('CO-008 floor price above cap price', async () => {
    expect(fires('CO-008', broken((x) => { x.offer.floorPrice = money('60'); }))).toBe(true);
  });

  it('CO-009 floor price below face value', async () => {
    expect(fires('CO-009', broken((x) => { x.offer.floorPrice = money('5'); x.offer.capPrice = money('8'); }))).toBe(true);
  });

  it('CO-010 post-issue shares exceeding authorised capital', async () => {
    const f = broken((x) => { x.capital.authorisedShares = 13000000; });
    expect(fires('CO-010', f)).toBe(true);
    expect(findingFor('CO-010', f)!.detail).toContain('shareholder resolution');
  });

  it('CO-011 customer revenue shares over 100%', async () => {
    expect(fires('CO-011', broken((x) => { x.business.topCustomers[0].revenueShare = 80; }))).toBe(true);
  });

  it('CO-012 a bonus issue carrying an issue price', async () => {
    expect(fires('CO-012', broken((x) => { x.capital.allotments[4].issuePrice = money('10'); }))).toBe(true);
    expect(findingFor('CO-012', broken((x) => { x.capital.allotments[4].issuePrice = money('10'); }))!.severity).toBe('minor');
  });
});

describe('scoring', () => {
  it('caps the score below 50 while any blocker stands', async () => {
    // A single blocker among otherwise clean facts must not read as "nearly there"
    const f = broken((x) => { x.company.isPublicLimited = false; });
    const s = summarise(allRules, f);
    expect(s.blockers).toBe(1);
    expect(s.score).toBeLessThan(50);
  });

  it('does not cap the score for major findings alone', async () => {
    const f = broken((x) => { x.offer.brlmUnderwritingPercent = 10; });
    const s = summarise(allRules, f);
    expect(s.blockers).toBe(0);
    expect(s.score).toBeGreaterThan(50);
  });
});

describe('assessment over the whole document', () => {
  it('merges document gaps into the findings list', async () => {
    const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });
    const { findings, summary } = assess(vardhman, sections);
    const completeness = findings.filter((f) => f.category === 'completeness');
    expect(completeness.length).toBeGreaterThan(0);
    // Risk Factors' own "not yet drafted" gap (D45) always stands, even for Vardhman.
    expect(completeness.map((f) => f.fix?.factPath)).toContain('general.riskFactors.narrative');
    expect(summary.blockers).toBe(0);
  });

  it('does not report full readiness while document gaps remain', async () => {
    // A rules-only score beside a longer findings list reads as a
    // contradiction. "100 / 100 ready" above three outstanding items tells
    // the issuer something false, and the score is what they look at first.
    const sections = await renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });
    const { findings, summary } = assess(vardhman, sections);
    expect(findings.length).toBeGreaterThan(0);
    expect(summary.score).toBeLessThan(100);
  });

  it('reports full readiness only when nothing is outstanding', async () => {
    const { findings, summary } = assess(vardhman, []);
    expect(findings).toHaveLength(0);
    expect(summary.score).toBe(100);
  });

  it('orders findings by severity', async () => {
    const f = broken((x) => {
      x.company.isPublicLimited = false;
      x.offer.brlmUnderwritingPercent = 10;
    });
    const { findings } = assess(f);
    const order = findings.map((x) => x.severity);
    expect(order[0]).toBe('blocker');
    expect(order.indexOf('major')).toBeGreaterThan(order.indexOf('blocker'));
  });
});

describe('linking findings to the document', () => {
  const sections = async () => renderSections(sectionRegistry, { orgId: ORG, facts: vardhman });

  it('links a gap to the placeholder itself, not the top of the section', async () => {
    // Landing the reader at the start of a 30-page section and leaving them to
    // find the highlight is barely better than not linking at all.
    const gap = completenessFindings(await sections()).find(
      (f) => f.fix?.factPath === 'general.riskFactors.narrative',
    );
    expect(gap?.links?.[0]).toEqual({
      label: 'Risk Factors',
      anchor: gapAnchor('general.riskFactors.narrative'),
    });
  });

  it('names the section a gap sits in', async () => {
    const gap = completenessFindings(await sections()).find(
      (f) => f.fix?.factPath === 'offer.categoryAllocation',
    );
    // One fact, two sections: The Issue and Issue Structure both carry the
    // allocation gap, and it is one finding naming both
    expect(gap?.blocks).toEqual(['The Issue', 'Issue Structure']);
  });

  it('resolves a rule that names a built section', async () => {
    const [linked] = linkFindings(
      [{ ...stubFinding, blocks: ['Issue Structure'] }],
      await sections(),
    );
    expect(linked.links).toEqual([
      { label: 'Issue Structure', anchor: sectionAnchor('issueRelated.issueStructure') },
    ]);
  });

  it('resolves a rule that names a whole numbered section', async () => {
    // Rules cite "Other Regulatory and Statutory Disclosures", which is a
    // group of five subsections rather than one. The first is where a reader
    // following the link would start.
    const [linked] = linkFindings(
      [{ ...stubFinding, blocks: ['Other Regulatory and Statutory Disclosures'] }],
      await sections(),
    );
    expect(linked.links?.[0].anchor).toBe(sectionAnchor('regulatory.authority'));
  });

  it('leaves a section that is not drafted yet as a plain label', async () => {
    // All 37 numbered subsections are built as of this session (D73) — even
    // Key Industry Regulations and Policies, this test's example until now,
    // exists as a real (if `external`) section with a real anchor. A link
    // that scrolls nowhere still teaches the reader the links do not work,
    // so the behavior itself is still real; it just needs a title that will
    // never be a subsection to demonstrate it now. "The entire filing" is
    // that case for real (every eligibility blocker in `eligibility.ts`
    // cites it, permanently, since it names no single section) — paired here
    // with a title that simply does not exist, the same "rule cites a title
    // the registry does not have" case a renamed or misspelled section would
    // hit.
    const [linked] = linkFindings(
      [{ ...stubFinding, blocks: ['A Section That Does Not Exist', 'The entire filing'] }],
      await sections(),
    );
    expect(linked.links).toEqual([{ label: 'A Section That Does Not Exist' }, { label: 'The entire filing' }]);
  });

  it('links Capital Structure now that it is built', async () => {
    // The rules have named it since D23; it resolved to a plain label until
    // the section existed, and resolves to an anchor now. Nothing in the rules
    // changed — which is the point of resolving blocks at render time.
    const [linked] = linkFindings([{ ...stubFinding, blocks: ['Capital Structure'] }], await sections());
    expect(linked.links?.[0].anchor).toBe(sectionAnchor('capital.structure'));
  });

  it('points every link at something that exists in the document', async () => {
    const rendered = await sections();
    const { findings } = assess(vardhman, rendered);

    const sectionAnchors = new Set(rendered.map((s) => s.anchor));
    const gapAnchors = new Set(
      findings.filter((f) => f.fix?.factPath).map((f) => gapAnchor(f.fix!.factPath!)),
    );

    const dangling = findings
      .flatMap((f) => f.links ?? [])
      .filter((l) => l.anchor && !sectionAnchors.has(l.anchor) && !gapAnchors.has(l.anchor));

    expect(dangling).toEqual([]);
  });

  it('does not overwrite links a finding already carries', async () => {
    const already = { ...stubFinding, blocks: ['Issue Structure'], links: [{ label: 'kept' }] };
    expect(linkFindings([already], await sections())[0].links).toEqual([{ label: 'kept' }]);
  });
});

describe('financial helpers', () => {
  it('computes operating profit excluding other income', async () => {
    // FY2026: 4.85 + 0.78 + 1.12 - 0.35 = 6.40
    expect(operatingProfit(vardhman.financials.years[0])).toBe(money('6.40', 'crores'));
  });

  it('computes free cash flow to equity', async () => {
    // FY2026: (5.20 - 3.80) + 0 + 1.40 - 0.58 = 2.22
    expect(freeCashFlowToEquity(vardhman.financials.years[0])).toBe(money('2.22', 'crores'));
  });
});
