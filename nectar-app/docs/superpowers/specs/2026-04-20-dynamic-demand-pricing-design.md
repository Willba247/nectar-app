# Dynamic Demand Pricing — Design Spec

**Date:** 2026-04-20  
**Status:** Approved — Ready for Implementation Planning  
**Feature:** Live Mode demand-based dynamic pricing for venue managers  
**Branch:** `feature/venue-manager-dashboard`

---

## 1. Overview

Venue managers can submit a real-time queue wait time estimate from their phone while standing at the door. An algorithm combines that wait time with recent sales velocity to compute a new queue skip price, which is immediately written to `venues.price`. The manager sees the current price and a recent submission history on a dedicated mobile-optimised dashboard page.

This feature is an input trigger — not an autonomous system. Price only changes when the manager submits. There are no background jobs, no cron tasks, and no WebSocket connections.

---

## 2. Consistency with Bible Documents

This design is validated against the following locked documents:

| Document                            | Location                                                      | Status                              |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| LOCKED_ASSUMPTIONS                  | `docs/venue-dashboard/LOCKED_ASSUMPTIONS`                     | ✅ All assumptions respected        |
| VENUE_DASHBOARD_IMPLEMENTATION_PLAN | `docs/venue-dashboard/VENUE_DASHBOARD_IMPLEMENTATION_PLAN.md` | ✅ Follows all established patterns |
| DEVELOPER_GUIDE                     | `docs/venue-dashboard/DEVELOPER_GUIDE.md`                     | ✅ Follows all code conventions     |
| RUNBOOK                             | `docs/venue-dashboard/RUNBOOK.md`                             | ✅ No operational deviations        |

### Key locked assumptions upheld

- **venueId is NEVER accepted from the client** — derived exclusively from `ctx.venue.venueId` via `venueManagerProcedure` (LOCKED_ASSUMPTIONS §2)
- **All DB access is server-side via tRPC + Drizzle** — zero client-side `.from()` calls (LOCKED_ASSUMPTIONS §3)
- **RLS enforced on the new `demand_signals` table** — policies follow the exact same pattern as existing tables (LOCKED_ASSUMPTIONS §4)
- **No background jobs or cron** — price only recalculates on explicit manager input (LOCKED_ASSUMPTIONS §9)
- **Audit logging is mandatory on every price write** — price changes are high-stakes mutations (LOCKED_ASSUMPTIONS §8, same policy as `setPanicOff`)
- **One venue per manager; no cross-venue access** — the feature is wholly scoped to `ctx.venue.venueId` (LOCKED_ASSUMPTIONS §1)

---

## 3. Database

### New table: `demand_signals`

```sql
CREATE TABLE demand_signals (
  id                 SERIAL PRIMARY KEY,
  venue_id           TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  submitted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  wait_time_minutes  INTEGER NOT NULL,
  sales_last_15_min  INTEGER NOT NULL,
  price_before       NUMERIC NOT NULL,
  price_after        NUMERIC NOT NULL,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_demand_signals_venue_id ON demand_signals(venue_id);
CREATE INDEX idx_demand_signals_venue_submitted ON demand_signals(venue_id, submitted_at DESC);
```

Drizzle schema definition added to `src/lib/db/schema.ts` following the existing column-naming conventions (`camelCase` in Drizzle, `snake_case` in Postgres).

### RLS policies for `demand_signals`

Mirrors the pattern from `qs_config_days` and `transactions_log`:

```sql
-- Venue managers can read only their own venue's signals
CREATE POLICY "manager_read_own_demand_signals"
  ON demand_signals FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );

-- Venue managers can insert only for their own venue
-- (server-side enforcement via venueManagerProcedure is primary; RLS is the backstop)
CREATE POLICY "manager_insert_own_demand_signals"
  ON demand_signals FOR INSERT
  WITH CHECK (
    venue_id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE — signals are immutable audit records
```

### No changes to existing tables

`venues`, `transactions_log`, `audit_log`, `qs_config_days`, `qs_config_hours`, `queue`, and `venue_managers` are unchanged.

---

## 4. Algorithm Module

**File:** `src/lib/pricing/demandAlgorithm.ts`

This is an isolated pure-function module. It has no DB calls, no imports from tRPC, and no side effects. This isolation is a **must-have** — it enables independent unit testing and straightforward future replacement.

```typescript
/**
 * Compute a new queue skip price based on demand signals.
 *
 * This function is a pure computation with no side effects.
 * The exact formula is to be designed collaboratively and
 * implemented as a follow-up.
 *
 * @param currentPrice  The current venues.price (last write, any source)
 * @param waitTimeMinutes  Manager-submitted estimated queue wait in minutes
 * @param salesLast15Min  Count of paid transactions in the last 15 minutes
 * @returns New price as a string with exactly 2 decimal places
 */
export function computeDynamicPrice(
  currentPrice: number,
  waitTimeMinutes: number,
  salesLast15Min: number,
): string {
  // TODO: Algorithm to be designed collaboratively.
  // Placeholder: returns current price unchanged until formula is agreed.
  return currentPrice.toFixed(2);
}
```

