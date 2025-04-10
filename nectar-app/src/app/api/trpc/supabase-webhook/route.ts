// src/app/api/webhook/route.ts

import { appRouter } from "@/server/api/root";
import { NextResponse } from "next/server";

interface TradeLog {
  session_id: string;
  venue_name: string;
  customer_email: string;
  payment_status: string;
  amount_total: number;
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
