import { describe, expect, it } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { articlesOfAssociation } from './articles-of-association';
import { sectionRegistry } from './index';
import { plannedSections } from './planned';
import type { FactBase } from '../../facts/schema';

const ORG = 'org_test1';
const render = (facts = vardhman) => renderSection(articlesOfAssociation, { orgId: ORG, facts });
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      return '';
    })
    .join('\n');

function variant(mutate: (f: FactBase) => void): FactBase {
  const f = structuredClone(vardhman) as FactBase;
  mutate(f);
  return f;
}

describe('Main Provisions of the Articles of Association — D69, S7\'s replacement (S7 paused permanently)', () => {
  it('is registered and no longer listed as planned', async () => {
    expect(sectionRegistry.some((s) => s.id === 'other.articles')).toBe(true);
    expect(plannedSections['other.articles']).toBeUndefined();
  });

  it('prints all six required topics as real headings, each with the typed clause text', async () => {
    const text = textOf(await render());
    expect(text).toContain('Voting Rights');
    expect(text).toContain('paid-up equity share capital');
    expect(text).toContain('Dividend');
    expect(text).toContain('Lien');
    expect(text).toContain('Forfeiture');
    expect(text).toContain('Transfer and Transmission of Shares');
    expect(text).toContain('Consolidation and Splitting of Capital');
  });

  it('never invents or paraphrases — prints exactly the stored text, verbatim', async () => {
    const text = textOf(await render());
    expect(text).toContain(vardhman.company.articlesProvisions.votingRights);
    expect(text).toContain(vardhman.company.articlesProvisions.dividend);
  });

  it('gaps each unanswered topic individually, not the whole section at once', async () => {
    const f = variant((x) => {
      x.company.articlesProvisions.lien = undefined;
    });
    const gaps = collectPlaceholders(await render(f));
    expect(gaps.some((g) => g.factPath === 'company.articlesProvisions.lien')).toBe(true);
    // The other five topics are still answered and must not gap
    expect(gaps.some((g) => g.factPath === 'company.articlesProvisions.dividend')).toBe(false);
  });

  it('gaps all six topics for a sparse issuer with none of them answered', async () => {
    const f = variant((x) => {
      x.company.articlesProvisions = {};
    });
    const gaps = collectPlaceholders(await render(f));
    const keys = ['votingRights', 'dividend', 'lien', 'forfeiture', 'transferAndTransmission', 'consolidationAndSplitting'];
    for (const key of keys) {
      expect(gaps.some((g) => g.factPath === `company.articlesProvisions.${key}`)).toBe(true);
    }
  });

  it('never crashes when articlesProvisions itself is entirely absent', async () => {
    const f = variant((x) => {
      // @ts-expect-error — simulating a genuinely sparse issuer's raw facts before defaults apply
      x.company.articlesProvisions = undefined;
    });
    await render(f);
  });
});
