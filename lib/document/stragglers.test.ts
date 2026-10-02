import { describe, expect, it, beforeAll } from 'vitest';
import type { FactBase } from '../facts/schema';
import { withAnswers } from '../seed/empty';
import { vardhman } from '../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from './nodes';
import { renderSection } from './section';
import { materialContracts } from './sections/material-contracts';
import { otherFinancial } from './sections/other-financial';

/** Other Financial Information (#24) and Material Contracts (#36). */

const ORG = 'org_test1';
const sparse = withAnswers({ company: { name: 'Sparse Test Limited' } });
const render = (spec: typeof otherFinancial, facts: FactBase = vardhman) => renderSection(spec, { orgId: ORG, facts });
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      if (n.type === 'list') return n.items.map((i) => i.map((r) => r.text).join('')).join('\n');
      if (n.type === 'table') return [n.headers.join(' | '), ...n.rows.map((r) => r.join(' | ')), ...(n.footnotes ?? [])].join('\n');
      return '';
    })
    .join('\n');
const gapsOf = (nodes: DocumentNode[]) => collectPlaceholders(nodes).map((p) => p.factPath);

describe('Other Financial Information', () => {
  let nodes: DocumentNode[];
  let text: string;

  beforeAll(async () => {
    nodes = await render(otherFinancial);
    text = textOf(nodes);
  });

  it('tabulates the five ratios across the three years with the formulas beneath', () => {
    expect(text).toContain('Basic and diluted earnings per Equity Share (Rs) (1) | 3.00 | 2.13 | 0.92');
    expect(text).toContain('Return on Net Worth (%) (2) | 18.56 | 17.96 | 11.22');
    expect(text).toContain('Net Asset Value per Equity Share (Rs) (3) | 16.17 | 11.83 | 8.17');
    expect(text).toContain('EBITDA (Rs in Lakhs) (4) | 640.00 | 476.00 | 262.00');
    expect(text).toContain('EBITDA Margin (%) (5) | 13.28 | 12.05 | 9.32');
    expect(text).toContain('(2) Return on Net Worth (%) = Restated profit after tax attributable to equity shareholders / net worth at the end of the year x 100.');
    expect(text).toContain('in accordance with Accounting Standard 20');
  });

  it('prints the restated share counts so the arithmetic can be checked by hand', () => {
    expect(text).toContain('Weighted average number of Equity Shares (restated for bonus issues) | 1,20,00,000 | 1,20,00,000 | 1,20,00,000');
  });

  it('has no gaps for the demo issuer and names the website', () => {
    expect(gapsOf(nodes)).toEqual([]);
    expect(text).toContain('available on our website at https://www.vardhmanprecision.in');
  });

  it('asks for the allotment history when there is nothing to weight', async () => {
    const noAllotments: FactBase = { ...vardhman, capital: { ...vardhman.capital, allotments: [] } };
    expect(gapsOf(await render(otherFinancial, noAllotments))).toEqual(['capital.allotments']);
    expect(gapsOf(await render(otherFinancial, sparse))).toContain('financials.years');
  });
});

describe('Material Contracts and Documents for Inspection', () => {
  let nodes: DocumentNode[];
  let text: string;

  beforeAll(async () => {
    nodes = await render(materialContracts);
    text = textOf(nodes);
  });

  it('lists the contracts with their dates and parties, and the unsigned ones as gaps', () => {
    expect(text).toContain('Issue Agreement dated July 2, 2026 between our Company and the Book Running Lead Manager (Indorient Financial Services Limited).');
    expect(text).toContain('Registrar Agreement dated July 14, 2026 between our Company and the Registrar to the Issue (Bigshare Services Private Limited).');
    expect(text).toContain('Underwriting Agreement dated November 28, 2026');
    expect(text).toContain('Monitoring Agency Agreement dated August 20, 2026 between our Company and the Monitoring Agency (Brickwork Ratings India Private Limited).');
    expect(text).toContain('Tripartite agreement dated June 18, 2026 between National Securities Depository Limited');
    // Signed before the RHP, so gaps at DRHP stage - as Maxwell prints them
    const gaps = gapsOf(nodes);
    expect(gaps).toContain('offer.bankerToIssueAgreementDate');
    expect(gaps).toContain('offer.marketMakingAgreementDate');
  });

  it('lists the documents from facts held elsewhere', () => {
    expect(text).toContain('Certificate of incorporation dated April 12, 2016 issued by the Registrar of Companies in the name of "Vardhman Precision Components Private Limited".');
    expect(text).toContain('Fresh certificate of incorporation dated February 18, 2025');
    expect(text).toContain('Board of Directors of our Company dated August 14, 2026 approving the Issue');
    expect(text).toContain('general meeting held on August 28, 2026 approving the Issue');
    expect(text).toContain('Resolution of the Board of Directors dated November 12, 2026 taking on record and approving this Draft Red Herring Prospectus');
    expect(text).toContain('Copies of the audited financial statements and annual reports of our Company for the Fiscals 2026, 2025, 2024.');
  });

  it("waits for the auditor's deliverables where the restatement is not yet delivered", async () => {
    // Vardhman has no restated statements yet: the examination report and the
    // tax benefits statement are gaps on that fact, not on their own dates
    expect(gapsOf(nodes)).toContain('financials.hasRestatedStatements');
    expect(gapsOf(nodes)).not.toContain('offer.auditorExaminationReportDate');

    const restated: FactBase = {
      ...vardhman,
      financials: { ...vardhman.financials, hasRestatedStatements: true },
      offer: { ...vardhman.offer, auditorExaminationReportDate: '2026-10-20', taxBenefitsStatementDate: '2026-10-22' },
    };
    const t = textOf(await render(materialContracts, restated));
    expect(t).toContain('The examination report dated October 20, 2026 of Kalyani & Associates, Chartered Accountants on the Restated Financial Information');
    expect(t).toContain('The statement of special tax benefits dated October 22, 2026 from Kalyani & Associates');
  });

  it('leaves out the monitoring agency agreement where there is no monitoring agency', async () => {
    const none: FactBase = { ...vardhman, offer: { ...vardhman.offer, monitoringAgency: undefined } };
    expect(textOf(await render(materialContracts, none))).not.toContain('Monitoring Agency Agreement');
  });

  it('renders a one-fact issuer as gaps, without seed text', async () => {
    const rendered = await render(materialContracts, sparse);
    const t = textOf(rendered);
    expect(gapsOf(rendered).length).toBeGreaterThan(8);
    expect(t).not.toContain('Vardhman');
    expect(t).not.toContain('undefined');
  });
});
