import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { writeNarrative } from '../../store/narrative-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../../store/versioned-table';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { industryOverview } from './industry-overview';
import { sectionRegistry } from './index';
import { plannedSections } from './planned';

const ORG = 'org_test1';
const render = (facts = vardhman) => renderSection(industryOverview, { orgId: ORG, facts });
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      return '';
    })
    .join('\n');

describe("Industry Overview — D65, unblocks the second of S9's two originally-blocked sections", () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('is registered and no longer listed as planned', () => {
    expect(sectionRegistry.some((s) => s.id === 'aboutCompany.industryOverview')).toBe(true);
    expect(plannedSections['aboutCompany.industryOverview']).toBeUndefined();
  });

  it('always states the preliminary-draft notice, in italics, regardless of draft state', async () => {
    const nodes = await render();
    const notice = nodes.find((n) => n.type === 'paragraph' && n.runs[0]?.text.includes('PRELIMINARY DRAFT'));
    expect(notice).toBeDefined();
    expect(notice!.type === 'paragraph' && notice!.runs[0].italic).toBe(true);
  });

  it('falls back to a plain sector + description sentence with no draft on file', async () => {
    const text = textOf(await render());
    expect(text).toContain('ENGINEERING');
    expect(text).toContain(vardhman.company.businessDescription);
  });

  it('renders a drafted paragraph in place of the computed fallback, once one exists', async () => {
    await writeNarrative(
      ORG,
      'aboutCompany.industryOverview',
      'This is the drafted industry paragraph, standing in for the plain fallback sentence.',
      '{}',
      {
        companyName: vardhman.company.name,
        sector: vardhman.company.sector,
        businessDescription: vardhman.company.businessDescription,
        productLines: vardhman.business.productLines ?? null,
        primaryMarketDescription: vardhman.business.primaryMarketDescription ?? null,
      },
      'test',
    );
    const text = textOf(await render());
    expect(text).toContain('This is the drafted industry paragraph, standing in for the plain fallback sentence.');
  });

  it('always raises the commissioned-report gap, even once a draft exists', async () => {
    await writeNarrative(
      ORG,
      'aboutCompany.industryOverview',
      'A real draft exists now.',
      '{}',
      {
        companyName: vardhman.company.name,
        sector: vardhman.company.sector,
        businessDescription: vardhman.company.businessDescription,
        productLines: vardhman.business.productLines ?? null,
        primaryMarketDescription: vardhman.business.primaryMarketDescription ?? null,
      },
      'test',
    );
    const gaps = collectPlaceholders(await render());
    expect(gaps.some((g) => g.factPath === 'aboutCompany.industryOverview.commissionedReport')).toBe(true);
  });

  it('never crashes for a sparse issuer with no product lines or primary market on file', async () => {
    const sparse = structuredClone(vardhman);
    sparse.business.productLines = undefined;
    sparse.business.primaryMarketDescription = undefined;
    await render(sparse);
  });
});
