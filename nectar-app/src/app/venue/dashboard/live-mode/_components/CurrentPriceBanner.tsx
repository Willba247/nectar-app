interface CurrentPriceBannerProps {
  price: string;
  enabled: boolean;
}

export function CurrentPriceBanner({ price, enabled }: CurrentPriceBannerProps) {
  return (
    <div>
      {!enabled && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-100 p-3">
          <p className="text-sm font-medium text-red-800">
            ⚠️ Queue skip purchases are currently DISABLED
          </p>
          <p className="text-xs text-red-600">
            New customers cannot purchase queue skips.
          </p>
        </div>
      )}
      <div className="rounded-xl border border-foreground/20 bg-card p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
          Current Queue Skip Price
        </p>
        <p className="mt-1 text-4xl font-extrabold text-foreground">${price}</p>
        <p className="mt-1 text-xs text-foreground/60">
          Queue skip: {enabled ? "enabled" : "disabled"}
        </p>
      </div>
    </div>
  );
}
