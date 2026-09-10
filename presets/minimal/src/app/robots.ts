import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings"],
    },
    sitemap: `${APP_CONFIG.url}/sitemap.xml`,
  }
}
