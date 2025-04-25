import { api } from "@/trpc/react";
import type { VenueWithConfigs } from "@/server/api/routers/venue";
import { dayNames } from "@/types/queue-skip";
import { useMemo } from "react";

export function useAvailableQueueSkips(venue: VenueWithConfigs | undefined) {
    const now = useMemo(() => new Date(), []);
    const hourStart = useMemo(() => {
        const date = new Date(now);
        date.setMinutes(0, 0, 0);
        return date;
    }, [now]);
    const hourEnd = useMemo(() => {
        const date = new Date(hourStart);
        date.setHours(date.getHours() + 1);
        return date;
    }, [hourStart]);

    const { data: transactions, error, isLoading } = api.transaction.getTransactionByTime.useQuery(
        {
            start_time: hourStart.toISOString(),
            end_time: hourEnd.toISOString(),
            venue_id: venue?.id ?? "",
        },
        {
            retry: false,
            staleTime: 60 * 1000, // Cache for 1 minute
        }
    );

    if (!venue) return { queueSkips: 0, isOpen: false, nextAvailableQueueSkip: null };

    const hourlyQueueSkips = getTotalQueueSkipsPerHour(venue);
    const nextAvailableQueueSkip = getNextAvailableQueueSkip(venue, now, hourlyQueueSkips);

    // If we're still loading or there's an error, default to closed
    if (isLoading || error) {
        return { queueSkips: 0, isOpen: false, nextAvailableQueueSkip };
    }

    // Check if we're within operating hours
    const isWithinOperatingHours = (() => {
        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        const todayConfig = venue.queueSkipConfigs.find(config =>
            config.day_of_week === currentDay &&
            config.is_active
        );

        if (!todayConfig) return false;

        return todayConfig.qs_config_hours.some(hour => {
            if (!hour.start_time || !hour.end_time) return false;

            const startTimeParts = hour.start_time.split(':');
            const endTimeParts = hour.end_time.split(':');

            if (startTimeParts.length !== 2 || endTimeParts.length !== 2) return false;

            const startHour = parseInt(startTimeParts[0]!, 10);
            const startMin = parseInt(startTimeParts[1]!, 10);
            const endHour = parseInt(endTimeParts[0]!, 10);
            const endMin = parseInt(endTimeParts[1]!, 10);

            if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return false;

            // Check if current time is within operating hours
            if (currentHour > startHour && currentHour < endHour) return true;
            if (currentHour === startHour && currentMinutes >= startMin) return true;
            if (currentHour === endHour && currentMinutes <= endMin) return true;
            return false;
        });
    })();

    // If outside operating hours, return 0 queue skips
    if (!isWithinOperatingHours) {
        return { queueSkips: 0, isOpen: false, nextAvailableQueueSkip };
    }

    // If there's no transactions data, assume no queue skips have been purchased
    const purchasedQueueSkips = !transactions ? 0 : transactions.reduce((sum, transaction) => {
        return sum + 1;
    }, 0);

    const queueSkips = Math.max(0, hourlyQueueSkips - purchasedQueueSkips);
    return { queueSkips, isOpen: queueSkips > 0, nextAvailableQueueSkip };
}

function getDayName(day: number) {
    return dayNames[day];
}

