import "server-only";
import { eq, and, gt, gte, lt, sql, or, inArray } from "drizzle-orm";
import { toZonedTime } from "date-fns-tz";
import { db } from "../index";
import {
  queue,
  qsConfigDays,
  qsConfigHours,
  transactions,
  venues,
} from "../schema";

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
 * Convert time string to minutes since midnight.
 * Tolerates "HH:MM" and "HH:MM:SS" formats.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  return hours * 60 + minutes;
}

/**
 * Find the active config hour for the current time at venue.
 * Handles cross-midnight slots by checking:
 * 1. Today's day configs (same-day and cross-midnight starting today)
 * 2. Yesterday's cross-midnight configs that spill into today
 *
 * PRECEDENCE RULES (deterministic tie-breaking):
 * 1. Today's same-day slots (highest priority)
 * 2. Today's cross-midnight slots (starting today)
 * 3. Yesterday's cross-midnight spillover (lowest priority)
 * Within same priority: prefer slot with latest startTime (most specific)
 *
 * Returns the matching config hour with its slotsPerHour/customSlots, or null if none.
 */
async function findActiveConfigHour(
  venueId: string,
  venueTimeZone: string,
): Promise<{
  configHourId: number;
  configDayId: number;
  slotsPerHour: number;
  customSlots: number | null;
} | null> {
  // CRITICAL: Use venue timezone for all calculations
  const venueNow = toZonedTime(new Date(), venueTimeZone);
  const todayDayOfWeek = venueNow.getDay(); // 0=Sunday, 6=Saturday
  const yesterdayDayOfWeek = (todayDayOfWeek + 6) % 7;
  const currentMinutes = venueNow.getHours() * 60 + venueNow.getMinutes();

  // Query: today's configs + yesterday's cross-midnight configs
  const configs = await db
    .select({
      configHourId: qsConfigHours.id,
      configDayId: qsConfigDays.id,
      dayOfWeek: qsConfigDays.dayOfWeek,
      slotsPerHour: qsConfigDays.slotsPerHour,
      startTime: qsConfigHours.startTime,
      endTime: qsConfigHours.endTime,
      endDayOffset: qsConfigHours.endDayOffset,
      customSlots: qsConfigHours.customSlots,
    })
    .from(qsConfigDays)
    .innerJoin(qsConfigHours, eq(qsConfigDays.id, qsConfigHours.configDayId))
    .where(
      and(
        eq(qsConfigDays.venueId, venueId),
        eq(qsConfigDays.isActive, true),
        eq(qsConfigHours.isActive, true),
        or(
          // Today's configs (both same-day and cross-midnight starting today)
          eq(qsConfigDays.dayOfWeek, todayDayOfWeek),
          // Yesterday's cross-midnight configs that spill into today
          and(
            eq(qsConfigDays.dayOfWeek, yesterdayDayOfWeek),
            eq(qsConfigHours.endDayOffset, 1),
          ),
        ),
      ),
    );

  // Filter to matching configs and assign priority
  type MatchedConfig = (typeof configs)[number] & { priority: number };
  const matchedConfigs: MatchedConfig[] = [];

  for (const config of configs) {
    const startMins = timeToMinutes(String(config.startTime));
    const endMins = timeToMinutes(String(config.endTime));
    const crossesMidnight = config.endDayOffset === 1;

    let isMatch = false;
    let priority = 3; // Default lowest

    if (config.dayOfWeek === todayDayOfWeek) {
      if (crossesMidnight) {
        // Cross-midnight slot starting today: active from startTime until midnight
        if (currentMinutes >= startMins) {
          isMatch = true;
          priority = 2; // Today cross-midnight
        }
      } else {
        // Same-day slot: current time must be within [startMins, endMins)
        if (currentMinutes >= startMins && currentMinutes < endMins) {
          isMatch = true;
          priority = 1; // Today same-day (highest)
        }
      }
    } else if (config.dayOfWeek === yesterdayDayOfWeek && crossesMidnight) {
      // Yesterday's cross-midnight slot spilling into today:
      // Active from midnight until endTime
      if (currentMinutes < endMins) {
        isMatch = true;
        priority = 3; // Yesterday spillover (lowest)
      }
    }

    if (isMatch) {
      matchedConfigs.push({ ...config, priority });
    }
  }

  if (matchedConfigs.length === 0) {
    return null;
  }

  // Sort by priority (ascending), then by startTime descending (latest start = most specific)
  matchedConfigs.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // Lower priority number = higher precedence
    }
    // Same priority: prefer latest startTime (most specific slot)
    const aStart = timeToMinutes(String(a.startTime));
    const bStart = timeToMinutes(String(b.startTime));
    return bStart - aStart; // Descending
  });

  const best = matchedConfigs[0]!;
  return {
    configHourId: best.configHourId,
    configDayId: best.configDayId,
    slotsPerHour: best.slotsPerHour,
    customSlots: best.customSlots,
  };
}

/**
 * Pre-check queue skip availability WITHOUT reserving a slot.
 * Use this BEFORE calling Stripe to avoid exposing Stripe errors
 * when queue skips are simply unavailable.
 *
 * Checks:
 * 1. Venue exists
 * 2. queueSkipEnabled is true
 * 3. There's an active config hour for current time
 *
 * Throws QueueSkipSoldOutError if unavailable.
 * Returns venue info if available.
 */
