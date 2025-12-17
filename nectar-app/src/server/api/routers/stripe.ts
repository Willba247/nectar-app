import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { stripeService } from "@/services/stripe";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";


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
        const now = new Date();
        const { data: queueRecord, error: queueError } = (await supabase
          .from("queue")
          .select("*")
          .eq("session_id", session.id)
          .eq("payment_status", "pending")
          .gt("expires_at", now.toISOString()) // CRITICAL: Only get non-expired reservations
          .single()) as { data: { venue_id: string; customer_name: string; receive_promo: boolean; created_at: string } | null; error: PostgrestError | null };

        if (queueError || !queueRecord) {
          console.error("Failed to find queue record:", queueError);
          return {
            success: false,
            redirectUrl: "/payment-error",
          };
        }

        if (session.payment_status === "paid") {
          // CRITICAL: Verify inventory is still available before confirming
          // This is the KEY FIX - double-check at payment time that we haven't oversold
          const queueCreatedDate = new Date(queueRecord.created_at);
          const dayOfWeek = queueCreatedDate.getDay();
          const hour = queueCreatedDate.getHours();

          // Get the venue config to determine slot limit for this 15-minute window
          const { data: configDay, error: configError } = await supabase
            .from("qs_config_days")
            .select("qs_config_hours(slots_per_hour, hour)")
            .eq("venue_id", queueRecord.venue_id)
            .eq("day_of_week", dayOfWeek)
            .single();

          if (configError || !configDay) {
            console.error("Failed to get venue config:", configError);
            // If no config, reject the payment
            return {
              success: false,
              redirectUrl: "/payment-error",
            };
          }

          // Find the hour config and calculate slots available in this period
          const hourConfig = (configDay.qs_config_hours as any[])?.find(
            (h: any) => h.hour === hour,
          );
          const slotsPerWindow = hourConfig
            ? Math.floor(hourConfig.slots_per_hour / 4)
            : 0;

          // Count all non-expired pending reservations in this 15-minute window
          const windowStart = new Date(queueCreatedDate);
          windowStart.setMinutes(Math.floor(windowStart.getMinutes() / 15) * 15, 0, 0);
          const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

          const { data: allReservations, error: resError } = await supabase
            .from("queue")
            .select("id")
            .eq("venue_id", queueRecord.venue_id)
            .eq("payment_status", "pending")
            .gt("expires_at", now.toISOString())
            .gte("created_at", windowStart.toISOString())
            .lt("created_at", windowEnd.toISOString());

          if (resError) {
            console.error("Failed to count reservations:", resError);
            return {
              success: false,
              redirectUrl: "/payment-error",
            };
          }

          // Count confirmed transactions in the same window
          const { data: confirmedTx, error: confirmedError } = await supabase
            .from("transactions")
            .select("id")\n            .eq("venue_id", queueRecord.venue_id)
            .eq("payment_status", "paid")
            .gte("created_at", windowStart.toISOString())
            .lt("created_at", windowEnd.toISOString());

          if (confirmedError) {
            console.error("Failed to check confirmed transactions:", confirmedError);
            return {
              success: false,
              redirectUrl: "/payment-error",
            };
          }

          const totalCommitted = (confirmedTx?.length ?? 0) + (allReservations?.length ?? 0);

          // CRITICAL: Reject if we've exceeded the slot limit (including this purchase)
          if (totalCommitted > slotsPerWindow) {
            console.error(
              `Inventory limit exceeded: ${totalCommitted} > ${slotsPerWindow}`,
            );
            // Mark as failed inventory check instead of proceeding
            await supabase
              .from("queue")
              .update({ payment_status: "failed_inventory_check" })
              .eq("session_id", session.id);

            return {
              success: false,
              redirectUrl: "/payment-error",
            };
          }

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
