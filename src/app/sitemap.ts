import type { MetadataRoute } from "next";
import { SITE, legalPages } from "@/lib/site";
import { articles } from "@/lib/docs";
import { posts } from "@/lib/blog";
import { playbooks } from "@/lib/playbooks";
import { guides } from "@/lib/migrate";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const issues = await prisma.newsletterPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, take: 500 }).catch(() => []);
  const pages = ["", "/why", "/features", "/solutions", "/security", "/pricing", "/changelog", "/newsletter", "/blog", "/roadmap", "/tools", "/tools/write-up-helper", "/tools/should-i-write-this-up", "/tools/policy-builder", "/tools/discipline-ladder", "/tools/handbook-outline", "/playbooks", "/migrate", "/launch", "/tutorial","/careers", "/partners", "/brand", "/verify", "/support", "/faq", "/about", "/contact", "/legal", "/login", "/register"];
  return [
    ...pages.map((p) => ({ url: `${SITE.url}${p}`, lastModified: now })),
    ...legalPages.map((l) => ({ url: `${SITE.url}${l.href}`, lastModified: now })),
    ...playbooks.map((p) => ({ url: `${SITE.url}/playbooks/${p.slug}`, lastModified: now })),
    ...guides.map((g) => ({ url: `${SITE.url}/migrate/${g.slug}`, lastModified: now })),
    ...posts.map((p) => ({ url: `${SITE.url}/blog/${p.slug}`, lastModified: new Date(p.date) })),
    ...issues.map((i) => ({ url: `${SITE.url}/newsletter/${i.slug}`, lastModified: i.updatedAt })),
    ...articles.map((a) => ({ url: `${SITE.url}/support/${a.slug}`, lastModified: now })),
  ];
}
