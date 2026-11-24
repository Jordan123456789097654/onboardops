import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { can, getSupportConfig } from "@/lib/support-config";
import { PageHeader } from "@/components/ui";
import { Settings } from "./settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support settings" };

export default async function SupportSettingsPage() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const cfg = await getSupportConfig();
  const allowed = can(cfg, staff.role, "settings");
  const [staffRows, blocks, canned] = await Promise.all([
    prisma.user.findMany({ where: { platformRole: { not: null } }, select: { name: true } }),
    prisma.supportBlock.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.supportCanned.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const safe = {
    hours: cfg.hours, awayMessage: cfg.awayMessage, responseTarget: cfg.responseTarget, sla: cfg.sla, statuses: cfg.statuses,
    autoAssign: cfg.autoAssign, inboxes: cfg.inboxes, idle: cfg.idle, retentionMonths: cfg.retentionMonths, perms: cfg.perms, brand: cfg.brand,
    webhook: { host: cfg.webhook.host, configured: !!cfg.webhook.urlSealed, events: cfg.webhook.events },
    apiKeys: cfg.apiKeys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
  };
  return (
    <>
      <PageHeader title="Support settings" sub="How the support desk and the chat bubble behave. Changes apply straight away." />
      {!allowed && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">You can look at these settings, but only an owner can change them.</p>}
      <Settings
        cfg={safe}
        staff={Array.from(new Set(staffRows.map((s) => s.name))).sort()}
        blocks={blocks.map((b) => ({ email: b.email, reason: b.reason, by: b.createdBy, at: b.createdAt.toISOString() }))}
        canned={canned.map((c) => ({ id: c.id, title: c.title, body: c.body, grp: c.grp }))}
        canEdit={allowed}
        canBlock={can(cfg, staff.role, "block")}
        inboundReady={!!process.env.SUPPORT_INBOUND_SECRET?.trim()}
        replyToSet={!!process.env.SUPPORT_REPLY_TO?.trim()}
      />
    </>
  );
}
