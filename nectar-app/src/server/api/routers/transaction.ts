import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";

export const transactionRouter = createTRPCRouter({
  insertTradeLog: publicProcedure
    .input(
      z.object({
        session_id: z.string(),
        venue_name: z.string(),
        customer_email: z.string(),
        payment_status: z.string(),
        amount_total: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const {
        session_id,
        venue_name,
        customer_email,
        payment_status,
        amount_total,
      } = input;

      const { data, error } = await supabase.from("transactions_log").insert({
        session_id,
        venue_name,
        customer_email,
        payment_status,
        amount_total,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    }),
});
