import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { stripeService } from "@/services/stripe";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase/server";

export const stripeRouter = createTRPCRouter({
  createCheckoutSession: publicProcedure
    .input(
      z.object({
        venueName: z.string(),
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
  storeCheckoutSession: publicProcedure
    .input(
      z.object({
        session_id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const stripeServer = new Stripe(process.env.STRIPE_SECRET_KEY!);
      try {
        const session = await stripeServer.checkout.sessions.retrieve(
          input.session_id,
        );

        const { error } = await supabase.from("transactions").insert({
          session_id: session.id,
          customer_email: session.customer_email,
          amount_total: session.amount_total,
          payment_status: session.payment_status,
          venue_id: session.metadata?.venueId,
          customer_name: session.metadata?.customerName,
        });

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }
        return {
          success: true,
          redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success`,
        };
      } catch (error) {
        console.error("Error storing checkout session:", error);
        return { success: false, redirectUrl: "/payment-error" };
      }
    }),
});
