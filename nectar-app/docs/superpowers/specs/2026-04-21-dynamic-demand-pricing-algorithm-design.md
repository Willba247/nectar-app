# Dynamic Demand Pricing Algorithm — Design Spec

**Date:** 2026-04-21
**Feature:** Live Mode — queue skip dynamic pricing
**File:** `nectar-app/src/lib/pricing/demandAlgorithm.ts`
**Status:** Approved, ready for implementation

---

## Overview

Venue managers submit a demand signal (current queue wait time) from their phone. The system reads the live sales velocity from the DB, passes both signals into `computeDynamicPrice`, and writes the result immediately to `venues.price`. The algorithm is a pure function with no side effects — all DB reads/writes and hard clamps happen in the `submitDemandSignal` tRPC mutation in `venueManager.ts`.

---

## Algorithm

### Core Concept: Relative Demand

D measures **change in demand from the previous submission**, not absolute demand against a fixed neutral point. This prevents the ratchet failure mode where any queue time above the neutral threshold would compound the price upward on every submission regardless of whether demand was actually rising.

- D = 1.0 when current conditions equal the previous submission → price unchanged
- D > 1.0 when demand rose since the last submission → price increases
- D < 1.0 when demand fell since the last submission → price decreases

On the **first submission of the night** (no prior signal in `demand_signals`), the algorithm falls back to neutral defaults (W_N=10, S_N=2) as the denominator — identical to the original absolute formula.

### Formula

```
FLOOR = 5.00           // AUD — algorithm-enforced lower bound
W_N   = 10             // neutral wait time fallback (first submission only)
S_N   = 2              // neutral sales fallback (first submission only)
α     = 0.70           // weight on wait time signal (dominant)
β     = 0.30           // weight on sales signal (β = 1 - α)
k     = 0.75           // power — controls curve aggression

waitDenom  = prevWaitTimeMinutes > 0 ? prevWaitTimeMinutes : W_N
salesDenom = prevSalesLast15Min  > 0 ? prevSalesLast15Min  : S_N

D          = α*(waitTimeMinutes / waitDenom) + β*(salesLast15Min / salesDenom)
multiplier = D ^ k
newPrice   = max(FLOOR, currentPrice * multiplier)

return newPrice.toFixed(2)
```

### Why relative denominators

- Fixes the compounding ratchet: a wait time of 25 min after a previous submission of 35 min produces D < 1 (demand fell), which lowers the price.
- Preserves first-submission behaviour: neutral defaults (W_N/S_N) as the baseline means the very first signal of the night still calibrates correctly against "normal" conditions.
- Zero-guard: if the previous wait or sales was 0, the neutral constant is used as the denominator to prevent division by zero.

### Why power-law

- `D^k` with k<1 applies diminishing returns — doubling D doesn't double the multiplier.
- k=0.75 produces aggressive-but-bounded responses in the typical $10–$20 range.
- Single tunable constant `k` controls the entire curve shape.

### Constants rationale

| Constant | Value | Rationale |
|---|---|---|
| `W_N` | 10 min | First-submission neutral — a 10-min queue is "expected busy" at an Australian club |
| `S_N` | 2 | First-submission neutral — 2 confirmed sales per 15 min is a normal sales rate |
| `α` | 0.70 | Wait time is the dominant demand signal — visible to the manager and directly felt by patrons |
| `β` | 0.30 | Sales velocity is a supporting signal — confirms demand but can lag |
| `k` | 0.75 | Produces ~1.9× at typical busy (first signal: 25 min / 4 sales), ~5.6× at extreme first-time peak |
| `FLOOR` | $5.00 | Algorithm-enforced minimum, independent of the system hard clamp ($0.50) in the caller |

### Calibrated reference points (currentPrice = $10, first submission of the night)

On the first submission, prevWait=W_N=10 and prevSales=S_N=2, so the formula is equivalent to the original absolute version:

| Scenario | Wait | Sales | D | Multiplier | Output |
|---|---|---|---|---|---|
| Quiet | 0 min | 0 | 0.00 | 0.00× | **$5.00** (floor) |
| Neutral | 10 min | 2 | 1.00 | 1.00× | **$10.00** |
| Busy | 25 min | 4 | 2.35 | 1.90× | **$19.00** |
| Peak | 120 min | 10 | 9.90 | 5.58× | **$55.80** |

