import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { venues } from "../schema";

export async function updateVenuePrice(venueId: string, price: number) {
  const result = await db
    .update(venues)
    .set({ price: price.toString() })
    .where(eq(venues.id, venueId))
    .returning();

  if (result.length === 0) {
    throw new Error(`Venue not found for update: ${venueId}`);
  }

  return result[0];
}