### Hard server-side clamps

Applied in the tRPC mutation **after** `computeDynamicPrice` returns, regardless of algorithm output:

- Minimum: `£0.50`
- Maximum: `£999.99`

These clamps protect against algorithm bugs producing nonsensical prices. They are constants defined at the top of the mutation file.

---

## 5. Backend — tRPC Procedures

Both procedures are added to the existing `venueManagerRouter` in `src/server/api/routers/venueManager.ts`. Both use `venueManagerProcedure` exclusively — `venueId` is always `ctx.venue.venueId`.

### 5.1 `venueManager.submitDemandSignal` — mutation

**Input:**

```typescript
z.object({
  waitTimeMinutes: z.number().int().min(0).max(999),
});
```

**Execution steps (sequential):**

1. Read `price` and `queueSkipEnabled` from `venues` for `ctx.venue.venueId`
2. COUNT rows in `transactions_log` where `venue_id = ctx.venue.venueId`, `payment_status = 'paid'`, and `created_at >= NOW() - INTERVAL '15 minutes'`
3. Call `computeDynamicPrice(currentPrice, waitTimeMinutes, salesCount)` from `demandAlgorithm.ts`
4. Clamp result to `[0.50, 999.99]`
5. `UPDATE venues SET price = clampedPrice, updated_at = NOW() WHERE id = ctx.venue.venueId`
6. `INSERT INTO demand_signals` with full snapshot: `venue_id`, `submitted_by`, `wait_time_minutes`, `sales_last_15_min`, `price_before`, `price_after`, `submitted_at`
7. `INSERT INTO audit_log` — action: `"demand_signal_submitted"`, changes payload: `{ before: { price }, after: { price: clampedPrice }, waitTimeMinutes, salesLast15Min, timestamp }`
8. Call `clearCachedVenues()` (patron-facing pages pick up the new price immediately)
9. Return `{ newPrice: string, priceChanged: boolean, salesLast15Min: number }`

**Error handling:** If any step fails, the mutation throws a `TRPCError`. Because price write (step 5) happens before the signal insert (step 6), a signal insert failure leaves the price updated but unlogged — this is acceptable (same tolerance already present in `updateQueueSkipPrice`). The audit log failure does not roll back the price write.

### 5.2 `venueManager.getLiveModeData` — query

**Input:** None

**Returns in one round-trip:**

```typescript
{
  currentPrice: string,
  queueSkipEnabled: boolean,
  recentSignals: Array<{
    id: number,
    waitTimeMinutes: number,
    salesLast15Min: number,
    priceBefore: string,
    priceAfter: string,
    submittedAt: string, // ISO string
  }>, // last 5, ordered by submittedAt DESC
}
```

Fetches `venues` and `demand_signals` (last 5 for this venue) in parallel using `Promise.all`.

---

## 6. UI — Live Mode Page

### Route

`/venue/dashboard/live-mode`

### File structure

```
src/app/venue/dashboard/live-mode/
├── page.tsx                         # Page component ("use client")
└── _components/
    ├── WaitTimeInput.tsx            # Large number input + increment buttons
    ├── CurrentPriceBanner.tsx       # Price display + queue skip enabled state
    └── RecentSignalsFeed.tsx        # Last 5 submissions list
```

### Page component pattern

Follows the exact pattern from `DEVELOPER_GUIDE.md §How to Add a New Dashboard Page`:

```tsx
"use client";

import { api } from "@/trpc/react";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";
// ... component imports

export default function LiveModePage() {
  const { data, isLoading, error } = api.venueManager.getLiveModeData.useQuery(
    undefined,
    { refetchInterval: 15000 }, // 15s polling — refreshes price if changed elsewhere
  );

  if (isLoading) {
    /* animate-pulse skeleton */
  }
  if (error) {
    /* red border error state */
  }
  if (!data) return null;

  return (
    <DashboardErrorBoundary>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Live Mode</h1>
        <CurrentPriceBanner
          price={data.currentPrice}
          enabled={data.queueSkipEnabled}
        />
        <WaitTimeInput />
        <RecentSignalsFeed signals={data.recentSignals} />
      </div>
    </DashboardErrorBoundary>
  );
}
```

### WaitTimeInput component

- Large numeric input (opens numeric keyboard on mobile)
- Quick-increment buttons: −5, +5, +10, +15 min
- Input value cannot go below 0 or above 999
- "Update Price" submit button — full width, thumb-friendly
- Calls `api.venueManager.submitDemandSignal.useMutation()`
- On success: invalidates `getLiveModeData` query, shows new price inline
- On error: shows inline error message below the button
- While pending: button shows "Updating..." and is disabled

### CurrentPriceBanner

- Displays current `venues.price` prominently
- Shows "Queue skip: enabled / disabled" state
- If `queueSkipEnabled === false`, shows a warning that sales are paused (consistent with the existing banner pattern on `queue-skip/page.tsx`)

### RecentSignalsFeed