### Relative pricing in action (subsequent submissions)

Demonstrates the fix for the ratchet failure mode:

| Step | Submit | Prev | D | Output |
|---|---|---|---|---|
| 1 | wait=35, sales=4 (first) | prevWait=10, prevSales=2 | 3.05 | **$26.60** (from $10) |
| 2 | wait=25, sales=4 (queue shorter) | prevWait=35, prevSales=4 | 0.80 | **~$22.50** (price falls) |
| 3 | wait=40, sales=6 (busier) | prevWait=25, prevSales=4 | 0.7*(40/25)+0.3*(6/4) = 1.345 | **price rises** |

---

## Function contract

```typescript
export function computeDynamicPrice(
  currentPrice: number,          // current venues.price at time of submission (AUD)
  waitTimeMinutes: number,       // manager-submitted queue wait (0–999, integer)
  salesLast15Min: number,        // confirmed paid transactions in last 15 min (≥0)
  prevWaitTimeMinutes?: number,  // wait time from the previous demand_signals record (default: W_N=10)
  prevSalesLast15Min?: number,   // sales from the previous demand_signals record (default: S_N=2)
): string                        // new price, exactly 2 decimal places
```

### Invariants

- **Pure function** — zero imports, zero side effects, no DB access.
- **No internal clamping to system limits** — the caller (`submitDemandSignal`) applies `MIN_PRICE=$0.50` and `MAX_PRICE=$299.99` after this function returns.
- **Algorithm floor is $5.00** — enforced inside this function via `max(FLOOR, ...)`.
- **Returns string** with exactly 2 decimal places via `.toFixed(2)`.
- **currentPrice is the last-written price** — whether set manually or by a previous signal. The manager resets the anchor by editing the base price in Queue Skip settings.
- **prevWaitTimeMinutes and prevSalesLast15Min default to W_N/S_N** — undefined is safe; TypeScript default params handle it.

### Edge cases

| Input | Behaviour |
|---|---|
| `waitTime=0, sales=0` (first submission) | D=0, multiplier=0 → `max($5.00, 0)` → **$5.00** |
| `waitTime=0, sales=0` (subsequent, prev>0) | D=0 → **$5.00** floor |
| `prevWait=0` | waitDenom falls back to W_N=10 (div-by-zero guard) |
| `prevSales=0` | salesDenom falls back to S_N=2 (div-by-zero guard) |
| Wait decreases from prev | D < 1 (wait component < 1) → price decreases |
| Sales and wait both decrease | D < 1 → price decreases |
| Very large waitTime vs small prevWait | D large → caller clamps at $299.99 |
| `currentPrice` at or below $5.00 | Output stays at $5.00 unless demand pushes above it |

---

## What is NOT in scope

- The algorithm does not read from or write to the DB.
- The algorithm does not apply the system hard clamps ($0.50 / $299.99) — the caller handles these.
- The algorithm does not store state between calls — each submission is fully stateless from its own perspective; the caller supplies `prevWaitTimeMinutes` and `prevSalesLast15Min` from the DB.
- Constants (`W_N`, `S_N`, `α`, `k`) are not configurable per venue in this version — they are hardcoded in the function.

---

## Implementation

### Files changed

- `nectar-app/src/lib/pricing/demandAlgorithm.ts` — function signature updated with optional `prevWaitTimeMinutes` / `prevSalesLast15Min` params; formula now uses relative denominators with zero-guards.
- `nectar-app/src/server/api/routers/venueManager.ts` — `submitDemandSignal` mutation fetches the most recent `demand_signals` record in parallel with the sales count query, and passes those values to `computeDynamicPrice`.

### No schema changes required

The `demand_signals` table already stores `wait_time_minutes` and `sales_last_15_min` per record. The caller reads the most recent record to get the previous values — no new columns needed.

### No imports required

All math uses `Math.pow` and `Math.max` — native JS, zero imports.
