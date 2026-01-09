import "server-only";
import { eq, and, gt, gte, lt } from "drizzle-orm";
import { db } from "../index";
import { queue } from "../schema";

export type QueueItem = typeof queue.$inferSelect;
export type NewQueueItem = typeof queue.$inferInsert;

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
      and(eq(queue.sessionId, sessionId), eq(queue.paymentStatus, "pending"))
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
        gt(queue.expiresAt, now)
      )
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
        lt(queue.createdAt, new Date(endTime))
      )
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
  paymentStatus: string
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
 */
export async function countPendingQueueItems(venueId: string) {
  const now = new Date();

  const result = await db
    .select()
    .from(queue)
    .where(
      and(
        eq(queue.venueId, venueId),
        eq(queue.paymentStatus, "pending"),
        gt(queue.expiresAt, now)
      )
    );

  return result.length;
}

/**
 * Get all queue items for a venue
 */
export async function getQueueItemsByVenue(venueId: string) {
  return await db.select().from(queue).where(eq(queue.venueId, venueId));
}
