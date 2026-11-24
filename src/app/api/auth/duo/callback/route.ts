import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { clearMfaPending, landingFor, readMfaPending } from "@/lib/login";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import {
  DUO_COOKIE,
  duoExchangeCode,
  duoRedirectUri,
  duoStateMatches,
  getDuoRuntimeConfig,
  verifyDuoFlow,
} from "@/lib/duo";

export const dynamic = "force-dynamic";

/** Duo Universal Prompt OIDC callback. Every path ends in a redirect outside try/catch. */
export async function GET(req: Request) {
  redirect(await handle(req));
}

async function handle(req: Request): Promise<string> {
  const q = new URL(req.url).searchParams;
  const flow = await verifyDuoFlow(cookies().get(DUO_COOKIE)?.value);
  cookies().delete({ name: DUO_COOKIE, path: "/api/auth/duo" });

  const pending = await readMfaPending();
  if (!pending) return "/login";

  try {
    await enforceRate("duo-callback", 20, 900);
  } catch {
    return "/login/2fa?duo_error=rate";
  }

  if (!flow || flow.u !== pending.u || !duoStateMatches(q.get("state"), flow.state)) {
    return "/login/2fa?duo_error=state";
  }

  if (q.get("error")) {
    return "/login/2fa?duo_error=denied";
  }

  const code = (q.get("duo_code") ?? q.get("code") ?? "").trim();
  if (!code) {
    return "/login/2fa?duo_error=denied";
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: flow.ws },
    select: { id: true, duoConfig: true },
  });
  const cfg = getDuoRuntimeConfig(ws);
  if (!ws || !cfg || !cfg.enabled) {
    return "/login/2fa?duo_error=not_configured";
  }

  const exchanged = await duoExchangeCode(cfg, code, flow.username, duoRedirectUri());
  if (!exchanged.ok) {
    return "/login/2fa?duo_error=denied";
  }

  clearMfaPending();
  await createSession(pending.u);

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: pending.u } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (member) {
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        workspaceId: ws.id,
        actorMemberId: member.id,
        actorName: member.user.name,
        actionType: "DUO_MFA_VERIFIED",
        targetType: "User",
        targetId: pending.u,
        summary: `${member.user.name} verified two-factor sign-in via Duo Security${exchanged.factor ? ` (${exchanged.factor})` : ""}`,
      }),
    );
  }

  return landingFor(pending.u, pending.ws ?? ws.id, "/workplaces");
}
