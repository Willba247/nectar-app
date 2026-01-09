import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { stripeService } from "@/services/stripe";
import Stripe from "stripe";
import {
  deleteQueueItem,
  getPendingQueueItem,
  insertTransaction,
  updateQueueItemStatus,
} from "@/lib/db/queries";

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
        const queueRecord = await getPendingQueueItem(session.id);

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
