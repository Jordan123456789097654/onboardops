import { headers } from "next/headers";
import { prisma } from "./prisma";
import { cleanHost, isMainHost } from "./host-shared";
import { ZONE } from "./spaceship-dns";

export function requestHost() {
  const h = headers();
  return cleanHost(h.get("x-forwarded-host") || h.get("host"));
}

export function onCustomHost() {
  return !isMainHost(requestHost());
}

/** Finds the workspace a custom hostname belongs to. `slug.localhost` also works for local testing. */
export async function workspaceForHost(host: string) {
  if (!host || isMainHost(host)) return null;
  if (host.endsWith(".localhost")) return prisma.workspace.findUnique({ where: { slug: host.slice(0, -".localhost".length) } });
  if (host.endsWith(`.${ZONE}`)) {
    const sub = host.slice(0, -`.${ZONE}`.length);
    const bySub = sub && !sub.includes(".") ? await prisma.workspace.findUnique({ where: { subdomain: sub } }) : null;
    if (bySub) return bySub;
  }
  return prisma.workspace.findFirst({ where: { customDomain: { equals: host, mode: "insensitive" } } });
}

/** Workspace id for the current request when it arrived on a custom domain, otherwise null. */
export async function hostWorkspaceId(): Promise<string | null> {
  const host = requestHost();
  if (isMainHost(host)) return null;
  return (await workspaceForHost(host))?.id ?? "__none__";
}
