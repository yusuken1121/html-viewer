"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { User } from "@/core/domain/user.entity"
import { APP_CONFIG } from "@/constants/app-config"
import { PATH } from "@/constants/path"
import {
  SIDEBAR_CONFIG,
  adminSidebar,
  footerSidebar,
  mainSidebar,
  manageSidebar,
  type MenuKey,
  type SidebarAction,
  type SidebarItemConfig,
} from "@/constants/sidebar"
import { isPathActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type SidebarUser = Pick<User, "id" | "email" | "name" | "role"> | null

const ACTIONS: Record<SidebarAction, () => void> = {
  "sign-out": () => void signOut({ callbackUrl: PATH.SIGN_IN }),
}

function SidebarNavItem({
  item,
  isActive,
}: {
  item: SidebarItemConfig
  isActive: boolean
}) {
  const Icon = item.icon

  const icon = (
    <Icon
      className={cn(
        "h-5 w-5 transition-colors",
        isActive
          ? (item.activeColor ?? "text-foreground")
          : "text-muted-foreground",
      )}
    />
  )

  const label = (
    <span
      className={cn(
        "font-medium",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {item.label}
    </span>
  )

  if (!item.path) {
    return (
      <SidebarMenuButton
        onClick={item.action ? ACTIONS[item.action] : undefined}
        className="h-10 cursor-pointer transition-all duration-200 ease-in-out hover:translate-x-1 hover:bg-sidebar-accent/50"
      >
        <div className="flex items-center gap-3">
          {icon}
          {label}
        </div>
      </SidebarMenuButton>
    )
  }

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        "h-10 transition-all duration-200 ease-in-out",
        isActive
          ? "bg-sidebar-accent shadow-sm"
          : "hover:translate-x-1 hover:bg-sidebar-accent/50",
      )}
    >
      <Link href={item.path} className="flex items-center gap-3">
        {icon}
        {label}
        {isActive && item.activeColor && (
          <div
            className={cn(
              "ml-auto h-1.5 w-1.5 rounded-full",
              item.activeColor.replace("text-", "bg-"),
            )}
          />
        )}
      </Link>
    </SidebarMenuButton>
  )
}

function SidebarNavGroup({
  label,
  keys,
  pathname,
  user,
  className,
}: {
  label?: string
  keys: MenuKey[]
  pathname: string
  user: SidebarUser
  className?: string
}) {
  const visible = keys.filter((key) => {
    const item = SIDEBAR_CONFIG[key]
    if (!item.path && !item.action) return false
    if (!item.roles) return true
    return user !== null && item.roles.includes(user.role)
  })

  if (!visible.length) return null

  const menu = (
    <SidebarMenu className="space-y-1">
      {visible.map((key) => {
        const item = SIDEBAR_CONFIG[key]
        return (
          <SidebarMenuItem key={key}>
            <SidebarNavItem
              item={item}
              isActive={!!item.path && isPathActive(pathname, item.path)}
            />
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )

  if (!label) return menu

  return (
    <SidebarGroup className={className}>
      {/* Full-strength muted-foreground: at 12px, the /70 tint this started
          with measured 2.83:1, well under the 4.5:1 WCAG AA minimum. */}
      <SidebarGroupLabel className="mb-2 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>{menu}</SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="border-b border-sidebar-border/50 p-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white shadow-md">
            {APP_CONFIG.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="text-lg font-bold tracking-tight">
              {APP_CONFIG.name}
            </span>
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              {APP_CONFIG.description}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarNavGroup
          label="Create"
          keys={mainSidebar}
          pathname={pathname}
          user={user}
        />
        <SidebarNavGroup
          label="Manage"
          keys={manageSidebar}
          pathname={pathname}
          user={user}
          className="mt-4"
        />
        <SidebarNavGroup
          label="Admin"
          keys={adminSidebar}
          pathname={pathname}
          user={user}
          className="mt-4"
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="mb-2">
          <SidebarNavGroup
            keys={footerSidebar}
            pathname={pathname}
            user={user}
          />
        </div>

        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
              <span className="text-xs font-bold">
                {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium">{user?.name ?? "Guest"}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user?.email ?? "Not signed in"}
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
