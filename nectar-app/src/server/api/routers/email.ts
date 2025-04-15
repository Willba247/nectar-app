import { z } from "zod";
import { Resend } from "resend";
import { publicProcedure } from "../trpc";
import { createTRPCRouter } from "../trpc";

export const emailRouter = createTRPCRouter({
  sendEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { email } = input;
      const { data, error } = await resend.emails.send({
        from: "Tickets <michael@tickets.thenectarapp.com>",
        to: email,
        subject: "Hello world!",
        html: "<div>Hello world!</div>",
      });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    }),
});
