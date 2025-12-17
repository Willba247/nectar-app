# Race Condition Fix: Queue Skip Inventory Management

## The Problem

When multiple customers attempt to purchase queue skips simultaneously (e.g., 2 customers buying when only 1 slot is available), both could complete their purchases successfully, causing the system to oversell.

**Root Cause:** The system checked inventory availability at checkout initiation but didn't enforce it at payment confirmation time. Two requests could see the same slot available and both reserve it before either completed payment.

## The Solution

Implemented a **multi-layered defense** system with three critical fixes:

### 1. **Double-Check Inventory at Payment Time (Most Critical)**

**File:** [src/server/api/routers/stripe.ts](src/server/api/routers/stripe.ts)

When a Stripe payment completes, we now:

1. **Re-validate the queue record is still valid** - Must not be expired

   ```typescript
   .gt("expires_at", now.toISOString()) // Only get non-expired reservations
   ```

2. **Fetch venue configuration** - Determine the slot limit for the 15-minute window when the order was placed

   ```typescript
   const hourConfig = configDay.qs_config_hours.find((h) => h.hour === hour);
   const slotsPerWindow = Math.floor(hourConfig.slots_per_hour / 4);
   ```

3. **Count all committed inventory** in that time window:

   - Active pending reservations (not expired)
   - Confirmed paid transactions

   ```typescript
   const totalCommitted = confirmedTx.length + allReservations.length;
   ```

4. **REJECT if inventory exceeded:**
   ```typescript
   if (totalCommitted > slotsPerWindow) {
     // Reject the payment
     return { success: false, redirectUrl: "/payment-error" };
   }
   ```

This ensures that even if 2 payments come in simultaneously for the last slot, one will be rejected at confirmation time.

### 2. **Filter Expired Reservations Everywhere**

**Files:**

- [src/services/stripe.ts](src/services/stripe.ts)
- [src/server/api/routers/transaction.ts](src/server/api/routers/transaction.ts)

Expired pending reservations should NOT count toward the inventory limit. Updated all queries to explicitly filter:

```typescript
.gt("expires_at", now.toISOString()) // Only non-expired
```

This prevents stale reservations from customers who abandoned checkout from blocking new sales.

### 3. **Accurate Time Window Calculation**

When checking inventory at payment time, we calculate the exact 15-minute window the reservation was created in:

```typescript
const windowStart = new Date(queueCreatedDate);
windowStart.setMinutes(Math.floor(windowStart.getMinutes() / 15) * 15, 0, 0);
const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);
```

This ensures we're comparing apples-to-apples: only transactions/reservations from the SAME 15-minute period count.

## Flow Diagram

```
Customer 1                          Customer 2
    |                                   |
    v                                   v
Check availability (3 slots free)   Check availability (3 slots free)
    |                                   |
    v                                   v
Create checkout session             Create checkout session
Reserve slot (queue record) ✓        Reserve slot (queue record) ✓
    |                                   |
    v                                   v
Pay with Stripe                      Pay with Stripe
    |                                   |
    v                                   v
Payment confirmed                    Payment confirmed
(arrives first)                      (arrives second)
    |                                   |
    v                                   v
storeCheckoutSession():          storeCheckoutSession():
- Count pending: 1                - Count pending: 1
- Count confirmed: 1              - Count confirmed: 2
- Total: 2 of 3 ✓                 - Total: 3 of 3 ✓
- APPROVE payment                 - APPROVE payment
    |                                   |
    v                                   v
Insert transaction ✓               Insert transaction... but now
Remove from queue ✓                we have 3 of 3!
    |                                   v
    v                           Final check REJECTS this
Payment success ✓                 (totalCommitted > slotsPerWindow)
                                      |
                                      v
                            Payment error, refund issued
```

## What Changed

### Before

- ❌ Only validated at checkout initiation
- ❌ Counted all pending reservations, including expired ones
- ❌ No re-validation at payment confirmation
- ❌ Race condition allowed overselling

### After

- ✅ Validates at checkout initiation (first layer)
- ✅ Validates again at payment confirmation (second layer)
- ✅ Only counts non-expired reservations
- ✅ Rejects payment if inventory would be exceeded
- ✅ Race condition eliminated with atomic-like checks

## Database Schema Consideration

For production, consider adding a database-level constraint:

```sql
-- Add a function to prevent overselling at the DB level
CREATE OR REPLACE FUNCTION check_queue_skip_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_config_slots INT;
  v_current_count INT;
BEGIN
  -- Get slot limit for this venue and time
  SELECT COALESCE(SUM(slots_per_hour) / 4, 0) INTO v_config_slots
  FROM qs_config_hours
  WHERE config_day_id IN (
    SELECT id FROM qs_config_days
    WHERE venue_id = NEW.venue_id
  );

  -- Count non-expired pending + confirmed
  SELECT COUNT(*) INTO v_current_count
  FROM queue
  WHERE venue_id = NEW.venue_id
    AND payment_status = 'pending'
    AND expires_at > NOW()
  UNION ALL
  SELECT COUNT(*) FROM transactions
  WHERE venue_id = NEW.venue_id
    AND payment_status = 'paid'
    AND created_at > NOW() - INTERVAL '15 minutes';

  IF v_current_count >= v_config_slots THEN
    RAISE EXCEPTION 'Queue skip limit exceeded for this time window';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This would provide an additional safety net at the database level.

## Testing Scenarios

To verify the fix works:

1. **Sequential Purchase** - Should succeed ✓

   - 1 slot available
   - Customer A buys → succeeds
   - Inventory now 0
   - Customer B tries → rejected

2. **Simultaneous Purchase (Race Condition)** - Should fail gracefully ✓

   - 1 slot available
   - Both customers start checkout simultaneously
   - Both see 1 slot available
   - Both pay simultaneously
   - First payment confirms → succeeds
   - Second payment at confirmation → REJECTED (totalCommitted exceeds limit)

3. **Expired Reservation** - Should free up slot ✓
   - 1 slot available, fully reserved (pending)
   - Reservation expires after 30 minutes
   - New customer checks availability → should see 1 slot free
   - New customer can purchase

## Monitoring & Alerts

Add monitoring for:

- `failed_inventory_check` status in queue table
- Payment rejections due to inventory limits
- Average pending reservation expiration rate
- Spike in simultaneous checkouts for same venue/time

These indicate potential issues or load testing scenarios.

## Future Enhancements

1. **Implement WebSocket/Server-Sent Events** for real-time inventory updates
2. **Add Redis caching** for inventory counts (with careful TTL management)
3. **Implement Queue (FIFO)** - If oversold, queue customers for refund + option to reschedule
4. **Add Admin Dashboard** - Show current inventory status, pending reservations, expiration timeline
