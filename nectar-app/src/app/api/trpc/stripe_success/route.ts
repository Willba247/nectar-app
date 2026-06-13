import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");

  if (!session_id) {
    console.warn("Invalid session_id received");
    return NextResponse.json({ error: "Invalid session_id" }, { status: 400 });
  }

  try {
    const context = await createTRPCContext({ headers: req.headers });
    const caller = appRouter.createCaller(context);

    const result = await caller.stripe.storeCheckoutSession({ session_id });
    return NextResponse.redirect(new URL(result.redirectUrl, req.url));
  } catch (error) {
    console.error("Error handling stripe success:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