export async function checkQueueSkipAvailability(venueId: string): Promise<{
  available: true;
  venueTimeZone: string;
}> {
  // Check venue exists and has queue skips enabled
  const [venue] = await db
    .select({
      queueSkipEnabled: venues.queueSkipEnabled,
      timeZone: venues.timeZone,
    })
    .from(venues)
    .where(eq(venues.id, venueId));

  if (!venue) {
    throw new QueueSkipSoldOutError(
      "Queue skips are currently unavailable for this venue.",
    );
  }

  if (!venue.queueSkipEnabled) {
    throw new QueueSkipSoldOutError(
      "Queue skips are currently unavailable for this venue.",
    );
  }

  // Check there's an active config hour
  const activeConfig = await findActiveConfigHour(venueId, venue.timeZone);

  if (!activeConfig) {
    throw new QueueSkipSoldOutError(
      "Queue skips are not available for this venue at this time.",
    );
  }

  return {
    available: true,
    venueTimeZone: venue.timeZone,
  };
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
 * Count non-expired pending queue items for a venue in a time range.
 * Lightweight alternative to getPendingQueueItemsByTimeRange when only count is needed.
 */
export async function countPendingQueueItemsByTimeRange(params: {
  venueId: string;
  startTime: string;
  endTime: string;
}) {
  const { venueId, startTime, endTime } = params;
  const now = new Date();

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
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

  return result[0]?.count ?? 0;
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
 * Uses findActiveConfigHour() to determine the active time slot configuration,
 * supporting cross-midnight slots with deterministic precedence rules.
 *
 * @param params - Reservation parameters including venue and customer data
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
  // Legacy parameters - kept for backward compatibility but no longer used
  // Time slot is now determined automatically via findActiveConfigHour()
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
  dayOfWeek?: number;
}) {
  const {
    venueId,
    sessionId,
    customerEmail,
    customerName,
    amountTotal,
    receivePromo,
    expiresAt,
  } = params;

  // ============================================
  // CRITICAL: Check panic off state FIRST
  // This MUST be the first check before any other validation
  // ============================================
  const [venue] = await db
    .select({
      queueSkipEnabled: venues.queueSkipEnabled,
      timeZone: venues.timeZone,
    })
    .from(venues)
    .where(eq(venues.id, venueId));

  if (!venue) {
    console.error(`[validateAndReserveSlot] Venue not found: ${venueId}`);
    throw new QueueSkipSoldOutError(
      "Queue skip purchases are currently unavailable for this venue.",
    );
  }

  if (!venue.queueSkipEnabled) {
    console.log(
      `[validateAndReserveSlot] Queue skip disabled for venue: ${venueId}`,
    );
    throw new QueueSkipSoldOutError(
      "Queue skip purchases are currently unavailable for this venue.",
    );
  }
  // ============================================

  // CRITICAL: Find active config hour using venue timezone
  // This handles cross-midnight slots with deterministic precedence
  const activeConfig = await findActiveConfigHour(venueId, venue.timeZone);

  if (!activeConfig) {
    // No active time slot for current time
    throw new QueueSkipSoldOutError(
      "Queue skips are not available for this venue at this time.",
    );
  }

  // Use database transaction to ensure atomicity
  return await db.transaction(async (tx) => {
    const now = new Date();

    // Lock the config hour row to prevent concurrent modifications
    const [lockedConfig] = await tx
      .select({
        id: qsConfigHours.id,
        isActive: qsConfigHours.isActive,
        customSlots: qsConfigHours.customSlots,
      })
      .from(qsConfigHours)
      .where(eq(qsConfigHours.id, activeConfig.configHourId))
      .for("update");

    // Double-check the config is still active after acquiring lock
    if (!lockedConfig?.isActive) {
      throw new QueueSkipSoldOutError(
        "Queue skips are not available for this venue at this time.",
      );
    }

    // Calculate effective slot limit (customSlots overrides slotsPerHour)
    const effectiveSlots =
      lockedConfig.customSlots ?? activeConfig.slotsPerHour;

    // Count existing PENDING (non-expired) queue items for this config hour
    const pendingCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(queue)
      .where(
        and(
          eq(queue.configHourId, activeConfig.configHourId),
          eq(queue.paymentStatus, "pending"),
          gt(queue.expiresAt, now),
        ),
      );

    const pendingReservations = pendingCount[0]?.count ?? 0;

    // Count confirmed (paid) transactions already recorded for this config hour
    const confirmedCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.configHourId, activeConfig.configHourId),
          eq(transactions.paymentStatus, "paid"),
        ),
      );
    const confirmedTransactions = confirmedCount[0]?.count ?? 0;

    // Check capacity: pending reservations + confirmed purchases must be below limit
    if (pendingReservations + confirmedTransactions >= effectiveSlots) {
      throw new QueueSkipSoldOutError(
        `All queue skips for this time period are sold out. ${pendingReservations + confirmedTransactions}/${effectiveSlots} slots taken.`,
      );
    }

    // Capacity available - insert the reservation with configHourId
    const result = await tx
      .insert(queue)
      .values({
        sessionId,
        venueId,
        configHourId: activeConfig.configHourId,
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

export async function countPendingQueueItemsByTimeRangeGrouped(params: {
  venueIds: string[];
  startTime: string;
  endTime: string;
}): Promise<{ venueId: string; count: number }[]> {
  const { venueIds, startTime, endTime } = params;
  if (venueIds.length === 0) return [];
  const now = new Date();

  return db
    .select({
      venueId: queue.venueId,
      count: sql<number>`count(*)::int`,
    })
    .from(queue)
    .where(
      and(
        inArray(queue.venueId, venueIds),
        eq(queue.paymentStatus, "pending"),
        gt(queue.expiresAt, now),
        gte(queue.createdAt, new Date(startTime)),
        lt(queue.createdAt, new Date(endTime)),
      ),
    )
    .groupBy(queue.venueId);
}
