import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { CertificateSheet } from "@/components/certificate-sheet";
import { loadCertificate, qrDataUrl } from "@/lib/certificate";
import { CertPrintButton } from "../cert-print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificate" };

export default async function Certificate({ params }: { params: { id: string } }) {
  const found = await loadCertificate(params.id);
  if (found.kind === "login") redirect("/login");
  if (found.kind === "mfa") redirect("/account?need2fa=1");
  if (found.kind !== "ok") notFound();
  const qr = await qrDataUrl(found.data.verifyUrl);
  return (
    <div className="cert-page mx-auto max-w-5xl p-4 sm:p-8">
      <style>{`
        @page { size: 11in 8.5in; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .cert-page { max-width: none !important; padding: 0 !important; }
          .cert-sheet { width: 11in !important; height: 8.5in !important; aspect-ratio: auto !important; }
        }
      `}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-soft">Certificate {found.data.code}. Print it, or download it as a PDF to email or keep.</p>
        <div className="flex gap-2">
          <a href={`/api/certificate/${found.data.id}/pdf`} className="btn" download><Download className="h-3.5 w-3.5" />Download PDF</a>
          <CertPrintButton />
        </div>
      </div>
      <div className="overflow-hidden rounded-sm shadow-[0_8px_30px_rgba(0,0,0,0.15)] print:rounded-none print:shadow-none">
        <CertificateSheet c={found.data} qr={qr} />
      </div>
    </div>
  );
}
