import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { stripeService } from "@/services/stripe";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Server-side verification of queue skip availability.
 * This prevents race conditions where multiple users submit forms simultaneously.
 */
async function verifyQueueSkipAvailability(venueId: string): Promise<{
  isAvailable: boolean;
  availableSlots: number;
  error?: string;
}> {
  try {
    // Get venue with queue skip configuration
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select(
        `
        *,
        qs_config_days!venue_id (
          *,
          qs_config_hours (*)
        )
      `,
      )
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      return {
        isAvailable: false,
        availableSlots: 0,
        error: "Venue not found",
      };
    }

    // Get current time in venue's timezone
    const now = new Date();
    const timeZone = venue.time_zone || "UTC";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find((p) => p.type === "year")?.value || "0", 10);
    const month = parseInt(parts.find((p) => p.type === "month")?.value || "0", 10) - 1;
    const day = parseInt(parts.find((p) => p.type === "day")?.value || "0", 10);
    const hours = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

    const dayOfWeek = new Date(year, month, day).getDay();

    // Find config for current day
    const todayConfig = venue.qs_config_days?.find(
      (config: { day_of_week: number; is_active: boolean }) =>
        config.day_of_week === dayOfWeek && config.is_active,
    );

    if (!todayConfig) {
      return {
        isAvailable: false,
        availableSlots: 0,
        error: "No queue skip configuration for this day",
      };
    }

    // Check if current time is within any operating hour
    const currentTimeInMinutes = hours * 60 + minutes;
    const isWithinOperatingHours = todayConfig.qs_config_hours.some(
      (hour: { start_time: string; end_time: string; is_active: boolean }) => {
        if (!hour.is_active) return false;
        const [startH, startM] = hour.start_time.split(":").map(Number);
        const [endH, endM] = hour.end_time.split(":").map(Number);
        const startInMinutes = startH * 60 + startM;
        const endInMinutes = endH * 60 + endM;
        return currentTimeInMinutes >= startInMinutes && currentTimeInMinutes <= endInMinutes;
      },
    );

    if (!isWithinOperatingHours) {
      return {
        isAvailable: false,
        availableSlots: 0,
        error: "Venue is not currently open for queue skips",
      };
    }

    // Calculate current 15-minute period
    const roundedMinutes = Math.floor(minutes / 15) * 15;
    const periodStartUTC = new Date(Date.UTC(year, month, day, hours, roundedMinutes, 0));
    const periodEndUTC = new Date(periodStartUTC.getTime() + 15 * 60 * 1000);

    // Get configured slots for this day
    const configuredSlots = todayConfig.slots_per_hour || 0;

    // Count confirmed transactions in this 15-minute period
    const { data: confirmedTx, error: confirmedError } = await supabase
      .from("transactions")
      .select("id")
      .eq("venue_id", venueId)
      .eq("payment_status", "paid")
      .gte("created_at", periodStartUTC.toISOString())
      .lt("created_at", periodEndUTC.toISOString());

    if (confirmedError) {
      console.error("Error checking confirmed transactions:", confirmedError);
      return {
        isAvailable: false,
        availableSlots: 0,
        error: "Database error checking availability",
      };
    }

    // Count non-expired pending reservations in this 15-minute period
    const { data: pendingTx, error: pendingError } = await supabase
      .from("queue")
      .select("id")
      .eq("venue_id", venueId)
      .eq("payment_status", "pending")
      .gte("created_at", periodStartUTC.toISOString())
      .lt("created_at", periodEndUTC.toISOString())
      .gt("expires_at", now.toISOString());

    if (pendingError) {
      console.error("Error checking pending reservations:", pendingError);
      return {
        isAvailable: false,
        availableSlots: 0,
        error: "Database error checking availability",
      };
    }

    const usedSlots = (confirmedTx?.length || 0) + (pendingTx?.length || 0);
    const availableSlots = Math.max(0, configuredSlots - usedSlots);

    return {
      isAvailable: availableSlots > 0,
      availableSlots,
    };
  } catch (error) {
    console.error("Error verifying queue skip availability:", error);
    return {
      isAvailable: false,
      availableSlots: 0,
      error: "Unexpected error checking availability",
    };
  }
}

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
      // CRITICAL: Verify queue skip availability on server BEFORE creating checkout
      // This prevents race conditions where multiple users submit simultaneously
      const availability = await verifyQueueSkipAvailability(input.venueId);

      if (!availability.isAvailable) {
        throw new Error(
          availability.error || "No queue skips available. Please refresh and try again.",
        );
      }

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
        const queueRecord = await getPendingQueueItemBySessionId(session.id);

        if (!queueRecord) {
          console.error("Failed to find queue record:", session.id);
          return {
            success: false,
            redirectUrl: "/payment-error",
          };
        }

        if (session.payment_status === "paid") {
          // Insert into confirmed transactions
          await insertTransaction({
            sessionId: session.id,
            customerEmail: session.customer_email ?? null,
            amountTotal: session.amount_total ?? null,
            paymentStatus: "paid",
            venueId: queueRecord.venueId,
            customerName: queueRecord.customerName,
            receivePromo: queueRecord.receivePromo ?? false,
          });

          // Remove from queue
          const deletedQueueItem = await deleteQueueItem(session.id);
          if (!deletedQueueItem) {
            console.error("Failed to remove from queue:", session.id);
          }
        } else {
          // Payment failed or expired - mark as cancelled in queue
          const updatedQueueItem = await updateQueueItemStatus(
            session.id,
            "cancelled",
          );
          if (!updatedQueueItem) {
            console.error("Failed to mark queue as cancelled:", session.id);
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
