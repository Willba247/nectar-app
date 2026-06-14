# Dark Mode — Venue Manager Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable dark/light mode to the venue manager dashboard scoped entirely to `/venue/dashboard` routes, persisted in `localStorage`.

**Architecture:** A `ThemeProvider` client component wraps the dashboard layout and applies/removes a `dark` class on a `display:contents` wrapper div. The existing `.dark` CSS variable block in `globals.css` handles all colour switching via Tailwind's `@custom-variant dark (&:is(.dark *))`. Hardcoded grey Tailwind classes across dashboard components are replaced with semantic tokens so they respond to the class toggle.

**Tech Stack:** Next.js 15 App Router, React context, Tailwind CSS v4, `localStorage`

---

## File Map

| Action | File |
|---|---|
| **Create** | `src/app/venue/dashboard/_components/ThemeProvider.tsx` |
| **Modify** | `src/app/venue/dashboard/_components/index.ts` |
| **Modify** | `src/app/venue/dashboard/layout.tsx` |
| **Modify** | `src/app/venue/dashboard/_components/Navbar.tsx` |
| **Modify** | `src/app/venue/dashboard/_components/Sidebar.tsx` |
| **Modify** | `src/app/venue/dashboard/transactions/_components/GrossSalesBox.tsx` |
| **Modify** | `src/app/venue/dashboard/transactions/_components/Pagination.tsx` |
| **Modify** | `src/app/venue/dashboard/transactions/_components/TransactionTable.tsx` |
| **Modify** | `src/app/venue/dashboard/transactions/_components/TransactionFilters.tsx` |
| **Modify** | `src/app/venue/dashboard/transactions/_components/PayoutSettingsPanel.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/AddDayDialog.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/DayConfigCard.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/DayTimeConfig.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/PanicOffButton.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/PanicConfirmDialog.tsx` |
| **Modify** | `src/app/venue/dashboard/queue-skip/_components/TimeSlotEditor.tsx` |
| **Modify** | `src/app/venue/dashboard/venue-card/_components/ImageUpload.tsx` |
| **Modify** | `src/app/venue/dashboard/venue-card/_components/ProfileForm.tsx` |
| **Modify** | `src/app/venue/dashboard/venue-card/_components/VenuePreview.tsx` |
| **Modify** | `src/app/venue/dashboard/venue-card/page.tsx` |
| **Modify** | `src/app/venue/dashboard/live-mode/_components/RecentSignalsFeed.tsx` |
| **Modify** | `src/app/venue/dashboard/live-mode/_components/WaitTimeInput.tsx` |

---

## Task 1: Create ThemeProvider

**Files:**
- Create: `src/app/venue/dashboard/_components/ThemeProvider.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nectar-theme") as Theme | null;
    if (saved === "dark") {
      setTheme("dark");
      wrapperRef.current?.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("nectar-theme", next);
      if (next === "dark") {
        wrapperRef.current?.classList.add("dark");
      } else {
        wrapperRef.current?.classList.remove("dark");
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div ref={wrapperRef} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Export from index**

In `src/app/venue/dashboard/_components/index.ts`, add:

```ts
export { Navbar } from "./Navbar";
export { Sidebar } from "./Sidebar";
export { ThemeProvider } from "./ThemeProvider";
```

- [ ] **Step 3: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors related to ThemeProvider.

- [ ] **Step 4: Commit**

```bash
git add src/app/venue/dashboard/_components/ThemeProvider.tsx src/app/venue/dashboard/_components/index.ts
git commit -m "feat: add ThemeProvider context for dashboard dark mode"
```

---

## Task 2: Wire layout.tsx

**Files:**
- Modify: `src/app/venue/dashboard/layout.tsx`

- [ ] **Step 1: Wrap layout content in ThemeProvider**

Replace the `return` block in `src/app/venue/dashboard/layout.tsx`:

```tsx
// Add import at the top (alongside existing Navbar/Sidebar imports):
import { Navbar, Sidebar, ThemeProvider } from "./_components";

