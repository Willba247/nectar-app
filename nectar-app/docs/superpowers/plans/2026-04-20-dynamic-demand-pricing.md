# Dynamic Demand Pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live Mode page to the venue manager dashboard that lets a manager input the current queue wait time, triggering an algorithm that updates `venues.price` in real time based on demand signals.

**Architecture:** A pure-function algorithm module (`demandAlgorithm.ts`) is called inside a new `submitDemandSignal` tRPC mutation; the mutation reads current price + 15-min sales velocity, clamps the result, writes the price, inserts an immutable audit record into `demand_signals`, inserts an `audit_log` row, and clears the venue cache. A second `getLiveModeData` query feeds the mobile-optimised Live Mode page. No background jobs — price only changes on manager input.

**Tech Stack:** Next.js 15 App Router, tRPC v11 (`venueManagerProcedure`), Drizzle ORM v0.44 + Supabase PostgreSQL, Zod, Tailwind CSS, shadcn/ui, React Query polling.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **CREATE** | `src/lib/pricing/demandAlgorithm.ts` | Isolated pure-function price computation — no DB, no tRPC |
| **MODIFY** | `src/lib/db/schema.ts` | Add `demandSignals` Drizzle table definition |
| **AUTO-GENERATED** | `drizzle/<name>.sql` | Migration SQL produced by `db:generate` |
| **AUTO-UPDATED** | `drizzle/meta/_journal.json` | Migration journal updated by `db:generate` |
| **MODIFY** | `src/server/api/routers/venueManager.ts` | Add `submitDemandSignal` mutation + `getLiveModeData` query |
| **CREATE** | `src/app/venue/dashboard/live-mode/page.tsx` | Live Mode page component |
| **CREATE** | `src/app/venue/dashboard/live-mode/_components/CurrentPriceBanner.tsx` | Price + enabled state banner |
| **CREATE** | `src/app/venue/dashboard/live-mode/_components/WaitTimeInput.tsx` | Wait time input + quick-increment buttons + submit |
| **CREATE** | `src/app/venue/dashboard/live-mode/_components/RecentSignalsFeed.tsx` | Last 5 demand signals feed |
| **MODIFY** | `src/app/venue/dashboard/_components/Sidebar.tsx` | Add Live Mode nav entry |

> **Supabase SQL editor (not a repo file):** RLS policies for `demand_signals` are applied manually — they use `auth.uid()` which is Supabase-specific and outside Drizzle's scope.

---

## Task 1: Add `demandSignals` to Drizzle schema

**Files:**
- Modify: `nectar-app/src/lib/db/schema.ts`

- [ ] **Step 1.1: Add `demandSignals` table definition to schema.ts**

  Open `src/lib/db/schema.ts`. The imports at the top already include `serial`, `uuid`, `integer`, `numeric`, `timestamp`, `text`, and `index`. Add the table definition at the **end of the file**, after the `auditLog` table:

  ```typescript
  // Demand Signals — immutable audit records for dynamic pricing submissions
  export const demandSignals = pgTable(
    "demand_signals",
    {
      id: serial("id").primaryKey().notNull(),
      venueId: text("venue_id")
        .notNull()
        .references(() => venues.id, { onDelete: "cascade" }),
      submittedBy: uuid("submitted_by").references(() => authUsers.id, {
        onDelete: "set null",
      }),
      waitTimeMinutes: integer("wait_time_minutes").notNull(),
      salesLast15Min: integer("sales_last_15_min").notNull(),
      priceBefore: numeric("price_before").notNull(),
      priceAfter: numeric("price_after").notNull(),
      submittedAt: timestamp("submitted_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index("idx_demand_signals_venue_id").on(table.venueId),
      index("idx_demand_signals_venue_submitted").on(
        table.venueId,
        table.submittedAt,
      ),
    ],
  );
  ```

- [ ] **Step 1.2: Generate the Drizzle migration**

  Run from `nectar-app/`:
  ```bash
  npm run db:generate
  ```

  Expected output: something like `1 migration(s) generated`. Drizzle creates a new SQL file in `drizzle/` (e.g. `0005_<words>.sql`) and updates `drizzle/meta/_journal.json`. Note the exact filename — you'll need it in step 1.4.

