import type { VenueWithConfigs } from "@/server/api/routers/venue";

export function getTotalQueueSkipsPerHour(venue: VenueWithConfigs) {
  const currentDay = new Date().getDay();
  const config = venue.queueSkipConfigs.find(
    (config) => config.day_of_week === currentDay,
  );

  if (!config) {
    return 0;
  }

  return config.slots_per_hour;
}
