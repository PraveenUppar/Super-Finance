import { describe, expect, it } from 'vitest';
import { createFakeVersionedTable } from './versioned-table';

describe('versioned table (fake, exercising the same contract the Supabase-backed one must honour)', () => {
  it('has no latest row until the first write', async () => {
    const t = createFakeVersionedTable();
    expect(await t.readLatest('org1', 'fact_base', '_singleton')).toBeNull();
    expect(await t.listVersions('org1', 'fact_base', '_singleton')).toEqual([]);
  });

  it('numbers versions from 1 and never overwrites a prior one', async () => {
    const t = createFakeVersionedTable();
    const v1 = await t.write('org1', 'fact_base', '_singleton', { a: 1 }, 'alice');
    const v2 = await t.write('org1', 'fact_base', '_singleton', { a: 2 }, 'bob');

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(await t.readVersion('org1', 'fact_base', '_singleton', 1)).toMatchObject({ data: { a: 1 }, savedBy: 'alice' });
    expect(await t.readLatest('org1', 'fact_base', '_singleton')).toMatchObject({ data: { a: 2 }, savedBy: 'bob' });
    expect(await t.listVersions('org1', 'fact_base', '_singleton')).toEqual([1, 2]);
  });

  it('keeps organizations fully isolated', async () => {
    const t = createFakeVersionedTable();
    await t.write('org1', 'fact_base', '_singleton', { org: 1 }, 'a');
    await t.write('org2', 'fact_base', '_singleton', { org: 2 }, 'b');

    expect(await t.readLatest('org1', 'fact_base', '_singleton')).toMatchObject({ data: { org: 1 } });
    expect(await t.readLatest('org2', 'fact_base', '_singleton')).toMatchObject({ data: { org: 2 } });
  });

  it('keeps different kinds and keys apart within one org', async () => {
    const t = createFakeVersionedTable();
    await t.write('org1', 'section_status', 'sec-a', { status: 'DRAFT' }, 'x');
    await t.write('org1', 'section_status', 'sec-b', { status: 'REVIEWED' }, 'x');
    await t.write('org1', 'risk_dismissal', 'sec-a', { dismissed: true }, 'x');

    expect(await t.readLatest('org1', 'section_status', 'sec-a')).toMatchObject({ data: { status: 'DRAFT' } });
    expect(await t.readLatest('org1', 'section_status', 'sec-b')).toMatchObject({ data: { status: 'REVIEWED' } });
    expect(await t.readLatest('org1', 'risk_dismissal', 'sec-a')).toMatchObject({ data: { dismissed: true } });
  });

  it('lists every distinct key written for an (org, kind), and only that org', async () => {
    const t = createFakeVersionedTable();
    await t.write('org1', 'risk_dismissal', 'archetype-a', { dismissed: true }, 'x');
    await t.write('org1', 'risk_dismissal', 'archetype-a', { dismissed: false }, 'x');
    await t.write('org1', 'risk_dismissal', 'archetype-b', { dismissed: true }, 'x');
    await t.write('org2', 'risk_dismissal', 'archetype-c', { dismissed: true }, 'x');

    expect(await t.listKeys('org1', 'risk_dismissal')).toEqual(expect.arrayContaining(['archetype-a', 'archetype-b']));
    expect(await t.listKeys('org1', 'risk_dismissal')).toHaveLength(2);
    expect(await t.listKeys('org2', 'risk_dismissal')).toEqual(['archetype-c']);
  });
});
