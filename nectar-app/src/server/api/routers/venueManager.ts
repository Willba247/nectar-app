import { createTRPCRouter, venueManagerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  and,
  eq,
  gte,
  lte,
  ilike,
  or,
  desc,
  count,
  sql,
  ne,
  inArray,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactionsLog,
  venues,
  qsConfigDays,
  qsConfigHours,
  queue,
  auditLog,
  demandSignals,
  venuePayoutSettings,
} from "@/lib/db/schema";
import { clearCachedVenues } from "@/server/api/routers/venue";
import { computeDynamicPrice } from "@/lib/pricing/demandAlgorithm";
import { Resend } from "resend";
import { env } from "@/env";

// Hard price clamps — applied after algorithm output regardless of computed value
const MIN_PRICE = 0.5;
const MAX_PRICE = 999.99;

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize transaction rows to ensure non-null paymentStatus and amountTotal.
 * Coerces null values at the API boundary so UI receives clean values.
 */
function normalizeTransactions<
  T extends { paymentStatus: string | null; amountTotal: number | null },
>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    paymentStatus: row.paymentStatus ?? "unknown",
    amountTotal: row.amountTotal ?? 0,
  }));
}

// ============================================
// Helper Functions for Phase 3
// ============================================

/**
 * Convert time string to minutes since midnight for safe numeric comparisons.
 * Tolerates "HH:MM" and "HH:MM:SS" formats.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  return hours * 60 + minutes;
}

/**
 * Convert time slot to linear minute range for overlap detection.
 * Cross-midnight slots (endDayOffset=1) get +1440 to end time.
 */
function toLinearMinuteRange(
  startTime: string,
  endTime: string,
  endDayOffset: number,
): { startMins: number; endMins: number } {
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime) + (endDayOffset === 1 ? 1440 : 0);
  return { startMins, endMins };
}

/**
 * Validate time slot configuration.
 * Rules:
 * - Reject zero-length slots (startTime == endTime)
 * - If endDayOffset=0: require endTime > startTime (same day)
 * - If endDayOffset=1: require endTime <= startTime (crosses midnight)
 *   - Disallow endDayOffset=1 when endTime > startTime (would be 24h+ config)
 */
function validateTimeRange(
  startTime: string,
  endTime: string,
  endDayOffset: number,
): void {
  const rawStart = timeToMinutes(startTime);
  const rawEnd = timeToMinutes(endTime);

  // Zero-length check (same start and end is always invalid)
  if (rawStart === rawEnd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Start time and end time cannot be the same",
    });
  }

  if (endDayOffset === 0) {
    // Same-day slot: endTime must be AFTER startTime
    if (rawEnd <= rawStart) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Start time must be before end time for same-day slots",
      });
    }
  } else {
    // Cross-midnight slot (endDayOffset=1): endTime must be BEFORE or EQUAL to startTime
    // If endTime > startTime with offset=1, that would create a 24h+ config (invalid)
    if (rawEnd > rawStart) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Cross-midnight slots require end time to be earlier than start time (e.g., 19:00-02:00)",
      });
    }
  }
}

/**
 * Verify configDayId belongs to venue before ANY mutation.
 */
async function verifyDayOwnership(
  configDayId: number,
  venueId: string,
): Promise<typeof qsConfigDays.$inferSelect> {
  const [day] = await db
    .select()
    .from(qsConfigDays)
    .where(
      and(eq(qsConfigDays.id, configDayId), eq(qsConfigDays.venueId, venueId)),
    );
  if (!day) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Configuration day not found",
    });
  }
  return day;
}

/**
 * Verify configHourId belongs to venue via JOIN before mutation.
 */
async function verifyHourOwnership(
  configHourId: number,
  venueId: string,
): Promise<{ hourId: number; configDayId: number }> {
  const [hour] = await db
    .select({
      hourId: qsConfigHours.id,
      configDayId: qsConfigHours.configDayId,
    })
    .from(qsConfigHours)
    .innerJoin(qsConfigDays, eq(qsConfigHours.configDayId, qsConfigDays.id))
    .where(
      and(
        eq(qsConfigHours.id, configHourId),
        eq(qsConfigDays.venueId, venueId),
      ),
    );
  if (!hour) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Configuration hour not found",
    });
  }
  return hour;
}

/**
 * Validate no overlapping time ranges within same configDayId.
 * Uses linear minute axis for cross-midnight support.
 * MUST be called within a transaction for race safety.
 */
