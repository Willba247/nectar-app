# Venue Dashboard — Developer Guide

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Project Structure](#project-structure)
3. [How to Add a New tRPC Procedure](#how-to-add-a-new-trpc-procedure)
4. [How to Add a New Dashboard Page](#how-to-add-a-new-dashboard-page)
5. [Code Conventions](#code-conventions)
6. [Testing Patterns](#testing-patterns)

---

## Environment Setup

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (with `venue_managers`, `venues`, `qs_config_days`, `qs_config_hours`, `transactions_log`, `audit_log` tables)
- A Stripe account with API keys

### Environment Variables

Create a `.env.local` file in the `nectar-app/` root with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
ADMIN_PASSWORD=<admin-password>
NODE_ENV=development
```

Environment variables are validated at build time via `@t3-oss/env-nextjs` in `src/env.js`.

### Running Locally

```bash
cd nectar-app
npm install
npm run dev          # Start dev server (Turbo)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run format:write # Prettier auto-format
```

### Database Migrations (Drizzle)

Schema lives in `src/lib/db/schema.ts`. Drizzle config is at `drizzle.config.ts`.

```bash
npx drizzle-kit generate   # Generate migration SQL
npx drizzle-kit push        # Push schema directly (dev only)
npx drizzle-kit migrate     # Apply pending migrations
```

Migration files are stored in `drizzle/`.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Patron feed (home)
│   ├── [venueName]/page.tsx          # Individual venue page
│   ├── venue/
│   │   ├── login/
│   │   │   ├── page.tsx              # Venue manager login
│   │   │   └── actions.ts            # Server action for auth
│   │   └── dashboard/
│   │       ├── layout.tsx            # Auth guard + sidebar layout
│   │       ├── page.tsx              # Redirects to /transactions
│   │       ├── transactions/         # Transaction log page
│   │       ├── queue-skip/           # Queue skip config page
│   │       └── venue-card/           # Venue profile editor
│   └── _components/                  # Shared app-level components
├── server/
│   └── api/
│       ├── trpc.ts                   # tRPC init, context, middleware
│       ├── root.ts                   # Root router (all sub-routers)
│       └── routers/
│           ├── venueManager.ts       # Dashboard-specific procedures
│           ├── venue.ts              # Public venue queries
│           ├── stripe.ts             # Stripe payment flow
│           ├── transaction.ts        # Transaction handling
│           ├── email.ts              # Email notifications
│           ├── price.ts              # Pricing logic
│           └── auth.ts               # Admin auth
├── lib/
│   ├── db/
│   │   ├── schema.ts                # Drizzle table definitions
│   │   ├── index.ts                 # DB client export
│   │   └── queries/                 # Reusable query functions
│   └── supabase/
│       └── server.ts                # Server-side Supabase client
├── services/
│   ├── stripe-server.ts             # Server-only Stripe SDK
│   └── stripe-client.ts             # Browser-only Stripe SDK
└── trpc/
    ├── react.tsx                     # Client-side tRPC hooks
    └── server.ts                     # Server-side tRPC caller
```

---

## How to Add a New tRPC Procedure

### 1. Choose the Right Procedure Type

| Procedure               | Use When                                                                         |
| ----------------------- | -------------------------------------------------------------------------------- |
| `publicProcedure`       | No auth required (patron-facing)                                                 |
| `venueManagerProcedure` | Dashboard endpoints (auto-injects `ctx.venue` with `venueId`, `userId`, `email`) |

### 2. Add the Procedure to a Router

Open or create a router in `src/server/api/routers/`. Example in `venueManager.ts`:

```typescript
import { createTRPCRouter, venueManagerProcedure } from "../trpc";
import { z } from "zod";

// Inside the router:
myNewProcedure: venueManagerProcedure
  .input(z.object({
    someParam: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // ctx.venue.venueId — always available, derived from auth
    // ctx.supabaseRls — RLS-enforced Supabase client
    // input.someParam — validated input

    const result = await db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(eq(venues.id, ctx.venue.venueId));

    return result;
  }),
```

**Key rules:**

- **NEVER** accept `venueId` from client input — always use `ctx.venue.venueId`
- Use `db.select({ specific columns })` rather than `db.select()` for performance
- Use `import type` for schema types that aren't used at runtime

### 3. Register the Router (if new file)

In `src/server/api/root.ts`:

```typescript
import { myNewRouter } from "./routers/myNewRouter";

export const appRouter = createTRPCRouter({
  // ... existing routers
  myNew: myNewRouter,
});
```

### 4. Call from the Client

```typescript
import { api } from "@/trpc/react";

// In a React component:
const { data, isLoading } = api.venueManager.myNewProcedure.useQuery({
  someParam: "value",
});

// For mutations:
const mutation = api.venueManager.myMutation.useMutation({
  onSuccess: () => {
    // Invalidate related queries
    utils.venueManager.someQuery.invalidate();
  },
});
```

---

## How to Add a New Dashboard Page

### 1. Create the Page Directory

```
src/app/venue/dashboard/my-page/
├── page.tsx                    # Page component
└── _components/                # Page-specific components
    └── MyWidget.tsx
```

### 2. Page Component Pattern

```tsx
"use client";

import { api } from "@/trpc/react";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";

export default function MyPage() {
  const { data, isLoading, error } = api.venueManager.myQuery.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Page</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-600">Failed to load data</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <DashboardErrorBoundary>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Page</h1>
        {/* Page content */}
      </div>
    </DashboardErrorBoundary>
  );
}
```

### 3. Add Sidebar Link

Update `src/app/venue/dashboard/_components/Sidebar.tsx` to include a navigation link to the new page.

### 4. Verify Auth Guard

The `dashboard/layout.tsx` already validates the Supabase session and redirects to `/venue/login` if unauthorized. No additional auth setup needed — all pages under `/venue/dashboard/` are protected automatically.

---

## Code Conventions

### TypeScript

- **Strict mode** is enabled with `noUncheckedIndexedAccess`
- Use `import type` for type-only imports
- Path alias: `@/*` maps to `./src/*`

### Styling

- **Tailwind CSS v4** (CSS-first config in `globals.css`)
- Brand colors: `#0DD2B6` (teal), `#FF69B4` (pink), `#4169E1` (blue)
- UI components via shadcn/ui in `src/components/ui/`

### Import Rules

- Import from specific module files, not barrel `index.ts` re-exports (compile-time optimization)
- Server-only modules must include `import "server-only"` guard
- Use `next/dynamic` with `{ ssr: false }` for heavy client-only components (modals, editors)

### Data Fetching

- All DB access is server-side via tRPC procedures
- RLS (Row Level Security) is enforced on all Supabase queries
- Polling intervals: 5–10s base with adaptive backoff via `useAdaptivePolling`

### Formatting

- Prettier and ESLint are configured
- Run `npm run format:write` before committing
- Run `npm run check` (lint + typecheck) to verify

---

## Testing Patterns

### Security Tests

- Login as Manager A → can only see Manager A's venue data
- Login as Manager B → can only see Manager B's venue data
- Manager A cannot access Manager B's transactions (RLS enforcement)
- Expired sessions redirect to `/venue/login`

### Integration Tests

- Verify tRPC procedures return correct data shapes
- Verify mutations invalidate the correct query caches
- Verify error boundaries render gracefully on component failure

### Manual QA Checklist

- Toggle between patron mode and venue side via the navbar toggle
- Complete a full login → dashboard → config → logout flow
- Test transaction filters (date range, search, pagination)
- Test queue skip config (add/edit/delete days and time slots)
- Test panic on/off toggle
- Test venue profile update and cover image upload
- Test data export functionality