- Last 5 demand signals from `getLiveModeData`
- Each row: wait time entered, time ago (relative), sales/15min, price before → price after
- Price after shown in green if higher than price before, neutral if unchanged

### Navigation

- No sidebar on this page — uses the standard dashboard layout (Navbar + Sidebar + `<main>`) to keep auth guard and session handling, but the page itself is focused
- "Live Mode" sidebar entry navigates to this route
- Sidebar entry positioned between "Queue Skip Settings" and "Venue Card"

### Styling conventions

Following `DEVELOPER_GUIDE.md §Styling`:

- Tailwind CSS + shadcn/ui components from `src/components/ui/`
- Brand colours: `#0DD2B6` (teal), `#FF69B4` (pink), `#4169E1` (blue) — specific colour scheme to be applied during implementation
- Card component from shadcn/ui wraps each section

---

## 7. Data Flow (End-to-End)

```
Manager at door, opens Live Mode on phone
  ↓
getLiveModeData query loads:
  - current price from venues
  - last 5 signals from demand_signals

Manager enters wait time (e.g. 25 min)
  ↓
Taps "Update Price"
  ↓
submitDemandSignal({ waitTimeMinutes: 25 })
  ↓ venueManagerProcedure validates JWT → injects ctx.venue
  ↓
  [Server]
  1. SELECT price FROM venues WHERE id = ctx.venue.venueId
  2. COUNT paid transactions in last 15 min
  3. computeDynamicPrice(price, 25, salesCount)   ← demandAlgorithm.ts
  4. clamp(result, 0.50, 999.99)
  5. UPDATE venues SET price = newPrice
  6. INSERT INTO demand_signals (full snapshot)
  7. INSERT INTO audit_log (action: demand_signal_submitted)
  8. clearCachedVenues()
  ↓
  Return { newPrice, priceChanged, salesLast15Min }
  ↓
UI updates CurrentPriceBanner + prepends row to RecentSignalsFeed
  ↓
Patron-facing page picks up new price on next load
(venue cache cleared; getAllVenues re-fetches from DB)
```

---

## 8. Override Behaviour

No special override logic is required. This feature coexists with the existing `PriceEditor` on the queue-skip page by design:

- **Last write wins** — whatever wrote to `venues.price` most recently (manual Price Editor or `submitDemandSignal`) is the live price
- **Recalculation base** — `submitDemandSignal` always reads the current `venues.price` at execution time as its base, regardless of how that price was set
- The `demand_signals` table captures `price_before` on every submission, giving a full audit trail of what the algorithm saw

---

## 9. Future Considerations (Out of Scope for This Build)

These are acknowledged design decisions that leave room for future work without requiring changes to this architecture:

- **People count input** — `demand_signals.wait_time_minutes` is the only signal column now. A future `queue_length_people` column can be added via migration when the manager input is expanded. The algorithm signature (`computeDynamicPrice`) will be updated to accept it.
- **Algorithm formula** — `demandAlgorithm.ts` is a pure function with a clear interface. The formula itself is to be designed collaboratively and swapped in without touching the tRPC layer.
- **Price bounds configuration** — hard clamps (`0.50` / `999.99`) are constants. A future per-venue `min_price` / `max_price` could be stored in `venues` and passed to the clamp.
- **Automatic recalculation** — the architecture does not preclude adding a pg_cron job later that calls the same algorithm on a schedule. The `demand_signals` table and algorithm module are designed to support this cleanly.

---

## 10. Drizzle Migration

One new migration file required:

- Creates `demand_signals` table with indexes
- Adds RLS policies for `demand_signals`

No changes to existing migration files.

---

## 11. Testing Checklist

### Security

- [ ] Manager A cannot read Manager B's `demand_signals` (RLS isolation)
- [ ] `submitDemandSignal` with a crafted `venueId` in the body is ignored — venue is always from `ctx.venue.venueId`
- [ ] Unauthenticated request to `submitDemandSignal` returns `UNAUTHORIZED`

### Correctness

- [ ] Submitting wait time writes new price to `venues.price`
- [ ] `demand_signals` row created with correct `price_before`, `price_after`, `sales_last_15_min`
- [ ] `audit_log` row created with action `demand_signal_submitted`
- [ ] `clearCachedVenues()` called — patron page picks up new price on next fetch
- [ ] Price clamped to minimum £0.50 even if algorithm returns lower
- [ ] Price clamped to maximum £999.99 even if algorithm returns higher
- [ ] `getLiveModeData` returns last 5 signals in descending order

### UI

- [ ] Page loads with isLoading skeleton
- [ ] Submitting updates price banner without page reload
- [ ] New signal appears at top of feed after submission
- [ ] Error message shown if mutation fails
- [ ] Quick-increment buttons correctly adjust input value
- [ ] Input cannot be set below 0 or above 999
- [ ] Panic disabled state shown in banner when `queueSkipEnabled = false`

### Integration

- [ ] Manual price update via PriceEditor → then `submitDemandSignal` → algorithm uses manually-set price as base
- [ ] `submitDemandSignal` → then manual PriceEditor update → PriceEditor price is now the live price
