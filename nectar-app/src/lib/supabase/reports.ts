create table if not exists nightly_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  venue_name text not null,
  report_date date not null,
  total_skips integer not null,
  total_revenue numeric(10,2) not null,
  avg_price numeric(10,2) not null,
  venue_share_pct numeric(5,2) not null,
  venue_share numeric(10,2) not null,
  png_key text not null,
  pdf_key text not null,
  created_at timestamptz not null default now()
);

create index on nightly_reports (venue_id, report_date);

// lib/reports.ts
import { supabase } from "@/lib/supabase/server";

// Hours we consider "a night" → 6PM (18) through 3AM (27)
const HOURS = [18,19,20,21,22,23,24,25,26,27];

function labelForHour(h: number) {
  const h24 = h >= 24 ? h - 24 : h;
  const mer = h >= 12 && h <= 23 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${mer}`;
}

// Window: 6PM of date → 3AM next day
export function nightlyWindow(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const start = new Date(d);
  start.setHours(18, 0, 0, 0); // 6PM
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  end.setHours(3, 0, 0, 0); // 3AM next day
  return { start, end };
}

export async function computeNightlySummary(
  venueId: string,
  dateISO: string,
  venueSharePct = 75
) {
  const { start, end } = nightlyWindow(dateISO);

  // Get venue name
  const { data: venue, error: vErr } = await supabase
    .from("venues")
    .select("id, name")
    .eq("id", venueId)
    .single();
  if (vErr || !venue) throw new Error(vErr?.message ?? "Venue not found");

  // Get paid transactions in window
  const { data: tx, error: tErr } = await supabase
    .from("transactions")
    .select("amount_total, created_at")
    .eq("venue_id", venueId)
    .eq("payment_status", "paid")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (tErr) throw new Error(tErr.message);

  const amounts = tx?.map(r => Number(r.amount_total)) ?? [];
  const totalRevenue = amounts.reduce((a,b)=>a+b, 0);
  const totalSkips = amounts.length;
  const avgPrice = totalSkips ? totalRevenue / totalSkips : 0;
  const venueShare = totalRevenue * (venueSharePct/100);

  // Hourly breakdown for rendering only
  const byHour = new Map<number, number[]>();
  for (const h of HOURS) byHour.set(h, []);
  tx?.forEach(row => {
    const dt = new Date(row.created_at);
    let hour = dt.getHours();
    if (hour < 6) hour += 24; // normalise 0–5 into 24–29
    if (hour >= 18 && hour <= 27) {
      byHour.get(hour)?.push(Number(row.amount_total));
    }
  });
  const hourly = HOURS.map(h => {
    const arr = byHour.get(h) ?? [];
    const avg = arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : null;
    return { hour: h, label: labelForHour(h), count: arr.length, avgPrice: avg };
  });

  return {
    venueId,
    venueName: venue.name ?? venueId,
    report_date: dateISO,                // ← matches nightly_reports schema
    total_skips: totalSkips,
    total_revenue: Number(totalRevenue.toFixed(2)),
    avg_price: Number(avgPrice.toFixed(2)),
    venue_share_pct: venueSharePct,
    venue_share: Number(venueShare.toFixed(2)),
    hourly
  };
}

