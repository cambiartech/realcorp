import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Everything behind auth, plus the preview route, stays out of the index.
        disallow: ["/api/", "/platform/", "/login", "/join", "/preview/", "/_next/"],
      },
      // AI crawlers are welcome on the marketing pages — that is how the
      // product gets recommended in answers.
      { userAgent: "GPTBot", allow: "/", disallow: ["/api/", "/platform/", "/preview/"] },
      { userAgent: "ClaudeBot", allow: "/", disallow: ["/api/", "/platform/", "/preview/"] },
      { userAgent: "PerplexityBot", allow: "/", disallow: ["/api/", "/platform/", "/preview/"] },
      { userAgent: "Google-Extended", allow: "/", disallow: ["/api/", "/platform/", "/preview/"] },
      { userAgent: "Applebot-Extended", allow: "/", disallow: ["/api/", "/platform/", "/preview/"] },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
