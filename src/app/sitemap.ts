import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"

/** Add a route here when it becomes publicly reachable. */
const PUBLIC_ROUTES = [PATH.HOME, PATH.CONTACT] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, APP_CONFIG.url).toString(),
    lastModified,
    changeFrequency: "weekly",
    priority: route === PATH.HOME ? 1 : 0.7,
  }))
}
