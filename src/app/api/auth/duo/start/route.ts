import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readMfaPending } from "@/lib/login";
import { prisma } from "@/lib/prisma";
import { enforceRate } from "@/lib/rate-limit";
import {
  DUO_COOKIE,
  DUO_TTL_SECONDS,
  duoAuthorizeUrl,
  duoHealthCheck,
  duoRedirectUri,
  getDuoRuntimeConfig,
  newDuoFlow,
  signDuoFlow,
} from "@/lib/duo";

export const dynamic = "force-dynamic";

/**
 * Starts Duo Security Universal Prompt verification for a user who has completed primary sign-in (oo_mfa pending cookie).
 */
export async function GET() {
  try {
    await enforceRate("duo-start", 20, 900);
  } catch {
    redirect("/login/2fa?duo_error=rate");
  }

  const pending = await readMfaPending();
  if (!pending) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: pending.u },
    select: { id: true, email: true },
  });
  if (!user) redirect("/login");

  let wsId = pending.ws ?? "";
  let ws = wsId
    ? await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, duoConfig: true } })
    : null;

  if (!ws) {
    // Fallback: inspect user's workspaces if workspaceId was not attached to the pending token
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, duoConfig: true } } },
      orderBy: { createdAt: "asc" },
    });
    const match = memberships.find((m) => getDuoRuntimeConfig(m.workspace)?.enabled);
    if (match) {
      ws = match.workspace;
      wsId = match.workspace.id;
    }
  }

  const cfg = getDuoRuntimeConfig(ws);
  if (!ws || !cfg || !cfg.enabled) {
    redirect("/login/2fa?duo_error=not_configured");
  }

  const health = await duoHealthCheck(cfg);
  if (!health.ok) {
    redirect("/login/2fa?duo_error=unreachable");
  }

  const flow = newDuoFlow(user.id, ws.id, user.email);
  cookies().set(DUO_COOKIE, await signDuoFlow(flow), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/duo",
    maxAge: DUO_TTL_SECONDS,
  });

  const authorizeUrl = await duoAuthorizeUrl(cfg, user.email, flow.state, duoRedirectUri());
  redirect(authorizeUrl);
}
