//npm i playwright-chromium
import { NextRequest, NextResponse } from "next/server";
import { computeNightlySummary } from "@/lib/reports";
import playwright from "playwright-chromium";
import { putToStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase/server";

const BUCKET = "reports";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { venueId, dateISO, venueSharePct = 75 } = await req.json();

  // Compute metrics first (also verifies venue exists)
  const summary = await computeNightlySummary(venueId, dateISO, venueSharePct);

  // Render target
  const u = new URL(`${BASE_URL}/admin/reports/_render/${venueId}/${dateISO}`);
  u.searchParams.set("token", process.env.INTERNAL_RENDER_TOKEN ?? "");

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(u.toString(), { waitUntil: "networkidle" });

  const png = await page.screenshot({ type: "png" });
  const pdf = await page.pdf({ printBackground: true, width: "1400px", height: "900px" });

  await browser.close();

  const slug = summary.venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const baseKey = `reports/${slug}/${summary.report_date}`;
  const pngKey = `${baseKey}/${summary.report_date}_hourly.png`;
  const pdfKey = `${baseKey}/${summary.report_date}_nightly.pdf`;

  await putToStorage(BUCKET, pngKey, png, "image/png");
  await putToStorage(BUCKET, pdfKey, pdf, "application/pdf");

  // Write DB record
  const { error } = await supabase.from("nightly_reports").insert({
    venue_id: summary.venueId,
    venue_name: summary.venueName,
    report_date: summary.report_date,
    total_skips: summary.totalSkips,
    total_revenue: summary.totalRevenue,
    avg_price: summary.avgPrice,
    venue_share_pct: summary.venueSharePct,
    venue_share: summary.venueShare,
    png_key: pngKey,
    pdf_key: pdfKey
  });
  if (error) throw new Error(error.message);

  return NextResponse.json({ ok: true, pngKey, pdfKey });
}
