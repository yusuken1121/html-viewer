import Link from "next/link"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"

/** Full-screen shell for unauthenticated pages — no sidebar, no header. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Link href={PATH.HOME} className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white shadow-md">
          {APP_CONFIG.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-lg font-bold tracking-tight">
          {APP_CONFIG.name}
        </span>
      </Link>

      {children}
    </main>
  )
}
