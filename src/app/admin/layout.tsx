import { requireStaffPage, ALL_STAFF } from "@/lib/platform";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Staff console", template: "%s · Staff console" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaffPage(ALL_STAFF);
  const nav = [{ href: "/admin", label: "Dashboard" }, { href: "/admin/workspaces", label: "Workspaces" }];
  if (s.role !== "VIEWER") nav.push({ href: "/admin/inbox", label: "Support inbox" }, { href: "/admin/feedback", label: "Beta feedback" }, { href: "/admin/roadmap", label: "Public roadmap" }, { href: "/admin/status", label: "Status page" }, { href: "/admin/careers", label: "Careers" }, { href: "/?preview-update=1", label: "Preview update animation" }, { href: "/?preview-maintenance=1", label: "Preview maintenance screen" }, { href: "/admin/testimonials", label: "Testimonials" }, { href: "/admin/partners", label: "Partners" }, { href: "/admin/privacy", label: "Privacy requests" }, { href: "/admin/email", label: "Email log" }, { href: "/admin/activity", label: "Staff activity" });
  if (s.role === "OWNER") nav.push({ href: "/admin/staff", label: "Staff & roles" });
  return <AdminShell nav={nav} name={s.name} role={s.role} children={children} />;
}
