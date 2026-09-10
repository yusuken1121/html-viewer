import { AppSidebar } from "@/components/app-sidebar"
import { GlobalHeader } from "@/components/global-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getCurrentUser } from "@/features/auth/session"

/**
 * Signed-in application shell.
 * `middleware.ts` has already redirected anonymous visitors to /sign-in, so
 * `user` is present in practice; the null branch keeps the type honest.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser()

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <GlobalHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
