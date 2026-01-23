import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { venues, qsConfigDays, qsConfigHours } from "../schema";

export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;

/**
 * Get a single venue by ID
 */
export async function getVenueById(venueId: string) {
  const result = await db
    .select()
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get a venue with all its queue skip configurations
 * Uses batch queries to avoid N+1 problem
 */
export async function getVenueWithConfigs(venueId: string) {
  const venue = await db
    .select()
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);

  if (!venue[0]) {
    return null;
  }

  // Get config days for this venue
  const configDays = await db
    .select()
    .from(qsConfigDays)
    .where(eq(qsConfigDays.venueId, venueId));

  // Get ALL config hours for ALL config days in a single query (fixes N+1)
  const configDayIds = configDays.map((day) => day.id);
  const configHours =
    configDayIds.length > 0
      ? await db
          .select()
          .from(qsConfigHours)
          .where(inArray(qsConfigHours.configDayId, configDayIds))
      : [];

  // Group hours by config day in memory
  const configDaysWithHours = configDays.map((day) => ({
    ...day,
    qs_config_hours: configHours.filter((hour) => hour.configDayId === day.id),
  }));

  return {
    ...venue[0],
    qs_config_days: configDaysWithHours,
  };
}

/**
 * Get all venues
 */
export async function getAllVenues() {
  return await db.select().from(venues).orderBy(venues.id);
}

/**
 * Get all venues with their configurations
 * Optimized: Uses only 3 queries total instead of 1 + N + (N*M) queries
 */
export async function getAllVenuesWithConfigs() {
  // Query 1: Get all venues
  const allVenues = await db.select().from(venues).orderBy(venues.id);

  if (allVenues.length === 0) {
    return [];
  }

  // Query 2: Get ALL config days for ALL venues in one query
  const venueIds = allVenues.map((v) => v.id);
  const allConfigDays = await db
    .select()
    .from(qsConfigDays)
    .where(inArray(qsConfigDays.venueId, venueIds));

  // Query 3: Get ALL config hours for ALL config days in one query
  const configDayIds = allConfigDays.map((day) => day.id);
  const allConfigHours =
    configDayIds.length > 0
      ? await db
          .select()
          .from(qsConfigHours)
          .where(inArray(qsConfigHours.configDayId, configDayIds))
      : [];

  // Group hours by config day in memory
  const hoursByDayId = new Map<number, typeof allConfigHours>();
  for (const hour of allConfigHours) {
    const existing = hoursByDayId.get(hour.configDayId) ?? [];
    existing.push(hour);
    hoursByDayId.set(hour.configDayId, existing);
  }

  // Group config days by venue in memory
  const daysByVenueId = new Map<string, typeof allConfigDays>();
  for (const day of allConfigDays) {
    const existing = daysByVenueId.get(day.venueId) ?? [];
    existing.push(day);
    daysByVenueId.set(day.venueId, existing);
  }

  // Assemble the final result
  const venuesWithConfigs = allVenues.map((venue) => {
    const configDays = daysByVenueId.get(venue.id) ?? [];
    const configDaysWithHours = configDays.map((day) => ({
      ...day,
      qs_config_hours: hoursByDayId.get(day.id) ?? [],
    }));

    return {
      ...venue,
      qs_config_days: configDaysWithHours,
    };
  });

  return venuesWithConfigs;
}

/**
 * Create a new venue
 */
export async function createVenue(data: NewVenue) {
  const result = await db.insert(venues).values(data).returning();
  return result[0]!;
}

/**
 * Update a venue
 */
export async function updateVenue(
  venueId: string,
  data: Partial<Omit<NewVenue, "id">>
) {
  const result = await db
    .update(venues)
    .set(data)
    .where(eq(venues.id, venueId))
    .returning();

  return result[0] ?? null;
}

/**
 * Delete a venue
 */
export async function deleteVenue(venueId: string) {
  const result = await db
    .delete(venues)
    .where(eq(venues.id, venueId))
    .returning();

  return result[0] ?? null;
}

/**
 * Check if a venue exists
 */
export async function venueExists(venueId: string): Promise<boolean> {
  const result = await db
    .select({ id: venues.id })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);

  return result.length > 0;
}