- [ ] **Step 1.3: Enable RLS in the generated migration file**

  Open the newly generated SQL file (e.g. `drizzle/0005_<words>.sql`). At the **end** of the file, append:

  ```sql
  -- Enable RLS on demand_signals.
  -- Policies are applied separately via Supabase SQL editor.
  ALTER TABLE "demand_signals" ENABLE ROW LEVEL SECURITY;
  ```

- [ ] **Step 1.4: Apply the migration to the database**

  Run from `nectar-app/`:
  ```bash
  npm run db:migrate
  ```

  Expected: migration completes without error. Verify in Supabase Table Editor that `demand_signals` now exists with columns: `id`, `venue_id`, `submitted_by`, `wait_time_minutes`, `sales_last_15_min`, `price_before`, `price_after`, `submitted_at`.

- [ ] **Step 1.5: Apply RLS policies in Supabase SQL editor**

  In your Supabase project → SQL Editor, run:

  ```sql
  -- Venue managers can SELECT only their own venue's signals
  CREATE POLICY "manager_read_own_demand_signals"
    ON demand_signals FOR SELECT
    USING (
      venue_id IN (
        SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
      )
    );

  -- Venue managers can INSERT only for their own venue
  -- (primary enforcement is server-side via venueManagerProcedure; RLS is the backstop)
  CREATE POLICY "manager_insert_own_demand_signals"
    ON demand_signals FOR INSERT
    WITH CHECK (
      venue_id IN (
        SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
      )
    );

  -- No UPDATE or DELETE policies — signals are immutable audit records
  ```

  Verify in Supabase → Authentication → Policies that `demand_signals` shows both policies.

- [ ] **Step 1.6: Type-check**

  ```bash
  npm run check
  ```

  Expected: no errors. If you see an error about `demandSignals` not being exported, ensure the table definition was added to `schema.ts`.

---

## Task 2: Algorithm module — `demandAlgorithm.ts`

**Files:**
- Create: `nectar-app/src/lib/pricing/demandAlgorithm.ts`

This module is intentionally isolated: **no DB imports, no tRPC imports, no side effects.** It is a pure function that can be independently replaced without touching the tRPC layer.

- [ ] **Step 2.1: Create the pricing directory and algorithm file**

  Create `src/lib/pricing/demandAlgorithm.ts` with:

  ```typescript
  /**
   * Compute a new queue skip price based on demand signals.
   *
   * D is a relative demand score — it measures change from the previous
   * submission, not absolute demand against a fixed neutral. D=1 when current
   * conditions equal the previous submission (price unchanged). D>1 when demand
   * rose; D<1 when demand fell.
   *
   * On the first submission of the night (no previous signal), prevWaitTimeMinutes
   * and prevSalesLast15Min default to W_N=10 and S_N=2 (neutral conditions).
   *
   * Hard clamps ($0.50 / $299.99) are applied by the caller AFTER this function
   * returns — never inside this function.
   */
  export function computeDynamicPrice(
    currentPrice: number,
    waitTimeMinutes: number,
    salesLast15Min: number,
    prevWaitTimeMinutes = 10,
    prevSalesLast15Min  = 2,
  ): string {
    const FLOOR = 5.0;
    const W_N   = 10;
    const S_N   = 2;
    const alpha = 0.70;
    const k     = 0.75;

    // Guard against div-by-zero: if prev value is 0, fall back to neutral constant
    const waitDenom  = prevWaitTimeMinutes > 0 ? prevWaitTimeMinutes : W_N;
    const salesDenom = prevSalesLast15Min  > 0 ? prevSalesLast15Min  : S_N;

    const D          = alpha * (waitTimeMinutes / waitDenom) + (1 - alpha) * (salesLast15Min / salesDenom);
    const multiplier = Math.pow(D, k);
    const newPrice   = Math.max(FLOOR, currentPrice * multiplier);

    return newPrice.toFixed(2);
  }
  ```

- [ ] **Step 2.2: Type-check**

  ```bash
  npm run check
  ```

  Expected: no errors.

---

## Task 3: tRPC procedures — `submitDemandSignal` + `getLiveModeData`

**Files:**
- Modify: `nectar-app/src/server/api/routers/venueManager.ts`

- [ ] **Step 3.1: Add `demandSignals` to schema imports**

  In `venueManager.ts`, find the existing schema import block (around line 20):

  ```typescript
  import {
    transactionsLog,
    venues,
    qsConfigDays,
    qsConfigHours,
    queue,
    auditLog,
  } from "@/lib/db/schema";
  ```

  Add `demandSignals` to the list:

  ```typescript
  import {
    transactionsLog,
    venues,
    qsConfigDays,
    qsConfigHours,
    queue,
    auditLog,
    demandSignals,
  } from "@/lib/db/schema";
  ```

