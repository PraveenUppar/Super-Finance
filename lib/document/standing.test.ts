import { describe, expect, it, beforeAll } from 'vitest';
import { money } from '../facts/money';
import type { FactBase } from '../facts/schema';
import { vardhman } from '../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from './nodes';
import { renderSection } from './section';
import { litigation } from './sections/litigation';
import { management } from './sections/management';
import { promoters } from './sections/promoters';
import { committeeTermsOfReference, personalGuaranteesGiven } from './sections/standing-statements';

/**
 * The standing boilerplate inside Our Management, Our Promoters and the
 * litigation section — extracted from two sources and switched by facts.
 */

const ORG = 'org_test1';
const cr = (v: string) => money(v, 'crores');
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      if (n.type === 'list') return n.items.map((i) => i.map((r) => r.text).join('')).join('\n');
      if (n.type === 'table') return [n.headers.join(' | '), ...n.rows.map((r) => r.join(' | '))].join('\n');
      return '';
    })
    .join('\n');
const lists = (nodes: DocumentNode[]) => nodes.filter((n): n is Extract<DocumentNode, { type: 'list' }> => n.type === 'list');
const gapsOf = (nodes: DocumentNode[]) => collectPlaceholders(nodes).map((p) => p.factPath);

describe('committee terms of reference', () => {
  it('carry the two-source intersection: 21 audit items, 8 NRC, 4 SRC, and none for a CSR committee', () => {
    const audit = lists(committeeTermsOfReference('AUDIT'));
    expect(audit[0].items).toHaveLength(21);
    expect(audit[1].items).toHaveLength(4);
    expect(lists(committeeTermsOfReference('NOMINATION_AND_REMUNERATION'))[0].items).toHaveLength(8);
    expect(lists(committeeTermsOfReference('STAKEHOLDERS_RELATIONSHIP'))[0].items).toHaveLength(4);
    expect(committeeTermsOfReference('CORPORATE_SOCIAL_RESPONSIBILITY')).toEqual([]);
  });

  it('leave out what only one source carried', () => {
    const audit = textOf(committeeTermsOfReference('AUDIT'));
    // Om Galaxy alone
    expect(audit).not.toContain('key performance indicators');
    expect(audit).not.toContain('rupees 100 crore');
    // Maxwell alone
    expect(audit).not.toContain('voidable at the option');
    expect(audit).not.toContain('Monitoring the end use');
    // Om Galaxy's half-yearly is not in Maxwell; the intersection is quarterly
    expect(audit).toContain('the quarterly financial statements before submission');
    expect(audit).not.toContain('half-yearly');
  });

  it('follow each committee table in Our Management', async () => {
    const text = textOf(await renderSection(management, { orgId: ORG, facts: vardhman }));
    const audit = text.indexOf('Terms of Reference of the Audit Committee');
    const nrc = text.indexOf('Terms of Reference of the Nomination and Remuneration Committee');
    const src = text.indexOf('Terms of Reference of the Stakeholders Relationship Committee');
    expect(audit).toBeGreaterThan(text.indexOf('Meera Kulkarni | Chairperson'));
    expect(nrc).toBeGreaterThan(audit);
    expect(src).toBeGreaterThan(nrc);
    expect(text).toContain('Scrutiny of inter-corporate loans and investments;');
    expect(text).toContain('Devising a policy on diversity of the Board;');
    expect(text).toContain('effective exercise of voting rights by shareholders');
  });
});

describe('interest of directors', () => {
  let text: string;

  beforeAll(async () => {
    text = textOf(await renderSection(management, { orgId: ORG, facts: vardhman }));
  });

  it('names the promoter-directors as the only ones interested in the promotion', () => {
    expect(text).toContain('Except for Rajesh Vardhman and Sunita Vardhman, who are the Promoters of our Company, none of our Directors has any interest in the promotion or formation of our Company.');
  });

  it('mentions personal guarantees only where a facility on file carries one', async () => {
    expect(personalGuaranteesGiven(vardhman)).toBe(true);
    expect(text).toContain('Certain of our Directors have provided personal guarantees');
    const unguaranteed: FactBase = {
      ...vardhman,
      financials: { ...vardhman.financials, borrowings: vardhman.financials.borrowings.map((b) => ({ ...b, security: 'Hypothecation of assets' })) },
    };
    expect(personalGuaranteesGiven(unguaranteed)).toBe(false);
    expect(textOf(await renderSection(management, { orgId: ORG, facts: unguaranteed }))).not.toContain('personal guarantees');
  });

  it('uses a two-year look-back and prints the bonus plan negative', () => {
    expect(text).toContain('during the two years preceding the date of this Draft Red Herring Prospectus in which our Directors are interested');
    expect(text).toContain('does not have any bonus or profit sharing plan for our Directors');
  });
});

