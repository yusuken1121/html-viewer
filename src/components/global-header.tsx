"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PATH } from "@/constants/path"
import { SIDEBAR_CONFIG } from "@/constants/sidebar"
import { isPathActive } from "@/lib/navigation"

/**
 * Resolves the breadcrumb label from the sidebar config.
 * Entries without a `path` (actions such as Logout) are skipped — matching
 * them would otherwise label every unknown route with the last action.
 */
function getPageTitle(pathname: string): string {
  const match = Object.values(SIDEBAR_CONFIG).find(
    (item) => item.path && isPathActive(pathname, item.path),
  )

  return match?.label ?? "Page"
}

export function GlobalHeader() {
  const pathname = usePathname()
  const isHome = pathname === PATH.HOME

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href={PATH.HOME}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          {!isHome && (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{getPageTitle(pathname)}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
