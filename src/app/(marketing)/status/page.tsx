import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui";
import { checkAllServices } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "System Status", description: "Live status of OnboardOps services.", alternates: { canonical: "/status" } };

export default async function StatusPage() {
  const report = await checkAllServices();
  const list = Object.values(report.services);
  return (
    <PageShell narrow eyebrow="Status" title={report.ok ? "All systems operational" : "System degraded"} intro="Live health checks for OnboardOps subsystems and BetterStack monitoring endpoints.">
      <div className="card divide-y divide-line">
        {list.map((s) => (
          <div key={s.service} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
            <div>
              <div className="font-medium capitalize">{s.service}</div>
              <div className="text-xs text-soft">{s.message}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="mono text-xs text-soft">{s.latencyMs}ms</span>
              <Badge value={s.ok ? "PASSED" : "FAILED"} label={s.status.toUpperCase()} />
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-4 text-[13px]">
        <h2 className="text-sm font-semibold">BetterStack JSON Endpoints</h2>
        <p className="mt-1 text-xs text-soft">Point your BetterStack HTTP/keyword monitors to any of these endpoints (returns HTTP 200 when healthy, HTTP 503 when down):</p>
        <ul className="mono mt-3 space-y-1.5 text-xs">
          {report.endpoints.map((ep) => (
            <li key={ep}>
              <a href={ep} target="_blank" rel="noreferrer" className="text-accent underline">{ep}</a>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