function getNextAvailableQueueSkip(venue: VenueWithConfigs | undefined, now: Date, hourlyQueueSkips: number) {
    if (!venue) return null;
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // First check if there's an active config for today
    const todayConfig = venue.queueSkipConfigs.find(config =>
        config.day_of_week === currentDay &&
        config.is_active
    );

    if (todayConfig) {
        // First check if there are any future hours today with available slots
        const futureHoursToday = todayConfig.qs_config_hours.filter(hour => {
            if (!hour.start_time) return false;
            const [hourStartStr, minuteStartStr] = hour.start_time.split(':');
            const hourStart = parseInt(hourStartStr!, 10);
            const minuteStart = parseInt(minuteStartStr!, 10);

            if (isNaN(hourStart) || isNaN(minuteStart)) return false;

            // Check if this hour is in the future
            return hourStart > currentHour ||
                (hourStart === currentHour && minuteStart > currentMinutes);
        });

        if (futureHoursToday.length > 0) {
            // Sort by start time to get the next available hour
            futureHoursToday.sort((a, b) => {
                if (!a.start_time || !b.start_time) return 0;

                const aTimeParts = a.start_time.split(':');
                const bTimeParts = b.start_time.split(':');

                if (aTimeParts.length !== 2 || bTimeParts.length !== 2) return 0;

                const aHourStr = aTimeParts[0];
                const aMinStr = aTimeParts[1];
                const bHourStr = bTimeParts[0];
                const bMinStr = bTimeParts[1];

                if (!aHourStr || !aMinStr || !bHourStr || !bMinStr) return 0;

                const aHour = parseInt(aHourStr, 10);
                const aMin = parseInt(aMinStr, 10);
                const bHour = parseInt(bHourStr, 10);
                const bMin = parseInt(bMinStr, 10);

                if (isNaN(aHour) || isNaN(aMin) || isNaN(bHour) || isNaN(bMin)) return 0;

                return aHour - bHour || aMin - bMin;
            });

            return {
                day: getDayName(currentDay),
                start_time: futureHoursToday[0]!.start_time!.slice(0, 5)
            };
        }

        const currentHourConfig = todayConfig.qs_config_hours.find(hour => {
            if (!hour.start_time || !hour.end_time) {
                return false;
            }

            const startTimeParts = hour.start_time.split(':');
            const endTimeParts = hour.end_time.split(':');

            if (startTimeParts.length !== 2 || endTimeParts.length !== 2) {
                return false;
            }

            const startHour = parseInt(startTimeParts[0]!, 10);
            const startMin = parseInt(startTimeParts[1]!, 10);
            const endHour = parseInt(endTimeParts[0]!, 10);
            const endMin = parseInt(endTimeParts[1]!, 10);

            if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
                return false;
            }

            // Check if current time is within operating hours
            if (currentHour > startHour && currentHour < endHour) {
                return true;
            }
            if (currentHour === startHour && currentMinutes >= startMin) {
                return true;
            }
            if (currentHour === endHour && currentMinutes <= endMin) {
                return true;
            }
            return false;
        });

        if (currentHourConfig) {
            // If we're within operating hours but queue skips are used up
            if (hourlyQueueSkips > 0) {
                // Check if there are more hours today with available slots
                const nextHourToday = todayConfig.qs_config_hours.find(hour => {
                    if (!hour.start_time) {
                        return false;
                    }
                    const [hourStartStr] = hour.start_time.split(':');
                    const hourStart = parseInt(hourStartStr!, 10);
                    return !isNaN(hourStart) && hourStart > currentHour;
                });

                if (nextHourToday?.start_time) {
                    return {
                        day: getDayName(currentDay),
                        start_time: nextHourToday.start_time.slice(0, 5)
                    };
                }
            }
        }
    }

    // If no slots available today, look for the next consecutive day with an active config
    let daysChecked = 0;
    let nextDay = (currentDay + 1) % 7;

    while (daysChecked < 7) {
        const config = venue.queueSkipConfigs.find(config =>
            config.day_of_week === nextDay &&
            config.is_active
        );

        if (config && config.qs_config_hours.length > 0) {
            const firstHour = config.qs_config_hours[0];
            if (firstHour?.start_time) {
                return {
                    day: getDayName(nextDay),
                    start_time: firstHour.start_time.slice(0, 5)
                };
            }
        }

        nextDay = (nextDay + 1) % 7;
        daysChecked++;
    }

    return null;
}

function getTotalQueueSkipsPerHour(venue: VenueWithConfigs) {
    const currentDay = new Date().getDay();
    const config = venue.queueSkipConfigs.find(
        (config) => config.day_of_week === currentDay,
    );

    if (!config) {
        return 0;
    }

    return config.slots_per_hour;
}