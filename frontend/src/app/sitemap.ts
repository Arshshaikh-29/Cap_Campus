import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://cap-campus.vercel.app";
  const now = new Date();
  const routes = [
    { path: "", priority: 1.0 },
    { path: "/option-form", priority: 0.9 },
    { path: "/what-if", priority: 0.9 },
    { path: "/cap-guide", priority: 0.85 },
    { path: "/rank-calculator", priority: 0.85 },
    { path: "/explorer", priority: 0.85 },
    { path: "/compare", priority: 0.8 },
    { path: "/analytics", priority: 0.8 },
    { path: "/pricing", priority: 0.8 },
    { path: "/about", priority: 0.7 },
  ];

  return routes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: r.priority,
  }));
}
