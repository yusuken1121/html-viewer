---
name: sidebar-management
description: >-
  How to add or modify sidebar menu items via path and menu config files. Use
  when adding a new route that should appear in the app sidebar.
---

# Sidebar Management

The sidebar is driven by config files — no hardcoded menu items in components.

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

In `src/constants/menuKeys.tsx`:

- Add a key to `MENU_KEYS`
- Add label, icon, and path to `SIDEBAR_CONFIG`

```typescript
export const SIDEBAR_CONFIG = {
  // ...
  [MENU_KEYS.NEW_FEATURE]: {
    label: "New Feature",
    path: PATH.NEW_FEATURE,
    icon: <YourIcon />,
  },
};
```

### 3. Add to a section

Add the `MENU_KEYS` constant to the appropriate array:

- `mainSidebar` — primary app features
- `manageSidebar` — secondary / management items
- `adminSidebar` — admin-only items
- `footerSidebar` — footer actions (e.g. logout)

### 4. Create the page

Add `src/app/new-feature/page.tsx` (or matching route) so the link does not 404.

## Related Skills

- [clean-architecture-extension](../clean-architecture-extension/SKILL.md) — full feature checklist
