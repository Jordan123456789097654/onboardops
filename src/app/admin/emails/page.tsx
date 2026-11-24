import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { aiConfigured } from "@/lib/ai/groq";
import { MAIL_LIBRARY } from "@/lib/email-library";
import { PageHeader } from "@/components/ui";
import { Composer, type CustomTpl, type HistoryRow } from "./composer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const [custom, history] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const customTpls: CustomTpl[] = custom.map((t) => ({ id: t.id, title: t.title, cat: t.category, desc: `Saved by ${t.createdBy}`, subject: t.subject, body: t.body, icon: t.icon, buttonText: t.buttonText, buttonUrl: t.buttonUrl }));
  const hist: HistoryRow[] = history.map((h) => ({ id: h.id, at: h.createdAt.toISOString(), audience: h.audience, target: h.target, subject: h.subject, total: h.total, delivered: h.delivered, failed: h.failed, skipped: h.skipped, status: h.status, by: h.staffName }));
  return (
    <>
      <PageHeader title="Emails" sub={`Send announcements, notices and policy updates from a library of ${MAIL_LIBRARY.length} ready-made templates, or draft one with AI. Every message uses the same layout as the emails the app sends.`} />
      <Composer ai={aiConfigured()} isOwner={staff.role === "OWNER"} myEmail={staff.email} custom={customTpls} history={hist} />
    </>
  );
}
