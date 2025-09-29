import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const type = req.nextUrl.searchParams.get("type");
  if (!key || !type) return new NextResponse("Bad Request", { status: 400 });

  // Optional: auth guard with your admin password flag in cookies/localStorage—since you’re already gating the admin area.
  const url = await getSignedUrl("reports", key, 60);
  return NextResponse.redirect(url);
}
