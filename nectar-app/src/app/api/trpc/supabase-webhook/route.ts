import formatVenueName from "@/lib/FormatVenueName";
import { appRouter } from "@/server/api/root";
import { NextResponse } from "next/server";

interface TradeLog {
  session_id: string;
  venue_name: string;
  customer_email: string;
  customer_name: string;
  payment_status: string;
  amount_total: number;
  created_at: string;
}

interface WebhookBody {
  record: TradeLog;
}

export async function POST(req: Request) {
  try {
    const body: WebhookBody = await req.json();
    const record: TradeLog = body.record;
    const caller = appRouter.createCaller({
      headers: req.headers,
    });
    await caller.transaction.insertTradeLog(record);
    if (record.payment_status === "paid") {
      const dateObj = new Date(record.created_at);
      if (isNaN(dateObj.getTime())) {
        console.error("Invalid created_at format:", record.created_at);
        return NextResponse.json(
          { error: "Invalid timestamp format" },
          { status: 400 },
        );
      }
      const date = dateObj.toISOString().split("T")[0];
      const time = dateObj.toTimeString().split(" ")[0];
      console.log("sending email to", record.customer_email);
      await caller.email.sendEmail({
        email: record.customer_email,
        userName: record.customer_name,
        venueName: formatVenueName(record.venue_name),
        date: date ?? "",
        time: time ?? "",
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