- [ ] **Step 3.2: Add algorithm import**

  Directly below the schema import, add:

  ```typescript
  import { computeDynamicPrice } from "@/lib/pricing/demandAlgorithm";
  ```

- [ ] **Step 3.3: Add price clamp constants**

  Near the top of the file (after imports, before the router), add:

  ```typescript
  // Hard price clamps — applied after algorithm output regardless of computed value
  const MIN_PRICE = 0.5;
  const MAX_PRICE = 999.99;
  ```

- [ ] **Step 3.4: Add `submitDemandSignal` mutation**

  In the `venueManagerRouter` object, add this procedure after the existing `updateQueueSkipPrice` procedure. Find the closing of `updateQueueSkipPrice` (around line 730) and insert **after** it:

  ```typescript
  /**
   * Submit a demand signal — reads current price + 15-min sales velocity,
   * runs the pricing algorithm, clamps the result, writes the new price,
   * inserts an immutable demand_signals record, and audits the change.
   *
   * venueId is NEVER accepted from the client — always ctx.venue.venueId.
   */
  submitDemandSignal: venueManagerProcedure
    .input(
      z.object({
        waitTimeMinutes: z.number().int().min(0).max(999),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      // 1. Read current price and queue skip state
      const [venue] = await db
        .select({ price: venues.price, queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, venueId));

      if (!venue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }

      // 2. Count paid transactions in the last 15 minutes, and fetch the most
      //    recent demand signal (used as the relative baseline for the algorithm)
      const [[salesResult], [prevSignal]] = await Promise.all([
        db
          .select({ total: count() })
          .from(transactionsLog)
          .where(
            and(
              eq(transactionsLog.venueId, venueId),
              eq(transactionsLog.paymentStatus, "paid"),
              gte(transactionsLog.createdAt, sql`NOW() - INTERVAL '15 minutes'`),
            ),
          ),
        db
          .select({
            waitTimeMinutes: demandSignals.waitTimeMinutes,
            salesLast15Min: demandSignals.salesLast15Min,
          })
          .from(demandSignals)
          .where(eq(demandSignals.venueId, venueId))
          .orderBy(desc(demandSignals.submittedAt))
          .limit(1),
      ]);

      const salesLast15Min = salesResult?.total ?? 0;
      const currentPrice = parseFloat(String(venue.price));

      // 3. Run algorithm (pure function — no DB, no side effects).
      //    prevSignal is undefined on the first submission of the night;
      //    computeDynamicPrice defaults to W_N=10 / S_N=2 (neutral) in that case.
      const computed = computeDynamicPrice(
        currentPrice,
        input.waitTimeMinutes,
        salesLast15Min,
        prevSignal?.waitTimeMinutes,
        prevSignal?.salesLast15Min,
      );

      // 4. Apply hard clamps regardless of algorithm output
      const clamped = Math.min(MAX_PRICE, Math.max(MIN_PRICE, parseFloat(computed)));
      const newPrice = clamped.toFixed(2);
      const priceChanged = newPrice !== currentPrice.toFixed(2);

      // 5. Write new price to venues
      await db
        .update(venues)
        .set({ price: newPrice, updatedAt: new Date() })
        .where(eq(venues.id, venueId));

      // 6. Insert immutable demand_signals record (full snapshot for audit trail)
      await db.insert(demandSignals).values({
        venueId,
        submittedBy: userId,
        waitTimeMinutes: input.waitTimeMinutes,
        salesLast15Min,
        priceBefore: currentPrice.toFixed(2),
        priceAfter: newPrice,
      });

      // 7. Audit log — mandatory for all price writes (LOCKED_ASSUMPTIONS §8)
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "demand_signal_submitted",
        changes: {
          before: { price: currentPrice.toFixed(2) },
          after: { price: newPrice },
          waitTimeMinutes: input.waitTimeMinutes,
          salesLast15Min,
          timestamp: new Date().toISOString(),
        },
      });

      // 8. Invalidate patron-facing venue cache
      clearCachedVenues();

      return { newPrice, priceChanged, salesLast15Min };
    }),
  ```

  > **Known trade-off (documented in spec §5.1):** Steps 5–7 are not wrapped in a DB transaction. A failure at step 6 or 7 leaves the price written but unlogged. This matches the tolerance already present in `updateQueueSkipPrice` and is an accepted limitation.

