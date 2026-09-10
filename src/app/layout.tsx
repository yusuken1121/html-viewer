import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { APP_CONFIG } from "@/constants/app-config"
import { NONCE_HEADER } from "@/constants/http"
import ReactQueryProvider from "@/providers/query-client-provider"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.name,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  metadataBase: new URL(APP_CONFIG.url),
  openGraph: {
    type: "website",
    siteName: APP_CONFIG.name,
    title: APP_CONFIG.name,
    description: APP_CONFIG.description,
    url: APP_CONFIG.url,
  },
  twitter: { card: "summary_large_image" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

/**
 * Root layout — document shell and providers only.
 *
 * The application chrome (sidebar, header) lives in the `(app)` route group so
 * that `(auth)` pages can render full-screen without it.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /**
   * Set by `src/middleware.ts`.
   *
   * Next applies it to its own scripts automatically, because middleware puts
   * the CSP on the *request* headers. It is passed to ThemeProvider by hand:
   * next-themes injects an inline script to set the theme class before first
   * paint, and a strict-dynamic CSP blocks it otherwise.
   *
   * Do NOT put it on <body>. The browser hides the nonce attribute from the
   * DOM after parsing, so the client would see an attribute the server sent
   * and the browser removed — a hydration mismatch on every page.
   */
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            {children}
            <Toaster />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
