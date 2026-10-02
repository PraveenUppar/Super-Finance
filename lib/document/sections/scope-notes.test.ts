import { describe, expect, it } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { keyIndustryRegulations, restatedFinancialInformation, taxBenefits } from './scope-notes';
import { plannedSections } from './planned';

/**
 * The three explained-gap subsections (#13, #16, #23) — D73. Each is
 * `producer: 'external'`, the same mechanism `renderSection()` already uses
 * for `summaryOfFinancialInformation` (#6): a heading, and a highlighted
 * `[TO BE PROVIDED: ...]` placeholder that is also a real gap-dashboard
 * finding, from one check.
 */

const textOf = (nodes: DocumentNode[]) =>
  nodes
    .map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : ''))
    .join('\n');

describe.each([
  ['taxBenefits', taxBenefits, /Statutory Auditor or tax advisor/],
  ['keyIndustryRegulations', keyIndustryRegulations, /Legal Counsel/],
  ['restatedFinancialInformation', restatedFinancialInformation, /peer-reviewed Statutory Auditor/],
])('%s', (_name, spec, expectedNote) => {
  it('is producer: external and no longer listed as planned', () => {
    expect(spec.producer).toBe('external');
    expect(plannedSections[spec.id]).toBeUndefined();
  });

  it('states both the reason and who supplies it', async () => {
    const text = textOf(await renderSection(spec, { orgId: 'org_test1', facts: vardhman }));
    expect(text).toContain(spec.title);
    expect(text).toMatch(expectedNote);
  });

  it('raises a real gap, not a silent absence', async () => {
    const gaps = collectPlaceholders(await renderSection(spec, { orgId: 'org_test1', facts: vardhman }));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].factPath).toBe(spec.id);
  });
});
