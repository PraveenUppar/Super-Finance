import { docxFilename, renderDocx } from '@/lib/document/docx';
import { assemble } from '@/lib/export/bundle';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

/**
 * GET /export/docx — the document as it stands, as a Word file.
 *
 * Renders the same sections the preview page renders, from the same
 * assembly, so what downloads is what was on screen. There is no query
 * parameter that lifts the draft notice: `certified` comes from `assemble()`
 * reading the certification store (`lib/store/certification-store.ts`),
 * which only the MB's "Certify" action on `/review` ever writes to.
 *
 * Open to both Admin and Member — downloading is not Owner-only.
 */
export async function GET() {
  const { facts, version, sections, certified } = await assemble(await currentOrgId());
  const options = { facts, version, certified };
  const bytes = await renderDocx(sections, options);

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${docxFilename(facts, options)}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
