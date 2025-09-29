"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client"; // you can make a client with anon key for RLS-safe reads, or expose an API that returns report rows

type ReportRow = {
  id: string;
  venue_id: string;
  venue_name: string;
  report_date: string;
  total_skips: number;
  total_revenue: number;
  avg_price: number;
  png_key: string;
  pdf_key: string;
  created_at: string;
};

export default function ReportsTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For admin-only pages, you might prefer a server API that returns signed URLs
    (async () => {
      const { data, error } = await supabase.from("nightly_reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (!error) setRows(data as ReportRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Nightly Reports</h2>
      </div>

      {loading ? <div>Loading…</div> : (
        <div className="rounded-lg border p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Date</th>
                <th className="p-2">Venue</th>
                <th className="p-2">Skips</th>
                <th className="p-2">Revenue</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.report_date}</td>
                  <td className="p-2">{r.venue_name}</td>
                  <td className="p-2">{r.total_skips}</td>
                  <td className="p-2">${r.total_revenue.toFixed(2)}</td>
                  <td className="p-2">
                    {/* In production, generate signed URLs on the server */}
                    <a href={`/api/reports/download?key=${encodeURIComponent(r.png_key)}&type=png`} className="underline mr-3">PNG</a>
                    <a href={`/api/reports/download?key=${encodeURIComponent(r.pdf_key)}&type=pdf`} className="underline">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
