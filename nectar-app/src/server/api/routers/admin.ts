import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { db } from "@/lib/db";
import { venues, auditLog } from "@/lib/db/schema";

export const adminRouter = createTRPCRouter({
  // ============================================
  // Group A: Venue Profile Fields
  // ============================================

  updateVenueDescription: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        description: z.string().max(2000).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ description: venues.description })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({ description: input.description, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.updateVenueDescription",
        changes: {
          description: { old: current.description, new: input.description },
        },
      });

      return updated;
    }),

  updateVenueStreetAddress: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        streetAddress: z.string().max(255).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ streetAddress: venues.streetAddress })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({ streetAddress: input.streetAddress, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.updateVenueStreetAddress",
        changes: {
          streetAddress: {
            old: current.streetAddress,
            new: input.streetAddress,
          },
        },
      });

      return updated;
    }),

  updateVenueCoverImage: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        coverImagePath: z.string().max(500).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ coverImagePath: venues.coverImagePath })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({ coverImagePath: input.coverImagePath, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.updateVenueCoverImage",
        changes: {
          coverImagePath: {
            old: current.coverImagePath,
            new: input.coverImagePath,
          },
        },
      });

      return updated;
    }),

  // ============================================
  // Group B: Pricing & Display Controls
  // ============================================

  updateVenuePriceDisplayMode: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        mode: z.enum(["queue_skip_only", "entry_fee_and_queue_skip"]),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ priceDisplayMode: venues.priceDisplayMode })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({ priceDisplayMode: input.mode, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.updateVenuePriceDisplayMode",
        changes: {
          priceDisplayMode: { old: current.priceDisplayMode, new: input.mode },
        },
      });

      return updated;
    }),

  updateVenueEntryFee: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        entryFee: z.number().min(0).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ entryFee: venues.entryFee })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({
          entryFee: input.entryFee?.toString() ?? null,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.updateVenueEntryFee",
        changes: {
          entryFee: {
            old: current.entryFee,
            new: input.entryFee?.toString() ?? null,
          },
        },
      });

      return updated;
    }),

  // ============================================
  // Group C: Operational Controls
  // ============================================

  toggleVenueQueueSkip: adminProcedure
    .input(
      z.object({
        venueId: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const [current] = await db
        .select({ queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, input.venueId));

      if (!current) {
        throw new Error("Venue not found");
      }

      const [updated] = await db
        .update(venues)
        .set({ queueSkipEnabled: input.enabled, updatedAt: new Date() })
        .where(eq(venues.id, input.venueId))
        .returning({ id: venues.id });

      await db.insert(auditLog).values({
        venueId: input.venueId,
        userId: null,
        action: "admin.toggleVenueQueueSkip",
        changes: {
          queueSkipEnabled: {
            old: current.queueSkipEnabled,
            new: input.enabled,
          },
        },
      });

      return updated;
    }),
});
