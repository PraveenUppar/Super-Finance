import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { withAnswers } from '../../seed/empty';
import { writeNarrative } from '../../store/narrative-store';
import { writeDismissal } from '../../store/risk-dismissal-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from '../../store/versioned-table';
import { customerConcentration } from '../../risk';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { riskFactors } from './risk-factors';
import { sectionRegistry } from './index';
import { plannedSections } from './planned';

const ORG = 'org_test1';
const render = (facts = vardhman) => renderSection(riskFactors, { orgId: ORG, facts });
const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => {
      if (n.type === 'paragraph') return n.runs.map((r) => r.text).join('');
      if (n.type === 'heading') return n.text;
      return '';
    })
    .join('\n');
const headingsOf = (nodes: DocumentNode[], level: 3 | 4) =>
  nodes.filter((n): n is Extract<DocumentNode, { type: 'heading' }> => n.type === 'heading' && n.level === level).map((n) => n.text);

describe('Risk Factors — computed selection over lib/risk/archetypes.ts', () => {
  beforeEach(() => {
    // Isolate from any other test's writes — otherwise these tests would
    // read whatever another run left behind, same reason `modules.test.ts`'s
    // fact-store block isolates its own directory.
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('is registered and no longer listed as planned', () => {
    expect(sectionRegistry.some((s) => s.id === 'general.riskFactors')).toBe(true);
    expect(plannedSections['general.riskFactors']).toBeUndefined();
  });

  it('renders the customer concentration risk with the real 61.3% for Vardhman', async () => {
    const text = textOf(await render());
    expect(text).toContain('61.3');
    expect(text).toContain('Mahindra & Mahindra Limited');
  });

  it('groups risks under category headings in a fixed order, and only for categories that fired', async () => {
    const nodes = await render();
    const categories = headingsOf(nodes, 3);
    // business, then financial, then legal, then promoter (D49's
    // promoterMajorityControl), then industry and offer (D71's first
    // archetypes in each, both fire on Vardhman) — CATEGORY_ORDER's fixed order
    expect(categories).toEqual([
      'Risks Relating to Our Business and Operations',
      'Risks Relating to Our Financial Condition',
      'Risks Relating to Legal and Regulatory Matters',
      'Risks Relating to Our Promoters and Promoter Group',
      'Risks Relating to Our Industry',
      'Risks Relating to this Issue and Our Equity Shares',
    ]);
  });

  it('orders risks within a category by materiality, most material first', async () => {
    const nodes = await render();
    const titles = headingsOf(nodes, 4);
    // Contingent liabilities (~7.5x threshold) outranks material litigation (~2.8x) — both financial
    const cl = titles.indexOf('Contingent liabilities exceed the materiality threshold');
    const lit = titles.indexOf('Material legal proceedings are pending against the Company');
    expect(cl).toBeGreaterThanOrEqual(0);
    expect(lit).toBeGreaterThan(cl);
  });

  it('always raises the "not yet complete" gap, even for the real issuer', async () => {
    const gaps = collectPlaceholders(await render());
    expect(gaps.some((g) => g.factPath === 'general.riskFactors.narrative')).toBe(true);
  });

  it('never crashes for a one-fact issuer, and only fires archetypes an unanswered default legitimately supports', async () => {
    const sparse = withAnswers({ company: { name: 'Sparse Test Limited' } });
    const nodes = await render(sparse);
    expect(nodes.length).toBeGreaterThan(0);
    // Every array-backed archetype needs real data to fire, so all stay
    // silent. Three boolean-defaulted archetypes fire on an unanswered
    // default — `keyManInsuranceAbsent`, and D71's `rawMaterialPriceExposure`
    // and `objectsNotIndependentlyAppraised` — same precedent as EL-037
    // firing on an unanswered tripartite agreement: an unanswered required
    // yes/no question defaults to the conservative, finding-raising answer
    // everywhere else in this codebase, so a fact-based archetype should not
    // special-case itself as silent.
    expect(headingsOf(nodes, 4)).toEqual([
      'No key man insurance for Promoters or Key Managerial Personnel',
      'No long-term or fixed-price arrangements with key suppliers',
      'The objects of the Issue have not been independently appraised',
    ]);
    // Still honest about incompleteness even with only those triggered
    expect(collectPlaceholders(nodes).some((g) => g.factPath === 'general.riskFactors.narrative')).toBe(true);
  });

  it('marks the framing note distinctly (italic), not as ordinary body text', async () => {
    const nodes = await render();
    const intro = nodes.find((n) => n.type === 'paragraph' && n.runs[0]?.text.includes('MACHINE-GENERATED'));
    expect(intro).toBeDefined();
    expect(intro!.type === 'paragraph' && intro!.runs[0].italic).toBe(true);
  });

  it('renders a drafted paragraph in place of the terse detail() sentence, once one exists (D50)', async () => {
    // D51: the factSlice must match EXACTLY what the archetype produces for
    // these facts, or the draft is (correctly) treated as stale/foreign and
    // ignored — see narrative-store.ts's `readNarrative`.
    await writeNarrative(
      ORG,
      'risk.customer-concentration',
      'This is the drafted paragraph, standing in for the computed sentence.',
      '{}',
      customerConcentration.factSlice(vardhman),
      'test',
    );
    const text = textOf(await render());
    expect(text).toContain('This is the drafted paragraph, standing in for the computed sentence.');
    // The computed detail() sentence is gone, not just supplemented
    expect(text).not.toContain('Our top');
  });

  it("ignores a stored draft whose factSlice does not match this issuer's facts (D51)", async () => {
    await writeNarrative(
      ORG,
      'risk.customer-concentration',
      'A draft that belongs to a different issuer entirely.',
      '{}',
      { topCustomers: [{ name: 'Someone Else', revenueShare: 99 }], companyName: 'Not Vardhman Limited' },
      'test',
    );
    const text = textOf(await render());
    expect(text).not.toContain('A draft that belongs to a different issuer entirely.');
    // Falls back to the honest, computed sentence for THIS issuer instead
    expect(text).toContain('Our top 5 customers accounted for 61.3%');
  });

  it('falls back to the computed detail() sentence for every risk with no draft on file', async () => {
    // No writeNarrative() call — the store is empty in this test's isolated fake.
    const text = textOf(await render());
    expect(text).toContain('Our top 5 customers accounted for 61.3%');
  });

  describe('dismissal (D58) — a reviewed-and-excluded risk drops out of the printed section', () => {
    it('excludes a dismissed risk entirely, and does not print its category heading if it was the only one', async () => {
      await writeDismissal(ORG, 'key-man-insurance-absent', true, 'Confirmed with the Company: cover was taken out after the seed data was recorded.', 'reviewer');
      const nodes = await render();
      const titles = headingsOf(nodes, 4);
      expect(titles).not.toContain('No key man insurance for Promoters or Key Managerial Personnel');
    });

    it('still prints the other risks in the same category once one is dismissed', async () => {
      await writeDismissal(ORG, 'customer-concentration', true, 'Reason.', 'reviewer');
      const text = textOf(await render());
      expect(text).not.toContain('Our top 5 customers accounted for');
      // single-manufacturing-facility is also in the business category and was not dismissed
      expect(text).toContain('single facility');
    });

    it('states how many risks were reviewed and excluded, in the machine-generated note', async () => {
      await writeDismissal(ORG, 'customer-concentration', true, 'Reason.', 'reviewer');
      await writeDismissal(ORG, 'single-manufacturing-facility', true, 'Reason.', 'reviewer');
      const text = textOf(await render());
      expect(text).toContain('2 additional risks were auto-flagged and subsequently reviewed and excluded');
    });

    it('a reinstated (dismissed: false) risk prints normally, same as one never touched', async () => {
      await writeDismissal(ORG, 'customer-concentration', true, 'Excluded in error.', 'reviewer');
      await writeDismissal(ORG, 'customer-concentration', false, 'Reinstated — the exclusion did not hold up.', 'reviewer');
      const text = textOf(await render());
      expect(text).toContain('Our top 5 customers accounted for 61.3%');
      expect(text).not.toContain('reviewed and excluded');
    });
  });
});
