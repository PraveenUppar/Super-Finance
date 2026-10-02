import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { writeNarrative } from '../../store/narrative-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../../store/versioned-table';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { basisForIssuePrice } from './basis-for-issue-price';
import { sectionRegistry } from './index';
import { plannedSections } from './planned';
import type { FactBase } from '../../facts/schema';

const ORG = 'org_test1';
const render = (facts = vardhman) => renderSection(basisForIssuePrice, { orgId: ORG, facts });
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      if (n.type === 'table') return [n.headers.join(' | '), ...n.rows.map((r) => r.join(' | '))].join('\n');
      return '';
    })
    .join('\n');

function variant(mutate: (f: FactBase) => void): FactBase {
  const f = structuredClone(vardhman) as FactBase;
  mutate(f);
  return f;
}

describe("Basis for Issue Price — D64, unblocks the second of S9's two originally-blocked sections", () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('is registered and no longer listed as planned', () => {
    expect(sectionRegistry.some((s) => s.id === 'particulars.basisForIssuePrice')).toBe(true);
    expect(plannedSections['particulars.basisForIssuePrice']).toBeUndefined();
  });

  it('falls back to the honest computed intro paragraph with no draft on file', async () => {
    const text = textOf(await render());
    expect(text).toContain('qualitative and quantitative factors');
    expect(text).toContain('Our Business');
    expect(text).toContain('Risk Factors');
  });

  it('renders a drafted paragraph in place of the computed intro, once one exists', async () => {
    await writeNarrative(
      ORG,
      'particulars.basisForIssuePrice',
      'This is the drafted opening, standing in for the computed paragraph.',
      '{}',
      {
        companyName: vardhman.company.name,
        latestBasicEps: '3.00',
        latestReturnOnNetWorthPercent: '18.56',
        latestNetAssetValuePerShare: '16.17',
        floorPrice: vardhman.offer.floorPrice,
        capPrice: vardhman.offer.capPrice,
        industryPeerCount: vardhman.offer.industryPeers.length,
      },
      'test',
    );
    const text = textOf(await render());
    expect(text).toContain('This is the drafted opening, standing in for the computed paragraph.');
    expect(text).not.toContain('qualitative and quantitative factors');
  });

  it('prints the accounting ratios for all three years, matching Other Financial Information', async () => {
    const text = textOf(await render());
    expect(text).toContain('3.00'); // FY2026 basic EPS
    expect(text).toContain('18.56'); // FY2026 RoNW
    expect(text).toContain('16.17'); // FY2026 NAV per share
  });

  it('computes the P/E ratio at the floor and cap price from the latest basic EPS', async () => {
    const text = textOf(await render());
    // Floor 47 / EPS 3.00 = 15.67; Cap 49 / EPS 3.00 = 16.33
    expect(text).toContain('15.67');
    expect(text).toContain('16.33');
  });

  it('gaps the P/E table where the price band is not yet fixed', async () => {
    const f = variant((x) => {
      x.offer.floorPrice = null;
      x.offer.capPrice = null;
    });
    const nodes = await render(f);
    const text = textOf(nodes);
    expect(text).toContain('[TO BE PROVIDED: price band]');
  });

  it('renders the peer comparison table with both peers and a computed row for our own Company', async () => {
    const text = textOf(await render());
    expect(text).toContain('Precitech Forgings Limited');
    expect(text).toContain('Chakan Auto Components Limited');
    expect(text).toContain(vardhman.company.name);
  });

  it('gaps the peer comparison where no industry peer is on file', async () => {
    const f = variant((x) => {
      x.offer.industryPeers = [];
    });
    const nodes = await render(f);
    expect(collectPlaceholders(nodes).some((g) => g.factPath === 'offer.industryPeers')).toBe(true);
  });

  it('gaps the whole section where no financial year is on file at all', async () => {
    const f = variant((x) => {
      x.financials.years = [];
    });
    const nodes = await render(f);
    expect(collectPlaceholders(nodes).some((g) => g.factPath === 'financials.years')).toBe(true);
  });

  it('never crashes for a sparse issuer with no allotment history, no financials and no peers', async () => {
    const sparse = variant((x) => {
      x.financials.years = [];
      x.capital.allotments = [];
      x.offer.industryPeers = [];
    });
    await render(sparse);
  });
});
