import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/docs", "/privacy"].map((path) => ({
    url: `https://campus-radar-umich.aswelltoo.chatgpt.site${path}`,
    lastModified: "2026-10-14",
    changeFrequency: "weekly",
  }));
}
