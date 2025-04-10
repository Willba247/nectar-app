import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { venueRouter } from "@/server/api/routers/venue";
import { stripeRouter } from "./routers/stripe";
import { transactionRouter } from "./routers/transaction";
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  transaction: transactionRouter,
  venue: venueRouter,
  stripe: stripeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
