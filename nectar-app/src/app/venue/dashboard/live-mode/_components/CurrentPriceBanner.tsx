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
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
          Current Queue Skip Price
        </p>
        <p className="mt-1 text-4xl font-extrabold text-sky-900">${price}</p>
        <p className="mt-1 text-xs text-slate-500">
          Queue skip: {enabled ? "enabled" : "disabled"}
        </p>
      </div>
    </div>
  );
}
