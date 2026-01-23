import "server-only";
import { eq, and, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "../index";
import { queue, qsConfigDays, transactions } from "../schema";

export type QueueItem = typeof queue.$inferSelect;
export type NewQueueItem = typeof queue.$inferInsert;

/**
 * Custom error for sold out conditions
 */
export class QueueSkipSoldOutError extends Error {
  constructor(
    message: string,
    public readonly nextAvailable?: { day: string; time: string },
  ) {
    super(message);
    this.name = "QueueSkipSoldOutError";
  }
}

/**
 * Insert a new queue item (pending reservation)
 */
export async function insertQueueItem(data: NewQueueItem) {
  const result = await db.insert(queue).values(data).returning();
  return result[0]!;
}

/**
 * Get queue item by session ID
 */
export async function getQueueItemBySessionId(sessionId: string) {
  const result = await db
    .select()
    .from(queue)
    .where(eq(queue.sessionId, sessionId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get pending queue item by session ID (no expiry check)
 */
export async function getPendingQueueItemBySessionId(sessionId: string) {
  const result = await db
    .select()
    .from(queue)
    .where(
      and(eq(queue.sessionId, sessionId), eq(queue.paymentStatus, "pending")),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get pending queue item by session ID (not expired)
 */
export async function getPendingQueueItem(sessionId: string) {
  const now = new Date();

  const result = await db
    .select()
    .from(queue)
    .where(
      and(
        eq(queue.sessionId, sessionId),
        eq(queue.paymentStatus, "pending"),
        gt(queue.expiresAt, now),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get non-expired pending queue items for a venue in a time range
 */
export async function getPendingQueueItemsByTimeRange(params: {
  venueId: string;
  startTime: string;
  endTime: string;
}) {
  const { venueId, startTime, endTime } = params;
  const now = new Date();

  const result = await db
    .select()
    .from(queue)
    .where(
      and(
        eq(queue.venueId, venueId),
        eq(queue.paymentStatus, "pending"),
        gt(queue.expiresAt, now),
        gte(queue.createdAt, new Date(startTime)),
        lt(queue.createdAt, new Date(endTime)),
      ),
    );

  return result;
}

/**
 * Delete queue item by session ID
 */
export async function deleteQueueItem(sessionId: string) {
  const result = await db
    .delete(queue)
    .where(eq(queue.sessionId, sessionId))
    .returning();

  return result[0] ?? null;
}

/**
 * Update queue item payment status
 */
export async function updateQueueItemStatus(
  sessionId: string,
  paymentStatus: string,
) {
  const result = await db
    .update(queue)
    .set({ paymentStatus })
    .where(eq(queue.sessionId, sessionId))
    .returning();

  return result[0] ?? null;
}

/**
 * Delete expired queue items (cleanup)
 */
export async function deleteExpiredQueueItems() {
  const now = new Date();

  const result = await db
    .delete(queue)
    .where(lt(queue.expiresAt, now))
    .returning();

  return result;
}

/**
 * Count pending (non-expired) queue items for a venue
 * Uses SQL COUNT(*) instead of fetching all rows
 */
export async function countPendingQueueItems(venueId: string) {
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queue)
    .where(
      and(
        eq(queue.venueId, venueId),
        eq(queue.paymentStatus, "pending"),
        gt(queue.expiresAt, now),
      ),
    );

  return result[0]?.count ?? 0;
}

/**
 * Get all queue items for a venue
 */
export async function getQueueItemsByVenue(venueId: string) {
  return await db.select().from(queue).where(eq(queue.venueId, venueId));
}

/**
 * ATOMIC CHECK AND RESERVE: Validate availability and reserve a slot in a single transaction
 * This prevents race conditions where multiple users can oversell queue skips.
 *
 * @param params - Reservation parameters including venue, time range, and customer data
 * @returns The created queue item
 * @throws QueueSkipSoldOutError if no slots are available
 */
export async function validateAndReserveSlot(params: {
  venueId: string;
  sessionId: string;
  customerEmail: string;
  customerName: string;
  amountTotal: number;
  receivePromo: boolean;
  expiresAt: Date;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  dayOfWeek: number;
}) {
  const {
    venueId,
    sessionId,
    customerEmail,
    customerName,
    amountTotal,
    receivePromo,
    expiresAt,
    timeRangeStart,
    timeRangeEnd,
    dayOfWeek,
  } = params;

  // CRITICAL: Check if config exists BEFORE starting transaction
  // This prevents holding database connections when validation fails early
  const preCheckConfig = await db
    .select({
      slotsPerHour: qsConfigDays.slotsPerHour,
      isActive: qsConfigDays.isActive,
    })
    .from(qsConfigDays)
    .where(
      and(
        eq(qsConfigDays.venueId, venueId),
        eq(qsConfigDays.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1);

  const preCheck = preCheckConfig[0];

  if (!preCheck?.isActive) {
    // Fail fast without opening a transaction
    throw new QueueSkipSoldOutError(
      "Queue skips are not available for this venue at this time.",
    );
  }

  // Use database transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    const now = new Date();

    // Step 1: Get configured slot limit for this day and venue (with row lock)
    // Using FOR UPDATE to lock this row and prevent concurrent modifications
    // We already verified this exists above, so this should always return a result
    const configResult = await tx
      .select({
        slotsPerHour: qsConfigDays.slotsPerHour,
        isActive: qsConfigDays.isActive,
      })
      .from(qsConfigDays)
      .where(
        and(
          eq(qsConfigDays.venueId, venueId),
          eq(qsConfigDays.dayOfWeek, dayOfWeek),
        ),
      )
      .for("update")
      .limit(1);

    const config = configResult[0];

    // Double-check in case config was disabled between pre-check and lock
    if (!config?.isActive) {
      throw new QueueSkipSoldOutError(
        "Queue skips are not available for this venue at this time.",
      );
    }

    const configuredSlots = config.slotsPerHour; // Note: This represents slots per 15-minute period

    // Step 2: Count existing CONFIRMED transactions in this time period
    const confirmedCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.venueId, venueId),
          eq(transactions.paymentStatus, "paid"),
          gte(transactions.createdAt, timeRangeStart),
          lt(transactions.createdAt, timeRangeEnd),
        ),
      );

    const confirmedReservations = confirmedCount[0]?.count ?? 0;

    // Step 3: Count existing PENDING (non-expired) queue items in this time period
    const pendingCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(queue)
      .where(
        and(
          eq(queue.venueId, venueId),
          eq(queue.paymentStatus, "pending"),
          gt(queue.expiresAt, now),
          gte(queue.createdAt, timeRangeStart),
          lt(queue.createdAt, timeRangeEnd),
        ),
      );

    const pendingReservations = pendingCount[0]?.count ?? 0;

    // Step 4: Calculate total reservations and check capacity
    const totalReservations = confirmedReservations + pendingReservations;

    if (totalReservations >= configuredSlots) {
      // SOLD OUT - reject the reservation
      throw new QueueSkipSoldOutError(
        `All queue skips for this time period are sold out. ${totalReservations}/${configuredSlots} slots reserved.`,
      );
    }

    // Step 5: Capacity available - insert the reservation
    const result = await tx
      .insert(queue)
      .values({
        sessionId,
        venueId,
        customerEmail,
        customerName,
        amountTotal,
        receivePromo,
        paymentStatus: "pending",
        expiresAt,
      })
      .returning();

    const queueItem = result[0];

    if (!queueItem) {
      throw new Error("Failed to create queue reservation");
    }

    // Transaction commits here automatically if no errors
    return queueItem;
  });
}
