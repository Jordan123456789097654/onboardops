import { buildCertificatePdf, loadCertificate } from "@/lib/certificate";

export const dynamic = "force-dynamic";

/** Downloads the certificate as a PDF. Same access rules as the printable page. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const found = await loadCertificate(params.id);
  if (found.kind === "login") return new Response("Sign in to download this certificate.", { status: 401 });
  if (found.kind === "mfa") return new Response("Finish two-step sign-in setup first.", { status: 403 });
  if (found.kind !== "ok") return new Response("Not found", { status: 404 });
  const bytes = await buildCertificatePdf(found.data);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="certificate-${found.data.code}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
