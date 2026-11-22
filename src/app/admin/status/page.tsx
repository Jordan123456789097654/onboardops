import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { betterstackConfigured, bsOverview, STATUS_PAGE_URL, type BsMonitor, type BsReport, type BsResource } from "@/lib/betterstack";
import { StatusManager } from "./manager";

export const metadata = { title: "Status page" };
export const dynamic = "force-dynamic";

export default async function AdminStatus() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const configured = betterstackConfigured();
  let data: { resources: BsResource[]; reports: BsReport[]; monitors: BsMonitor[] } = { resources: [], reports: [], monitors: [] };
  let error = "";
  if (configured) {
    try { data = await bsOverview(); } catch (e) { error = e instanceof Error ? e.message : "Could not reach Better Stack."; }
  }
  return (
    <>
      <PageHeader title="Status page" sub="What visitors see on the public status page. Post incidents, schedule maintenance and mark services as degraded. Maintenance mode and slow services are posted automatically." />
      <StatusManager configured={configured} error={error} canEdit={staff.role === "OWNER"} publicUrl={STATUS_PAGE_URL} resources={data.resources} reports={data.reports} monitors={data.monitors} />
    </>
  );
}
