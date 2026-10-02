import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readNarrative, writeNarrative, listNarrativeVersions, readNarrativeVersion } from './narrative-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from './versioned-table';

const ORG = 'org_test1';

describe('the narrative store', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('returns null for an id with no draft yet', async () => {
    expect(await readNarrative(ORG, 'risk.customer-concentration', { a: 1 })).toBeNull();
  });

  it('round-trips a draft when the current factSlice matches the one it was drafted from', async () => {
    await writeNarrative(ORG, 'risk.customer-concentration', 'Drafted text.', '{"raw":true}', { a: 1 }, 'tester');
    const draft = await readNarrative(ORG, 'risk.customer-concentration', { a: 1 });
    expect(draft?.text).toBe('Drafted text.');
    expect(draft?.raw).toBe('{"raw":true}');
    expect(draft?.factSlice).toEqual({ a: 1 });
    expect(draft?.version).toBe(1);
  });

  // D51: found by a real test failure, not designed up front — a draft
  // generated for one issuer's facts was being served to a different
  // issuer entirely, because nothing checked whether the facts still
  // matched. This is the guard, and the case it exists to stop.
  it('refuses a stored draft whose factSlice no longer matches — the leak this exists to prevent', async () => {
    await writeNarrative(
      ORG,
      'risk.key-man-insurance-absent',
      'Drafted for Vardhman.',
      '',
      { companyName: 'Vardhman Precision Components Limited', hasKeyManInsurance: false },
      'tester',
    );
    const draftForADifferentIssuer = await readNarrative(ORG, 'risk.key-man-insurance-absent', {
      companyName: 'Some Other Company Limited',
      hasKeyManInsurance: false,
    });
    expect(draftForADifferentIssuer).toBeNull();
  });

  it("refuses a stored draft once the SAME issuer's facts have changed", async () => {
    await writeNarrative(ORG, 'risk.export-revenue-dependency', 'Drafted at 8.4%.', '', { exportRevenueShare: 8.4 }, 'tester');
    expect(await readNarrative(ORG, 'risk.export-revenue-dependency', { exportRevenueShare: 9.1 })).toBeNull();
    // Still readable against the exact facts it was drafted from
    expect((await readNarrative(ORG, 'risk.export-revenue-dependency', { exportRevenueShare: 8.4 }))?.text).toBe('Drafted at 8.4%.');
  });

  it('appends a new version rather than overwriting on regeneration', async () => {
    await writeNarrative(ORG, 'risk.customer-concentration', 'First draft.', '', {}, 'tester');
    await writeNarrative(ORG, 'risk.customer-concentration', 'Second draft.', '', {}, 'tester');

    expect((await readNarrative(ORG, 'risk.customer-concentration', {}))?.text).toBe('Second draft.');
    expect(await listNarrativeVersions(ORG, 'risk.customer-concentration')).toEqual([1, 2]);
    expect((await readNarrativeVersion(ORG, 'risk.customer-concentration', 1)).text).toBe('First draft.');
  });

  it('keeps drafts for different ids apart', async () => {
    await writeNarrative(ORG, 'risk.customer-concentration', 'Customer draft.', '', {}, 'tester');
    await writeNarrative(ORG, 'risk.leased-facilities', 'Facilities draft.', '', {}, 'tester');

    expect((await readNarrative(ORG, 'risk.customer-concentration', {}))?.text).toBe('Customer draft.');
    expect((await readNarrative(ORG, 'risk.leased-facilities', {}))?.text).toBe('Facilities draft.');
  });

  it('is safe for an id containing dots, matching a section id shape', async () => {
    await writeNarrative(ORG, 'aboutCompany.ourBusiness', 'Business narrative.', '', {}, 'tester');
    expect((await readNarrative(ORG, 'aboutCompany.ourBusiness', {}))?.text).toBe('Business narrative.');
  });

  it('keeps organizations apart', async () => {
    await writeNarrative(ORG, 'risk.customer-concentration', 'Org one draft.', '', {}, 'tester');
    expect(await readNarrative('org_other', 'risk.customer-concentration', {})).toBeNull();
  });
});
