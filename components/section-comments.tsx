'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addComment, resolveComment } from '@/app/(app)/review/actions';
import { formatTimestamp } from '@/lib/review/timestamp';
import { ROLE_LABELS } from '@/lib/review/types';
import type { CommentEvent } from '@/lib/store/comment-store';

/**
 * Section-anchored comment thread, restored onto `ReviewSectionCard`.
 *
 * `addComment`/`resolveComment` (`app/(app)/review/actions.ts`) and the
 * `comment_events` store have existed since S12 — nothing here is new
 * infrastructure. What was missing was purely the UI: an earlier redesign of
 * `ReviewSectionCard` dropped the thread to simplify the row, and nothing
 * since has called either action. This follows the same pattern as
 * `ReviewSectionCard`'s own status toggle: no local optimistic list — the
 * server action's `revalidatePath('/review')` refreshes this component's
 * `comments` prop from the server on the same transition, so the prop is
 * always the source of truth.
 */
export function SectionComments({
  sectionId,
  sectionTitle,
  comments,
}: {
  sectionId: string;
  sectionTitle: string;
  comments: CommentEvent[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  const submit = () => {
    const value = text.trim();
    if (!value) {
      setError('Write something first.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addComment(sectionId, sectionTitle, value);
      if (!result.ok) {
        setError(result.error ?? 'Could not post.');
        return;
      }
      setText('');
    });
  };

  const toggleResolved = (commentId: string, resolved: boolean) => {
    startTransition(async () => {
      const result = await resolveComment(sectionId, sectionTitle, commentId, resolved);
      if (!result.ok && result.error) window.alert(result.error);
    });
  };

  return (
    <div className="w-full border-t border-border/60 pt-2 pb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {comments.length === 0
          ? 'Comment'
          : `${comments.length} comment${comments.length === 1 ? '' : 's'}${
              unresolvedCount > 0 ? ` · ${unresolvedCount} open` : ''
            }`}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-md border border-border bg-muted/30 p-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {ROLE_LABELS[c.author]}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {formatTimestamp(c.createdAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleResolved(c.id, !c.resolved)}
                      className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-60"
                      title={c.resolved ? 'Reopen' : 'Resolve'}
                    >
                      {c.resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {c.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                  <p
                    className={`mt-0.5 ${
                      c.resolved ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {c.text}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-start gap-2 pt-1">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Leave a comment on this section..."
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <Button type="button" size="sm" disabled={pending} onClick={submit}>
              Post
            </Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
