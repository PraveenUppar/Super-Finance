'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { confirmExtraction, uploadAndExtract, type ExtractResult } from './actions';
import { DOMAINS } from './domains';

/**
 * S7 — upload a document, review what the model read out of it, confirm
 * only what checks out.
 *
 * Deliberately the plainest possible review surface for a first version:
 * one checkbox per TOP-LEVEL field (not per nested value — `company.
 * registeredOffice` is confirmed or not as a whole), and the targeted page
 * numbers shown as "look here," not a rendered page image beside each
 * value. Real review-against-the-source-page (mental model #4) needs that
 * eventually; this is the honest first slice, not the finished feature.
 */

const inputClass =
  'mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ' +
  'focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

export default function ExtractPage() {
  const [domain, setDomain] = useState<string>(DOMAINS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const runExtraction = () => {
    if (!file) return;
    setError(null);
    setResult(null);
    setSavedVersion(null);
    const formData = new FormData();
    formData.set('file', file);
    formData.set('domain', domain);
    startTransition(async () => {
      try {
        const r = await uploadAndExtract(formData);
        setResult(r);
        // Every field starts checked — a reviewer unchecks what does not hold up, per-field.
        setChecked(Object.fromEntries(Object.keys(r.parsed).map((k) => [k, true])));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const confirm = () => {
    if (!result) return;
    const confirmedFields = Object.fromEntries(
      Object.entries(result.parsed).filter(([k]) => checked[k]),
    );
    startTransition(async () => {
      try {
        const { version } = await confirmExtraction(
          result.documentId,
          result.domain,
          result.targetedPages[0],
          confirmedFields,
          result.confidence,
        );
        setSavedVersion(version);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="min-h-full bg-zinc-100 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-8 py-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">S7 — extraction</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Extract facts from a document</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Upload a PDF and pick which part of the fact base it should fill. Nothing is saved until
            you confirm it below, field by field, against the document.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/intake" className="underline decoration-dotted underline-offset-2">
              Back to intake
            </Link>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-8 py-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium">Which part of the fact base?</label>
          <select
            className={inputClass}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={isPending}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-sm font-medium">Document (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            className={inputClass}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={isPending}
          />

          <button
            type="button"
            onClick={runExtraction}
            disabled={!file || isPending}
            className="mt-4 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isPending && !result ? 'Extracting...' : 'Extract'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Review — check against the document</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Extracted from pages {result.targetedPages.join(', ')} of {result.totalPages}. Uncheck
              anything that does not match the source before confirming — an unchecked field is
              discarded, not saved as blank.
            </p>

            <div className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
              {Object.entries(result.parsed).map(([key, value]) => {
                const confidence = result.confidence[key] ?? 1;
                const low = confidence < 0.5;
                return (
                  <label key={key} className="flex items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked[key] ?? false}
                      onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{key}</span>
                        {low && (
                          <span
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            title="Not found close to verbatim in the extracted page text — check this one against the source carefully"
                          >
                            Low confidence
                          </span>
                        )}
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400">
                        {formatValue(value)}
                      </pre>
                    </div>
                  </label>
                );
              })}
              {Object.keys(result.parsed).length === 0 && (
                <p className="py-3 text-sm text-zinc-500">
                  The model found nothing to extract for this domain on these pages.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={isPending || Object.keys(result.parsed).length === 0}
              className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {isPending ? 'Saving...' : 'Confirm checked fields'}
            </button>

            {savedVersion !== null && (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                Saved as fact base version {savedVersion}.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
