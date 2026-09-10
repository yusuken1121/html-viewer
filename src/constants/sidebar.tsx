import {
  CreditCard,
  LogOutIcon,
  Mail,
  MessageSquare,
  ScrollText,
  Settings,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { UserRole } from "@/core/domain/user.entity"
import { PATH } from "@/constants/path"

export const MENU_KEYS = {
  CHAT: "chat",
  CONTACT: "contact",
  SETTINGS: "settings",
  BILLING: "billing",
  AUDIT: "audit",
  LOGOUT: "logout",
} as const

export type MenuKey = (typeof MENU_KEYS)[keyof typeof MENU_KEYS]

/**
 * Actions the sidebar can perform instead of navigating.
 *
 * A string tag rather than a callback: this module is imported by Server
 * Components, so it must not pull in `next-auth/react`. `AppSidebar` maps the
 * tag to the client-side handler.
 */
export type SidebarAction = "sign-out"

export interface SidebarItemConfig {
  label: string
  /** A navigable route. Mutually exclusive with `action`. */
  path?: string
  action?: SidebarAction
  icon: LucideIcon
  /** Tailwind text color applied while the route is active. */
  activeColor?: string
  /** Omit to show for everyone. */
  roles?: readonly UserRole[]
}

export const SIDEBAR_CONFIG: Record<MenuKey, SidebarItemConfig> = {
  [MENU_KEYS.CHAT]: {
    label: "Chat",
    path: PATH.HOME,
    icon: MessageSquare,
    activeColor: "text-blue-600 dark:text-blue-400",
  },
  [MENU_KEYS.CONTACT]: {
    label: "Contact",
    path: PATH.CONTACT,
    icon: Mail,
    activeColor: "text-green-600 dark:text-green-400",
  },
  [MENU_KEYS.SETTINGS]: {
    label: "Settings",
    path: PATH.SETTINGS,
    icon: Settings,
  },
  [MENU_KEYS.BILLING]: {
    label: "Billing",
    path: PATH.BILLING,
    icon: CreditCard,
    activeColor: "text-violet-600 dark:text-violet-400",
  },
  [MENU_KEYS.AUDIT]: {
    label: "Audit log",
    path: PATH.AUDIT,
    icon: ScrollText,
    activeColor: "text-amber-600 dark:text-amber-400",
    roles: ["admin"],
  },
  [MENU_KEYS.LOGOUT]: {
    label: "Sign out",
    icon: LogOutIcon,
    action: "sign-out",
  },
}

export const mainSidebar: MenuKey[] = [MENU_KEYS.CHAT, MENU_KEYS.CONTACT]
export const manageSidebar: MenuKey[] = [MENU_KEYS.BILLING, MENU_KEYS.SETTINGS]
/** Items here are filtered by `roles` — see SidebarItemConfig. */
export const adminSidebar: MenuKey[] = [MENU_KEYS.AUDIT]
export const footerSidebar: MenuKey[] = [MENU_KEYS.LOGOUT]
