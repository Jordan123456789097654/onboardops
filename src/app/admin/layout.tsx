import { prisma } from "@/lib/prisma";
import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { getOpenIncidents } from "@/lib/incidents";
import { AdminShell, type AdminNavGroup } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Staff console", template: "%s · Staff console" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaffPage(ALL_STAFF);
  const [openSupport, openPrivacy, incidents] = await Promise.all([
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, NOT: { topic: "Privacy request" } } }).catch(() => 0),
    prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, topic: "Privacy request" } }).catch(() => 0),
    getOpenIncidents().catch(() => []),
  ]);

  const groups: AdminNavGroup[] = [
    {
      heading: "Operations",
      items: [
        { href: "/admin", label: "Dashboard", icon: "dashboard" },
        ...(s.role !== "VIEWER"
          ? [{ href: "/admin/status", label: "Status & Incidents", icon: "status", badge: incidents.length, badgeTone: "danger" as const }]
          : []),
        { href: "/admin/analytics", label: "Growth analytics", icon: "analytics" },
        { href: "/admin/workspaces", label: "Workspaces", icon: "workspaces" },
      ],
    },
  ];

  if (s.role !== "VIEWER") {
    groups.push(
      {
        heading: "Support & Compliance",
        items: [
          { href: "/admin/inbox", label: "Support inbox", icon: "inbox", badge: openSupport, badgeTone: "warn" },
          { href: "/admin/support-analytics", label: "Support analytics", icon: "analytics" },
          { href: "/admin/support-settings", label: "Support settings", icon: "settings" },
          { href: "/admin/feedback", label: "Beta feedback", icon: "feedback" },
          { href: "/admin/moderation", label: "Moderation & appeals", icon: "privacy" },
          { href: "/admin/privacy", label: "Privacy requests", icon: "privacy", badge: openPrivacy, badgeTone: "warn" },
        ],
      },
      {
        heading: "Website & Growth",
        items: [
          { href: "/admin/content", label: "Content studio", icon: "content" },
          { href: "/admin/newsletter", label: "Newsletter", icon: "email" },
          { href: "/admin/team", label: "Edit team", icon: "team" },
          { href: "/admin/roadmap", label: "Public roadmap", icon: "roadmap" },
          { href: "/admin/testimonials", label: "Testimonials", icon: "testimonials" },
          { href: "/admin/partners", label: "Partners", icon: "partners" },
          { href: "/admin/careers", label: "Careers", icon: "careers" },
        ],
      },
      {
        heading: "System & Audit",
        items: [
          { href: "/admin/emails", label: "Emails", icon: "compose" },
          { href: "/admin/email", label: "Email log", icon: "email" },
          { href: "/admin/activity", label: "Staff activity", icon: "activity" },
          { href: "/admin/discord", label: "Link Discord", icon: "team" },
          ...(s.role === "OWNER" ? [{ href: "/admin/staff", label: "Staff & roles", icon: "staff" }] : []),
        ],
      },
      {
        heading: "Live Previews",
        items: [
          { href: "/?preview-outage=1", label: "Outage screen", icon: "preview", external: true },
          { href: "/?preview-maintenance=1", label: "Maintenance screen", icon: "preview", external: true },
          { href: "/?preview-update=1", label: "Update animation", icon: "preview", external: true },
        ],
      }
    );
  }

  return <AdminShell groups={groups} name={s.name} role={s.role}>{children}</AdminShell>;
}
