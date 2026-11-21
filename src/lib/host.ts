import { headers } from "next/headers";
import { prisma } from "./prisma";
import { cleanHost, isMainHost } from "./host-shared";

export function requestHost() {
  return cleanHost(headers().get("host"));
}

export function onCustomHost() {
  return !isMainHost(requestHost());
}

/** Finds the workspace a custom hostname belongs to. Verified domains only; `slug.localhost` and `slug.onboardops.org` also work. */
export async function workspaceForHost(host: string) {
  if (!host || isMainHost(host)) return null;
  if (host.endsWith(".localhost")) return prisma.workspace.findUnique({ where: { slug: host.slice(0, -".localhost".length) } });
  if (host.endsWith(".onboardops.org") && host !== "onboardops.org" && host !== "www.onboardops.org") {
    const sub = host.slice(0, -".onboardops.org".length);
    return prisma.workspace.findFirst({ where: { OR: [{ customDomain: host }, { slug: sub }] } });
  }
  return prisma.workspace.findFirst({ where: { customDomain: host, domainStatus: "VERIFIED" } });
}

/** Workspace id for the current request when it arrived on a custom domain, otherwise null. */
export async function hostWorkspaceId(): Promise<string | null> {
  const host = requestHost();
  if (isMainHost(host)) return null;
  return (await workspaceForHost(host))?.id ?? "__none__";
}
