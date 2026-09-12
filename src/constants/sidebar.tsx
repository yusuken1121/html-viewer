import { Library, Settings, Upload } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PATH } from "@/constants/path"

export const MENU_KEYS = {
  LIBRARY: "library",
  UPLOAD: "upload",
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
  [MENU_KEYS.LIBRARY]: {
    label: "ライブラリ",
    path: PATH.HOME,
    icon: Library,
    activeColor: "text-blue-600 dark:text-blue-400",
  },
  [MENU_KEYS.UPLOAD]: {
    label: "アップロード",
    path: PATH.UPLOAD,
    icon: Upload,
    activeColor: "text-emerald-600 dark:text-emerald-400",
  },
  [MENU_KEYS.SETTINGS]: {
    label: "設定",
    path: PATH.SETTINGS,
    icon: Settings,
  },
}

export const mainSidebar: MenuKey[] = [MENU_KEYS.LIBRARY, MENU_KEYS.UPLOAD]
export const manageSidebar: MenuKey[] = [MENU_KEYS.SETTINGS]
export const adminSidebar: MenuKey[] = []
export const footerSidebar: MenuKey[] = []
