'use client';

import { useState, useTransition } from 'react';
import { ChevronUp, ChevronDown, Trash2, CircleHelp, Plus } from 'lucide-react';
import { saveField } from '@/app/(app)/intake/actions';
import { formatCell, parseCell, type RepeaterColumn } from '@/lib/modules/repeater-spec';
import { applyPaste, blankRow, parsePaste } from '@/lib/modules/paste';

/**
 * The repeater — the workhorse field.
 *
 * ~60% of all data volume goes through this one component: allotment history,
 * shareholders, directors, litigation, customers, licences, group companies,
 * related-party transactions, indebtedness. The architecture note is blunt
 * about the stakes — if the repeater is good the app is good, and if it is
 * clunky M2 alone sinks the demo.
 *
 * So the things it has to do well are the boring ones:
 *
 *   PASTE FROM EXCEL. Nobody types an allotment history. It exists in a
 *   spreadsheet, and the fastest path from there to here is a paste of
 *   tab-separated rows. Paste into the first cell of the last row and it
 *   expands to fit.
 *
 *   RUNNING TOTALS. The column that has to tie to paid-up capital shows its
 *   total as you go, so a mistake is visible on the row that caused it rather
 *   than in week nine.
 *
 *   NEVER LOSE A ROW. Save fires on blur, per row, and the whole list is
 *   written as one fact — so a half-typed row cannot orphan the rows after it.
 */

export interface RepeaterProps {
  moduleId: string;
  path: string;
  label: string;
  helpText: string;
  columns: RepeaterColumn[];
  initial: Record<string, unknown>[];
  /**
   * The stored answer is an explicit empty list — "None" was chosen. A table
   * nobody has reached is absent from the store, not empty, and the two must
   * not look the same: a company with no litigation has answered; a company
   * that has not got to M7 has not.
   */
  answeredNone?: boolean;
  /** Rendered under the table — running totals, reconciliation, warnings. */
  footer?: React.ReactNode;
}

const cellClass =
  'w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors ' +
  'hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30';

