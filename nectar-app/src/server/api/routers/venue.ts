import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";
import { createVenueSlug } from "@/data/venues";
import {
  getVenueWithConfigs,
  getAllVenuesWithConfigs,
  createVenue as dbCreateVenue,
  updateVenue as dbUpdateVenue,
  deleteVenue as dbDeleteVenue,
  venueExists,
  getConfigDaysByVenue,
  getConfigDayByVenueAndDay,
  createConfigDay,
  updateConfigDay,
  getExistingConfigHour,
  createConfigHour,
  updateConfigHour,
  deleteConfigDay,
  toggleConfigDayActive,
  countTransactionsByVenue,
} from "@/lib/db/queries";
import { venues, qsConfigDays, qsConfigHours } from "@/lib/db/schema";

// Database types
type DbVenue = typeof venues.$inferSelect;
type DbQsConfigDay = typeof qsConfigDays.$inferSelect;
type DbQsConfigHour = typeof qsConfigHours.$inferSelect;

type DbQsConfigDayWithHours = DbQsConfigDay & {
  qs_config_hours: DbQsConfigHour[];
};

type DbVenueWithConfigs = DbVenue & {
  qs_config_days: DbQsConfigDayWithHours[];
};

// API response types
type QueueSkipConfigHour = {
  id: number;
  config_day_id?: number;
  start_time: string;
  end_time: string;
  custom_slots?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

type QueueSkipConfigDay = {
  id: number;
  venue_id: string;
  day_of_week: number;
  slots_per_hour: number; // Note: This now represents slots per 15-minute period
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  qs_config_hours: QueueSkipConfigHour[];
};

type Venue = {
  id: string;
  name: string;
  image_url: string;
  price: number;
  time_zone: string;
  created_at?: string;
  updated_at?: string;
};

export type VenueWithConfigs = Venue & {
  qs_config_days: QueueSkipConfigDay[];
};

// Helper function to convert Drizzle format to snake_case format
function mapVenueToSnakeCase(venue: DbVenueWithConfigs): VenueWithConfigs {
  return {
    id: venue.id,
    name: venue.name,
    image_url: venue.imageUrl,
    price: parseFloat(venue.price),
    time_zone: venue.timeZone,
    created_at: venue.createdAt?.toISOString(),
    updated_at: venue.updatedAt?.toISOString(),
    qs_config_days:
      venue.qs_config_days?.map((day: DbQsConfigDayWithHours) => ({
        id: day.id,
        venue_id: day.venueId,
        day_of_week: day.dayOfWeek,
        slots_per_hour: day.slotsPerHour,
        is_active: day.isActive ?? true,
        created_at: day.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: day.updatedAt?.toISOString(),
        qs_config_hours:
          day.qs_config_hours?.map((hour: DbQsConfigHour) => ({
            id: hour.id,
            config_day_id: hour.configDayId,
            start_time: hour.startTime,
            end_time: hour.endTime,
            custom_slots: hour.customSlots ?? undefined,
            is_active: hour.isActive ?? true,
            created_at: hour.createdAt?.toISOString() ?? new Date().toISOString(),
            updated_at: hour.updatedAt?.toISOString(),
          })) ?? [],
      })) ?? [],
  };
}

export const venueRouter = createTRPCRouter({
  getVenueById: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ input }) => {
      const venue = await getVenueWithConfigs(input.venueId);

      if (!venue) {
        throw new Error("Venue not found");
      }

      const mapped = mapVenueToSnakeCase(venue);
      return {
        ...mapped,
        queueSkipConfigs: mapped.qs_config_days || [],
      };
    }),

  getAllVenues: publicProcedure.query(async () => {
    const venues = await getAllVenuesWithConfigs();

    // Transform the data to match the expected structure and sort by active configs
    const transformedVenues = venues
      .map((venue) => {
        const mapped = mapVenueToSnakeCase(venue);
        return {
          ...mapped,
          queueSkipConfigs: mapped.qs_config_days ?? [],
        };
      })
      .sort((a, b) => {
        // First check if either venue has any configs
        const aHasConfigs = a.qs_config_days.length > 0;
        const bHasConfigs = b.qs_config_days.length > 0;

        if (aHasConfigs !== bHasConfigs) {
          return bHasConfigs ? 1 : -1; // Venues with configs come first
        }

        // If both have configs, check for active configs
        const aHasActiveConfigs = a.qs_config_days.some(
          (config) => config.is_active,
        );
        const bHasActiveConfigs = b.qs_config_days.some(
          (config) => config.is_active,
        );

        if (aHasActiveConfigs !== bHasActiveConfigs) {
          return bHasActiveConfigs ? 1 : -1; // Venues with active configs come first
        }

        return 0; // Keep original order if both have same config status
      });

    return transformedVenues;
  }),

  getVenueQueueSkipConfig: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ input }) => {
      return await getConfigDaysByVenue(input.venueId);
    }),
  createVenueQueueSkipConfig: publicProcedure
    .input(
      z.object({
        venueId: z.string(),
        dayOfWeek: z.number(),
        start_time: z.string(),
        end_time: z.string(),
        slots_per_hour: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      // First check if a config already exists for this day and venue
      const existingDay = await getConfigDayByVenueAndDay(
        input.venueId,
        input.dayOfWeek,
      );

      let configDayId: number;

      if (existingDay) {
        // Update existing day config
        const updated = await updateConfigDay(existingDay.id, {
          slotsPerHour: input.slots_per_hour,
          isActive: true,
        });

        if (!updated) {
          throw new Error("Failed to update queue skip config day");
        }

        configDayId = updated.id;
      } else {
        // Insert new day config
        const created = await createConfigDay({
          venueId: input.venueId,
          dayOfWeek: input.dayOfWeek,
          slotsPerHour: input.slots_per_hour,
          isActive: true,
        });

        configDayId = created.id;
      }

      // Now handle the hour config
      const existingHour = await getExistingConfigHour(configDayId);

      let configHourId: number;

      if (existingHour) {
        // Update existing hour config
        const updated = await updateConfigHour(existingHour.id, {
          startTime: input.start_time,
          endTime: input.end_time,
          customSlots: input.slots_per_hour,
          isActive: true,
        });

        if (!updated) {
          throw new Error("Failed to update queue skip config hour");
        }

        configHourId = updated.id;
      } else {
        // Insert new hour config
        const created = await createConfigHour({
          configDayId,
          startTime: input.start_time,
          endTime: input.end_time,
          customSlots: input.slots_per_hour,
          isActive: true,
        });

        configHourId = created.id;
      }

      return {
        config_day_id: configDayId,
        config_hour_id: configHourId,
      };
    }),
  createVenueQueueSkipConfigs: publicProcedure
    .input(
      z.object({
        venueId: z.string(),
        configs: z.array(
          z.object({
            dayOfWeek: z.number(),
            start_time: z.string(),
            end_time: z.string(),
            slots_per_hour: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const { venueId, configs } = input;

      // Process all configs
      const results = await Promise.all(
        configs.map(async (config) => {
          // First check if a config already exists for this day and venue
          const existingDay = await getConfigDayByVenueAndDay(
            venueId,
            config.dayOfWeek,
          );

          let configDayId: number;

          if (existingDay) {
            // Update existing day config
            const updated = await updateConfigDay(existingDay.id, {
              slotsPerHour: config.slots_per_hour,
              isActive: true,
            });

            if (!updated) {
              throw new Error("Failed to update queue skip config day");
            }

            configDayId = updated.id;
          } else {
            // Insert new day config
            const created = await createConfigDay({
              venueId,
              dayOfWeek: config.dayOfWeek,
              slotsPerHour: config.slots_per_hour,
              isActive: true,
            });

            configDayId = created.id;
          }

          // Now handle the hour config
          const existingHour = await getExistingConfigHour(configDayId);

          let configHourId: number;

          if (existingHour) {
            // Update existing hour config
            const updated = await updateConfigHour(existingHour.id, {
              startTime: config.start_time,
              endTime: config.end_time,
              customSlots: config.slots_per_hour,
              isActive: true,
            });

            if (!updated) {
              throw new Error("Failed to update queue skip config hour");
            }

            configHourId = updated.id;
          } else {
            // Insert new hour config
            const created = await createConfigHour({
              configDayId,
              startTime: config.start_time,
              endTime: config.end_time,
              customSlots: config.slots_per_hour,
              isActive: true,
            });

            configHourId = created.id;
          }

          return {
            config_day_id: configDayId,
            config_hour_id: configHourId,
          };
        }),
      );

      return results;
    }),
  deleteVenueQueueSkipConfig: publicProcedure
    .input(
      z.object({
        configDayId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const deleted = await deleteConfigDay(input.configDayId);

      if (!deleted) {
        throw new Error("Failed to delete queue skip config day");
      }

      return {
        config_day_id: input.configDayId,
      };
    }),
  toggleConfigActive: publicProcedure
    .input(z.object({ configId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const updated = await toggleConfigDayActive(
        input.configId,
        input.isActive,
      );

      if (!updated) {
        throw new Error("Failed to toggle config active");
      }

      return {
        config_day_id: input.configId,
      };
    }),

  // Venue Management CRUD endpoints
  createVenue: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Venue name is required"),
        price: z.number().min(0, "Price must be positive"),
        imageUrl: z.string().url("Invalid image URL"),
        timeZone: z.string().min(1, "Time zone is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const venueId = createVenueSlug(input.name);

      // Check if venue with this ID already exists
      const exists = await venueExists(venueId);

      if (exists) {
        throw new Error("A venue with this name already exists");
      }

      const venue = await dbCreateVenue({
        id: venueId,
        name: input.name,
        price: input.price.toString(),
        imageUrl: input.imageUrl,
        timeZone: input.timeZone,
      });

      return venue;
    }),

  updateVenue: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Venue name is required").optional(),
        price: z.number().min(0, "Price must be positive").optional(),
        imageUrl: z.string().url("Invalid image URL").optional(),
        timeZone: z.string().min(1, "Time zone is required").optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updateData: {
        name?: string;
        price?: string;
        imageUrl?: string;
        timeZone?: string;
      } = {};

      if (input.name) {
        updateData.name = input.name;
      }
      if (input.price !== undefined) {
        updateData.price = input.price.toString();
      }
      if (input.imageUrl) {
        updateData.imageUrl = input.imageUrl;
      }
      if (input.timeZone) {
        updateData.timeZone = input.timeZone;
      }

      const updated = await dbUpdateVenue(input.id, updateData);

      if (!updated) {
        throw new Error("Failed to update venue");
      }

      return updated;
    }),

  deleteVenue: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // First check if venue has any queue skip configs
      const configs = await getConfigDaysByVenue(input.id);

      if (configs.length > 0) {
        throw new Error(
          "Cannot delete venue with existing queue skip configurations. Please delete configurations first.",
        );
      }

      // Check if venue has any transactions
      const transactionCount = await countTransactionsByVenue(input.id);

      if (transactionCount > 0) {
        throw new Error("Cannot delete venue with existing transactions.");
      }

      const deleted = await dbDeleteVenue(input.id);

      if (!deleted) {
        throw new Error("Failed to delete venue");
      }

      return { success: true, deletedVenue: deleted };
    }),

  uploadVenueImage: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileType: z.string(),
        fileData: z.string(), // base64 encoded file data
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(
          input.fileData.split(",")[1] ?? input.fileData,
          "base64",
        );

        // Generate unique filename with sanitization
        const timestamp = Date.now();
        const sanitizedFileName = input.fileName
          .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace invalid characters with underscore
          .replace(/_{2,}/g, "_") // Replace multiple underscores with single
          .toLowerCase();
        const filename = `venues/${timestamp}-${sanitizedFileName}`;

        // Upload to Supabase Storage
        const { error } = await supabase.storage
          .from("venue-image")
          .upload(filename, buffer, {
            contentType: input.fileType,
            upsert: false,
          });

        if (error) {
          throw new Error(`Failed to upload image: ${error.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("venue-image")
          .getPublicUrl(filename);

        return {
          success: true,
          imageUrl: publicUrlData.publicUrl,
          fileName: filename,
        };
      } catch (error) {
        throw new Error(
          `Image upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
});
