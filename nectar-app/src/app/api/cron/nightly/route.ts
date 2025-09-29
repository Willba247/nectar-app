import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

const OPERATING_DAYS = new Set([4,5,6]); // Thu, Fri, Sat (0=Sun)

export async function GET(req: NextRequest) {
  // simple token guard
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Unauthorized", { status: 401 });

  const now = new Date();
  if (!OPERATING_DAYS.has(now.getDay())) return NextResponse.json({ ok: true, skipped: "non-operating day" });

  // date of 'last night' in local AEST (use your preferred TZ logic)
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const dateISO = d.toISOString().slice(0,10);

  // all active venues
  const { data: venues, error } = await supabase.from("venues").select("id, name, is_active").eq("is_active", true);
  if (error) throw new Error(error.message);

  // fan out sequentially (or Promise.all with a small pool)
  const results: any[] = [];
  for (const v of venues ?? []) {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/reports/nightly`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ venueId: v.id, dateISO })
    }).then(x=>x.json());
    results.push({ venue: v.name, status: r.ok ? "ok" : "failed", r });
  }

  return NextResponse.json({ ok: true, dateISO, results });
}
