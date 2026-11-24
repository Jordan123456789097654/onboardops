import { redirect } from "next/navigation";
import { DUO_ERRORS, isDuoEnabled } from "@/lib/duo";
import { readMfaPending } from "@/lib/login";
import { prisma } from "@/lib/prisma";
import { MfaLogin } from "./mfa-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-factor sign-in", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: { duo_error?: string } }) {
  const p = await readMfaPending();
  if (!p) redirect("/login");
  if (p.enroll) redirect("/login/2fa/setup");

  const [user, ws] = await Promise.all([
    prisma.user.findUnique({ where: { id: p.u }, select: { totpEnabledAt: true } }),
    p.ws ? prisma.workspace.findUnique({ where: { id: p.ws }, select: { duoConfig: true } }) : Promise.resolve(null),
  ]);

  let duoEnabled = isDuoEnabled(ws);
  if (!duoEnabled && !p.ws) {
    const ms = await prisma.workspaceMember.findMany({
      where: { userId: p.u },
      include: { workspace: { select: { duoConfig: true } } },
    });
    duoEnabled = ms.some((m) => isDuoEnabled(m.workspace));
  }

  const duoError = searchParams.duo_error
    ? DUO_ERRORS[searchParams.duo_error] ?? DUO_ERRORS.failed
    : undefined;

  return <MfaLogin duoEnabled={duoEnabled} hasTotp={!!user?.totpEnabledAt} duoError={duoError} />;
}
