import z from "node_modules/zod/lib";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";

export const priceRouter = createTRPCRouter({
  updateVenuePrice: publicProcedure
    .input(
      z.object({
        venueId: z.string(),
        price: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, price } = input;
      const { data, error } = await supabase
        .from("venues")
        .update({
          price: price,
        })
        .eq("id", venueId)
        .select();
      if (error) {
        throw new Error(error.message);
      }
      return data;
    }),
});
