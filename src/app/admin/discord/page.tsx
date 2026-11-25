import { prisma } from "@/lib/prisma";
import { ALL_STAFF, requireStaffPage } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { DiscordLinkPanel } from "./panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Link Discord" };

export default async function DiscordPage() {
  const staff = await requireStaffPage(ALL_STAFF);
  const link = await prisma.discordLink.findUnique({ where: { userId: staff.id }, select: { linkedAt: true } }).catch(() => undefined);
  const botReady = (process.env.STAFF_BOT_KEY?.trim().length ?? 0) >= 32;
  return (
    <>
      <PageHeader title="Link Discord" sub="Connect your Discord account so staff bot commands run with your staff permissions. The bot can only do what your role here allows." />
      {link === undefined ? (
        <div className="card border-amber-400/50 bg-amber-500/5 p-4 text-[13px]"><b>The Discord link table is not in the database yet.</b> Run <span className="mono">npx prisma db push</span> against the production database, then reload.</div>
      ) : (
        <DiscordLinkPanel linked={!!link} linkedAt={link?.linkedAt.toISOString() ?? null} botReady={botReady} />
      )}
    </>
  );
}
