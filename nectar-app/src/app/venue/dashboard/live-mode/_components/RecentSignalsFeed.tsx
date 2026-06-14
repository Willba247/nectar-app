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
    <div className="rounded-xl border border-foreground/20 bg-card p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
        Recent Submissions
      </p>

      {signals.length === 0 ? (
        <p className="text-sm text-foreground/60">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => {
            const increased =
              parseFloat(signal.priceAfter) > parseFloat(signal.priceBefore);
            return (
              <div
                key={signal.id}
                className="flex items-center justify-between rounded-lg bg-foreground/10 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {signal.waitTimeMinutes} min queue
                  </p>
                  <p className="text-xs text-foreground/60">
                    {timeAgo(signal.submittedAt)} · {signal.salesLast15Min}{" "}
                    sales/15min
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      increased ? "text-green-400" : "text-foreground"
                    }`}
                  >
                    ${signal.priceAfter}
                  </p>
                  <p className="text-xs text-foreground/60">
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
