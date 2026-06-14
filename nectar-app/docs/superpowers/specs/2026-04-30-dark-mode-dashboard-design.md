# Dark Mode — Venue Manager Dashboard

**Date:** 2026-04-30
**Scope:** `/venue/dashboard` routes only

---

## Summary

Add a toggleable dark mode to the venue manager dashboard. A pill-style toggle (☀️ / 🌙) sits in the navbar top-right next to Sign Out. Preference is persisted in `localStorage`. Dark mode is scoped entirely to the dashboard — patron-facing pages are unaffected.

---

## Architecture

A `ThemeProvider` client component wraps the dashboard layout content. It:

- Reads `localStorage.getItem("nectar-theme")` on mount (`"dark"` | `"light"`, default `"light"`)
- Applies or removes the `dark` class on its own wrapper `<div>`
- Exposes `useTheme()` context returning `{ theme, toggleTheme }`

The `dark` class activates the existing `.dark` variable block in `globals.css` via the already-configured `@custom-variant dark (&:is(.dark *))`. No new colours are introduced — the full dark palette is already defined.

Scope is contained within `/venue/dashboard` — the `dark` class never touches `<html>` or any patron page.

---

## Components

### New: `ThemeProvider`

**File:** `nectar-app/src/app/venue/dashboard/_components/ThemeProvider.tsx`

- `"use client"` component
- Creates a React context with `{ theme: "light" | "dark", toggleTheme: () => void }`
- On mount: reads `localStorage.getItem("nectar-theme")`, sets initial theme
- `toggleTheme`: flips state, writes to `localStorage`, adds/removes `dark` class on wrapper div
- Renders a `<div className="flex h-full flex-col flex-1 contents">` wrapper that carries the `dark` class when active — must not break the existing `flex h-screen` layout, so wrapper uses `className="contents"` (CSS `display: contents`) to stay invisible to flex layout
- Exports `useTheme()` hook for consumers

### Modified: `Navbar`

**File:** `nectar-app/src/app/venue/dashboard/_components/Navbar.tsx`

- Calls `useTheme()` to get `{ theme, toggleTheme }`
- Renders pill toggle between venue name and Sign Out:
  - `☀️` — pill — `🌙`
  - Pill: `w-9 h-5` rounded-full, background `bg-input` (light) / `bg-[#0DD2B6]` (dark)
  - Thumb: `w-4 h-4` white circle, translates right when dark is active
- Hardcoded colours updated to semantic tokens (`bg-background`, `border-border`, etc.)

### Modified: `layout.tsx`

**File:** `nectar-app/src/app/venue/dashboard/layout.tsx`

- Imports `ThemeProvider`
- Wraps the existing layout JSX in `<ThemeProvider>`
- Layout remains a server component — `ThemeProvider` handles all client state

### Colour sweep

Replace hardcoded static Tailwind colour classes with semantic tokens across all dashboard components so they respond to the `dark` class:

| Hardcoded | Semantic token |
|---|---|
| `bg-white` | `bg-background` or `bg-card` |
| `bg-gray-50` | `bg-background` |
| `bg-gray-100` | `bg-muted` |
| `text-gray-900` | `text-foreground` |
| `text-gray-700` | `text-foreground` |
| `text-gray-600` | `text-muted-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `border-r` / `border-b` | keep structural classes; ensure `border-border` is applied |

Files to sweep: `Sidebar.tsx`, `Navbar.tsx`, `layout.tsx`, and all dashboard page components and their sub-components.

---

## Data Flow & Persistence

- Theme state lives entirely client-side in `ThemeProvider`
- `localStorage` key: `"nectar-theme"`, values: `"light"` | `"dark"`
- No server state, no cookies, no tRPC calls
- No flash-of-wrong-theme risk: the dashboard requires authentication (server redirects unauthenticated users to `/venue/login`), so JS hydration applies the saved theme before the user sees content

---

## Out of Scope

- Patron-facing pages (`/[venueName]`, `/admin`) — remain light-only
- System preference auto-detection (`prefers-color-scheme`) — manual toggle only
- Per-user server-side preference storage — localStorage is sufficient
