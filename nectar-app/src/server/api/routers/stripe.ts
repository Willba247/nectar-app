import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { stripeService } from "@/services/stripe";

export const stripeRouter = createTRPCRouter({
  createCheckoutSession: publicProcedure
    .input(
      z.object({
        venueId: z.string(),
        price: z.number(),
        customerData: z.object({
          name: z.string(),
          email: z.string().email(),
          sex: z.string(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      return stripeService.createCheckoutSessionAndRedirect(input);
    }),
});
