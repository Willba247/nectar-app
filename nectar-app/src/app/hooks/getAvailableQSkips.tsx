import { api } from "@/trpc/react";
import { getTotalQueueSkipsPerHour } from "../utils/venue";
import type { VenueWithConfigs } from "@/server/api/routers/venue";

export function useAvailableQueueSkips(venue: VenueWithConfigs | undefined) {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const { data: transactions, error } = api.transaction.getTransactionByTime.useQuery(
        {
            start_time: hourStart.toISOString(),
            end_time: hourEnd.toISOString(),
            venue_id: venue?.id ?? "",
        },
        {
            retry: false, // Don't retry on error
        }
    );

    if (!venue) return 0;

    const hourlyQueueSkips = getTotalQueueSkipsPerHour(venue);

    // If there's an error or no transactions data, assume no queue skips have been purchased
    const purchasedQueueSkips = error || !transactions ? 0 : transactions.reduce((sum, transaction) => {
        return sum + transaction.quantity;
    }, 0);

    return Math.max(0, hourlyQueueSkips - purchasedQueueSkips);
}