async function validateNoTimeOverlap(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  configDayId: number,
  startTime: string,
  endTime: string,
  endDayOffset: number,
  excludeHourId?: number,
): Promise<void> {
  // First validate the time range itself
  validateTimeRange(startTime, endTime, endDayOffset);

  const { startMins: newStart, endMins: newEnd } = toLinearMinuteRange(
    startTime,
    endTime,
    endDayOffset,
  );

  // Fetch existing active hours for this day
  const conditions = [
    eq(qsConfigHours.configDayId, configDayId),
    eq(qsConfigHours.isActive, true),
  ];
  if (excludeHourId) {
    conditions.push(ne(qsConfigHours.id, excludeHourId));
  }

  const existingHours = await tx
    .select({
      id: qsConfigHours.id,
      startTime: qsConfigHours.startTime,
      endTime: qsConfigHours.endTime,
      endDayOffset: qsConfigHours.endDayOffset,
    })
    .from(qsConfigHours)
    .where(and(...conditions));

  for (const existing of existingHours) {
    const { startMins: existStart, endMins: existEnd } = toLinearMinuteRange(
      String(existing.startTime),
      String(existing.endTime),
      existing.endDayOffset ?? 0,
    );

    // Overlap check: ranges overlap if NOT (newEnd <= existStart OR newStart >= existEnd)
    const overlaps = !(newEnd <= existStart || newStart >= existEnd);
    if (overlaps) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Time range ${startTime}-${endTime} overlaps with existing slot ${existing.startTime}-${existing.endTime}`,
      });
    }
  }
}

// ============================================
// Zod Schemas
// ============================================

const updatePayoutSettingsInput = z.object({
  payoutPeriod: z.enum(["weekly", "fortnightly", "monthly"]),
  accountName: z.string().min(1).max(255),
  bsb: z
    .string()
    .regex(/^\d{3}-\d{3}$/, "BSB must be in the format XXX-XXX (e.g. 062-000)"),
  accountNumber: z
    .string()
    .regex(/^\d{6,10}$/, "Account number must be 6–10 digits"),
});

const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endDayOffset: z.number().int().min(0).max(1).default(0),
  customSlots: z
    .number()
    .int()
    .min(1, "Custom slots must be at least 1")
    .max(100, "Custom slots cannot exceed 100")
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

const updateQueueSkipConfigInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_day"),
    dayOfWeek: z.number().int().min(0).max(6),
    slotsPerHour: z
      .number()
      .int()
      .min(1, "Slots per hour must be at least 1")
      .max(100, "Slots per hour cannot exceed 100")
      .default(10),
    times: z.array(timeSlotSchema).optional(),
  }),
  z.object({
    action: z.literal("update_day"),
    configDayId: z.number().int().positive(),
    slotsPerHour: z
      .number()
      .int()
      .min(1, "Slots per hour must be at least 1")
      .max(100, "Slots per hour cannot exceed 100")
      .optional(),
    dayIsActive: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("delete_day"),
    configDayId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("add_time"),
    configDayId: z.number().int().positive(),
    times: z.array(timeSlotSchema).min(1, "At least one time slot required"),
  }),
  z.object({
    action: z.literal("update_time"),
    configHourId: z.number().int().positive(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format")
      .optional(),
    endDayOffset: z.number().int().min(0).max(1).optional(),
    customSlots: z
      .number()
      .int()
      .min(1, "Custom slots must be at least 1")
      .max(100)
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("delete_time"),
    configHourId: z.number().int().positive(),
  }),
]);

export const venueManagerRouter = createTRPCRouter({
  whoami: venueManagerProcedure.query(async ({ ctx }) => {
    const { venueId, userId, email } = ctx.venue;

    const { data: venue, error: venueError } = await ctx.supabaseRls
      .from("venues")
      .select("id, name, image_url, price, time_zone")
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: venueError?.message ?? "Failed to load venue",
      });
    }

    const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await ctx.supabaseRls
      .from("transactions_log")
      .select("session_id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .gte("created_at", since);

    if (countError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: countError.message,
      });
    }

    return {
      venue,
      user: {
        userId,
        email,
        venueId,
      },
      last31DaysTransactionCount: count ?? 0,
    };
  }),

  getTransactionLogs: venueManagerProcedure
    .input(
      z.object({
        filter: z.enum(["all", "paid"]).default("all"),
        dateStart: z.date().optional(),
        dateEnd: z.date().optional(),
        search: z.string().optional(), // Single-field search: email OR name
        page: z.number().int().min(0).default(0),
        limit: z
          .union([z.literal(25), z.literal(50), z.literal(100)])
          .default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Apply safe defaults if dates missing (last 31 days - max allowed range)
      let dateStart = input.dateStart;
      let dateEnd = input.dateEnd;

      if (!dateStart && !dateEnd) {
        dateEnd = new Date();
        dateStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      // Validate date range
      if (dateStart && dateEnd) {
        if (dateEnd < dateStart) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "End date must be after start date",
          });
        }

        const daysDiff =
          (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 31) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Date range cannot exceed 31 days",
          });
        }
      }

      // Normalize dateEnd to end-of-day (23:59:59.999) for date-only pickers
      // This ensures same-day transactions are included (e.g., dateEnd=Feb11 captures Feb11 23:59:59)
      let normalizedDateEnd = dateEnd;
      if (normalizedDateEnd) {
        normalizedDateEnd = new Date(normalizedDateEnd);
        normalizedDateEnd.setHours(23, 59, 59, 999);
      }

      // Build WHERE conditions
      const conditions = [eq(transactionsLog.venueId, ctx.venue.venueId)];

      if (input.filter === "paid") {
        conditions.push(eq(transactionsLog.paymentStatus, "paid"));
      }

      if (dateStart) {
        conditions.push(gte(transactionsLog.createdAt, dateStart));
      }

      if (normalizedDateEnd) {
        conditions.push(lte(transactionsLog.createdAt, normalizedDateEnd));
      }

      if (input.search) {
        const trimmedSearch = input.search.trim().slice(0, 255);
        if (trimmedSearch) {
          const searchPattern = `%${trimmedSearch}%`;
          conditions.push(
            or(
              sql`${transactionsLog.customerEmail}::text ILIKE ${searchPattern}`,
              sql`${transactionsLog.customerName}::text ILIKE ${searchPattern}`,
            ) as any as SQL<unknown>,
          );
        }
      }

      // Count total matching rows + sum paid amounts in parallel
      const paidConditions = [
        ...conditions,
        eq(transactionsLog.paymentStatus, "paid"),
      ];

      const [[countResult], [sumResult]] = await Promise.all([
        db
          .select({ count: count() })
          .from(transactionsLog)
          .where(and(...conditions)),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${transactionsLog.amountTotal}), 0)::int`,
          })
          .from(transactionsLog)
          .where(and(...paidConditions)),
      ]);

      // Drizzle/Postgres count() may return bigint or string; coerce safely
      let realTotal = Number(countResult?.count ?? 0);
      if (Number.isNaN(realTotal)) realTotal = 0;
      const cappedTotal = Math.min(realTotal, 1000);

      // Enforce 1000-row hard cap across pagination
      const offset = input.page * input.limit;

      if (offset >= 1000) {
        // User has paginated beyond max allowed rows
        return {
          transactions: [],
          total: cappedTotal,
          grossSales: Number(sumResult?.total ?? 0),
          page: input.page,
          limit: input.limit,
        };
      }

      const effectiveLimit = Math.min(input.limit, 100, 1000 - offset);

      // Fetch paginated rows - select only columns needed for dashboard display
      const transactions = await db
        .select({
          sessionId: transactionsLog.sessionId,
          customerEmail: transactionsLog.customerEmail,
          customerName: transactionsLog.customerName,
          paymentStatus: transactionsLog.paymentStatus,
          amountTotal: transactionsLog.amountTotal,
          createdAt: transactionsLog.createdAt,
        })
        .from(transactionsLog)
        .where(and(...conditions))
        .orderBy(desc(transactionsLog.createdAt))
        .limit(effectiveLimit)
        .offset(offset);

      return {
        transactions: normalizeTransactions(transactions),
        total: cappedTotal,
        grossSales: Number(sumResult?.total ?? 0),
        page: input.page,
        limit: input.limit,
      };
    }),

  getTransactionLogsForExport: venueManagerProcedure
    .input(
      z.object({
        filter: z.enum(["all", "paid"]).default("all"),
        dateStart: z.date().optional(),
        dateEnd: z.date().optional(),
        search: z.string().optional(), // Single-field search: email OR name
      }),
    )
    .query(async ({ ctx, input }) => {
      // Apply safe defaults if dates missing (last 31 days - max allowed range)
      let dateStart = input.dateStart;
      let dateEnd = input.dateEnd;

      if (!dateStart && !dateEnd) {
        dateEnd = new Date();
        dateStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      }

      // Validate date range (same logic as getTransactionLogs)
      if (dateStart && dateEnd) {
        if (dateEnd < dateStart) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "End date must be after start date",
          });
        }

        const daysDiff =
          (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 31) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Date range cannot exceed 31 days",
          });
        }
      }

      // Normalize dateEnd to end-of-day to ensure same-day transactions included
      let normalizedDateEnd = dateEnd;
      if (normalizedDateEnd) {
        normalizedDateEnd = new Date(normalizedDateEnd);
        normalizedDateEnd.setHours(23, 59, 59, 999);
      }

      // Build WHERE conditions (same as getTransactionLogs)
      const conditions = [eq(transactionsLog.venueId, ctx.venue.venueId)];

      if (input.filter === "paid") {
        conditions.push(eq(transactionsLog.paymentStatus, "paid"));
      }

      if (dateStart) {
        conditions.push(gte(transactionsLog.createdAt, dateStart));
      }

      if (normalizedDateEnd) {
        conditions.push(lte(transactionsLog.createdAt, normalizedDateEnd));
      }

      if (input.search) {
        const trimmedSearch = input.search.trim().slice(0, 255);
        if (trimmedSearch) {
          const searchPattern = `%${trimmedSearch}%`;
          conditions.push(
            or(
              sql`${transactionsLog.customerEmail}::text ILIKE ${searchPattern}`,
              sql`${transactionsLog.customerName}::text ILIKE ${searchPattern}`,
            ) as any as SQL<unknown>,
          );
        }
      }

      // Fetch up to 1000 rows (no pagination)
      const transactions = await db
        .select()
        .from(transactionsLog)
        .where(and(...conditions))
        .orderBy(desc(transactionsLog.createdAt))
        .limit(1000); // Hard cap at 1000

      const normalized = normalizeTransactions(transactions);
      return {
        transactions: normalized,
        total: normalized.length, // Returned count (= transactions.length, up to 1000)
      };
    }),

  // ============================================
  // Phase 3: Queue Skip Configuration + Panic Off
  // ============================================

  /**
   * Get current queue skip configuration for editing.
   * Returns price, panic state, and day/time configurations.
   */
  getQueueSkipConfig: venueManagerProcedure.query(async ({ ctx }) => {
    // 1. Get venue price + panic state
    const [venue] = await db
      .select({
        price: venues.price,
        queueSkipEnabled: venues.queueSkipEnabled,
      })
      .from(venues)
      .where(eq(venues.id, ctx.venue.venueId))
      .limit(1);

    if (!venue) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Venue not found",
      });
    }

    // 2. Get days with hours joined
    const configRows = await db
      .select({
        dayId: qsConfigDays.id,
        dayOfWeek: qsConfigDays.dayOfWeek,
        slotsPerHour: qsConfigDays.slotsPerHour,
        dayIsActive: qsConfigDays.isActive,
        hourId: qsConfigHours.id,
        startTime: qsConfigHours.startTime,
        endTime: qsConfigHours.endTime,
        endDayOffset: qsConfigHours.endDayOffset,
        customSlots: qsConfigHours.customSlots,
        hourIsActive: qsConfigHours.isActive,
      })
      .from(qsConfigDays)
      .leftJoin(qsConfigHours, eq(qsConfigDays.id, qsConfigHours.configDayId))
      .where(eq(qsConfigDays.venueId, ctx.venue.venueId))
      .orderBy(qsConfigDays.dayOfWeek, qsConfigHours.startTime);

    // 3. Transform flat rows into nested structure
    const daysMap = new Map<
      number,
      {
        id: number;
        dayOfWeek: number;
        slotsPerHour: number;
        isActive: boolean;
        times: Array<{
          id: number;
          startTime: string;
          endTime: string;
          endDayOffset: number;
          customSlots: number | null;
          isActive: boolean;
        }>;
      }
    >();

    for (const row of configRows) {
      if (!daysMap.has(row.dayId)) {
        daysMap.set(row.dayId, {
          id: row.dayId,
          dayOfWeek: row.dayOfWeek,
          slotsPerHour: row.slotsPerHour,
          isActive: row.dayIsActive ?? true,
          times: [],
        });
      }

      if (row.hourId !== null) {
        const day = daysMap.get(row.dayId)!;
        day.times.push({
          id: row.hourId,
          startTime: String(row.startTime),
          endTime: String(row.endTime),
          endDayOffset: row.endDayOffset ?? 0,
          customSlots: row.customSlots,
          isActive: row.hourIsActive ?? true,
        });
      }
    }

    return {
      price: String(venue.price),
      queueSkipEnabled: venue.queueSkipEnabled ?? true,
      days: Array.from(daysMap.values()),
    };
  }),

  /**
   * Update venue's queue skip base price.
   */
  updateQueueSkipPrice: venueManagerProcedure
    .input(
      z.object({
        price: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal format")
          .refine((val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num >= 0 && num <= 999.99;
          }, "Price must be between 0.00 and 999.99"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Read BEFORE state from DB
      const [beforeState] = await db
        .select({ price: venues.price })
        .from(venues)
        .where(eq(venues.id, ctx.venue.venueId));

      if (!beforeState) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }

      // 2. Perform the update
      await db
        .update(venues)
        .set({
          price: input.price,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, ctx.venue.venueId));

      // 3. Write audit log
      await db.insert(auditLog).values({
        venueId: ctx.venue.venueId,
        userId: ctx.venue.userId,
        action: "queue_skip_price_updated",
        changes: {
          source: "venue_manager_dashboard",
          before: { price: String(beforeState.price) },
          after: { price: input.price },
          timestamp: new Date().toISOString(),
        },
      });

      clearCachedVenues();
      return {
        success: true,
        newPrice: input.price,
        message: "Price updated successfully",
      };
    }),

  /**
   * Submit a demand signal — reads current price + 15-min sales velocity,
   * runs the pricing algorithm, clamps the result, writes the new price,
   * inserts an immutable demand_signals record, and audits the change.
   *
   * venueId is NEVER accepted from the client — always ctx.venue.venueId.
   */
  submitDemandSignal: venueManagerProcedure
    .input(
      z.object({
        waitTimeMinutes: z.number().int().min(0).max(999),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      // 1. Read current price and queue skip state
      const [venue] = await db
        .select({ price: venues.price, queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, venueId));

      if (!venue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }

      // 2. Count paid transactions in the last 15 minutes, and fetch the most
      //    recent demand signal (used as the relative baseline for the algorithm)
      const [[salesResult], [prevSignal]] = await Promise.all([
        db
          .select({ total: count() })
          .from(transactionsLog)
          .where(
            and(
              eq(transactionsLog.venueId, venueId),
              eq(transactionsLog.paymentStatus, "paid"),
              gte(transactionsLog.createdAt, sql`NOW() - INTERVAL '15 minutes'`),
            ),
          ),
        db
          .select({
            waitTimeMinutes: demandSignals.waitTimeMinutes,
            salesLast15Min: demandSignals.salesLast15Min,
          })
          .from(demandSignals)
          .where(eq(demandSignals.venueId, venueId))
          .orderBy(desc(demandSignals.submittedAt))
          .limit(1),
      ]);

      const salesLast15Min = salesResult?.total ?? 0;
      const currentPrice = parseFloat(String(venue.price));

      // 3. Run algorithm (pure function — no DB, no side effects).
      //    prevSignal is undefined on the first submission of the night;
      //    computeDynamicPrice defaults to W_N=10 / S_N=2 (neutral) in that case.
      const computed = computeDynamicPrice(
        currentPrice,
        input.waitTimeMinutes,
        salesLast15Min,
        prevSignal?.waitTimeMinutes,
        prevSignal?.salesLast15Min,
      );

      // 4. Apply hard clamps regardless of algorithm output
      const clamped = Math.min(MAX_PRICE, Math.max(MIN_PRICE, parseFloat(computed)));
      const newPrice = clamped.toFixed(2);
      const priceChanged = newPrice !== currentPrice.toFixed(2);

      // 5. Write new price to venues
      await db
        .update(venues)
        .set({ price: newPrice, updatedAt: new Date() })
        .where(eq(venues.id, venueId));

      // 6. Insert immutable demand_signals record (full snapshot for audit trail)
      await db.insert(demandSignals).values({
        venueId,
        submittedBy: userId,
        waitTimeMinutes: input.waitTimeMinutes,
        salesLast15Min,
        priceBefore: currentPrice.toFixed(2),
        priceAfter: newPrice,
      });

      // 7. Audit log — mandatory for all price writes (LOCKED_ASSUMPTIONS §8)
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "demand_signal_submitted",
        changes: {
          before: { price: currentPrice.toFixed(2) },
          after: { price: newPrice },
          waitTimeMinutes: input.waitTimeMinutes,
          salesLast15Min,
          timestamp: new Date().toISOString(),
        },
      });

      // 8. Invalidate patron-facing venue cache
      clearCachedVenues();

      return { newPrice, priceChanged, salesLast15Min };
    }),

  /**
   * Fetch all data needed for the Live Mode page in one round-trip.
   * Returns current price, queue skip state, and last 5 demand signals.
   */
  getLiveModeData: venueManagerProcedure.query(async ({ ctx }) => {
    const { venueId } = ctx.venue;

    const [venueResult, signals] = await Promise.all([
      db
        .select({ price: venues.price, queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, venueId))
        .then((rows) => rows[0]),
      db
        .select()
        .from(demandSignals)
        .where(eq(demandSignals.venueId, venueId))
        .orderBy(desc(demandSignals.submittedAt))
        .limit(5),
    ]);

    if (!venueResult) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
    }

    return {
      currentPrice: String(venueResult.price),
      queueSkipEnabled: venueResult.queueSkipEnabled ?? true,
      recentSignals: signals.map((s) => ({
        id: s.id,
        waitTimeMinutes: s.waitTimeMinutes,
        salesLast15Min: s.salesLast15Min,
        priceBefore: String(s.priceBefore),
        priceAfter: String(s.priceAfter),
        submittedAt: s.submittedAt.toISOString(),
      })),
    };
  }),

  /**
   * Toggle queue skip sales on/off (emergency stop).
   * MANDATORY audit logging per LOCKED_ASSUMPTIONS.
   */
  setPanicOff: venueManagerProcedure
    .input(
      z.object({
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Read BEFORE state from DB
      const [beforeState] = await db
        .select({ queueSkipEnabled: venues.queueSkipEnabled })
        .from(venues)
        .where(eq(venues.id, ctx.venue.venueId));

      if (!beforeState) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
      }

      // 2. Perform the update
      await db
        .update(venues)
        .set({
          queueSkipEnabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, ctx.venue.venueId));

      // 3. MANDATORY audit log
      await db.insert(auditLog).values({
        venueId: ctx.venue.venueId,
        userId: ctx.venue.userId,
        action: input.enabled ? "queue_skip_enabled" : "queue_skip_disabled",
        changes: {
          source: "venue_manager_dashboard",
          before: { queueSkipEnabled: beforeState.queueSkipEnabled },
          after: { queueSkipEnabled: input.enabled },
          timestamp: new Date().toISOString(),
        },
      });

      clearCachedVenues();
      return {
        success: true,
        state: input.enabled,
        message: input.enabled
          ? "Queue skip purchases are now enabled"
          : "Queue skip purchases are now disabled",
      };
    }),

  /**
   * Add, update, or delete day/time configurations.
   * Uses discriminated union for type-safe input validation.
   */
  updateQueueSkipConfig: venueManagerProcedure
    .input(updateQueueSkipConfigInput)
    .mutation(async ({ ctx, input }) => {
      // Handle each action type
      switch (input.action) {
        case "add_day": {
          // Validate dayOfWeek not already configured for this venue
          const existing = await db
            .select()
            .from(qsConfigDays)
            .where(
              and(
                eq(qsConfigDays.venueId, ctx.venue.venueId),
                eq(qsConfigDays.dayOfWeek, input.dayOfWeek),
              ),
            );
          if (existing.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Day already configured",
            });
          }

          // Use transaction for atomicity
          const result = await db.transaction(async (tx) => {
            const [newDay] = await tx
              .insert(qsConfigDays)
              .values({
                venueId: ctx.venue.venueId,
                dayOfWeek: input.dayOfWeek,
                slotsPerHour: input.slotsPerHour ?? 10,
                isActive: true,
              })
              .returning();

            // Insert time slots if provided
            if (input.times?.length) {
              for (const t of input.times) {
                await validateNoTimeOverlap(
                  tx,
                  newDay!.id,
                  t.startTime,
                  t.endTime,
                  t.endDayOffset ?? 0,
                );
              }
              await tx.insert(qsConfigHours).values(
                input.times.map((t) => ({
                  configDayId: newDay!.id,
                  startTime: t.startTime,
                  endTime: t.endTime,
                  customSlots: t.customSlots ?? null,
                  isActive: t.isActive ?? true,
                  endDayOffset: t.endDayOffset ?? 0,
                })),
              );
            }

            return newDay;
          });

          // Audit log
          await db.insert(auditLog).values({
            venueId: ctx.venue.venueId,
            userId: ctx.venue.userId,
            action: "queue_skip_day_added",
            changes: {
              source: "venue_manager_dashboard",
              before: null,
              after: {
                dayOfWeek: input.dayOfWeek,
                slotsPerHour: input.slotsPerHour ?? 10,
                timesAdded: input.times?.length ?? 0,
              },
              timestamp: new Date().toISOString(),
            },
          });

          clearCachedVenues();
          return { success: true, message: "Day configuration added" };
        }

        case "update_day": {
          // Verify ownership
          const beforeDay = await verifyDayOwnership(
            input.configDayId,
            ctx.venue.venueId,
          );

          // Perform update
          await db
            .update(qsConfigDays)
            .set({
              slotsPerHour: input.slotsPerHour ?? beforeDay.slotsPerHour,
              isActive: input.dayIsActive ?? beforeDay.isActive,
              updatedAt: new Date(),
            })
            .where(eq(qsConfigDays.id, input.configDayId));

          // Audit log
          const afterState: Record<string, unknown> = {};
          if (input.slotsPerHour !== undefined)
            afterState.slotsPerHour = input.slotsPerHour;
          if (input.dayIsActive !== undefined)
            afterState.isActive = input.dayIsActive;

          await db.insert(auditLog).values({
            venueId: ctx.venue.venueId,
            userId: ctx.venue.userId,
            action: "queue_skip_day_updated",
            changes: {
              source: "venue_manager_dashboard",
              configDayId: input.configDayId,
              before: {
                slotsPerHour: beforeDay.slotsPerHour,
                isActive: beforeDay.isActive,
              },
              after: afterState,
              timestamp: new Date().toISOString(),
            },
          });

          clearCachedVenues();
          return { success: true, message: "Day configuration updated" };
        }

        case "delete_day": {
          // Verify ownership
          const beforeDay = await verifyDayOwnership(
            input.configDayId,
            ctx.venue.venueId,
          );

          // Clear pending queue reservations for all hours in this day first
          // (prevents FK violation from queue.config_hour_id_fkey when hours cascade-delete)
          const hoursToDelete = await db
            .select({ id: qsConfigHours.id })
            .from(qsConfigHours)
            .where(eq(qsConfigHours.configDayId, input.configDayId));

          if (hoursToDelete.length > 0) {
            const hourIds = hoursToDelete.map((h) => h.id);
            await db
              .delete(queue)
              .where(inArray(queue.configHourId, hourIds));
          }

          // CASCADE deletes associated hours
          await db
            .delete(qsConfigDays)
            .where(eq(qsConfigDays.id, input.configDayId));

          // Audit log
          await db.insert(auditLog).values({
            venueId: ctx.venue.venueId,
            userId: ctx.venue.userId,
            action: "queue_skip_day_deleted",
            changes: {
              source: "venue_manager_dashboard",
              configDayId: input.configDayId,
              before: {
                dayOfWeek: beforeDay.dayOfWeek,
                slotsPerHour: beforeDay.slotsPerHour,
              },
              after: null,
              timestamp: new Date().toISOString(),
            },
          });

          clearCachedVenues();
          return { success: true, message: "Day configuration deleted" };
        }

        case "add_time": {
          // Verify day ownership
          await verifyDayOwnership(input.configDayId, ctx.venue.venueId);

          // Use transaction for race safety
          await db.transaction(async (tx) => {
            for (const t of input.times) {
              await validateNoTimeOverlap(
                tx,
                input.configDayId,
                t.startTime,
                t.endTime,
                t.endDayOffset ?? 0,
              );
            }

            await tx.insert(qsConfigHours).values(
              input.times.map((t) => ({
                configDayId: input.configDayId,
                startTime: t.startTime,
                endTime: t.endTime,
                customSlots: t.customSlots ?? null,
                isActive: t.isActive ?? true,
                endDayOffset: t.endDayOffset ?? 0,
              })),
            );
          });

          // Audit log
          await db.insert(auditLog).values({
            venueId: ctx.venue.venueId,
            userId: ctx.venue.userId,
            action: "queue_skip_time_added",
            changes: {
              source: "venue_manager_dashboard",
              configDayId: input.configDayId,
              before: null,
              after: {
                timesAdded: input.times.map((t) => ({
                  startTime: t.startTime,
                  endTime: t.endTime,
                  customSlots: t.customSlots ?? null,
                  isActive: t.isActive ?? true,
                  endDayOffset: t.endDayOffset ?? 0,
                })),
              },
              timestamp: new Date().toISOString(),
            },
          });

          clearCachedVenues();
          return { success: true, message: "Time slots added" };
        }

        case "update_time": {
          // Verify hour ownership
          const hourInfo = await verifyHourOwnership(
            input.configHourId,
            ctx.venue.venueId,
          );

          // Use transaction for race safety
          await db.transaction(async (tx) => {
            const [beforeHour] = await tx
              .select()
              .from(qsConfigHours)
              .where(eq(qsConfigHours.id, input.configHourId));

            if (!beforeHour) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Hour not found",
              });
            }

            const newStartTime =
              input.startTime ?? String(beforeHour.startTime);
            const newEndTime = input.endTime ?? String(beforeHour.endTime);
            const newEndDayOffset =
              input.endDayOffset ?? beforeHour.endDayOffset;
            const newCustomSlots =
              input.customSlots !== undefined
                ? input.customSlots
                : beforeHour.customSlots;
            const newIsActive = input.isActive ?? beforeHour.isActive;

            // Validate no overlap (exclude self)
            await validateNoTimeOverlap(
              tx,
              hourInfo.configDayId,
              newStartTime,
              newEndTime,
              newEndDayOffset,
              input.configHourId,
            );

            // Perform update
            await tx
              .update(qsConfigHours)
              .set({
                startTime: newStartTime,
                endTime: newEndTime,
                endDayOffset: newEndDayOffset,
                customSlots: newCustomSlots,
                isActive: newIsActive,
                updatedAt: new Date(),
              })
              .where(eq(qsConfigHours.id, input.configHourId));

            // Audit log (inside transaction)
            await tx.insert(auditLog).values({
              venueId: ctx.venue.venueId,
              userId: ctx.venue.userId,
              action: "queue_skip_time_updated",
              changes: {
                source: "venue_manager_dashboard",
                configHourId: input.configHourId,
                before: {
                  startTime: String(beforeHour.startTime),
                  endTime: String(beforeHour.endTime),
                  endDayOffset: beforeHour.endDayOffset,
                  customSlots: beforeHour.customSlots,
                  isActive: beforeHour.isActive,
                },
                after: {
                  startTime: newStartTime,
                  endTime: newEndTime,
                  endDayOffset: newEndDayOffset,
                  customSlots: newCustomSlots,
                  isActive: newIsActive,
                },
                timestamp: new Date().toISOString(),
              },
            });
          });

          clearCachedVenues();
          return { success: true, message: "Time slot updated" };
        }

        case "delete_time": {
          // Verify hour ownership
          await verifyHourOwnership(input.configHourId, ctx.venue.venueId);

          // Get before state
          const [beforeHour] = await db
            .select()
            .from(qsConfigHours)
            .where(eq(qsConfigHours.id, input.configHourId));

          if (!beforeHour) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Hour not found",
            });
          }

          // Clear any pending queue reservations for this slot first
          // (prevents FK violation from queue.config_hour_id_fkey)
          await db
            .delete(queue)
            .where(eq(queue.configHourId, input.configHourId));

          // Delete
          await db
            .delete(qsConfigHours)
            .where(eq(qsConfigHours.id, input.configHourId));

          // Audit log
          await db.insert(auditLog).values({
            venueId: ctx.venue.venueId,
            userId: ctx.venue.userId,
            action: "queue_skip_time_deleted",
            changes: {
              source: "venue_manager_dashboard",
              configHourId: input.configHourId,
              before: {
                startTime: String(beforeHour.startTime),
                endTime: String(beforeHour.endTime),
                customSlots: beforeHour.customSlots,
                isActive: beforeHour.isActive,
              },
              after: null,
              timestamp: new Date().toISOString(),
            },
          });

          clearCachedVenues();
          return { success: true, message: "Time slot deleted" };
        }
      }
    }),

  // ============================================
  // Phase 4: Venue Profile Management
  // ============================================

  /**
   * Get venue profile data including server-derived uploadPrefix.
   * The uploadPrefix MUST be used by client for storage path construction.
   */
  getVenueProfile: venueManagerProcedure.query(async ({ ctx }) => {
    const { venueId } = ctx.venue;

    const [venue] = await db
      .select({
        id: venues.id,
        name: venues.name,
        description: venues.description,
        streetAddress: venues.streetAddress,
        coverImagePath: venues.coverImagePath,
        entryFee: venues.entryFee,
        price: venues.price,
        priceDisplayMode: venues.priceDisplayMode,
        timeZone: venues.timeZone,
        imageUrl: venues.imageUrl, // Legacy field for fallback
      })
      .from(venues)
      .where(eq(venues.id, venueId));

    if (!venue) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" });
    }

    return {
      ...venue,
      // Server-derived upload prefix - client MUST use this for path construction
      // Do NOT allow client to derive this from venue.id prop
      uploadPrefix: `${venueId}/`,
    };
  }),

  /**
   * Update venue display name.
   */
  updateVenueName: venueManagerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      await db
        .update(venues)
        .set({
          name: input.name,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, venueId));

      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_name_updated",
        changes: {
          source: "venue_manager_dashboard",
          name: input.name,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true };
    }),

  /**
   * Update venue description text.
   */
  updateVenueDescription: venueManagerProcedure
    .input(
      z.object({
        description: z.string().max(1000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      await db
        .update(venues)
        .set({
          description: input.description,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, venueId));

      // Audit log
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_description_updated",
        changes: {
          source: "venue_manager_dashboard",
          description: input.description,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true };
    }),

  /**
   * Update venue street address.
   * Optionally accepts the browser-detected IANA timezone so the venue's
   * timezone is kept in sync with the manager's location automatically.
   */
  updateStreetAddress: venueManagerProcedure
    .input(
      z.object({
        streetAddress: z.string().max(255).nullable(),
        // Browser-detected timezone sent by the client (Intl.DateTimeFormat)
        detectedTimeZone: z
          .string()
          .optional()
          .refine((tz) => {
            if (!tz) return true;
            try {
              Intl.DateTimeFormat(undefined, { timeZone: tz });
              return true;
            } catch {
              return false;
            }
          }, "Invalid IANA timezone identifier"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      if (input.detectedTimeZone) {
        await db
          .update(venues)
          .set({
            streetAddress: input.streetAddress,
            timeZone: input.detectedTimeZone,
            updatedAt: new Date(),
          })
          .where(eq(venues.id, venueId));
      } else {
        await db
          .update(venues)
          .set({
            streetAddress: input.streetAddress,
            updatedAt: new Date(),
          })
          .where(eq(venues.id, venueId));
      }

      // Audit log
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_street_address_updated",
        changes: {
          source: "venue_manager_dashboard",
          streetAddress: input.streetAddress,
          ...(input.detectedTimeZone
            ? { autoDetectedTimeZone: input.detectedTimeZone }
            : {}),
          timestamp: new Date().toISOString(),
        },
      });

      if (input.detectedTimeZone) {
        clearCachedVenues();
      }

      return { success: true };
    }),

  /**
   * Update venue timezone.
   * Must be a valid IANA timezone identifier (validated by Intl.DateTimeFormat).
   */
  updateTimeZone: venueManagerProcedure
    .input(
      z.object({
        timeZone: z.string().min(1).refine((tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        }, "Invalid IANA timezone identifier"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      const [before] = await db
        .select({ timeZone: venues.timeZone })
        .from(venues)
        .where(eq(venues.id, venueId));

      await db
        .update(venues)
        .set({ timeZone: input.timeZone, updatedAt: new Date() })
        .where(eq(venues.id, venueId));

      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_timezone_updated",
        changes: {
          source: "venue_manager_dashboard",
          before: { timeZone: before?.timeZone },
          after: { timeZone: input.timeZone },
          timestamp: new Date().toISOString(),
        },
      });

      clearCachedVenues();
      return { success: true };
    }),

  /**
   * Update entry fee and price display mode.
   * Type Safety: entryFee is string with strict decimal validation.
   * Drizzle's numeric() maps to string; Postgres handles string→numeric conversion.
   */
  updatePriceDisplay: venueManagerProcedure
    .input(
      z.object({
        // String with strict decimal format validation (max 2 decimal places)
        entryFee: z
          .string()
          .regex(
            /^\d{1,6}(\.\d{1,2})?$/,
            "Invalid price format (max 6 digits, 2 decimal places)",
          )
          .nullable(),
        priceDisplayMode: z.enum(["queue_skip_only", "entry_fee_only", "both"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;

      await db
        .update(venues)
        .set({
          entryFee: input.entryFee, // String → Postgres numeric (handled by Drizzle)
          priceDisplayMode: input.priceDisplayMode,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, venueId));

      // Audit log
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_price_display_updated",
        changes: {
          source: "venue_manager_dashboard",
          entryFee: input.entryFee,
          priceDisplayMode: input.priceDisplayMode,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true };
    }),

  /**
   * Confirm cover image upload and save path to database.
   * CRITICAL: File is already in storage via direct browser upload.
   * This mutation validates path ownership and stores it in DB.
   */
  confirmCoverUpload: venueManagerProcedure
    .input(
      z.object({
        storagePath: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId } = ctx.venue;
      const { storagePath } = input;

      // SECURITY: Validate path starts with venue_id
      if (!storagePath.startsWith(`${venueId}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid storage path - must be within your venue folder",
        });
      }

      // Get old path for cleanup reference
      const [oldVenue] = await db
        .select({ coverImagePath: venues.coverImagePath })
        .from(venues)
        .where(eq(venues.id, venueId));

      // Update venue with new path
      await db
        .update(venues)
        .set({
          coverImagePath: storagePath,
          updatedAt: new Date(),
        })
        .where(eq(venues.id, venueId));

      // Audit log
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "venue_cover_image_updated",
        changes: {
          source: "venue_manager_dashboard",
          oldPath: oldVenue?.coverImagePath ?? null,
          newPath: storagePath,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        oldPath: oldVenue?.coverImagePath ?? null, // Client can use this to delete old file
      };
    }),

  /**
   * Delete cover image from database (and return path for client to delete from storage).
   */
  deleteCoverImage: venueManagerProcedure.mutation(async ({ ctx }) => {
    const { venueId, userId } = ctx.venue;

    // Get current path before clearing
    const [venue] = await db
      .select({ coverImagePath: venues.coverImagePath })
      .from(venues)
      .where(eq(venues.id, venueId));

    if (!venue?.coverImagePath) {
      return { success: true, deletedPath: null };
    }

    // Clear path from database
    await db
      .update(venues)
      .set({
        coverImagePath: null,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venueId));

    // Audit log
    await db.insert(auditLog).values({
      venueId,
      userId,
      action: "venue_cover_image_deleted",
      changes: {
        source: "venue_manager_dashboard",
        deletedPath: venue.coverImagePath,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      deletedPath: venue.coverImagePath, // Client uses this to delete from storage
    };
  }),

  getPayoutSettings: venueManagerProcedure.query(async ({ ctx }) => {
    const [settings] = await db
      .select({
        payoutPeriod: venuePayoutSettings.payoutPeriod,
        accountName: venuePayoutSettings.accountName,
        bsb: venuePayoutSettings.bsb,
        accountNumber: venuePayoutSettings.accountNumber,
        updatedAt: venuePayoutSettings.updatedAt,
      })
      .from(venuePayoutSettings)
      .where(eq(venuePayoutSettings.venueId, ctx.venue.venueId))
      .limit(1);
    return settings ?? null;
  }),

  updatePayoutSettings: venueManagerProcedure
    .input(updatePayoutSettingsInput)
    .mutation(async ({ ctx, input }) => {
      const { venueId, userId, email: managerEmail } = ctx.venue;

      // Read before state (null = first-time setup)
      const [before] = await db
        .select()
        .from(venuePayoutSettings)
        .where(eq(venuePayoutSettings.venueId, venueId))
        .limit(1);

      // Upsert — atomic for both first-time setup and updates
      await db
        .insert(venuePayoutSettings)
        .values({ venueId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: venuePayoutSettings.venueId,
          set: { ...input, updatedAt: new Date() },
        });

      // Audit log — account number excluded from changes blob intentionally
      await db.insert(auditLog).values({
        venueId,
        userId,
        action: "payout_settings_updated",
        changes: {
          source: "venue_manager_dashboard",
          before: before
            ? {
                payoutPeriod: before.payoutPeriod,
                accountName: before.accountName,
                bsb: before.bsb,
              }
            : null,
          after: {
            payoutPeriod: input.payoutPeriod,
            accountName: input.accountName,
            bsb: input.bsb,
          },
          isFirstTimeSetup: !before,
          timestamp: new Date().toISOString(),
        },
      });

      // Internal notification — non-fatal, failure does not roll back the save
      try {
        if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
        const resend = new Resend(env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Tickets <michael@tickets.thenectarapp.com>",
          to: "wabraham@thenectarapp.com",
          subject: `Payout Settings ${before ? "Updated" : "Configured"} — ${venueId}`,
          html: `
            <h2>Payout Settings ${before ? "Updated" : "Configured for the First Time"}</h2>
            <p><strong>Venue:</strong> ${venueId}</p>
            <p><strong>Manager:</strong> ${managerEmail}</p>
            <p><strong>Period:</strong> ${input.payoutPeriod}</p>
            <p><strong>Account Name:</strong> ${input.accountName}</p>
            <p><strong>BSB:</strong> ${input.bsb}</p>
            <p><strong>Account Number:</strong> ${input.accountNumber}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            ${before ? `<p><em>Previous BSB: ${before.bsb ?? "not set"}</em></p>` : ""}
          `,
        });
      } catch (emailError) {
        console.error("[payout_settings] Admin notification email failed:", emailError);
      }

      return { success: true, isFirstTimeSetup: !before };
    }),
});
