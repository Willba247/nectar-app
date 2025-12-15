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
          receivePromo: z.boolean(),
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
        console.log("[session]", session);
        
        // Get the pending queue record
        const { data: queueRecord, error: queueError } = (await supabase
          .from("queue")
          .select("*")
          .eq("session_id", session.id)
          .eq("payment_status", "pending")
          .single()) as { data: { venue_id: string; customer_name: string; receive_promo: boolean } | null; error: any };

        if (queueError || !queueRecord) {
          console.error("Failed to find queue record:", queueError);
          return {
            success: false,
            redirectUrl: "/payment-error",
          };
        }

        if (session.payment_status === "paid") {
          // Insert into confirmed transactions
          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              session_id: session.id,
              customer_email: session.customer_email,
              amount_total: session.amount_total,
              payment_status: "paid",
              venue_id: queueRecord.venue_id,
              customer_name: queueRecord.customer_name,
              receive_promo: queueRecord.receive_promo,
            });

          if (insertError) {
            console.error("Failed to insert confirmed transaction:", insertError);
            return {
              success: false,
              redirectUrl: "/payment-error",
            };
          }

          // Remove from queue
          const { error: deleteError } = await supabase
            .from("queue")
            .delete()
            .eq("session_id", session.id);

          if (deleteError) {
            console.error("Failed to remove from queue:", deleteError);
          }
        } else {
          // Payment failed or expired - mark as cancelled in queue
          const { error: updateError } = await supabase
            .from("queue")
            .update({ payment_status: "cancelled" })
            .eq("session_id", session.id);

          if (updateError) {
            console.error("Failed to mark queue as cancelled:", updateError);
          }

          return {
            success: false,
            redirectUrl: "/payment-error",
          };
        }

        return {
          success: true,
          redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?email=${session.customer_email}`,
        };
      } catch (error) {
        console.error("Error storing checkout session:", error);
        return { success: false, redirectUrl: "/payment-error" };
      }
    }),
});
