import "server-only";
import { eq, and, gte, lt, lte, desc } from "drizzle-orm";
import { db } from "../index";
import { transactions, transactionsLog } from "../schema";

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionLog = typeof transactionsLog.$inferSelect;
export type NewTransactionLog = typeof transactionsLog.$inferInsert;

/**
 * Insert a transaction log entry
 */
export async function insertTransactionLog(data: NewTransactionLog) {
  const result = await db.insert(transactionsLog).values(data).returning();
  return result[0]!;
}

/**
 * Insert a confirmed transaction
 */
export async function insertTransaction(data: NewTransaction) {
  const result = await db.insert(transactions).values(data).returning();
  return result[0]!;
}

/**
 * Get transaction by session ID
 */
export async function getTransactionBySessionId(sessionId: string) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.sessionId, sessionId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get transactions by time range for a venue
 */
export async function getTransactionsByTimeRange(params: {
  venueId: string;
  startTime: string;
  endTime: string;
}) {
  const { venueId, startTime, endTime } = params;

  const result = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.venueId, venueId),
        eq(transactions.paymentStatus, "paid"),
        gte(transactions.createdAt, new Date(startTime)),
        lt(transactions.createdAt, new Date(endTime))
      )
    );

  return result;
}

/**
 * Get transactions with optional filters
 */
export async function getTransactions(filters?: {
  venueId?: string;
  startDate?: string;
  endDate?: string;
  paymentStatus?: string;
}) {
  let query = db.select().from(transactions);

  const conditions = [];

  if (filters?.venueId) {
    conditions.push(eq(transactions.venueId, filters.venueId));
  }

  if (filters?.startDate) {
    const startDate = new Date(filters.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    conditions.push(gte(transactions.createdAt, startDate));
  }

  if (filters?.endDate) {
    const endDate = new Date(filters.endDate);
    endDate.setUTCHours(23, 59, 59, 999);
    conditions.push(lte(transactions.createdAt, endDate));
  }

  if (filters?.paymentStatus) {
    conditions.push(eq(transactions.paymentStatus, filters.paymentStatus));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query.orderBy(desc(transactions.createdAt));

  return result;
}

/**
 * Count transactions for a venue
 */
export async function countTransactionsByVenue(venueId: string) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.venueId, venueId));

  return result.length;
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  sessionId: string,
  paymentStatus: string
) {
  const result = await db
    .update(transactions)
    .set({ paymentStatus })
    .where(eq(transactions.sessionId, sessionId))
    .returning();

  return result[0] ?? null;
}

/**
 * Check if transaction exists
 */
export async function transactionExists(sessionId: string): Promise<boolean> {
  const result = await db
    .select({ sessionId: transactions.sessionId })
    .from(transactions)
    .where(eq(transactions.sessionId, sessionId))
    .limit(1);

  return result.length > 0;
}
