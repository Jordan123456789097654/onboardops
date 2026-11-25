import { prisma } from "@/lib/prisma";
import { requireStaffPage, SUPPORT_STAFF } from "@/lib/platform";
import { PageHeader } from "@/components/ui";
import { TeamAdmin } from "./team-admin";

export const metadata = { title: "Edit team" };
export const dynamic = "force-dynamic";

export default async function AdminTeam() {
  const staff = await requireStaffPage(SUPPORT_STAFF);
  const [page, rows] = await Promise.all([
    prisma.teamPage.findUnique({ where: { id: "team" } }).catch(() => undefined),
    prisma.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, role: true, bio: true, linkUrl: true, visible: true, photoMime: true, updatedAt: true } }).catch(() => null),
  ]);
  return (
    <>
      <PageHeader title="Edit team" sub="The people on the public Our team page. Everything here is editable: the page heading and intro, and each person's name, role, bio, photo, link, order and visibility. Hidden people are not shown on the site." />
      {rows === null ? (
        <div className="card border-amber-400/50 bg-amber-500/5 p-4 text-[13px]"><b>The team tables are not in the database yet.</b> Run <span className="mono">npx prisma db push</span> against the production database, then reload.</div>
      ) : (
        <TeamAdmin
          canEdit={staff.role === "OWNER"}
          title={page?.title ?? "Our team"}
          intro={page?.intro ?? ""}
          items={rows.map((r) => ({ id: r.id, name: r.name, role: r.role, bio: r.bio, linkUrl: r.linkUrl, visible: r.visible, photoUrl: r.photoMime ? `/api/team-photo/${r.id}?v=${r.updatedAt.getTime()}` : null }))}
        />
      )}
    </>
  );
}
