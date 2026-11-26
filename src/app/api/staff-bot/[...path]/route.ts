import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { actorFor, authBot, noLink } from "@/lib/staff-bot";
import type { PlatformRole } from "@/lib/platform-role";
import type { Staff } from "@/lib/platform";
import { claimTicketCore, replyTicketCore, solveTicketCore, suspendWorkspaceCore, unsuspendWorkspaceCore } from "@/lib/staff-ops";
import { banUserCore, decideAppealCore, decideBanRequestCore, lookupUserCore, requestBanCore, unbanUserCore, warnUserCore } from "@/lib/moderation-core";
import { saveMaintenanceState } from "@/lib/maintenance";
import { reconcileMaintenance } from "@/lib/betterstack";
import { staffAudit } from "@/lib/platform";
import { postDiscord } from "@/lib/discord-events";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const appUrl = () => (process.env.APP_URL || "https://onboardops.org").trim().replace(/^["']+|["']+$/g, "").replace(/\/$/, "");
const refOf = (id: string) => id.slice(-8).toUpperCase();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const SUPPORT: PlatformRole[] = ["OWNER", "SUPPORT"];
const OWNER: PlatformRole[] = ["OWNER"];
const reason = z.string().trim().min(10, "Give a reason (10+ characters).").max(500);
const emailField = z.string().trim().toLowerCase().email();

class Denied extends Error {}

async function ticketByRef(ref: string) {
  const r = (ref ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(r)) throw new Error("A ticket reference is 8 letters and numbers.");
  const t = await prisma.supportRequest.findFirst({ where: { id: { endsWith: r.toLowerCase() } } });
  if (!t) throw new Error("No ticket with that reference.");
  return t;
}

const summary = (t: { id: string; status: string; priority: string; assignee: string | null; topic: string; source: string; createdAt: Date }) => ({
  ref: refOf(t.id), id: t.id, status: t.status, priority: t.priority, assignee: t.assignee, topic: t.topic, source: t.source, createdAt: t.createdAt.toISOString(), url: `${appUrl()}/admin/inbox?open=${t.id}`,
});

async function userIdByEmail(email: string): Promise<string> {
  const e = emailField.parse(email);
  const u = await prisma.user.findFirst({ where: { OR: [{ email: e }, { extraEmails: { some: { email: e } } }] }, select: { id: true } });
  if (!u) throw new Error("No account with that email.");
  return u.id;
}

async function handle(req: Request, path: string[], method: "GET" | "POST"): Promise<Response> {
  const route = path.join("/");
  const system = route.startsWith("ops/signals") || route.startsWith("ops/digest") || route.startsWith("ops/tickets");
  const a = await authBot(req, { needsUser: !system });
  if (!a.ok) return a.res;

  /* System calls: no person is acting, only the bot's own schedule. Counts only. */
  if (method === "GET" && route === "ops/signals") {
    let database = true;
    try { await prisma.$queryRaw`SELECT 1`; } catch { database = false; }
    const hours = Math.min(Math.max(Number(new URL(req.url).searchParams.get("staleHours") ?? 24) || 24, 1), 720);
    const [failedEmails, newAccounts, open, stale, solvedToday, newToday] = await Promise.all([
      prisma.emailLog.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 3600_000) } } }).catch(() => 0),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 3600_000) } } }).catch(() => 0),
      prisma.supportRequest.count({ where: { status: { not: "SOLVED" }, mergedIntoId: null } }).catch(() => 0),
      prisma.supportRequest.findMany({ where: { status: { not: "SOLVED" }, mergedIntoId: null, createdAt: { lt: new Date(Date.now() - hours * 3600_000) } }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true, status: true, priority: true, assignee: true, topic: true, source: true, createdAt: true } }).catch(() => []),
      prisma.supportRequest.count({ where: { solvedAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => 0),
      prisma.supportRequest.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => 0),
    ]);
    return json({ database, failedEmailsLastHour: failedEmails, newAccountsLastHour: newAccounts, openTickets: open, solvedLast24h: solvedToday, newLast24h: newToday, stale: stale.map((t) => ({ ...summary(t), ageHours: Math.round((Date.now() - t.createdAt.getTime()) / 3600_000) })) });
  }
  if (method === "GET" && route === "ops/digest") {
    const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days") ?? 7) || 7, 1), 31);
    const since = new Date(Date.now() - days * 86400_000);
    const [accounts, workspaces, tickets, solved, subscribers, issues] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.workspace.count({ where: { createdAt: { gte: since } } }),
      prisma.supportRequest.count({ where: { createdAt: { gte: since } } }),
      prisma.supportRequest.count({ where: { solvedAt: { gte: since } } }),
      prisma.newsletterSubscriber.count({ where: { status: "ACTIVE", confirmedAt: { gte: since } } }).catch(() => 0),
      prisma.newsletterPost.count({ where: { status: "PUBLISHED", publishedAt: { gte: since } } }).catch(() => 0),
    ]);
    return json({ days, newAccounts: accounts, newWorkspaces: workspaces, ticketsOpened: tickets, ticketsSolved: solved, newSubscribers: subscribers, newsletterIssues: issues });
  }

  const body = method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const q = new URL(req.url).searchParams;

  /* Ticket threads: the bot opens one Discord thread per ticket. These carry references and topics only, never customer messages or emails. */
  if (route.startsWith("ops/tickets")) {
    if (method === "GET" && route === "ops/tickets/unthreaded") {
      const rows = await prisma.supportRequest.findMany({ where: { discordThreadId: null, status: { not: "SOLVED" }, mergedIntoId: null }, orderBy: { createdAt: "asc" }, take: 10 });
      return json({ tickets: rows.map((t) => ({ ...summary(t), security: t.topic === "Security report" })) });
    }
    if (method === "GET" && route === "ops/tickets/threaded") {
      const rows = await prisma.supportRequest.findMany({ where: { discordThreadId: { not: null }, status: { not: "SOLVED" }, mergedIntoId: null }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, status: true, discordThreadId: true, assignee: true } });
      return json({ tickets: rows.map((t) => ({ id: t.id, ref: refOf(t.id), status: t.status, threadId: t.discordThreadId, assignee: t.assignee })) });
    }
    if (method === "POST" && route === "ops/tickets/thread") {
      const d = z.object({ id: z.string().min(5), threadId: z.string().regex(/^\d{15,25}$/) }).parse(body);
      await prisma.supportRequest.update({ where: { id: d.id }, data: { discordThreadId: d.threadId } });
      return json({ ok: true });
    }
    return json({ error: "Unknown route" }, 404);
  }


  /* Everything below acts as a linked staff member, with that person's own role. */
  const staff: Staff | null = await actorFor(a.call.discordId!);
  if (!staff) return noLink();
  const need = (roles: PlatformRole[]) => { if (!roles.includes(staff.role)) throw new Denied("Your staff role doesn't allow that."); };

  try {
    /* ---- Support ---- */
    if (method === "GET" && route === "support/ticket") { need(SUPPORT); return json(summary(await ticketByRef(q.get("ref") ?? ""))); }
    if (method === "GET" && route === "support/mine") {
      need(SUPPORT);
      const rows = await prisma.supportRequest.findMany({ where: { assignee: staff.name, status: { not: "SOLVED" }, mergedIntoId: null }, orderBy: { createdAt: "asc" }, take: 15, select: { id: true, status: true, priority: true, assignee: true, topic: true, source: true, createdAt: true } });
      return json({ tickets: rows.map(summary) });
    }
    if (method === "GET" && route === "support/canned") {
      need(SUPPORT);
      const rows = await prisma.supportCanned.findMany({ orderBy: [{ grp: "asc" }, { title: "asc" }], take: 50, select: { id: true, title: true, body: true } });
      return json({ replies: rows });
    }
    if (method === "POST" && route === "support/claim") { need(SUPPORT); const d = z.object({ id: z.string().min(5) }).parse(body); await claimTicketCore(staff, d.id); return json({ ok: true }); }
    if (method === "POST" && route === "support/solve") {
      need(SUPPORT);
      const d = z.object({ id: z.string().optional(), ref: z.string().optional() }).parse(body);
      const t = d.id ? { id: d.id } : await ticketByRef(d.ref ?? "");
      await solveTicketCore(staff, t.id);
      return json({ ok: true, ref: refOf(t.id) });
    }
    if (method === "POST" && route === "support/reply") {
      need(SUPPORT);
      const d = z.object({ ref: z.string().optional(), threadId: z.string().regex(/^\d{15,25}$/).optional(), body: z.string().trim().min(2).max(4000), markSolved: z.boolean().default(false) }).parse(body);
      if (!d.ref && !d.threadId) throw new Error("Give a ticket reference or use this inside the ticket's thread.");
      const t = d.threadId
        ? await prisma.supportRequest.findUnique({ where: { discordThreadId: d.threadId } }).then((x) => x ?? (() => { throw new Error("This thread is not linked to a ticket."); })())
        : await ticketByRef(d.ref!);
      const r = await replyTicketCore(staff, t.id, { body: d.body, markSolved: d.markSolved, fromDiscord: true });
      return json({ ok: true, ref: refOf(t.id), emailed: r.emailed });
    }

    /* ---- Moderation ---- */
    if (method === "GET" && route === "moderation/lookup") { need(SUPPORT); return json(await lookupUserCore(emailField.parse(q.get("email") ?? ""))); }
    if (method === "POST" && route === "moderation/warn") { need(SUPPORT); const d = z.object({ email: z.string(), reason }).parse(body); await warnUserCore(staff, await userIdByEmail(d.email), d.reason); return json({ ok: true }); }
    if (method === "POST" && route === "moderation/ban") { need(OWNER); const d = z.object({ email: z.string(), reason }).parse(body); return json({ ok: true, ...(await requestBanCore(staff, await userIdByEmail(d.email), d.reason)) }); }
    if (method === "POST" && route === "moderation/unban") { need(OWNER); const d = z.object({ email: z.string(), reason }).parse(body); await unbanUserCore(staff, await userIdByEmail(d.email), d.reason); return json({ ok: true }); }
    if (method === "POST" && route === "moderation/banreq") { need(OWNER); const d = z.object({ id: z.string().min(5), approve: z.boolean() }).parse(body); await decideBanRequestCore(staff, d.id, d.approve); return json({ ok: true }); }
    if (method === "POST" && route === "moderation/appeal") {
      need(OWNER);
      const d = z.object({ id: z.string().min(5), overturn: z.boolean(), note: z.string().trim().min(10).max(500) }).parse(body);
      await decideAppealCore(staff, d.id, d.overturn, d.note);
      return json({ ok: true });
    }
    if (method === "POST" && route === "moderation/workspace") {
      need(OWNER);
      const d = z.object({ slug: z.string().trim().min(2).max(80), action: z.enum(["suspend", "reinstate"]), reason: z.string().trim().max(500).optional() }).parse(body);
      const ws = await prisma.workspace.findUnique({ where: { slug: d.slug }, select: { id: true, name: true, suspendedAt: true } });
      if (!ws) throw new Error("No workspace with that address.");
      if (d.action === "suspend") {
        if (ws.suspendedAt) throw new Error("That workspace is already suspended.");
        await suspendWorkspaceCore(staff, { workspaceId: ws.id, reason: reason.parse(d.reason ?? "") });
      } else {
        if (!ws.suspendedAt) throw new Error("That workspace isn't suspended.");
        await unsuspendWorkspaceCore(staff, ws.id);
      }
      await postDiscord("modlog", { title: `Workspace ${d.action === "suspend" ? "suspended" : "reinstated"}`, description: d.reason, fields: [{ name: "Workspace", value: ws.name }, { name: "By", value: staff.name }], tone: d.action === "suspend" ? "bad" : "good" });
      return json({ ok: true, name: ws.name });
    }

    /* ---- Operations ---- */
    if (method === "POST" && route === "ops/maintenance") {
      need(OWNER);
      const d = z.object({ enabled: z.boolean(), message: z.string().trim().max(500).optional() }).parse(body);
      const state = await saveMaintenanceState({ enabled: d.enabled, message: d.message, startsAt: null, endsAt: null, updatedBy: staff.name });
      await prisma.$transaction((tx) => staffAudit(tx, staff, { action: d.enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED", targetType: "Platform", targetId: "maintenance", summary: `Maintenance mode ${d.enabled ? "ENABLED" : "DISABLED"} from Discord` }));
      await reconcileMaintenance().catch(() => undefined);
      await postDiscord("status", { title: d.enabled ? "Maintenance mode is ON" : "Maintenance mode is off", description: d.enabled ? state.message : "The site is open again.", fields: [{ name: "By", value: staff.name }], tone: d.enabled ? "warn" : "good" });
      return json({ ok: true, enabled: d.enabled });
    }
  } catch (e) {
    if (e instanceof Denied) return json({ error: e.message }, 403);
    if (e instanceof z.ZodError) return json({ error: e.issues[0]?.message ?? "That input isn't valid." }, 400);
    return json({ error: e instanceof Error ? e.message : "Something went wrong." }, 400);
  }
  return json({ error: "Not found." }, 404);
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return handle(req, params.path ?? [], "GET");
}
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return handle(req, params.path ?? [], "POST");
}
