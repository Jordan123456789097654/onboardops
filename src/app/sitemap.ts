import type { MetadataRoute } from "next";
import { SITE, legalPages } from "@/lib/site";
import { articles } from "@/lib/docs";
import { posts } from "@/lib/blog";
import { playbooks } from "@/lib/playbooks";
import { guides } from "@/lib/migrate";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = ["", "/why", "/features", "/solutions", "/security", "/pricing", "/changelog", "/blog", "/roadmap", "/tools", "/tools/write-up-helper", "/tools/should-i-write-this-up", "/tools/policy-builder", "/tools/discipline-ladder", "/tools/handbook-outline", "/playbooks", "/migrate", "/launch", "/careers", "/partners", "/brand", "/verify", "/support", "/faq", "/about", "/contact", "/legal", "/login", "/register"];
  return [
    ...pages.map((p) => ({ url: `${SITE.url}${p}`, lastModified: now })),
    ...legalPages.map((l) => ({ url: `${SITE.url}${l.href}`, lastModified: now })),
    ...playbooks.map((p) => ({ url: `${SITE.url}/playbooks/${p.slug}`, lastModified: now })),
    ...guides.map((g) => ({ url: `${SITE.url}/migrate/${g.slug}`, lastModified: now })),
    ...posts.map((p) => ({ url: `${SITE.url}/blog/${p.slug}`, lastModified: new Date(p.date) })),
    ...articles.map((a) => ({ url: `${SITE.url}/support/${a.slug}`, lastModified: now })),
  ];
}
