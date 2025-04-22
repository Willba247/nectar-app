import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";

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

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("venue_id", venue_id)
        .gte("created_at", start_time)
        .lt("created_at", end_time)
        .eq("payment_status", "paid");

      if (error) {
        throw new Error(error.message);
      }

      return data;
    }),
});
