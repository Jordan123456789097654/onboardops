import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveMembership } from "@/lib/auth";
import { Brand, ThemeToggle } from "@/components/ui";
import { Account } from "./account";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [extras, m] = await Promise.all([prisma.userEmail.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }), getActiveMembership()]);
  const back = m && !m.support ? (m.role === "EMPLOYEE" ? "/app/my-portal" : "/app/overview") : "/workplaces";
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-4">
      <div className="flex items-center justify-between"><Link href="/" aria-label="OnboardOps home"><Brand /></Link><ThemeToggle /></div>
      <div className="py-8">
        <Link href={back} className="inline-flex items-center gap-1 text-[13px] text-soft hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">Account settings</h1>
        <p className="mt-1 text-[13px] text-soft">Your profile, sign-in details and email addresses. These follow you across every workplace.</p>
        <Account
          me={{ id: user.id, name: user.name, nickname: user.nickname ?? "", email: user.email, verified: !!user.emailVerifiedAt, avatarUrl: user.avatarUrl, hasPassword: !!user.passwordSetAt, createdAt: user.createdAt.toISOString() }}
          extras={extras.map((e) => ({ id: e.id, email: e.email, verified: !!e.verifiedAt }))}
        />
      </div>
    </div>
  );
}
