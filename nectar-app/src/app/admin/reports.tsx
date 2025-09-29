// server component
import { computeNightlySummary } from "@/lib/reports";
import { notFound } from "next/navigation";

// very simple token gate so only our API can hit it
function validateToken(searchParams: URLSearchParams) {
  const token = searchParams.get("token");
  return token && token === process.env.INTERNAL_RENDER_TOKEN;
}

export default async function RenderReportPage({
  params,
  searchParams
}: {
  params: { venueId: string; date: string };
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const ok = validateToken(new URLSearchParams(searchParams as Record<string, string>));
  if (!ok) return notFound();

  const summary = await computeNightlySummary(params.venueId, params.date);

  // Inline CSS so the screenshot is consistent
  return (
    <html>
      <body style={{
        margin: 0,
        background: "#0f141a",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#e8eef6"
      }}>
        <div style={{padding: "28px"}}>
          <h1 style={{fontSize: 24, marginBottom: 12}}>Hourly Performance Tracker • {summary.venueName} • {summary.dateISO}</h1>

          {/* Summary cards */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20}}>
            {[
              ["🎟 Total Skips", summary.totalSkips],
              ["💰 Total Revenue", `$${summary.totalRevenue.toFixed(2)}`],
              ["📈 Avg Price", `$${summary.avgPrice.toFixed(2)}`],
              ["🏛 Venue Share", `$${summary.venueShare.toFixed(2)} (${summary.venueSharePct}%)`],
            ].map(([label, value]) => (
              <div key={label as string} style={{background:"#171e26", borderRadius:12, padding:"14px 16px"}}>
                <div style={{opacity:.8, fontSize:12}}>{label}</div>
                <div style={{fontSize:22, fontWeight:700}}>{value as string}</div>
              </div>
            ))}
          </div>

          {/* Tracker rows */}
          <div style={{background:"#171e26", borderRadius:16, padding:"18px 16px"}}>
            {summary.hourly.map((h) => {
              const max = Math.max(...summary.hourly.map(x => x.count), 1);
              const widthPct = `${(h.count / max) * 55 + 2}%`; // 0..57% bar width
              return (
                <div key={h.hour} style={{
                  display:"grid",
                  gridTemplateColumns:"80px 1fr 64px 96px",
                  alignItems:"center",
                  gap:12,
                  padding:"10px 8px",
                  background:"#1c242e",
                  borderRadius:12,
                  margin:"6px 0"
                }}>
                  <div style={{opacity:.9}}>{h.label}</div>

                  {/* gradient bar */}
                  <div style={{
                    background:"linear-gradient(90deg,#10d0b6 0%,#7327fa 55%,#f44a8a 100%)",
                    height: 22,
                    width: widthPct,
                    borderRadius: 12
                  }}/>

                  {/* count pill */}
                  <div style={{
                    background:"#231a3a",
                    border:"1px solid #4a2f7d",
                    color:"#e8eef6",
                    borderRadius: 999,
                    height: 28, display: "flex", alignItems:"center", justifyContent:"center"
                  }}>{h.count}</div>

                  {/* price pill */}
                  <div style={{
                    background:"#132219",
                    border:"1px solid #2a5f3f",
                    color:"#1f9d55",
                    borderRadius: 999,
                    height: 28, display: "flex", alignItems:"center", justifyContent:"center"
                  }}>{h.avgPrice ? `$${Math.round(h.avgPrice)}` : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </body>
    </html>
  );
}
