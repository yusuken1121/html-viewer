import { ImageResponse } from "next/og"
import { APP_CONFIG } from "@/constants/app-config"

export const alt = APP_CONFIG.name
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Default social preview, rendered at build time by Satori.
 *
 * Only system fonts are used, so the build needs no network access. To use a
 * custom face, `fetch` the .ttf and pass it in `fonts` — see the next/og docs.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
        padding: 96,
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 30,
          color: "#a5b4fc",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)",
            fontSize: 36,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {APP_CONFIG.name.charAt(0).toUpperCase()}
        </div>
        <span>{new URL(APP_CONFIG.url).host}</span>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {APP_CONFIG.name}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: "#cbd5e1",
          lineHeight: 1.4,
        }}
      >
        {APP_CONFIG.description}
      </div>
    </div>,
    size,
  )
}
