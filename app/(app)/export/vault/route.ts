import { assemble, buildVault } from '@/lib/export/bundle';
import { currentOrgId } from '@/lib/auth/org-context';

export const dynamic = 'force-dynamic';

/**
 * GET /export/vault — the document and its working papers as one archive:
 * DOCX, PDF where LibreOffice is available, the gap report, the fact base
 * and the provenance map, with a manifest. See lib/export/bundle.
 *
 * Open to both Admin and Member — downloading is not Owner-only.
 */
export async function GET() {
  const { zip, filename, pdfOmitted } = await buildVault(await assemble(await currentOrgId()));

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.byteLength),
      'Cache-Control': 'no-store',
      // A header the browser ignores and a curl user can see; the manifest says the same
      ...(pdfOmitted ? { 'X-Setu-Pdf-Omitted': pdfOmitted } : {}),
    },
  });
}
