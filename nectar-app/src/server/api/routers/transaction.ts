import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";

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

      const { data, error } = await supabase.from("transactions_log").insert({
        session_id,
        venue_id,
        customer_email,
        customer_name,
        payment_status,
        amount_total,
      });

      if (error) {
        throw new Error(error.message);
      }

      // If payment is successful, move from queue to confirmed transactions
      if (payment_status === "paid") {
        // Get the pending queue record
        const { data: queueRecord, error: queueError } = await supabase
          .from("queue")
          .select("*")
          .eq("session_id", session_id)
          .eq("payment_status", "pending")
          .single();

        if (queueError) {
          console.error("Failed to find queue record:", queueError);
          return data;
        }

        if (queueRecord) {
          // Insert into confirmed transactions
          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              session_id: session_id,
              customer_email: customer_email,
              amount_total: amount_total,
              payment_status: "paid",
              venue_id: venue_id,
              customer_name: customer_name,
              receive_promo: queueRecord.receive_promo,
            });

          if (insertError) {
            console.error("Failed to insert confirmed transaction:", insertError);
            return data;
          }

          // Remove from queue
          const { error: deleteError } = await supabase
            .from("queue")
            .delete()
            .eq("session_id", session_id);

          if (deleteError) {
            console.error("Failed to remove from queue:", deleteError);
          }
        }
      }

      return data;
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
      const now = new Date().toISOString();

      // Get confirmed paid transactions
      const { data: confirmedTx, error: confirmedError } = await supabase
        .from("transactions")
        .select("*")
        .eq("venue_id", venue_id)
        .eq("payment_status", "paid")
        .gte("created_at", start_time)
        .lt("created_at", end_time);

      // Get non-expired pending reservations from queue
      const { data: pendingTx, error: pendingError } = await supabase
        .from("queue")
        .select("*")
        .eq("venue_id", venue_id)
        .eq("payment_status", "pending")
        .gt("expires_at", now)
        .gte("created_at", start_time)
        .lt("created_at", end_time);

      if (confirmedError || pendingError) {
        throw new Error(confirmedError?.message || pendingError?.message);
      }

      // Combine confirmed and pending (non-expired) transactions
      const allTransactions = [
        ...(confirmedTx || []),
        ...(pendingTx || []),
      ];

      return allTransactions as Transaction[];

      if (error) {
        throw new Error(error.message);
      }

      return data as Transaction[];
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

      let query = supabase.from("transactions").select("*");

      // Apply filters if they are provided
      if (venue_id) {
        query = query.eq("venue_id", venue_id);
      }

      if (start_date) {
        // Convert start_date to start of day in UTC
        const startDate = new Date(start_date);
        startDate.setUTCHours(0, 0, 0, 0);
        query = query.gte("created_at", startDate.toISOString());
      }

      if (end_date) {
        // Convert end_date to end of day in UTC
        const endDate = new Date(end_date);
        endDate.setUTCHours(23, 59, 59, 999);
        query = query.lte("created_at", endDate.toISOString());
      }

      if (payment_status) {
        query = query.eq("payment_status", payment_status);
      }

      // Order by created_at in descending order (newest first)
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data as Transaction[];
    }),
});
