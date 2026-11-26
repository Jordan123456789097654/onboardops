import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { kenerConfigured, kenerOverview, STATUS_PAGE_URL, type StatusMonitor, type StatusReport, type StatusResource } from "@/lib/kener";
import { getOutageTest } from "@/lib/maintenance";
import { getIncidentSettings } from "@/lib/incidents";
import { aiConfigured } from "@/lib/ai/groq";
import { StatusManager } from "./manager";

export const metadata = { title: "Status & Incidents" };
export const dynamic = "force-dynamic";

export default async function AdminStatus() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const configured = kenerConfigured();
  const [test, settings] = await Promise.all([getOutageTest(), getIncidentSettings()]);
  let data: { resources: StatusResource[]; reports: StatusReport[]; monitors: StatusMonitor[] } = { resources: [], reports: [], monitors: [] };
  let error = "";
  if (configured) {
    try { data = await kenerOverview(); } catch (e) { error = e instanceof Error ? e.message : "Could not reach Kener status page."; }
  }
  return (
    <>
      <PageHeader
        title="Status & Incidents"
        sub="Manage status.onboardops.org (Kener) incidents, long-form status updates, in-app outage screen overrides, staff Discord/Slack alerts, and outage drills."
      />
      <StatusManager
        configured={configured}
        error={error}
        canEdit={staff.role === "OWNER"}
        aiReady={aiConfigured()}
        publicUrl={STATUS_PAGE_URL}
        resources={data.resources}
        reports={data.reports}
        monitors={data.monitors}
        outageTest={test}
        incidentSettings={settings}
      />
    </>
  );
}