// Replace the return statement:
  return (
    <ThemeProvider>
      <div className="flex h-screen flex-col">
        <Navbar venueName={venueName} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
```

Note: `bg-gray-50` on `<main>` is replaced with `bg-background` here.

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/venue/dashboard/layout.tsx
git commit -m "feat: wrap dashboard layout in ThemeProvider"
```

---

## Task 3: Update Navbar — add toggle and semantic tokens

**Files:**
- Modify: `src/app/venue/dashboard/_components/Navbar.tsx`

- [ ] **Step 1: Replace Navbar contents**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

interface NavbarProps {
  venueName: string;
}

export function Navbar({ venueName }: NavbarProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const utils = api.useUtils();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    utils.venueManager.whoami.reset();
    router.push("/venue/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Venue Manager Dashboard</h1>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-medium text-foreground">{venueName}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Dark mode pill toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm" aria-hidden>☀️</span>
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                theme === "dark" ? "bg-[#0DD2B6]" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  theme === "dark" ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
            <span className="text-sm" aria-hidden>🌙</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify toggle works**

```bash
cd nectar-app && npm run dev
```

Navigate to `http://localhost:3000/venue/dashboard`. Click the toggle — the dashboard should switch between light and dark. Refresh — the preference should be remembered.

- [ ] **Step 4: Commit**

```bash
git add src/app/venue/dashboard/_components/Navbar.tsx
git commit -m "feat: add dark mode toggle to dashboard navbar"
```

---

## Task 4: Update Sidebar — semantic tokens

**Files:**
- Modify: `src/app/venue/dashboard/_components/Sidebar.tsx`

- [ ] **Step 1: Replace hardcoded colours**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Transactions", href: "/venue/dashboard/transactions" },
  { label: "Queue Skip Settings", href: "/venue/dashboard/queue-skip" },
  { label: "Live Mode", href: "/venue/dashboard/live-mode" },
  { label: "Venue Profile", href: "/venue/dashboard/venue-card" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-background">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/venue/dashboard/_components/Sidebar.tsx
git commit -m "fix: replace hardcoded sidebar colours with semantic tokens"
```

---

## Task 5: Colour sweep — transactions components

**Files:**
- Modify: `src/app/venue/dashboard/transactions/_components/GrossSalesBox.tsx`
- Modify: `src/app/venue/dashboard/transactions/_components/Pagination.tsx`
- Modify: `src/app/venue/dashboard/transactions/_components/TransactionTable.tsx`
- Modify: `src/app/venue/dashboard/transactions/_components/TransactionFilters.tsx`
- Modify: `src/app/venue/dashboard/transactions/_components/PayoutSettingsPanel.tsx`

- [ ] **Step 1: GrossSalesBox.tsx**

Replace:
```tsx
<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
  <p className="text-sm font-medium text-gray-500">
```
With:
```tsx
<div className="rounded-lg border bg-card p-4 shadow-sm">
  <p className="text-sm font-medium text-muted-foreground">
```

Replace:
```tsx
<p className="mt-1 text-2xl font-bold text-gray-900">{formatted}</p>
```
With:
```tsx
<p className="mt-1 text-2xl font-bold text-foreground">{formatted}</p>
```

- [ ] **Step 2: Pagination.tsx**

Replace:
```tsx
<div className="flex items-center justify-between rounded-lg border bg-white p-4">
  <div className="text-sm text-gray-600">
```
With:
```tsx
<div className="flex items-center justify-between rounded-lg border bg-card p-4">
  <div className="text-sm text-muted-foreground">
```

- [ ] **Step 3: TransactionTable.tsx**

Replace all three occurrences of `bg-white` and `text-gray-500` in the loading/empty/table containers:

```tsx
// loading state:
<div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">

// empty state:
<div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">

// table wrapper:
<div className="rounded-lg border bg-card">
```

- [ ] **Step 4: TransactionFilters.tsx**

Replace:
```tsx
<div className="space-y-4 rounded-lg border bg-white p-4">
```
With:
```tsx
<div className="space-y-4 rounded-lg border bg-card p-4">
```

Replace:
```tsx
<p className="text-xs text-gray-500">
```
With:
```tsx
<p className="text-xs text-muted-foreground">
```

- [ ] **Step 5: PayoutSettingsPanel.tsx**

Replace all `text-gray-500` with `text-muted-foreground`.

Replace:
```tsx
className="h-9 animate-pulse rounded bg-gray-100"
```
With:
```tsx
className="h-9 animate-pulse rounded bg-muted"
```

- [ ] **Step 6: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/app/venue/dashboard/transactions/_components/
git commit -m "fix: replace hardcoded colours in transactions components"
```

---

## Task 6: Colour sweep — queue-skip components

**Files:**
- Modify: `src/app/venue/dashboard/queue-skip/_components/AddDayDialog.tsx`
- Modify: `src/app/venue/dashboard/queue-skip/_components/DayConfigCard.tsx`
- Modify: `src/app/venue/dashboard/queue-skip/_components/DayTimeConfig.tsx`
- Modify: `src/app/venue/dashboard/queue-skip/_components/PanicOffButton.tsx`
- Modify: `src/app/venue/dashboard/queue-skip/_components/PanicConfirmDialog.tsx`
- Modify: `src/app/venue/dashboard/queue-skip/_components/TimeSlotEditor.tsx`

- [ ] **Step 1: AddDayDialog.tsx**

Replace:
```tsx
<p className="mt-1 text-xs text-gray-500">
```
With:
```tsx
<p className="mt-1 text-xs text-muted-foreground">
```

- [ ] **Step 2: DayConfigCard.tsx**

Replace:
```tsx
<span className="text-sm text-gray-500">Active</span>
```
With:
```tsx
<span className="text-sm text-muted-foreground">Active</span>
```

Replace:
```tsx
<div className="space-y-2 border-l-2 border-gray-200 pl-4">
  <h4 className="text-sm font-medium text-gray-600">Time Slots</h4>
```
With:
```tsx
<div className="space-y-2 border-l-2 border-border pl-4">
  <h4 className="text-sm font-medium text-muted-foreground">Time Slots</h4>
```

Replace:
```tsx
<p className="text-sm text-gray-400">No time slots configured</p>
```
With:
```tsx
<p className="text-sm text-muted-foreground">No time slots configured</p>
```

Replace:
```tsx
className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
```
With:
```tsx
className="flex items-center justify-between rounded bg-muted px-3 py-2"
```

Replace (the inactive slot text):
```tsx
slot.isActive ? "" : "text-gray-400 line-through"
```
With:
```tsx
slot.isActive ? "" : "text-muted-foreground line-through"
```

Replace:
```tsx
<span className="text-xs text-gray-500">
```
With:
```tsx
<span className="text-xs text-muted-foreground">
```

- [ ] **Step 3: DayTimeConfig.tsx**

Replace:
```tsx
<p className="text-gray-500">
```
With:
```tsx
<p className="text-muted-foreground">
```

- [ ] **Step 4: PanicOffButton.tsx**

Replace:
```tsx
<p className="text-sm text-gray-500">
```
With:
```tsx
<p className="text-sm text-muted-foreground">
```

- [ ] **Step 5: PanicConfirmDialog.tsx**

Replace:
```tsx
<p className="text-sm text-gray-500">
```
With:
```tsx
<p className="text-sm text-muted-foreground">
```

- [ ] **Step 6: TimeSlotEditor.tsx**

Replace:
```tsx
<div className="space-y-3 rounded border bg-white p-3 shadow-sm">
```
With:
```tsx
<div className="space-y-3 rounded border bg-card p-3 shadow-sm">
```

- [ ] **Step 7: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/app/venue/dashboard/queue-skip/_components/
git commit -m "fix: replace hardcoded colours in queue-skip components"
```

---

## Task 7: Colour sweep — venue-card components

**Files:**
- Modify: `src/app/venue/dashboard/venue-card/_components/ImageUpload.tsx`
- Modify: `src/app/venue/dashboard/venue-card/_components/ProfileForm.tsx`
- Modify: `src/app/venue/dashboard/venue-card/_components/VenuePreview.tsx`
- Modify: `src/app/venue/dashboard/venue-card/page.tsx`

- [ ] **Step 1: ImageUpload.tsx**

Replace the dropzone class string. Find:
```tsx
`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"} ${uploading ? "cursor-not-allowed opacity-50" : ""} `
```
With:
```tsx
`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${isDragActive ? "border-blue-500 bg-blue-50" : "border-border hover:border-muted-foreground"} ${uploading ? "cursor-not-allowed opacity-50" : ""} `
```

Replace all `text-gray-400`, `text-gray-500`, `text-gray-600` in this file with `text-muted-foreground`.

- [ ] **Step 2: ProfileForm.tsx**

Replace all three occurrences of:
```tsx
<p className="mt-1 text-xs text-gray-500">
```
With:
```tsx
<p className="mt-1 text-xs text-muted-foreground">
```

- [ ] **Step 3: VenuePreview.tsx — caption only**

The inner card colours (`bg-gray-900`, `bg-gray-800`, `text-gray-400`, `text-gray-300`, `text-gray-400` within the gradient card) are intentional — they simulate the patron-facing dark card and must NOT be changed.

Only update the caption below the card:
```tsx
// Find:
<p className="mt-4 text-center text-xs text-gray-400">
// Replace with:
<p className="mt-4 text-center text-xs text-muted-foreground">
```

- [ ] **Step 4: venue-card/page.tsx**

Replace:
```tsx
<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
```
With:
```tsx
<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
```

- [ ] **Step 5: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/app/venue/dashboard/venue-card/
git commit -m "fix: replace hardcoded colours in venue-card components"
```

---

## Task 8: Colour sweep — live-mode components

**Files:**
- Modify: `src/app/venue/dashboard/live-mode/_components/RecentSignalsFeed.tsx`
- Modify: `src/app/venue/dashboard/live-mode/_components/WaitTimeInput.tsx`

- [ ] **Step 1: RecentSignalsFeed.tsx**

Replace:
```tsx
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
```
With:
```tsx
<div className="rounded-xl border bg-card p-4 shadow-sm">
```

- [ ] **Step 2: WaitTimeInput.tsx**

Replace:
```tsx
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
```
With:
```tsx
<div className="rounded-xl border bg-card p-4 shadow-sm">
```

- [ ] **Step 3: Typecheck**

```bash
cd nectar-app && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/venue/dashboard/live-mode/_components/
git commit -m "fix: replace hardcoded colours in live-mode components"
```

---

## Task 9: Final smoke test

- [ ] **Step 1: Run full lint + typecheck**

```bash
cd nectar-app && npm run check
```

Expected: no errors or warnings introduced by this change.

- [ ] **Step 2: Start dev server and verify**

```bash
cd nectar-app && npm run dev
```

Log into the dashboard at `http://localhost:3000/venue/dashboard` and verify:

1. Toggle is visible in the navbar between the venue name and Sign Out
2. Clicking the toggle switches all pages to dark mode (navbar, sidebar, main area, cards, tables)
3. Refreshing the page preserves the dark mode preference
4. Clicking the toggle again switches back to light mode
5. Navigate to a patron page (e.g. `http://localhost:3000`) — it remains light regardless of toggle state
6. Check all four dashboard sections: Transactions, Queue Skip Settings, Live Mode, Venue Profile

- [ ] **Step 3: Verify VenuePreview patron card is unchanged**

On the Venue Profile page, confirm the patron card preview (the dark card with gradient border) still renders with its intentional dark colours in both light and dark dashboard modes.
