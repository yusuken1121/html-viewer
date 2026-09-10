import { Mail, MessageSquare, Settings } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PATH } from "@/constants/path"

export const MENU_KEYS = {
  CHAT: "chat",
  CONTACT: "contact",
  SETTINGS: "settings",
} as const

export type MenuKey = (typeof MENU_KEYS)[keyof typeof MENU_KEYS]

/** Actions the sidebar can perform instead of navigating. */
export type SidebarAction = never

export interface SidebarItemConfig {
  label: string
  path?: string
  action?: SidebarAction
  icon: LucideIcon
  /** Tailwind text color applied while the route is active. */
  activeColor?: string
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
}

export const mainSidebar: MenuKey[] = [MENU_KEYS.CHAT, MENU_KEYS.CONTACT]
export const manageSidebar: MenuKey[] = [MENU_KEYS.SETTINGS]
export const adminSidebar: MenuKey[] = []
export const footerSidebar: MenuKey[] = []
