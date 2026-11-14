import type { MetadataRoute } from "next"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"

/**
 * Makes the app installable — "ホーム画面に追加" opens it full screen, like
 * an app, rather than in a browser tab. Served at /manifest.webmanifest and
 * linked from every page by Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_CONFIG.name,
    short_name: APP_CONFIG.name.slice(0, 12),
    description: APP_CONFIG.description,
    lang: "ja",
    start_url: PATH.HOME,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the home-screen icon to jump straight to a collection.
    shortcuts: [
      { name: "ニュース", url: PATH.NEWS },
      { name: "英語", url: PATH.ENGLISH },
      { name: "世界史", url: PATH.HISTORY },
      { name: "アップロード", url: PATH.UPLOAD },
    ],
  }
}
