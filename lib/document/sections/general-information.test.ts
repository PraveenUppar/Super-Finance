import { describe, expect, it } from 'vitest';
import { vardhman } from '../../seed/vardhman';
import { collectPlaceholders, type DocumentNode } from '../nodes';
import { renderSection } from '../section';
import { generalInformation } from './general-information';
import type { FactBase } from '../../facts/schema';

/**
 * GENERAL INFORMATION — section map #9, D73. Every intermediary name here
 * already existed as a fact before this section did; this is their first
 * reader, not a reason to ask for them twice.
 */

const ORG = 'org_test1';

const textOf = (nodes: DocumentNode[]) =>
  nodes.map((n) => (n.type === 'paragraph' ? n.runs.map((r) => r.text).join('') : n.type === 'heading' ? n.text : '')).join('\n');

const variant = (mutate: (f: FactBase) => void): FactBase => {
  const f = structuredClone(vardhman);
  mutate(f);
  return f;
};

describe('General Information', () => {
  it('renders every intermediary already on file for Vardhman, gap-free', async () => {
    const nodes = await renderSection(generalInformation, { orgId: ORG, facts: vardhman });
    const text = textOf(nodes);
    expect(text).toContain('Indorient Financial Services Limited'); // BRLM
    expect(text).toContain('Kanga and Company'); // Legal Advisor
    expect(text).toContain('Bigshare Services Private Limited'); // Registrar
    expect(text).toContain('Kalyani & Associates'); // Statutory Auditor
    expect(text).toContain('Bank of Maharashtra'); // Banker to the Company
    expect(text).toContain('PR-014782'); // auditor peer review number
    expect(text).toContain('118204W'); // auditor FRN
    expect(collectPlaceholders(nodes)).toHaveLength(0);
  });

  it('finds the CFO among the Key Managerial Personnel by designation', async () => {
    const text = textOf(await renderSection(generalInformation, { orgId: ORG, facts: vardhman }));
    expect(text).toContain('Sunita Vardhman, Chief Financial Officer.');
  });

  it('prints the Company Secretary with contact details', async () => {
    const text = textOf(await renderSection(generalInformation, { orgId: ORG, facts: vardhman }));
    expect(text).toContain(vardhman.company.companySecretary.name);
    expect(text).toContain(vardhman.company.companySecretary.email);
  });

  it('cross-references Our Management for the Board, rather than repeating it', async () => {
    const text = textOf(await renderSection(generalInformation, { orgId: ORG, facts: vardhman }));
    expect(text).toContain('For details of our Board of Directors, see "Our Management".');
  });

  it('raises a real gap for a missing intermediary, not a silent absence', async () => {
    const f = variant((x) => {
      x.offer.bookRunningLeadManager = undefined;
    });
    const nodes = await renderSection(generalInformation, { orgId: ORG, facts: f });
    const gaps = collectPlaceholders(nodes);
    expect(gaps.some((g) => g.factPath === 'offer.bookRunningLeadManager')).toBe(true);
  });

  it('falls back honestly when no KMP designation matches CFO', async () => {
    const f = variant((x) => {
      x.management.keyManagerialPersonnel = x.management.keyManagerialPersonnel.filter(
        (k) => !/chief financial officer|cfo/i.test(k.designation),
      );
    });
    const gaps = collectPlaceholders(await renderSection(generalInformation, { orgId: ORG, facts: f }));
    expect(gaps.some((g) => g.factPath === 'management.keyManagerialPersonnel')).toBe(true);
  });

  it('never crashes for a one-fact issuer', async () => {
    const sparse = { ...vardhman, offer: { ...vardhman.offer, bookRunningLeadManager: undefined, legalAdvisor: undefined, registrarToIssue: undefined, escrowCollectionBank: undefined, bankerToCompany: undefined } };
    await renderSection(generalInformation, { orgId: ORG, facts: sparse });
  });
});
