import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const authRouter = createTRPCRouter({
  verifyAdminPassword: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminPassword) {
        throw new Error("Admin password not configured");
      }

      const isValid = input.password === adminPassword;

      return {
        isValid,
      };
    }),
});
