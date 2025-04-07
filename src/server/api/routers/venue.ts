import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { venues } from "@/data/venues";

export const venueRouter = createTRPCRouter({
  getVenueById: publicProcedure
    .input(z.object({ venueId: z.string() }))
    .query(({ input }) => {
      //change this to db call
      console.log("API CALL");

      return venues.find((venue) => venue.id === input.venueId);
    }),
});
