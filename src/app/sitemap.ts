import type { MetadataRoute } from "next";
import { SITE, legalPages } from "@/lib/site";
import { articles } from "@/lib/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = ["", "/why", "/features", "/solutions", "/security", "/pricing", "/changelog", "/support", "/faq", "/about", "/contact", "/legal", "/login", "/register"];
  return [
    ...pages.map((p) => ({ url: `${SITE.url}${p}`, lastModified: now })),
    ...legalPages.map((l) => ({ url: `${SITE.url}${l.href}`, lastModified: now })),
    ...articles.map((a) => ({ url: `${SITE.url}/support/${a.slug}`, lastModified: now })),
  ];
}