- [ ] **Step 3.5: Add `getLiveModeData` query**

  After `submitDemandSignal`, add:

  ```typescript
  /**
   * Fetch all data needed for the Live Mode page in one round-trip.
   * Returns current price, queue skip state, and last 5 demand signals.
   */
  getLiveModeData: venueManagerProcedure.query(async ({ ctx }) => {
    const { venueId } = ctx.venue;

    const [venueResult, signals] = await Promise.all([
      db
        .select({ price: venues.price, queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, venueId))
        .then((rows) => rows[0]),
      db
        .select()
        .from(demandSignals)
        .where(eq(demandSignals.venueId, venueId))
        .orderBy(desc(demandSignals.submittedAt))
        .limit(5),
    ]);

    if (!venueResult) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
    }

    return {
      currentPrice: String(venueResult.price),
      queueSkipEnabled: venueResult.queueSkipEnabled ?? true,
      recentSignals: signals.map((s) => ({
        id: s.id,
        waitTimeMinutes: s.waitTimeMinutes,
        salesLast15Min: s.salesLast15Min,
        priceBefore: String(s.priceBefore),
        priceAfter: String(s.priceAfter),
        submittedAt: s.submittedAt.toISOString(),
      })),
    };
  }),
  ```

- [ ] **Step 3.6: Type-check**

  ```bash
  npm run check
  ```

  Expected: no errors. Common issues to look for:
  - `demandSignals` not imported → check step 3.1
  - `computeDynamicPrice` not found → check step 3.2
  - `MIN_PRICE`/`MAX_PRICE` not defined → check step 3.3
  - `salesResult?.total` typed as `unknown` → ensure `count` is imported from `drizzle-orm` (it is, line ~13 of venueManager.ts)

---

## Task 4: UI — Components and Page

**Files:**
- Create: `nectar-app/src/app/venue/dashboard/live-mode/_components/CurrentPriceBanner.tsx`
- Create: `nectar-app/src/app/venue/dashboard/live-mode/_components/WaitTimeInput.tsx`
- Create: `nectar-app/src/app/venue/dashboard/live-mode/_components/RecentSignalsFeed.tsx`
- Create: `nectar-app/src/app/venue/dashboard/live-mode/page.tsx`

