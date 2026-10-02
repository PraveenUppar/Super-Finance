import { describe, expect, it } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { subsidiaries } from './subsidiaries';
import type { FactBase } from '../../facts/schema';

/**
 * OUR SUBSIDIARIES, ASSOCIATES AND JOINT VENTURES — section map #18, D73.
 * Unlike the three explained-gap sections, this is a real `producer:
 * 'computed'` section: "none" is a complete, honest, computable answer for
 * the SME-majority case (four of the five ToC-mapped corpus documents).
 */

const ORG = 'org_test1';

const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      if (n.type === 'table') return [n.headers.join(' | '), ...n.rows.map((r) => r.join(' | '))].join('\n');
      return '';
    })
    .join('\n');

const variant = (mutate: (f: FactBase) => void): FactBase => {
  const f = structuredClone(vardhman);
  mutate(f);
  return f;
};

describe('Our Subsidiaries, Associates and Joint Ventures', () => {
  it('states plainly that Vardhman has none, gap-free', async () => {
    const nodes = await renderSection(subsidiaries, { orgId: ORG, facts: vardhman });
    const text = textOf(nodes);
    expect(text).toContain('does not have any subsidiaries, associates or joint ventures');
    expect(collectPlaceholders(nodes)).toHaveLength(0);
  });

  it('renders a real table when the issuer has one', async () => {
    const f = variant((x) => {
      x.groupCompanies.subsidiaries = [
        {
          name: 'Vardhman Precision Exports Private Limited',
          cin: 'U29100MH2024PTC400001',
          relationship: 'SUBSIDIARY',
          shareholdingPercent: 100,
          natureOfBusiness: 'Export marketing of precision machined components',
        },
      ];
    });
    const nodes = await renderSection(subsidiaries, { orgId: ORG, facts: f });
    const text = textOf(nodes);
    expect(text).toContain('Vardhman Precision Exports Private Limited');
    expect(text).toContain('Subsidiary');
    expect(text).toContain('100.00');
    expect(collectPlaceholders(nodes)).toHaveLength(0);
  });

  it('raises a gap per missing field, not a silently blank cell', async () => {
    const f = variant((x) => {
      x.groupCompanies.subsidiaries = [
        { name: 'Some Associate Limited', relationship: 'ASSOCIATE' },
      ];
    });
    const nodes = await renderSection(subsidiaries, { orgId: ORG, facts: f });
    const text = textOf(nodes);
    expect(text).toContain('[TO BE PROVIDED]');
    const gaps = collectPlaceholders(nodes);
    expect(gaps).toHaveLength(3); // CIN, shareholding, nature of business
    expect(gaps.every((g) => g.factPath === 'groupCompanies.subsidiaries')).toBe(true);
  });

  it('never crashes for a one-fact issuer', async () => {
    await renderSection(subsidiaries, {
      orgId: ORG,
      facts: { ...vardhman, groupCompanies: { ...vardhman.groupCompanies, subsidiaries: [] } },
    });
  });
});