export function Repeater({
  moduleId,
  path,
  label,
  helpText,
  columns,
  initial,
  answeredNone = false,
  footer,
}: RepeaterProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(
    initial.length > 0 ? initial : [blankRow(columns)],
  );
  const [none, setNone] = useState(answeredNone && initial.length === 0);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, startTransition] = useTransition();
  const [showHelp, setShowHelp] = useState(false);

  /** "None": an explicit empty list, which the store keeps apart from absence. */
  const commitNone = () => {
    setNone(true);
    setRows([blankRow(columns)]);
    setState('saving');
    startTransition(async () => {
      const result = await saveField(moduleId, path, []);
      if (!result.ok) window.alert(result.issues[0] ?? 'Could not save.');
      setState('saved');
    });
  };

  const commit = (draft: Record<string, unknown>[]) => {
    // Text-like cells are edited as raw strings and parsed here, at the seam:
    // a list becomes an array, and an empty text or date becomes absent.
    const next = draft.map((r) =>
      Object.fromEntries(
        columns.map((c) => [
          c.key,
          typeof r[c.key] === 'string' && (c.type === 'list' || c.type === 'text' || c.type === 'date')
            ? parseCell(c, r[c.key] as string)
            : r[c.key],
        ]),
      ),
    );
    setRows(next);
    // A trailing blank row is scaffolding, not data. Saving it would put an
    // empty allotment into the build-up and break the reconciliation.
    const meaningful = next.filter((r) =>
      Object.values(r).some(
        (v) => v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0),
      ),
    );
    // Nothing typed is nothing to save. Writing [] here would record "None"
    // for an issuer who only clicked into the table.
    if (meaningful.length === 0 && !none) return;
    setNone(false);
    setState('saving');
    startTransition(async () => {
      const result = await saveField(moduleId, path, meaningful);
      if (!result.ok) window.alert(result.issues[0] ?? 'Could not save.');
      setState('saved');
    });
  };

  const setCell = (rowIndex: number, key: string, value: unknown) => {
    setRows((current) => current.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    commit(next);
  };

  // Money cells are decimal strings, so the total reads both kinds. A float
  // sum is fine HERE — it is a running check on the screen, never a figure
  // the document prints; those go through decimal.js on the server.
  const asNumber = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return 0;
  };
  const totals = columns
    .filter((c) => c.total)
    .map((c) => ({
      key: c.key,
      label: c.label,
      value: rows.reduce((n, r) => n + asNumber(r[c.key]), 0),
    }));

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="shrink-0 text-xs text-muted-foreground">
          {state === 'saving' && 'Saving...'}
          {state === 'saved' && 'Saved'}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Paste straight from a spreadsheet into the first cell of the last row.
      </p>

      {none && (
        <p className="mt-2 text-sm">
          <span className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground">
            None
          </span>
          <span className="ml-2 text-xs text-muted-foreground">Add a row below to change this.</span>
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40 text-left">
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-1.5 text-xs font-medium text-muted-foreground" style={{ width: c.width }}>
                  {c.label}
                </th>
              ))}
              <th className="w-24 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border">
                {columns.map((c, ci) => (
                  <td key={c.key} className="px-1 py-0.5">
                    {c.type === 'select' || c.type === 'boolean' ? (
                      <select
                        className={cellClass}
                        value={formatCell(c, row[c.key])}
                        onChange={(e) =>
                          setCell(
                            i,
                            c.key,
                            c.type === 'boolean' ? parseCell(c, e.target.value) : e.target.value,
                          )
                        }
                        onBlur={() => commit(rows)}
                      >
                        <option value="">—</option>
                        {(c.type === 'boolean'
                          ? [
                              { value: 'true', label: 'Yes' },
                              { value: 'false', label: 'No' },
                            ]
                          : (c.options ?? [])
                        ).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={c.type === 'date' ? 'date' : 'text'}
                        inputMode={c.type === 'number' || c.type === 'money' ? 'decimal' : undefined}
                        className={`${cellClass} ${c.type === 'number' || c.type === 'money' ? 'text-right tabular-nums' : ''}`}
                        placeholder={c.placeholder ?? (c.type === 'list' ? 'One; another; a third' : undefined)}
                        value={formatCell(c, row[c.key])}
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Text-like cells keep the raw string while typing so the
                          // caret does not jump; the parse happens on blur.
                          setCell(i, c.key, c.type === 'list' || c.type === 'text' || c.type === 'date' ? raw : parseCell(c, raw));
                        }}
                        onBlur={() => commit(rows)}
                        onPaste={(e) => {
                          // Only the first column accepts a grid paste; pasting
                          // into the middle of a row means one cell.
                          if (ci !== 0) return;
                          const parsed = parsePaste(e.clipboardData.getData('text/plain'), columns);
                          if (!parsed) return;
                          e.preventDefault();
                          commit(applyPaste(rows, i, parsed));
                        }}
                      />
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap px-2 py-0.5 text-right">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(i, i - 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(i, i + 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    disabled={i === rows.length - 1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => {
                      const remaining = rows.filter((_, j) => j !== i);
                      // Removing the last row is an explicit "none": the
                      // deletion must reach the store, not be swallowed by
                      // the nothing-typed guard
                      if (remaining.length === 0) commitNone();
                      else commit(remaining);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {totals.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border">
                {columns.map((c) => {
                  const t = totals.find((x) => x.key === c.key);
                  return (
                    <td key={c.key} className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums">
                      {t ? t.value.toLocaleString('en-IN') : ''}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setRows([...rows, blankRow(columns)])}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a row
        </button>
        {!none && (
          <button
            type="button"
            onClick={commitNone}
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            None / no entries
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          {showHelp ? 'Hide' : 'Why we ask'}
        </button>
      </div>

      {showHelp && (
        <div className="mt-2 rounded-md border-l-2 border-border bg-muted/40 py-2 pl-3 pr-2 text-xs leading-relaxed text-muted-foreground">
          {helpText}
        </div>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
