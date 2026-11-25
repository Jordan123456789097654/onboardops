import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our team", description: "The people building OnboardOps.", alternates: { canonical: "/team" } };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default async function Team() {
  const [page, members] = await Promise.all([
    prisma.teamPage.findUnique({ where: { id: "team" } }).catch(() => null),
    prisma.teamMember.findMany({ where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, role: true, bio: true, linkUrl: true, photoMime: true, updatedAt: true } }).catch(() => []),
  ]);
  return (
    <PageShell eyebrow="About" title={page?.title || "Our team"} intro={page?.intro || undefined}>
      {members.length === 0 ? (
        <p className="text-[15px] text-soft">We are a small team in Georgia. More about us is coming soon.</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m.id} className="card p-5">
              {m.photoMime ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/team-photo/${m.id}?v=${m.updatedAt.getTime()}`} alt="" width={96} height={96} className="h-24 w-24 rounded-full border border-line object-cover" />
              ) : (
                <div aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full border border-line bg-muted text-2xl font-semibold text-soft">{initials(m.name)}</div>
              )}
              <h2 className="mt-4 text-lg font-semibold">{m.name}</h2>
              {m.role && <p className="text-[13.5px] text-soft">{m.role}</p>}
              {m.bio && (
                <div className="mt-3 space-y-2 text-[14px] text-soft">
                  {m.bio.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
              {m.linkUrl && <a className="mt-3 inline-block text-[13px] text-accent underline" href={m.linkUrl} target="_blank" rel="noopener noreferrer">Profile</a>}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