- [ ] **Step 4.1: Create `CurrentPriceBanner.tsx`**

  Create `src/app/venue/dashboard/live-mode/_components/CurrentPriceBanner.tsx`:

  ```tsx
  interface CurrentPriceBannerProps {
    price: string;
    enabled: boolean;
  }

  export function CurrentPriceBanner({ price, enabled }: CurrentPriceBannerProps) {
    return (
      <div>
        {!enabled && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-100 p-3">
            <p className="text-sm font-medium text-red-800">
              ⚠️ Queue skip purchases are currently DISABLED
            </p>
            <p className="text-xs text-red-600">
              New customers cannot purchase queue skips.
            </p>
          </div>
        )}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Current Queue Skip Price
          </p>
          <p className="mt-1 text-4xl font-extrabold text-sky-900">£{price}</p>
          <p className="mt-1 text-xs text-slate-500">
            Queue skip: {enabled ? "enabled" : "disabled"}
          </p>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4.2: Create `WaitTimeInput.tsx`**

  Create `src/app/venue/dashboard/live-mode/_components/WaitTimeInput.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { api } from "@/trpc/react";
  import { Button } from "@/components/ui/button";

  interface WaitTimeInputProps {
    onSuccess: () => void;
  }

  const QUICK_INCREMENTS = [-5, 5, 10, 15] as const;

  export function WaitTimeInput({ onSuccess }: WaitTimeInputProps) {
    const [waitTime, setWaitTime] = useState(0);

    const mutation = api.venueManager.submitDemandSignal.useMutation({
      onSuccess,
    });

    const clamp = (val: number) => Math.min(999, Math.max(0, val));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setWaitTime(clamp(parseInt(e.target.value, 10) || 0));
    };

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-700">
          How long is the queue right now?
        </p>

        <div className="mb-3 flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            value={waitTime}
            onChange={handleChange}
            className="w-full rounded-xl border-2 border-indigo-500 bg-slate-50 py-3 text-center text-3xl font-bold text-slate-900 focus:outline-none"
          />
          <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
            min wait
          </span>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {QUICK_INCREMENTS.map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => setWaitTime((prev) => clamp(prev + delta))}
              className="rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 active:bg-slate-300"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        {mutation.error && (
          <p className="mb-2 text-sm text-red-600">{mutation.error.message}</p>
        )}

        <Button
          className="w-full py-5 text-base font-bold"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ waitTimeMinutes: waitTime })}
        >
          {mutation.isPending ? "Updating..." : "Update Price"}
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 4.3: Create `RecentSignalsFeed.tsx`**

  Create `src/app/venue/dashboard/live-mode/_components/RecentSignalsFeed.tsx`:

  ```tsx
  interface Signal {
    id: number;
    waitTimeMinutes: number;
    salesLast15Min: number;
    priceBefore: string;
    priceAfter: string;
    submittedAt: string;
  }

  interface RecentSignalsFeedProps {
    signals: Signal[];
  }

  function timeAgo(isoString: string): string {
    const diffSecs = Math.floor(
      (Date.now() - new Date(isoString).getTime()) / 1000,
    );
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }

  export function RecentSignalsFeed({ signals }: RecentSignalsFeedProps) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent Submissions
        </p>

        {signals.length === 0 ? (
          <p className="text-sm text-slate-400">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => {
              const increased =
                parseFloat(signal.priceAfter) > parseFloat(signal.priceBefore);
              return (
                <div
                  key={signal.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {signal.waitTimeMinutes} min queue
                    </p>
                    <p className="text-xs text-slate-400">
                      {timeAgo(signal.submittedAt)} · {signal.salesLast15Min}{" "}
                      sales/15min
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        increased ? "text-green-600" : "text-slate-800"
                      }`}
                    >
                      £{signal.priceAfter}
                    </p>
                    <p className="text-xs text-slate-400">
                      was £{signal.priceBefore}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4.4: Create `page.tsx`**

  Create `src/app/venue/dashboard/live-mode/page.tsx`:

  ```tsx
  "use client";

  import { api } from "@/trpc/react";
  import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";
  import { CurrentPriceBanner } from "./_components/CurrentPriceBanner";
  import { WaitTimeInput } from "./_components/WaitTimeInput";
  import { RecentSignalsFeed } from "./_components/RecentSignalsFeed";

  export default function LiveModePage() {
    const { data, isLoading, error, refetch } =
      api.venueManager.getLiveModeData.useQuery(undefined, {
        refetchInterval: 15000, // 15s polling — picks up price changes from other sources
      });

    if (isLoading) {
      return (
        <div className="mx-auto max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Live Mode</h1>
          <div className="animate-pulse space-y-4">
            <div className="h-28 rounded-xl bg-gray-200" />
            <div className="h-48 rounded-xl bg-gray-200" />
            <div className="h-32 rounded-xl bg-gray-200" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="mx-auto max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Live Mode</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-red-600">Failed to load live mode data</p>
            <p className="mt-2 text-sm text-red-500">{error.message}</p>
          </div>
        </div>
      );
    }

    if (!data) return null;

    return (
      <DashboardErrorBoundary>
        <div className="mx-auto max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Live Mode</h1>
          <CurrentPriceBanner
            price={data.currentPrice}
            enabled={data.queueSkipEnabled}
          />
          <WaitTimeInput onSuccess={() => void refetch()} />
          <RecentSignalsFeed signals={data.recentSignals} />
        </div>
      </DashboardErrorBoundary>
    );
  }
  ```

- [ ] **Step 4.5: Type-check**

  ```bash
  npm run check
  ```

  Expected: no errors. Common issues:
  - `api.venueManager.getLiveModeData` not found — ensure Task 3 is complete and the dev server has picked up the new procedure
  - `api.venueManager.submitDemandSignal` not found — same
  - `Button` not found — it is in `@/components/ui/button`

---

## Task 5: Navigation — add Live Mode to Sidebar

**Files:**
- Modify: `nectar-app/src/app/venue/dashboard/_components/Sidebar.tsx`