describe('interest of promoters and the undertakings', () => {
  let nodes: DocumentNode[];
  let text: string;

  beforeAll(async () => {
    nodes = await renderSection(promoters, { orgId: ORG, facts: vardhman });
    text = textOf(nodes);
  });

  it('prints the interest, property, payment and common-pursuit statements with two-year windows', () => {
    expect(text).toContain('Interest of our Promoters');
    expect(text).toContain('No sum has been paid or agreed to be paid to our Promoters');
    expect(text).toContain('Payment or Benefit to our Promoters or Promoter Group in the Last Two Years');
    expect(text).toContain('acquired by our Company in the two years preceding');
    expect(text).toContain('None of our Promoters or the members of our Promoter Group is involved in any business activity similar to that of our Company.');
    expect(text).not.toContain('three years preceding the date of this Draft Red Herring Prospectus in which');
  });

  it('prints the disclosed common pursuit where there is one', async () => {
    const pursuit: FactBase = { ...vardhman, promoters: { ...vardhman.promoters, commonPursuitsDetails: 'Vardhman Tooling Private Limited manufactures tooling used by our Company.' } };
    expect(textOf(await renderSection(promoters, { orgId: ORG, facts: pursuit }))).toContain('Vardhman Tooling Private Limited manufactures tooling');
  });

  it('prints all six undertakings as negatives for a clean issuer', () => {
    const block = text.slice(text.indexOf('Undertakings and Confirmations'), text.indexOf('Our Promoter Group\n'));
    for (const phrase of [
      'has been prohibited or debarred from accessing or operating in the capital markets',
      'promoter or director of any other company which is debarred',
      'fugitive economic offender under Section 12',
      'wilful defaulters or fraudulent borrowers',
      'No material regulatory or disciplinary action has been taken',
      'no defaults in respect of payment of interest or principal',
    ]) {
      expect(block).toContain(phrase);
    }
    expect(gapsOf(nodes).filter((p) => p.startsWith('promoters.any') || p.startsWith('legal.'))).toEqual([]);
  });

  it('turns a set flag into a gap for the particulars instead of printing the negative', async () => {
    const flagged: FactBase = {
      ...vardhman,
      promoters: { ...vardhman.promoters, anyFugitiveEconomicOffender: true },
      legal: { ...vardhman.legal, regulatoryActionAgainstPromotersSince: '2026-03-01' },
    };
    const out = await renderSection(promoters, { orgId: ORG, facts: flagged });
    expect(gapsOf(out)).toContain('promoters.anyFugitiveEconomicOffender');
    expect(gapsOf(out)).toContain('legal.regulatoryActionAgainstPromotersSince');
    expect(textOf(out)).not.toContain('has been declared a fugitive economic offender under Section 12 of the Fugitive Economic Offenders Act, 2018.');
  });
});

describe('outstanding dues to creditors', () => {
  let nodes: DocumentNode[];
  let text: string;

  beforeAll(async () => {
    nodes = await renderSection(litigation, { orgId: ORG, facts: vardhman });
    text = textOf(nodes);
  });

  it('tables MSME and other creditors, totals them, and states the material creditors', () => {
    expect(text).toContain('Micro, small and medium enterprises | 38 | 215.00');
    expect(text).toContain('Other creditors | 61 | 465.00');
    expect(text).toContain('Total | 99 | 680.00');
    expect(text).toContain('Material creditors | 2 | 102.00');
    expect(text).toContain('being Rs 34.00 Lakhs against total trade payables of Rs 680.00 Lakhs');
    expect(gapsOf(nodes).filter((p) => p.startsWith('financials.creditors'))).toEqual([]);
  });

  it('flags a split that does not tie to trade payables', async () => {
    const broken: FactBase = {
      ...vardhman,
      financials: { ...vardhman.financials, creditors: { ...vardhman.financials.creditors, otherAmount: cr('4.00') } },
    };
    const gaps = collectPlaceholders(await renderSection(litigation, { orgId: ORG, facts: broken }));
    expect(gaps.some((g) => g.factPath === 'financials.creditors' && g.ask.includes('Rs 615.00 Lakhs') && g.ask.includes('Rs 680.00 Lakhs'))).toBe(true);
  });

  it('asks for the split and the material creditors where they are not on file', async () => {
    const none: FactBase = { ...vardhman, financials: { ...vardhman.financials, creditors: {} } };
    const gaps = collectPlaceholders(await renderSection(litigation, { orgId: ORG, facts: none })).filter((g) => g.factPath === 'financials.creditors');
    expect(gaps).toHaveLength(2);
  });
});
