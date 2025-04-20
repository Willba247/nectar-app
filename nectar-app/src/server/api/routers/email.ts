import { z } from "zod";
import { Resend } from "resend";
import { publicProcedure } from "../trpc";
import { createTRPCRouter } from "../trpc";
import { generateTicketEmailTemplate } from "@/lib/email-templates/ticket";

export const emailRouter = createTRPCRouter({
  sendEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        userName: z.string(),
        venueName: z.string(),
        date: z.string(),
        time: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { email, userName, venueName, date, time } = input;

      const htmlContent = generateTicketEmailTemplate({
        userName,
        venueName,
        date,
        time,
      });

      const { data, error } = await resend.emails.send({
        from: "Tickets <michael@tickets.thenectarapp.com>",
        to: email,
        subject: "Your Queue Skip Ticket",
        html: htmlContent,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    }),
});
