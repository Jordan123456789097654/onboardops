import Link from "next/link";
import { workspaceForHost } from "@/lib/host";
import { StaffLogin } from "@/components/staff-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

/** Served for a workspace's custom domain (the middleware rewrites "/" and "/login" here). */
export default async function DomainLogin({ params }: { params: { host: string } }) {
  const host = decodeURIComponent(params.host).toLowerCase();
  const ws = await workspaceForHost(host);
  if (!ws) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2"><h1 className="text-xl font-semibold">This domain is not connected yet</h1><p className="text-[13px] text-soft">{host} is not set up for any OnboardOps workspace, or its DNS check has not finished. If you manage it, finish setup in Settings, Custom domain.</p><Link className="btn" href="https://onboardops.org">Go to OnboardOps</Link></div>
      </div>
    );
  }
  return <StaffLogin workspaceId={ws.id} name={ws.name} onCustomDomain />;
}
