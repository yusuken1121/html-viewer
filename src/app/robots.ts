import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Everything behind the auth wall is private; only public pages are listed.
      allow: "/",
      disallow: [
        "/api/",
        "/settings",
        "/audit",
        "/billing",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${APP_CONFIG.url}/sitemap.xml`,
  }
}
