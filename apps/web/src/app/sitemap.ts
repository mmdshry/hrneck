import type { MetadataRoute } from "next";
import { listGuides, guideHref } from "@/lib/guides/registry";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrneck.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const guideEntries = listGuides().map((guide) => ({
    url: `${siteUrl}${guideHref(guide.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...guideEntries,
  ];
}
