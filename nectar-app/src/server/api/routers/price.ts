import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { updateVenuePrice } from "@/lib/db/queries/price";

export const priceRouter = createTRPCRouter({
  updateVenuePrice: publicProcedure
    .input(
      z.object({
        venueId: z.string(),
        price: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const { venueId, price } = input;
      const updatedVenue = await updateVenuePrice(venueId, price);
      return updatedVenue;
    }),
});
