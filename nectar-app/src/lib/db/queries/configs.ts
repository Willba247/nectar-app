import "server-only";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../index";
import { qsConfigDays, qsConfigHours } from "../schema";

export type QueueSkipConfigDay = typeof qsConfigDays.$inferSelect;
export type NewQueueSkipConfigDay = typeof qsConfigDays.$inferInsert;
export type QueueSkipConfigHour = typeof qsConfigHours.$inferSelect;
export type NewQueueSkipConfigHour = typeof qsConfigHours.$inferInsert;

/**
 * Get all config days for a venue
 */
export async function getConfigDaysByVenue(venueId: string) {
  return await db
    .select()
    .from(qsConfigDays)
    .where(eq(qsConfigDays.venueId, venueId));
}

/**
 * Get a single config day by ID
 */
export async function getConfigDayById(configDayId: number) {
  const result = await db
    .select()
    .from(qsConfigDays)
    .where(eq(qsConfigDays.id, configDayId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get config day by venue and day of week
 */
export async function getConfigDayByVenueAndDay(
  venueId: string,
  dayOfWeek: number
) {
  const result = await db
    .select()
    .from(qsConfigDays)
    .where(
      and(
        eq(qsConfigDays.venueId, venueId),
        eq(qsConfigDays.dayOfWeek, dayOfWeek)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Create a new config day
 */
export async function createConfigDay(data: NewQueueSkipConfigDay) {
  const result = await db.insert(qsConfigDays).values(data).returning();
  return result[0]!;
}

/**
 * Update a config day
 */
export async function updateConfigDay(
  configDayId: number,
  data: Partial<Omit<NewQueueSkipConfigDay, "id">>
) {
  const result = await db
    .update(qsConfigDays)
    .set(data)
    .where(eq(qsConfigDays.id, configDayId))
    .returning();

  return result[0] ?? null;
}

/**
 * Delete a config day (will cascade delete hours)
 */
export async function deleteConfigDay(configDayId: number) {
  const result = await db
    .delete(qsConfigDays)
    .where(eq(qsConfigDays.id, configDayId))
    .returning();

  return result[0] ?? null;
}

/**
 * Toggle config day active status
 */
export async function toggleConfigDayActive(
  configDayId: number,
  isActive: boolean
) {
  const result = await db
    .update(qsConfigDays)
    .set({ isActive })
    .where(eq(qsConfigDays.id, configDayId))
    .returning();

  return result[0] ?? null;
}

/**
 * Get config hours by config day ID
 */
export async function getConfigHoursByConfigDay(configDayId: number) {
  return await db
    .select()
    .from(qsConfigHours)
    .where(eq(qsConfigHours.configDayId, configDayId));
}

/**
 * Get a single config hour by ID
 */
export async function getConfigHourById(configHourId: number) {
  const result = await db
    .select()
    .from(qsConfigHours)
    .where(eq(qsConfigHours.id, configHourId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get existing config hour for a config day
 */
export async function getExistingConfigHour(configDayId: number) {
  const result = await db
    .select()
    .from(qsConfigHours)
    .where(eq(qsConfigHours.configDayId, configDayId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Create a new config hour
 */
export async function createConfigHour(data: NewQueueSkipConfigHour) {
  const result = await db.insert(qsConfigHours).values(data).returning();
  return result[0]!;
}

/**
 * Update a config hour
 */
export async function updateConfigHour(
  configHourId: number,
  data: Partial<Omit<NewQueueSkipConfigHour, "id">>
) {
  const result = await db
    .update(qsConfigHours)
    .set(data)
    .where(eq(qsConfigHours.id, configHourId))
    .returning();

  return result[0] ?? null;
}

/**
 * Delete a config hour
 */
export async function deleteConfigHour(configHourId: number) {
  const result = await db
    .delete(qsConfigHours)
    .where(eq(qsConfigHours.id, configHourId))
    .returning();

  return result[0] ?? null;
}

/**
 * Get config days with hours for a venue
 * Optimized: Uses 2 queries instead of 1 + N queries
 */
export async function getConfigDaysWithHours(venueId: string) {
  // Query 1: Get all config days for this venue
  const configDays = await db
    .select()
    .from(qsConfigDays)
    .where(eq(qsConfigDays.venueId, venueId));

  if (configDays.length === 0) {
    return [];
  }

  // Query 2: Get ALL hours for ALL config days in a single query
  const configDayIds = configDays.map((day) => day.id);
  const allHours = await db
    .select()
    .from(qsConfigHours)
    .where(inArray(qsConfigHours.configDayId, configDayIds));

  // Group hours by config day in memory
  const hoursByDayId = new Map<number, typeof allHours>();
  for (const hour of allHours) {
    const existing = hoursByDayId.get(hour.configDayId) ?? [];
    existing.push(hour);
    hoursByDayId.set(hour.configDayId, existing);
  }

  // Assemble the result
  const configDaysWithHours = configDays.map((day) => ({
    ...day,
    qs_config_hours: hoursByDayId.get(day.id) ?? [],
  }));

  return configDaysWithHours;
}
