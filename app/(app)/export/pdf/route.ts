import { docxFilename, renderDocx } from '@/lib/document/docx';
import { assemble } from '@/lib/export/bundle';
import { docxToPdf, PdfUnavailableError } from '@/lib/export/pdf';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

/**
 * GET /export/pdf — a print of the DOCX through LibreOffice.
 *
 * 501 with a plain message when LibreOffice is not installed. The document
 * is not re-rendered by a second engine to get a PDF out; see lib/export/pdf.
 * Open to both Admin and Member — downloading is not Owner-only.
 */
export async function GET() {
  const { facts, version, sections, certified } = await assemble(await currentOrgId());
  const options = { facts, version, certified };
  const name = docxFilename(facts, options).replace(/\.docx$/, '');

  try {
    const docx = await renderDocx(sections, options);
    const pdf = await docxToPdf(docx, name);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}.pdf"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof PdfUnavailableError) {
      return new Response(e.message, { status: 501, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response(`PDF conversion failed: ${(e as Error).message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
