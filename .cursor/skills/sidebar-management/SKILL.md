---
name: sidebar-management
description: >-
  How to add or modify sidebar menu items via path and menu config files. Use
  when adding a new route that should appear in the app sidebar.
---

# Sidebar Management

The sidebar is driven by config files — no hardcoded menu items in components.
`GlobalHeader` reads the same config for its breadcrumb label, so one edit updates both.

## Steps

### 1. Define the route

Add a constant in `src/constants/path.ts`:

```typescript
export const PATH = {
  // ...
  NEW_FEATURE: "/new-feature",
} as const
```

### 2. Register the menu item

In `src/constants/sidebar.tsx`:

- Add a key to `MENU_KEYS`
- Add label, icon, and path to `SIDEBAR_CONFIG`

```typescript
import { Star } from "lucide-react"

export const SIDEBAR_CONFIG: Record<MenuKey, SidebarItemConfig> = {
  // ...
  [MENU_KEYS.NEW_FEATURE]: {
    label: "New Feature",
    path: PATH.NEW_FEATURE,
    icon: Star, // the component itself, not <Star />
    activeColor: "text-amber-600 dark:text-amber-400",
  },
}
```

`icon` is a `LucideIcon` **component reference**. `AppSidebar` renders it and applies
the active/inactive color itself — do not pass an element or a `className`.

For an action instead of a link, set `action` and omit `path`:

```typescript
[MENU_KEYS.LOGOUT]: { label: "Sign out", icon: LogOutIcon, action: "sign-out" },
```

A **string tag, not a callback**: this module is imported by Server Components,
so it must not pull in `next-auth/react`. `AppSidebar` maps the tag to the
client-side handler in its `ACTIONS` record — add a case there for a new action.

To restrict an item to certain roles, add `roles`:

```typescript
[MENU_KEYS.USERS]: { label: "Users", path: PATH.USERS, icon: Users, roles: ["admin"] },
```

Omitting `roles` shows the item to everyone. Filtering the sidebar is cosmetic —
the route itself must still call `requireRole("admin")`.

An item without a `path` is never treated as the active route, and is skipped when
resolving the breadcrumb title.

### 3. Add to a section

Add the `MENU_KEYS` constant to the appropriate array:

- `mainSidebar` — primary app features
- `manageSidebar` — secondary / management items
- `adminSidebar` — admin-only items (the group is hidden while the array is empty)
- `footerSidebar` — footer actions (e.g. logout)

### 4. Create the page

Add `src/app/new-feature/page.tsx` (or matching route) so the link does not 404.

## Active-route matching

`isPathActive(pathname, path)` in `src/lib/navigation.ts` is the single rule:
`"/"` matches only itself, every other route also matches its sub-routes
(`/contact` is active on `/contact/thanks`). Use it anywhere you need the same behavior.

## Related Skills

- [clean-architecture-extension](../clean-architecture-extension/SKILL.md) — full feature checklist
