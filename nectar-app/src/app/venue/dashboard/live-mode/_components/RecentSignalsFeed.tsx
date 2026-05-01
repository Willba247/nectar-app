interface Signal {
  id: number;
  waitTimeMinutes: number;
  salesLast15Min: number;
  priceBefore: string;
  priceAfter: string;
  submittedAt: string;
}

interface RecentSignalsFeedProps {
  signals: Signal[];
}

function timeAgo(isoString: string): string {
  const diffSecs = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 1000,
  );
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
}

export function RecentSignalsFeed({ signals }: RecentSignalsFeedProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Recent Submissions
      </p>

      {signals.length === 0 ? (
        <p className="text-sm text-slate-400">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => {
            const increased =
              parseFloat(signal.priceAfter) > parseFloat(signal.priceBefore);
            return (
              <div
                key={signal.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {signal.waitTimeMinutes} min queue
                  </p>
                  <p className="text-xs text-slate-400">
                    {timeAgo(signal.submittedAt)} · {signal.salesLast15Min}{" "}
                    sales/15min
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      increased ? "text-green-600" : "text-slate-800"
                    }`}
                  >
                    ${signal.priceAfter}
                  </p>
                  <p className="text-xs text-slate-400">
                    was ${signal.priceBefore}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
