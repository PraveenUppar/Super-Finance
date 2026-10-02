'use client';

import { useState, useTransition } from 'react';
import { CircleHelp, AlertTriangle } from 'lucide-react';
import { saveField } from '@/app/(app)/intake/actions';
import type { FieldView } from '@/lib/modules/types';
import { Repeater } from './repeater';

/**
 * ONE renderer for every module (MM2).
 *
 * M1 to M10 are specs; this file is the whole form engine. Adding a module
 * adds no UI code, which is the point — otherwise ten modules become ten
 * forms that drift.
 *
 * Every field shows why it is asked and where the answer lands. That is not
 * decoration: a first-time issuer learns the disclosure framework from it
 * while filling the form, and an issuer who understands the question gives a
 * better answer.
 */

type Saved = 'idle' | 'saving' | 'saved' | 'error';

const inputClass =
  'mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none ' +
  'transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

function Why({ field }: { field: FieldView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <CircleHelp className="h-3.5 w-3.5" />
        {open ? 'Hide' : 'Why we ask'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border-l-2 border-border bg-muted/40 py-2 pl-3 pr-2 text-xs leading-relaxed text-muted-foreground">
          <p>{field.helpText}</p>
          {field.clause && (
            <p className="mt-2">
              <span className="text-muted-foreground/70">Requirement: </span>
              {field.clause}
            </p>
          )}
          {field.feedsInto.length > 0 && (
            <p className="mt-2">
              <span className="text-muted-foreground/70">Where this appears: </span>
              {field.feedsInto.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Input({
  field,
  value,
  onChange,
}: {
  field: FieldView;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <div className="mt-2 inline-flex gap-1 rounded-md border border-border bg-muted/40 p-0.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange(v)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                value === v
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );

    case 'select':
      return (
        <select
          className={inputClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case 'longtext':
      return (
        <textarea
          rows={3}
          className={inputClass}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : value ? JSON.stringify(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
    case 'currency':
    case 'percent':
      return (
        <div className="flex items-baseline gap-2">
          <input
            className={`${inputClass} tabular-nums`}
            inputMode="decimal"
            placeholder={field.placeholder}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              // An empty box is unanswered, not zero. Coercing it to 0 would
              // report the field as answered and satisfy a rule falsely.
              if (raw === '') return onChange(undefined);
              // Money stays a decimal STRING — the fact base's Money type.
              // Number() here would fail the zMoney schema and put a float
              // into rupee arithmetic.
              onChange(field.type === 'currency' ? raw.replace(/[,\s]/g, '') : Number(raw));
            }}
          />
          {field.suffix && <span className="shrink-0 text-xs text-muted-foreground">{field.suffix}</span>}
        </div>
      );

    default:
      return (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          className={inputClass}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function FieldRow({ field, moduleId }: { field: FieldView; moduleId: string }) {
  const [value, setValue] = useState<unknown>(field.value);
  const [issues, setIssues] = useState<string[]>(field.issues);
  const [state, setState] = useState<Saved>('idle');
  const [, startTransition] = useTransition();

  const commit = (next: unknown) => {
    setValue(next);
    setState('saving');
    startTransition(async () => {
      const result = await saveField(moduleId, field.path, next);
      setIssues(result.issues);
      setState(result.ok ? 'saved' : 'error');
    });
  };

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium text-foreground">{field.label}</label>
        <span className="shrink-0 text-xs text-muted-foreground">
          {state === 'saving' && 'Saving...'}
          {state === 'saved' && 'Saved'}
          {state === 'error' && <span className="text-amber-500">Saved, needs attention</span>}
        </span>
      </div>

      {/*
        Save on blur, not on every keystroke. Each save appends a version, and
        a version per keystroke would bury the real edits in the history.

        A nullable field has a third state beside "answered" and "not yet":
        NONE — no pledged shares, no regulatory action, no change of control.
        It saves as null, which the store keeps apart from an absent answer,
        so the module can complete without the issuer typing "none" into a
        box that then reads as a disclosure.
      */}
      {value === null ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
            None
          </span>
          <button
            type="button"
            onClick={() => setValue(undefined)}
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Enter details instead
          </button>
        </div>
      ) : (
        <>
          <div onBlur={() => commit(value)}>
            <Input field={field} value={value} onChange={setValue} />
          </div>
          {field.nullable && (
            <button
              type="button"
              onClick={() => commit(null)}
              className="mt-2 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              None / not applicable
            </button>
          )}
        </>
      )}

      {issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-amber-500">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {i}
            </li>
          ))}
        </ul>
      )}

      <Why field={field} />
    </div>
  );
}

/**
 * `fields` arrives already filtered by `showIf` and already carrying its
 * values, resolved section titles and current issues — all computed on the
 * server. A field that appears only after another answer therefore shows on
 * the next load rather than mid-keystroke, which also keeps the form from
 * rearranging under the cursor.
 */
export function ModuleForm({ moduleId, fields }: { moduleId: string; fields: FieldView[] }) {
  return (
    <div>
      {fields.map((f) =>
        f.type === 'table' && f.columns ? (
          <Repeater
            key={f.path}
            moduleId={moduleId}
            path={f.path}
            label={f.label}
            helpText={f.helpText}
            columns={f.columns}
            initial={Array.isArray(f.value) ? (f.value as Record<string, unknown>[]) : []}
            answeredNone={Array.isArray(f.value) && f.value.length === 0}
          />
        ) : (
          <FieldRow key={f.path} field={f} moduleId={moduleId} />
        ),
      )}
    </div>
  );
}
