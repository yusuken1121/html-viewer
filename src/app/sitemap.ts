import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"

/** Only the landing page — the documents are personal, not for crawlers. */
const PUBLIC_ROUTES = [PATH.HOME] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, APP_CONFIG.url).toString(),
    lastModified,
    changeFrequency: "weekly",
    priority: 1,
  }))
}
