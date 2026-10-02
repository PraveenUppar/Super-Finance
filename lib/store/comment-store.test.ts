import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addComment, resolveComment, readThread, createFakeCommentStore, __setCommentStoreForTests } from './comment-store';

const ORG = 'org_test1';

describe('the comment store', () => {
  beforeEach(() => {
    __setCommentStoreForTests(createFakeCommentStore());
  });

  afterEach(() => {
    __setCommentStoreForTests(null);
  });

  it('is empty for a section with no comments', async () => {
    expect(await readThread(ORG, 'aboutCompany.ourBusiness')).toEqual([]);
  });

  it('posts a comment, unresolved by default', async () => {
    const c = await addComment(ORG, 'aboutCompany.ourBusiness', 'MERCHANT_BANKER', 'The revenue figure needs a source.');
    expect(c.resolved).toBe(false);

    const thread = await readThread(ORG, 'aboutCompany.ourBusiness');
    expect(thread).toHaveLength(1);
    expect(thread[0].text).toContain('needs a source');
  });

  it('resolving is a new event, not an edit of the original post', async () => {
    const c = await addComment(ORG, 'aboutCompany.ourBusiness', 'MERCHANT_BANKER', 'Fix the date.');
    await resolveComment(ORG, 'aboutCompany.ourBusiness', c.id, true);

    const thread = await readThread(ORG, 'aboutCompany.ourBusiness');
    expect(thread).toHaveLength(1); // still one comment, latest revision
    expect(thread[0].resolved).toBe(true);
    expect(thread[0].text).toBe('Fix the date.');
  });

  it('reopening a resolved comment does not move it in the thread order', async () => {
    const first = await addComment(ORG, 'aboutCompany.ourBusiness', 'CFO', 'First comment.');
    await addComment(ORG, 'aboutCompany.ourBusiness', 'CFO', 'Second comment.');
    await resolveComment(ORG, 'aboutCompany.ourBusiness', first.id, true);
    await resolveComment(ORG, 'aboutCompany.ourBusiness', first.id, false);

    const thread = await readThread(ORG, 'aboutCompany.ourBusiness');
    expect(thread.map((c) => c.text)).toEqual(['First comment.', 'Second comment.']);
    expect(thread[0].resolved).toBe(false);
  });

  it('keeps threads on different sections apart', async () => {
    await addComment(ORG, 'aboutCompany.ourBusiness', 'CFO', 'On Our Business.');
    await addComment(ORG, 'general.riskFactors', 'LEGAL', 'On Risk Factors.');

    expect(await readThread(ORG, 'aboutCompany.ourBusiness')).toHaveLength(1);
    expect(await readThread(ORG, 'general.riskFactors')).toHaveLength(1);
  });

  it('resolving an unknown comment id is a no-op, not a crash', async () => {
    expect(await resolveComment(ORG, 'aboutCompany.ourBusiness', 'does-not-exist', true)).toBeNull();
  });

  it('keeps organizations apart', async () => {
    await addComment(ORG, 'aboutCompany.ourBusiness', 'CFO', 'Org one.');
    expect(await readThread('org_other', 'aboutCompany.ourBusiness')).toEqual([]);
  });
});