- [ ] **Step 5.1: Add Live Mode to navItems**

  In `Sidebar.tsx`, find the `navItems` array:

  ```typescript
  const navItems = [
    {
      label: "Transactions",
      href: "/venue/dashboard/transactions",
    },
    {
      label: "Queue Skip Settings",
      href: "/venue/dashboard/queue-skip",
    },
    {
      label: "Venue Profile",
      href: "/venue/dashboard/venue-card",
    },
  ];
  ```

  Replace it with (Live Mode inserted between Queue Skip Settings and Venue Profile, per spec §6):

  ```typescript
  const navItems = [
    {
      label: "Transactions",
      href: "/venue/dashboard/transactions",
    },
    {
      label: "Queue Skip Settings",
      href: "/venue/dashboard/queue-skip",
    },
    {
      label: "Live Mode",
      href: "/venue/dashboard/live-mode",
    },
    {
      label: "Venue Profile",
      href: "/venue/dashboard/venue-card",
    },
  ];
  ```

- [ ] **Step 5.2: Type-check**

  ```bash
  npm run check
  ```

  Expected: no errors.

- [ ] **Step 5.3: Start dev server and verify end-to-end**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000/venue/login` and log in as a venue manager. Then verify:

  1. **Sidebar** shows "Live Mode" between "Queue Skip Settings" and "Venue Profile"
  2. **Clicking Live Mode** navigates to `/venue/dashboard/live-mode`
  3. **Page loads** with the price banner showing the current price and queue skip state
  4. **Skeleton** appears briefly on first load (hard to see locally — can slow network in DevTools)
  5. **Increment buttons** (+5, +10, +15, −5) adjust the wait time input correctly
  6. **Input cannot go below 0 or above 999** — try typing 1000, should clamp to 999
  7. **Tapping "Update Price"** sends the mutation; button shows "Updating..." while pending
  8. **After submission** — price banner updates, new row appears at top of Recent Submissions feed
  9. **Queue skip disabled state** — in another tab, use Queue Skip Settings → Panic Off to disable queue skip, then reload Live Mode; banner should show the red disabled warning
  10. **Manual price override coexists** — set price via Queue Skip Settings → Price Editor, then submit a demand signal; the demand signal reads the manually-set price as its base

- [ ] **Step 5.4: Commit all changes**

  ```bash
  git add \
    nectar-app/src/lib/db/schema.ts \
    nectar-app/src/lib/pricing/demandAlgorithm.ts \
    nectar-app/drizzle/ \
    nectar-app/src/server/api/routers/venueManager.ts \
    nectar-app/src/app/venue/dashboard/live-mode/ \
    nectar-app/src/app/venue/dashboard/_components/Sidebar.tsx

  git commit -m "feat: add Live Mode dynamic demand pricing for venue managers

  - New demand_signals table with RLS (immutable audit trail)
  - computeDynamicPrice pure-function algorithm module (placeholder formula)
  - submitDemandSignal mutation: reads price + 15-min sales velocity, clamps
    result to [£0.50, £999.99], writes venues.price, inserts demand_signals
    record, audits to audit_log, clears venue cache
  - getLiveModeData query: parallel fetch of current price + last 5 signals
  - Live Mode page at /venue/dashboard/live-mode (mobile-optimised, 15s polling)
  - Sidebar nav entry added between Queue Skip Settings and Venue Profile"
  ```

---

## Testing Checklist

Cross-reference with spec §11. Verify manually in the running app:

### Security
- [ ] Log in as Manager A, visit `/venue/dashboard/live-mode` — can only see Manager A's signals
- [ ] An unauthenticated request to `submitDemandSignal` (e.g. via curl without a session cookie) returns `UNAUTHORIZED`

### Correctness
- [ ] Submitting a wait time writes a new `price` to `venues` (check Supabase Table Editor)
- [ ] A `demand_signals` row is inserted with correct `price_before`, `price_after`, `sales_last_15_min`, `wait_time_minutes`
- [ ] An `audit_log` row is inserted with `action = 'demand_signal_submitted'`
- [ ] Patron-facing venue page reflects the new price on next load (venue cache cleared)
- [ ] `getLiveModeData` returns signals in descending `submitted_at` order

### UI
- [ ] Page shows loading skeleton, then data
- [ ] After submission, price banner updates without page reload
- [ ] New signal appears at top of feed after submission
- [ ] Error message shown if mutation fails (simulate by killing dev server mid-request)
- [ ] Input cannot go below 0 or above 999

### Integration
- [ ] Manual price update via Price Editor → then submit demand signal → algorithm uses the manually-set price as base (check `price_before` in demand_signals row)
- [ ] Submit demand signal → then use Price Editor → Price Editor's write is the live price (last write wins)
