import { loadStripe, type Stripe as StripeJS } from "@stripe/stripe-js";

// Lazy initialization for browser-side Stripe SDK
let _stripeClientPromise: Promise<StripeJS | null> | null = null;

export function getStripeClient(): Promise<StripeJS | null> {
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
