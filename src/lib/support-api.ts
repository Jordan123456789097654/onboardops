import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { enforceRate } from "./rate-limit";
import { getSupportConfig, saveSupportConfig, type ApiKeyMeta } from "./support-config";
import { refOf } from "./support";
import type { SupportRequest } from "@prisma/client";

export const apiError = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Checks the bearer key against the stored hashes. Returns the key's metadata, or a ready-made error response. */
export async function authSupportApi(req: Request): Promise<{ key: ApiKeyMeta } | { res: NextResponse }> {
  try {
    await enforceRate("support-api", 120, 60);
  } catch {
    return { res: apiError("Too many requests", 429) };
  }
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(oo_support_[A-Za-z0-9_-]{20,80})$/);
  if (!m) return { res: apiError("Missing or malformed API key", 401) };
  const hash = Buffer.from(createHash("sha256").update(m[1]).digest("hex"));
  const cfg = await getSupportConfig();
  const key = cfg.apiKeys.find((k) => {
    const h = Buffer.from(k.hash);
    return h.length === hash.length && timingSafeEqual(h, hash);
  });
  if (!key) return { res: apiError("Invalid API key", 401) };
  const last = key.lastUsedAt ? Date.parse(key.lastUsedAt) : 0;
  if (Date.now() - last > 3600_000) {
    await saveSupportConfig({ apiKeys: cfg.apiKeys.map((k) => (k.id === key.id ? { ...k, lastUsedAt: new Date().toISOString() } : k)) }).catch(() => {});
  }
  return { key };
}

export function ticketJson(t: SupportRequest, excerpt = 240) {
  return {
    id: t.id,
    ref: refOf(t.id),
    name: t.name,
    email: t.email,
    topic: t.topic,
    status: t.status,
    priority: t.priority,
    tags: t.tags,
    category: t.category,
    sentiment: t.sentiment,
    assignee: t.assignee,
    inbox: t.inbox,
    source: t.source,
    rating: t.rating,
    linkedIds: t.linkedIds,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    solvedAt: t.solvedAt?.toISOString() ?? null,
    excerpt: t.message.slice(0, excerpt),
  };
}
