# Database Query Layer

This directory contains the database access layer using Drizzle ORM. All database queries should go through these functions for type safety and consistency.

## Structure

- `venues.ts` - Venue CRUD operations
- `transactions.ts` - Transaction and transaction log operations
- `queue.ts` - Queue (pending reservations) operations
- `configs.ts` - Queue skip configuration operations
- `index.ts` - Exports all query functions

## Usage

### Import queries

```typescript
// Import from the index file
import { getVenueById, getAllVenuesWithConfigs } from "@/lib/db/queries";

// Or import from specific modules
import { createVenue } from "@/lib/db/queries/venues";
import { insertTransaction } from "@/lib/db/queries/transactions";
```

### Example: Venue Operations

```typescript
// Get a single venue
const venue = await getVenueById("venue-slug");

// Get venue with all its configurations
const venueWithConfigs = await getVenueWithConfigs("venue-slug");

// Create a new venue
const newVenue = await createVenue({
  id: "new-venue",
  name: "New Venue",
  imageUrl: "https://example.com/image.jpg",
  price: "25.00",
  timeZone: "America/New_York",
});

// Update a venue
const updated = await updateVenue("venue-slug", {
  price: "30.00",
});

// Delete a venue
await deleteVenue("venue-slug");
```

### Example: Transaction Operations

```typescript
// Insert a transaction log
await insertTransactionLog({
  sessionId: "sess_123",
  venueId: "venue-slug",
  customerEmail: "user@example.com",
  customerName: "John Doe",
  paymentStatus: "pending",
  amountTotal: 2500, // cents
});

// Insert a confirmed transaction
await insertTransaction({
  sessionId: "sess_123",
  venueId: "venue-slug",
  customerEmail: "user@example.com",
  customerName: "John Doe",
  paymentStatus: "paid",
  amountTotal: 2500,
  receivePromo: true,
});

// Get transactions with filters
const transactions = await getTransactions({
  venueId: "venue-slug",
  startDate: "2024-01-01",
  endDate: "2024-01-31",
  paymentStatus: "paid",
});
```

### Example: Queue Operations

```typescript
// Insert pending reservation
await insertQueueItem({
  sessionId: "sess_123",
  venueId: "venue-slug",
  customerEmail: "user@example.com",
  customerName: "John Doe",
  amountTotal: 2500,
  receivePromo: false,
  paymentStatus: "pending",
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
});

// Get pending queue item
const queueItem = await getPendingQueueItem("sess_123");

// Delete from queue after payment
await deleteQueueItem("sess_123");

// Cleanup expired items
await deleteExpiredQueueItems();
```

### Example: Configuration Operations

```typescript
// Get config days for a venue
const configDays = await getConfigDaysByVenue("venue-slug");

// Create a config day
const configDay = await createConfigDay({
  venueId: "venue-slug",
  dayOfWeek: 1, // Monday
  slotsPerHour: 4,
  isActive: true,
});

// Create a config hour
const configHour = await createConfigHour({
  configDayId: configDay.id,
  startTime: "18:00:00",
  endTime: "23:00:00",
  customSlots: 6,
  isActive: true,
});

// Toggle config active status
await toggleConfigDayActive(configDay.id, false);

// Delete config (cascades to hours)
await deleteConfigDay(configDay.id);
```

## Type Safety

All functions are fully typed using Drizzle's type inference:

```typescript
import type { Venue, NewVenue, Transaction } from "@/lib/db/queries";

// NewVenue is the insert type (without auto-generated fields)
// Venue is the select type (with all fields)
```

## Best Practices

1. **Always use these query functions** instead of raw Drizzle queries in your application code
2. **Keep business logic in your routers/services**, not in query functions
3. **Query functions should be simple data access** - no complex business rules
4. **Add new queries here** as your app grows
5. **Use transactions** for operations that need to be atomic (will add transaction wrapper if needed)

## Migration from Supabase

These functions replace the previous Supabase client queries:

```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from("venues")
  .select("*")
  .eq("id", venueId)
  .single();

// After (Drizzle)
const venue = await getVenueById(venueId);
```
