import { FileText, FileDown, Sheet, Archive } from 'lucide-react';
import { readCertification } from '@/lib/store/certification-store';
import { ROLE_LABELS } from '@/lib/review/types';
import { formatTimestamp } from '@/lib/review/timestamp';
import { currentOrgId } from '@/lib/auth/org-context';

/**
 * The export hub — kept apart from the document and the gap report on
 * purpose. Those two answer "what does the draft say" and "is it ready";
 * this one is just "give me the file", and mixing file-download links into
 * either of the other pages buried them.
 */

const EXPORTS = [
  {
    href: '/export/docx',
    icon: FileText,
    title: 'Word',
    description: 'The full draft as a .docx — headings, table of contents, highlighted placeholders. What a merchant banker redlines.',
  },
  {
    href: '/export/pdf',
    icon: FileDown,
    title: 'PDF',
    description: 'A print-ready PDF of the same document, for sharing where Word is not wanted.',
  },
  {
    href: '/export/gaps',
    icon: Sheet,
    title: 'Gap report (Excel)',
    description: 'Every finding as a spreadsheet — severity, clause, what it blocks — for tracking outside the app.',
  },
  {
    href: '/export/vault',
    icon: Archive,
    title: 'Vault (zip)',
    description: 'Word, PDF, the gap workbook and a provenance map, bundled together.',
  },
] as const;

export default async function ExportPage() {
  const orgId = await currentOrgId();
  const certification = await readCertification(orgId);

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Export
      </p>
      <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
        Download the draft
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {certification.certified ? (
          <>
            Certified by {ROLE_LABELS[certification.certifiedBy!]} on{' '}
            {formatTimestamp(certification.certifiedAt!)}.
          </>
        ) : (
          <>
            Unsigned draft — every export below prints &quot;UNSIGNED DRAFT — NOT FOR FILING&quot;
            until a Merchant Banker certifies it in{' '}
            <a href="/review" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
              Review
            </a>
            .
          </>
        )}
      </p>

      {/* Plain anchors, not <Link>: these are file downloads, not navigations. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <a
            key={e.href}
            href={e.href}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-foreground/30 hover:shadow-md"
          >
            <e.icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-heading text-base font-semibold">{e.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
