/**
 * Race condition test for queue skip slot enforcement.
 *
 * Fires two concurrent checkout session creation requests against the local
 * dev server. With the fix in place, exactly one request should succeed (HTTP
 * 200) and the other should be rejected as sold-out (HTTP 409 CONFLICT).
 *
 * Prerequisites:
 *   1. Dev server is running:  npm run dev
 *   2. Venue is configured with exactly 1 slot for the current day/time
 *   3. Fill in VENUE_ID and PRICE below
 *
 * Usage:
 *   npm run test:race
 */

// ─── Configuration ────────────────────────────────────────────────────────────
// Set these to match a real venue in your database that has 1 slot configured
// for the current day and time period.
const VENUE_ID = "test-venue-3-sjpm"; // e.g. "my-venue"
const PRICE = 1; // replace with the venue's price in AUD (e.g. 15)
const BASE_URL = "http://localhost:3000";
// ──────────────────────────────────────────────────────────────────────────────

if (VENUE_ID === "REPLACE_WITH_VENUE_ID" || PRICE === 0) {
  console.error(
    "❌  Fill in VENUE_ID and PRICE at the top of scripts/test-race-condition.ts before running.",
  );
  process.exit(1);
}

interface TrpcSuccessResponse {
  result: { data: { json: { url: string | null; success: boolean } } };
}

interface TrpcErrorResponse {
  error: {
    json: {
      message: string;
      data: { code: string; httpStatus: number; path: string };
    };
  };
}

type TrpcResponse = TrpcSuccessResponse | TrpcErrorResponse;

function isError(r: TrpcResponse): r is TrpcErrorResponse {
  return "error" in r;
}

async function attemptPurchase(requestNumber: number): Promise<void> {
  const input = {
    venueName: VENUE_ID,
    venueId: VENUE_ID,
    price: PRICE,
    customerData: {
      name: `Race Test User ${requestNumber}`,
      email: `race-test-${requestNumber}@example.com`,
      sex: "M",
      receivePromo: false,
    },
  };

  const startMs = Date.now();

  const res = await fetch(`${BASE_URL}/api/trpc/stripe.createCheckoutSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // tRPC + SuperJSON wire format: wrap input as { json: <value> }
    body: JSON.stringify({ json: input }),
  });

  const elapsedMs = Date.now() - startMs;
  const body = (await res.json()) as TrpcResponse;

  if (isError(body)) {
    const { code, httpStatus } = body.error.json.data;
    console.log(
      `  Request ${requestNumber}  →  ❌  HTTP ${httpStatus} ${code}  (${elapsedMs}ms)`,
    );
    console.log(`             Message: ${body.error.json.message}`);
  } else {
    const { success, url } = body.result.data.json;
    console.log(
      `  Request ${requestNumber}  →  ✅  HTTP ${res.status} success=${String(success)}  (${elapsedMs}ms)`,
    );
    if (url) {
      // Stripe checkout URL — not followed, just logged for confirmation
      console.log(`             Stripe URL: ${url.slice(0, 60)}…`);
    }
  }
}

console.log("─".repeat(60));
console.log("Queue Skip Race Condition Test");
console.log(`Venue: ${VENUE_ID}  |  Price: $${PRICE} AUD`);
console.log(`Target: ${BASE_URL}`);
console.log("─".repeat(60));
console.log("\nFiring 2 requests simultaneously…\n");

await Promise.all([attemptPurchase(1), attemptPurchase(2)]);

console.log("\n─".repeat(30));
console.log("\nExpected: one ✅ and one ❌ CONFLICT (409).");
console.log("If both succeed  →  race condition is NOT fixed.");
console.log(
  "If both fail     →  venue may have 0 slots or queue skip is disabled.\n",
);
