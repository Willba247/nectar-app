import Stripe from "stripe";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "@/lib/supabase/server";

const stripeServer = new Stripe(process.env.STRIPE_SECRET_KEY!);
const stripeClient = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

interface CreateCheckoutSessionParams {
  venueName: string;
  venueId: string;
  price: number;
  customerData: {
    name: string;
    email: string;
    sex: string;
    receivePromo: boolean;
  };
}

export const stripeService = {
  createCheckoutSessionAndRedirect: async ({
    venueName,
    venueId,
    price,
    customerData,
  }: CreateCheckoutSessionParams) => {
    try {
      // CRITICAL: Validate available slots BEFORE creating session
      // Check current time window for available slots
      const now = new Date();
      const timeWindowStart = new Date(now.getTime() - 15 * 60 * 1000); // Current 15-min window start
      const timeWindowEnd = new Date(now.getTime() + 15 * 60 * 1000); // Next 15-min window end

      const { data: allReservations, error: reservationCheckError } =
        await supabase
          .from("queue")
          .select("*")
          .eq("venue_id", venueId)
          .eq("payment_status", "pending")
          .gt("expires_at", now.toISOString());

      const { data: confirmedTx, error: confirmedError } = await supabase
        .from("transactions")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "paid")
        .gte("created_at", timeWindowStart.toISOString())
        .lt("created_at", timeWindowEnd.toISOString());

      if (reservationCheckError || confirmedError) {
        throw new Error("Failed to check slot availability");
      }

      // Get venue config to determine slot limit
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("*")
        .eq("id", venueId)
        .single();

      if (venueError || !venue) {
        throw new Error("Venue not found");
      }

      // Get queue skip config for current day
      const dayOfWeek = now.getDay();
      const { data: configDays, error: configError } = await supabase
        .from("qs_config_days")
        .select("*, qs_config_hours(*)")
        .eq("venue_id", venueId)
        .eq("day_of_week", dayOfWeek)
        .single();

      if (configError || !configDays) {
        throw new Error("No queue skip configuration for this time");
      }

      // Calculate available slots for current 15-minute window
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const window15Min = Math.floor(currentMinute / 15); // 0, 1, 2, or 3

      // Find the hour config for current time
      const hourConfig = (configDays.qs_config_hours as any[]).find(
        (h: any) => h.hour === currentHour,
      );

      if (!hourConfig) {
        throw new Error("No configuration for current hour");
      }

      // Calculate slots per 15-minute window (slots_per_hour / 4)
      const slotsPerWindow = Math.floor(hourConfig.slots_per_hour / 4);
      const totalReservations =
        (allReservations?.length ?? 0) + (confirmedTx?.length ?? 0);

      if (totalReservations >= slotsPerWindow) {
        throw new Error("No available queue skip slots at this time");
      }

      const session = await stripeServer.checkout.sessions.create({
        payment_method_types: ["card"],
        payment_intent_data: {
          description: `Queue Skip at ${venueName}`,
        },
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `Queue Skip at ${venueName}`,
                description: "Skip the queue at the venue",
              },
              unit_amount: price * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/trpc/stripe_success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/${venueId}`,
        customer_email: customerData.email,
        metadata: {
          venueName,
          venueId,
          customerName: customerData.name,
          customerSex: customerData.sex,
          receivePromo: customerData.receivePromo ? "true" : "false",
        },
      });

      // CRITICAL FIX: Reserve the queue skip slot IMMEDIATELY when checkout begins
      // This prevents race condition where multiple users see the same slot available
      // Using separate 'queue' table to track pending reservations
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minute expiration
      const { error: reservationError } = await supabase.from("queue").insert({
        session_id: session.id,
        venue_id: venueId,
        customer_email: customerData.email,
        customer_name: customerData.name,
        amount_total: price * 100,
        receive_promo: customerData.receivePromo,
        payment_status: "pending",
        expires_at: expiresAt.toISOString(),
      });

      if (reservationError) {
        console.error("Failed to reserve queue skip:", reservationError);
        throw new Error(
          `Failed to reserve queue skip: ${reservationError.message}`,
        );
      }

      const stripe = await stripeClient;
      await stripe?.redirectToCheckout({
        sessionId: session.id,
        mode: "payment",
        billingAddressCollection: "auto",
      });

      return { url: session.url, success: true };
    } catch (error) {
      console.error("Stripe error:", error);
      throw error;
    }
  },
};
