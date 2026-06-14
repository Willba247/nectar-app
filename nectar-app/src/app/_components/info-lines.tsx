export default function InfoLines({
  queueSkips,
  price,
  isOpen,
  nextAvailableQueueSkip,
  priceDisplayMode = "queue_skip_only",
  entryFee,
}: {
  queueSkips: number;
  price: number;
  isOpen: boolean;
  nextAvailableQueueSkip:
    | {
        day:
          | "Sunday"
          | "Monday"
          | "Tuesday"
          | "Wednesday"
          | "Thursday"
          | "Friday"
          | "Saturday"
          | undefined;
        next_available_time: string | undefined;
      }
    | null
    | undefined;
  priceDisplayMode?: "queue_skip_only" | "entry_fee_only" | "both";
  entryFee?: number;
}) {
  const renderPrice = () => {
    if (priceDisplayMode === "queue_skip_only") {
      return (
        <p className="text-sm text-white">Queue Skip: ${price.toFixed(2)}</p>
      );
    }
    if (priceDisplayMode === "entry_fee_only") {
      return (
        <p className="text-sm text-white">
          Entry Fee: ${entryFee?.toFixed(2) ?? "0.00"}
        </p>
      );
    }
    if (priceDisplayMode === "both") {
      return (
        <>
          <p className="text-sm text-white">Queue Skip: ${price.toFixed(2)}</p>
          <p className="text-sm text-white">
            Entry Fee: ${entryFee?.toFixed(2) ?? "0.00"}
          </p>
        </>
      );
    }
    // Default fallback
    return (
      <p className="text-sm text-white">Queue Skip: ${price.toFixed(2)}</p>
    );
  };

  return (
    <div className="mb-4 space-y-1">
      {isOpen ? (
        <>
          <p className="text-sm text-white">
            Queue skips available: {queueSkips}
          </p>
          {renderPrice()}
        </>
      ) : (
        <p className="rounded-lg bg-gray-700/80 px-6 py-4 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          {nextAvailableQueueSkip
            ? `Unavailable until ${nextAvailableQueueSkip.day} ${nextAvailableQueueSkip.next_available_time}`
            : "Unavailable for now"}
        </p>
      )}
    </div>
  );
}
