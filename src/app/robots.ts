import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"

/** A personal library: let a crawler see the door, not the shelves. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/docs/", "/settings"],
    },
    sitemap: `${APP_CONFIG.url}/sitemap.xml`,
  }
}
