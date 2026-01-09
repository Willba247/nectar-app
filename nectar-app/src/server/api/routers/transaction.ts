import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  deleteExpiredQueueItems,
  deleteQueueItem,
  getPendingQueueItemBySessionId,
  getPendingQueueItemsByTimeRange,
} from "@/lib/db/queries/queue";
import {
  getTransactions as getTransactionsQuery,
  getTransactionsByTimeRange,
  insertTransaction,
  insertTransactionLog,
} from "@/lib/db/queries/transactions";
import type { QueueItem } from "@/lib/db/queries/queue";
import type { Transaction as DbTransaction } from "@/lib/db/queries/transactions";

type Transaction = {
  id: string;
  session_id: string;
  venue_id: string;
  customer_email: string;
  customer_name: string;
  payment_status: string;
  amount_total: number;
  created_at: string;
};

function mapTransactionToSnakeCase(transaction: DbTransaction): Transaction {
  return {
    id: transaction.sessionId,
    session_id: transaction.sessionId,
    venue_id: transaction.venueId,
    customer_email: transaction.customerEmail ?? "",
    customer_name: transaction.customerName ?? "",
    payment_status: transaction.paymentStatus ?? "",
    amount_total: transaction.amountTotal ?? 0,
    created_at:
      transaction.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function mapQueueItemToSnakeCase(queueItem: QueueItem): Transaction {
  return {
    id: queueItem.id,
    session_id: queueItem.sessionId,
    venue_id: queueItem.venueId,
    customer_email: queueItem.customerEmail,
    customer_name: queueItem.customerName,
    payment_status: queueItem.paymentStatus,
    amount_total: queueItem.amountTotal ?? 0,
    created_at: queueItem.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export const transactionRouter = createTRPCRouter({
  insertTradeLog: publicProcedure
    .input(
      z.object({
        session_id: z.string(),
        venue_id: z.string(),
        customer_email: z.string(),
        customer_name: z.string(),
        payment_status: z.string(),
        amount_total: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        session_id,
        venue_id,
        customer_email,
        customer_name,
        payment_status,
        amount_total,
      } = input;

      const insertedLog = await insertTransactionLog({
        sessionId: session_id,
        venueId: venue_id,
        customerEmail: customer_email,
        customerName: customer_name,
        paymentStatus: payment_status,
        amountTotal: amount_total,
      });

      // If payment is successful, move from queue to confirmed transactions
      if (payment_status === "paid") {
        // Get the pending queue record
        const queueRecord = await getPendingQueueItemBySessionId(session_id);

        if (queueRecord) {
          // Insert into confirmed transactions
          await insertTransaction({
            sessionId: session_id,
            customerEmail: customer_email,
            amountTotal: amount_total,
            paymentStatus: "paid",
            venueId: venue_id,
            customerName: customer_name,
            receivePromo: queueRecord.receivePromo ?? false,
          });

          // Remove from queue
          const deletedQueueItem = await deleteQueueItem(session_id);
          if (!deletedQueueItem) {
            console.error("Failed to remove from queue:", session_id);
          }
        }
      }

      return {
        id: insertedLog.sessionId,
        session_id: insertedLog.sessionId,
        venue_id: insertedLog.venueId,
        customer_email: insertedLog.customerEmail ?? "",
        customer_name: insertedLog.customerName ?? "",
        payment_status: insertedLog.paymentStatus ?? "",
        amount_total: insertedLog.amountTotal ?? 0,
        created_at:
          insertedLog.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    }),
  getTransactionByTime: publicProcedure
    .input(
      z.object({
        start_time: z.string(),
        end_time: z.string(),
        venue_id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { start_time, end_time, venue_id } = input;

      await deleteExpiredQueueItems();

      // Get confirmed paid transactions
      const confirmedTx = await getTransactionsByTimeRange({
        venueId: venue_id,
        startTime: start_time,
        endTime: end_time,
      });

      // Get non-expired pending reservations from queue
      const pendingTx = await getPendingQueueItemsByTimeRange({
        venueId: venue_id,
        startTime: start_time,
        endTime: end_time,
      });

      // Combine confirmed and pending (non-expired) transactions
      const allTransactions = [
        ...confirmedTx.map(mapTransactionToSnakeCase),
        ...pendingTx.map(mapQueueItemToSnakeCase),
      ];

      return allTransactions;
    }),
  getTransactions: publicProcedure
    .input(
      z.object({
        venue_id: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        payment_status: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { venue_id, start_date, end_date, payment_status } = input;
      const transactions = await getTransactionsQuery({
        venueId: venue_id,
        startDate: start_date,
        endDate: end_date,
        paymentStatus: payment_status,
      });

      return transactions.map(mapTransactionToSnakeCase);
    }),
});
