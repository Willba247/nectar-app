import "server-only";
import { eq } from "drizzle-orm";
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

  // Get config days with their hours
  const configDays = await db
    .select()
    .from(qsConfigDays)
    .where(eq(qsConfigDays.venueId, venueId));

  // Get all config hours for these days
  const configDayIds = configDays.map((day) => day.id);
  const configHours =
    configDayIds.length > 0
      ? await db
          .select()
          .from(qsConfigHours)
          .where(
            eq(
              qsConfigHours.configDayId,
              configDayIds[0]!
            )
          )
      : [];

  // Group hours by config day
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
 */
export async function getAllVenuesWithConfigs() {
  const allVenues = await db.select().from(venues).orderBy(venues.id);

  const venuesWithConfigs = await Promise.all(
    allVenues.map(async (venue) => {
      const configDays = await db
        .select()
        .from(qsConfigDays)
        .where(eq(qsConfigDays.venueId, venue.id));

      const configDaysWithHours = await Promise.all(
        configDays.map(async (day) => {
          const hours = await db
            .select()
            .from(qsConfigHours)
            .where(eq(qsConfigHours.configDayId, day.id));

          return {
            ...day,
            qs_config_hours: hours,
          };
        })
      );

      return {
        ...venue,
        qs_config_days: configDaysWithHours,
      };
    })
  );

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
