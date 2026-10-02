import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readDismissal, writeDismissal, listDismissalVersions, readDismissalVersion, listDismissalIds } from './risk-dismissal-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from './versioned-table';

const ORG = 'org_test1';

describe('the risk dismissal store', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('returns null for an id never touched', async () => {
    expect(await readDismissal(ORG, 'customer-concentration')).toBeNull();
  });

  it('records a dismissal with its reason and who made it', async () => {
    const record = await writeDismissal(
      ORG,
      'supplier-concentration',
      true,
      'The 55% figure is a single large one-off order, not a recurring dependency.',
      'reviewer@example.com',
    );
    expect(record.dismissed).toBe(true);
    expect(record.reason).toContain('single large one-off order');
    expect(record.version).toBe(1);

    const read = await readDismissal(ORG, 'supplier-concentration');
    expect(read?.dismissed).toBe(true);
    expect(read?.dismissedBy).toBe('reviewer@example.com');
  });

  it('a reinstatement is a new version, not a deletion of the dismissal history', async () => {
    await writeDismissal(ORG, 'leased-facilities', true, 'Excluded in error.', 'reviewer@example.com');
    await writeDismissal(ORG, 'leased-facilities', false, 'Reinstated — the exclusion reason did not hold up on a second look.', 'reviewer@example.com');

    expect((await readDismissal(ORG, 'leased-facilities'))?.dismissed).toBe(false);
    expect(await listDismissalVersions(ORG, 'leased-facilities')).toEqual([1, 2]);
    expect((await readDismissalVersion(ORG, 'leased-facilities', 1)).dismissed).toBe(true);
  });

  it('keeps dismissals for different ids apart', async () => {
    await writeDismissal(ORG, 'customer-concentration', true, 'Reason A.', 'a@example.com');
    await writeDismissal(ORG, 'leased-facilities', true, 'Reason B.', 'b@example.com');

    expect((await readDismissal(ORG, 'customer-concentration'))?.reason).toBe('Reason A.');
    expect((await readDismissal(ORG, 'leased-facilities'))?.reason).toBe('Reason B.');
  });

  it('lists every id with a dismissal record on file', async () => {
    expect(await listDismissalIds(ORG)).toEqual([]);
    await writeDismissal(ORG, 'customer-concentration', true, 'Reason.', 'a@example.com');
    await writeDismissal(ORG, 'leased-facilities', false, 'Never actually dismissed, just reviewed.', 'a@example.com');
    expect((await listDismissalIds(ORG)).sort()).toEqual(['customer-concentration', 'leased-facilities']);
  });

  it('keeps organizations apart', async () => {
    await writeDismissal(ORG, 'customer-concentration', true, 'Reason.', 'a@example.com');
    expect(await readDismissal('org_other', 'customer-concentration')).toBeNull();
    expect(await listDismissalIds('org_other')).toEqual([]);
  });
});
