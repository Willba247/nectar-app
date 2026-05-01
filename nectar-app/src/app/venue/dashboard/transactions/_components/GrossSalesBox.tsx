interface GrossSalesBoxProps {
  grossSales: number; // cents
  isLoading: boolean;
}

export function GrossSalesBox({ grossSales, isLoading }: GrossSalesBoxProps) {
  const formatted = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(grossSales / 100);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">
        Gross Sales This Period
      </p>
      {isLoading ? (
        <div className="mt-1 h-8 w-32 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-foreground">{formatted}</p>
      )}
    </div>
  );
}
