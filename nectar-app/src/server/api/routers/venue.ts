import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { supabase } from "@/lib/supabase/server";

type Venue = {
  id: string;
  name: string;
  image_url: string;
  price: number;
};

export const venueRouter = createTRPCRouter({
  getVenueById: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", input.venueId)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data as Venue;
    }),

  getAllVenues: publicProcedure.query(async () => {
    const { data, error } = await supabase.from("venues").select("*");

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }),
  getVenueQueueSkipConfig: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from("qs_config_days")
        .select("*")
        .eq("venue_id", input.venueId);

      if (error) {
        throw new Error(error.message);
      }
      return data;
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
      const { data: existingDay } = await supabase
        .from("qs_config_days")
        .select("id")
        .eq("venue_id", input.venueId)
        .eq("day_of_week", input.dayOfWeek)
        .single();

      let configDayId: number;

      if (existingDay) {
        // Update existing day config
        const { data, error } = await supabase
          .from("qs_config_days")
          .update({
            slots_per_hour: input.slots_per_hour,
            is_active: true,
          })
          .eq("id", existingDay.id)
          .select()
          .single();

        if (error || !data) {
          throw new Error(
            error?.message || "Failed to update queue skip config day",
          );
        }

        configDayId = data.id;
      } else {
        // Insert new day config
        const { data, error } = await supabase
          .from("qs_config_days")
          .insert({
            venue_id: input.venueId,
            day_of_week: input.dayOfWeek,
            slots_per_hour: input.slots_per_hour,
            is_active: true,
          })
          .select()
          .single();

        if (error || !data) {
          throw new Error(
            error?.message || "Failed to create queue skip config day",
          );
        }

        configDayId = data.id;
      }

      // Now handle the hour config
      const { data: existingHour } = await supabase
        .from("qs_config_hours")
        .select("id")
        .eq("config_day_id", configDayId)
        .single();

      let configHourId: number;

      if (existingHour) {
        // Update existing hour config
        const { data, error } = await supabase
          .from("qs_config_hours")
          .update({
            start_time: input.start_time,
            end_time: input.end_time,
            custom_slots: input.slots_per_hour,
            is_active: true,
          })
          .eq("id", existingHour.id)
          .select()
          .single();

        if (error || !data) {
          throw new Error(
            error?.message || "Failed to update queue skip config hour",
          );
        }

        configHourId = data.id;
      } else {
        // Insert new hour config
        const { data, error } = await supabase
          .from("qs_config_hours")
          .insert({
            config_day_id: configDayId,
            start_time: input.start_time,
            end_time: input.end_time,
            custom_slots: input.slots_per_hour,
            is_active: true,
          })
          .select()
          .single();

        if (error || !data) {
          throw new Error(
            error?.message || "Failed to create queue skip config hour",
          );
        }

        configHourId = data.id;
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

      // Process all configs in a single transaction
      const results = await Promise.all(
        configs.map(async (config) => {
          // First check if a config already exists for this day and venue
          const { data: existingDay } = await supabase
            .from("qs_config_days")
            .select("id")
            .eq("venue_id", venueId)
            .eq("day_of_week", config.dayOfWeek)
            .single();

          let configDayId: number;

          if (existingDay) {
            // Update existing day config
            const { data, error } = await supabase
              .from("qs_config_days")
              .update({
                slots_per_hour: config.slots_per_hour,
                is_active: true,
              })
              .eq("id", existingDay.id)
              .select()
              .single();

            if (error || !data) {
              throw new Error(
                error?.message || "Failed to update queue skip config day",
              );
            }

            configDayId = data.id;
          } else {
            // Insert new day config
            const { data, error } = await supabase
              .from("qs_config_days")
              .insert({
                venue_id: venueId,
                day_of_week: config.dayOfWeek,
                slots_per_hour: config.slots_per_hour,
                is_active: true,
              })
              .select()
              .single();

            if (error || !data) {
              throw new Error(
                error?.message || "Failed to create queue skip config day",
              );
            }

            configDayId = data.id;
          }

          // Now handle the hour config
          const { data: existingHour } = await supabase
            .from("qs_config_hours")
            .select("id")
            .eq("config_day_id", configDayId)
            .single();

          let configHourId: number;

          if (existingHour) {
            // Update existing hour config
            const { data, error } = await supabase
              .from("qs_config_hours")
              .update({
                start_time: config.start_time,
                end_time: config.end_time,
                custom_slots: config.slots_per_hour,
                is_active: true,
              })
              .eq("id", existingHour.id)
              .select()
              .single();

            if (error || !data) {
              throw new Error(
                error?.message || "Failed to update queue skip config hour",
              );
            }

            configHourId = data.id;
          } else {
            // Insert new hour config
            const { data, error } = await supabase
              .from("qs_config_hours")
              .insert({
                config_day_id: configDayId,
                start_time: config.start_time,
                end_time: config.end_time,
                custom_slots: config.slots_per_hour,
                is_active: true,
              })
              .select()
              .single();

            if (error || !data) {
              throw new Error(
                error?.message || "Failed to create queue skip config hour",
              );
            }

            configHourId = data.id;
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
      const { data, error } = await supabase
        .from("qs_config_days")
        .delete()
        .eq("id", input.configDayId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(
          error?.message || "Failed to delete queue skip config day",
        );
      }

      return {
        config_day_id: input.configDayId,
      };
    }),
  toggleConfigActive: publicProcedure
    .input(z.object({ configId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from("qs_config_days")
        .update({ is_active: input.isActive })
        .eq("id", input.configId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to toggle config active");
      }

      return {
        config_day_id: input.configId,
      };
    }),
});
