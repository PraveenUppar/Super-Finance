import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readMemberRole, writeMemberRole, listAssignedUserIds } from './member-role-store';
import { createFakeVersionedTable, __setVersionedTableForTests } from './versioned-table';

const ORG = 'org_test1';

describe('the member role store', () => {
  beforeEach(() => {
    __setVersionedTableForTests(createFakeVersionedTable());
  });

  afterEach(() => {
    __setVersionedTableForTests(null);
  });

  it('returns null for a user never assigned a role', async () => {
    expect(await readMemberRole(ORG, 'user_1')).toBeNull();
  });

  it('records the assigned role and who assigned it', async () => {
    const record = await writeMemberRole(ORG, 'user_1', 'MERCHANT_BANKER', 'owner@example.com');
    expect(record.role).toBe('MERCHANT_BANKER');
    expect(record.assignedBy).toBe('owner@example.com');
    expect(await readMemberRole(ORG, 'user_1')).toBe('MERCHANT_BANKER');
  });

  it('reassigning is a new version, not a loss of who held it before', async () => {
    await writeMemberRole(ORG, 'user_1', 'CFO', 'owner@example.com');
    const second = await writeMemberRole(ORG, 'user_1', 'LEGAL', 'owner@example.com');
    expect(second.version).toBe(2);
    expect(await readMemberRole(ORG, 'user_1')).toBe('LEGAL');
  });

  it('keeps different members apart', async () => {
    await writeMemberRole(ORG, 'user_1', 'CFO', 'owner@example.com');
    await writeMemberRole(ORG, 'user_2', 'LEGAL', 'owner@example.com');
    expect(await readMemberRole(ORG, 'user_1')).toBe('CFO');
    expect(await readMemberRole(ORG, 'user_2')).toBe('LEGAL');
  });

  it('lists every member ever assigned a role, for this org only', async () => {
    await writeMemberRole(ORG, 'user_1', 'CFO', 'owner@example.com');
    await writeMemberRole(ORG, 'user_2', 'LEGAL', 'owner@example.com');
    await writeMemberRole('org_other', 'user_3', 'AUDITOR', 'owner2@example.com');
    expect((await listAssignedUserIds(ORG)).sort()).toEqual(['user_1', 'user_2']);
    expect(await listAssignedUserIds('org_other')).toEqual(['user_3']);
  });
});
