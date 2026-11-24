import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { getGrowthStats } from "@/lib/growth";
import { PageHeader } from "@/components/ui";
import { GrowthView, RangeTabs } from "./growth-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Growth analytics" };

export default async function GrowthPage({ searchParams }: { searchParams: { days?: string } }) {
  await requireStaffPage(ALL_STAFF);
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const stats = await getGrowthStats(days);
  return (
    <>
      <PageHeader title="Growth analytics" sub="Who visits, where they come from, and how many become real workspaces. Visits are counted anonymously; sign-ups and activation come straight from the database.">
        <RangeTabs days={days} />
      </PageHeader>
      <GrowthView s={stats} />
    </>
  );
}
