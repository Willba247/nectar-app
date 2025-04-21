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
});
