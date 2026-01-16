import Stripe from "stripe";
import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";
import {
  validateAndReserveSlot,
  QueueSkipSoldOutError,
} from "@/lib/db/queries/queue";

// Lazy initialization functions
let _stripeServer: Stripe | null = null;
function getStripeServer(): Stripe {
  if (!_stripeServer) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripeServer = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripeServer;
}

let _stripeClientPromise: Promise<StripeJS | null> | null = null;
function getStripeClient(): Promise<StripeJS | null> {
  if (!_stripeClientPromise) {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
    }
    _stripeClientPromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    );
  }
  return _stripeClientPromise;
}

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
  timeZone?: string; // Venue timezone for accurate period calculation
}

/**
 * Calculate the current 15-minute time period for slot validation
 */
function calculateTimePeriod(timeZone?: string): {
  start: Date;
  end: Date;
  dayOfWeek: number;
} {
  const now = new Date();

  // Get the current time in the venue's timezone
  let localDate: Date;
  if (timeZone) {
    try {
      // Convert to venue's local time
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
      const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "0");
      const month =
        parseInt(parts.find((p) => p.type === "month")?.value ?? "1") - 1;
      const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1");
      const hours = parseInt(
        parts.find((p) => p.type === "hour")?.value ?? "0",
      );
      const minutes = parseInt(
        parts.find((p) => p.type === "minute")?.value ?? "0",
      );

      localDate = new Date(year, month, day, hours, minutes);
    } catch {
      localDate = now; // Fallback to UTC
    }
  } else {
    localDate = now;
  }

  // Round down to nearest 15-minute period
  const roundedMinutes = Math.floor(localDate.getMinutes() / 15) * 15;
  const periodStart = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    localDate.getHours(),
    roundedMinutes,
    0,
    0,
  );

  // Period ends 15 minutes later
  const periodEnd = new Date(periodStart.getTime() + 15 * 60 * 1000);

  // Get day of week (0 = Sunday)
  const dayOfWeek = localDate.getDay();

  return {
    start: periodStart,
    end: periodEnd,
    dayOfWeek,
  };
}

export const stripeService = {
  createCheckoutSessionAndRedirect: async ({
    venueName,
    venueId,
    price,
    customerData,
    timeZone,
  }: CreateCheckoutSessionParams) => {
    try {
      // Calculate the current 15-minute time period
      const timePeriod = calculateTimePeriod(timeZone);

      // Step 1: Create Stripe checkout session FIRST (before validation)
      // This gives us a session ID to track the reservation
      const session = await getStripeServer().checkout.sessions.create({
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

      // Step 2: ATOMIC VALIDATION AND RESERVATION
      // This prevents race condition where multiple users can oversell queue skips
      // The database transaction ensures only one request can reserve a slot at a time
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiration

      try {
        await validateAndReserveSlot({
          venueId,
          sessionId: session.id,
          customerEmail: customerData.email,
          customerName: customerData.name,
          amountTotal: price * 100,
          receivePromo: customerData.receivePromo,
          expiresAt,
          timeRangeStart: timePeriod.start,
          timeRangeEnd: timePeriod.end,
          dayOfWeek: timePeriod.dayOfWeek,
        });
      } catch (error) {
        // If validation fails, we need to cancel the Stripe session
        // and throw a user-friendly error
        if (error instanceof QueueSkipSoldOutError) {
          // TODO: Cancel/expire the Stripe session here if possible
          console.error("Queue skip sold out:", error.message);
          throw error; // Re-throw to be handled by the caller
        }

        // For other errors, log and re-throw
        console.error("Failed to reserve queue skip:", error);
        throw new Error("Failed to reserve queue skip. Please try again.");
      }

      // Step 3: Redirect to Stripe checkout
      const stripe = await getStripeClient();
      if (stripe) {
        await stripe.redirectToCheckout({
          sessionId: session.id,
          mode: "payment",
          billingAddressCollection: "auto",
        });
      }

      return { url: session.url, success: true };
    } catch (error) {
      console.error("Stripe error:", error);
      throw error;
    }
  },
};
