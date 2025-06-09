import { api } from "@/trpc/react";
import type { VenueWithConfigs } from "@/server/api/routers/venue";
import { dayNames } from "@/types/queue-skip";
import { useMemo } from "react";

// Utility function to parse time string into hours and minutes
export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
    if (!timeStr) return null;
    const [hoursStr, minutesStr] = timeStr.split(':').slice(0, 2);
    if (!hoursStr || !minutesStr) return null;

    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return { hours, minutes };
}

// Utility function to check if a time is within a time range
function isTimeWithinRange(
    currentTime: { hours: number; minutes: number },
    startTime: { hours: number; minutes: number },
    endTime: { hours: number; minutes: number }
): boolean {
    const currentTotalMinutes = currentTime.hours * 60 + currentTime.minutes;
    const startTotalMinutes = startTime.hours * 60 + startTime.minutes;
    const endTotalMinutes = endTime.hours * 60 + endTime.minutes;

    return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

// Utility function to check if current time is within operating hours
function checkOperatingHours(venue: VenueWithConfigs, now: Date): boolean {
    const currentDay = now.getDay();
    const currentTime = { hours: now.getHours(), minutes: now.getMinutes() };

    const todayConfig = venue.qs_config_days.find(config =>
        config.day_of_week === currentDay &&
        config.is_active
    );

    if (!todayConfig) return false;

    return todayConfig.qs_config_hours.some(hour => {
        if (!hour.start_time || !hour.end_time) return false;

        const startTime = parseTimeString(hour.start_time);
        const endTime = parseTimeString(hour.end_time);

        if (!startTime || !endTime) return false;

        return isTimeWithinRange(currentTime, startTime, endTime);
    });
}
function getDayName(day: number) {
    return dayNames[day];
}

function getNextAvailableQueueSkip(venue: VenueWithConfigs | undefined, now: Date, hourlyQueueSkips: number) {
    if (!venue) return null;
    const currentDay = now.getDay();
    const currentTime = { hours: now.getHours(), minutes: now.getMinutes() };

    // First check if there's an active config for today
    const todayConfig = venue.qs_config_days?.find(config =>
        config.day_of_week === currentDay &&
        config.is_active
    );

    if (todayConfig) {
        // Check if we're within operating hours
        const currentHourConfig = todayConfig.qs_config_hours.find(hour => {
            if (!hour.start_time || !hour.end_time) return false;
            const startTime = parseTimeString(hour.start_time);
            const endTime = parseTimeString(hour.end_time);
            if (!startTime || !endTime) return false;
            return isTimeWithinRange(currentTime, startTime, endTime);
        });

        // If we're within operating hours and queue skips are used up
        if (currentHourConfig && hourlyQueueSkips === 0) {
            // Get the next hour's time
            const nextHour = currentTime.hours + 1;
            const endTime = parseTimeString(currentHourConfig.end_time);

            if (endTime && nextHour <= endTime.hours) {
                // Format the next hour as HH:00
                const nextHourTime = `${nextHour.toString().padStart(2, '0')}:00`;
                return {
                    day: getDayName(currentDay),
                    next_available_time: nextHourTime
                };
            }
        }

        // If we're not in operating hours or no next hour today, look for future hours today
        const futureHoursToday = todayConfig.qs_config_hours
            .filter(hour => {
                if (!hour.start_time) return false;
                const startTime = parseTimeString(hour.start_time);
                if (!startTime) return false;
                return startTime.hours > currentTime.hours ||
                    (startTime.hours === currentTime.hours && startTime.minutes > currentTime.minutes);
            })
            .sort((a, b) => {
                if (!a.start_time || !b.start_time) return 0;
                const aTime = parseTimeString(a.start_time);
                const bTime = parseTimeString(b.start_time);
                if (!aTime || !bTime) return 0;
                return aTime.hours - bTime.hours;
            });

        if (futureHoursToday.length > 0) {
            return {
                day: getDayName(currentDay),
                next_available_time: futureHoursToday[0]?.start_time?.slice(0, 5) ?? ''
            };
        }
    }

    // If no slots available today, look for the next consecutive day with an active config
    let daysChecked = 0;
    let nextDay = (currentDay + 1) % 7;

    while (daysChecked < 7) {
        const config = venue.qs_config_days?.find(config =>
            config.day_of_week === nextDay &&
            config.is_active
        );

        if (config && config.qs_config_hours.length > 0) {
            const firstHour = config.qs_config_hours[0];
            if (firstHour?.start_time) {
                return {
                    day: getDayName(nextDay),
                    next_available_time: firstHour.start_time.slice(0, 5)
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
    const config = venue.qs_config_days?.find(
        (config) => config.day_of_week === currentDay,
    );

    if (!config) {
        return 0;
    }

    return config.slots_per_hour;
}
export function useAvailableQueueSkips(venue: VenueWithConfigs | undefined) {
    // All hooks must be called unconditionally at the top level
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

    // Always make the API call, but use enabled option to control when it runs
    const { data: transactions, error, isLoading } = api.transaction.getTransactionByTime.useQuery(
        {
            start_time: hourStart.toISOString(),
            end_time: hourEnd.toISOString(),
            venue_id: venue?.id ?? "",
        },
        {
            retry: false,
            staleTime: 60 * 1000,
            enabled: !!venue?.id, // Only run if we have a venue ID
        }
    );

    // Calculate purchased queue skips
    const purchasedQueueSkips = useMemo(() => {
        return transactions?.reduce((sum, transaction) => sum + 1, 0) ?? 0;
    }, [transactions]);

    // Memoize all calculations that depend on venue
    const venueCalculations = useMemo(() => {
        if (!venue) {
            return {
                hourlyQueueSkips: 0,
                isWithinOperatingHours: false
            };
        }

        const hourlyQueueSkips = getTotalQueueSkipsPerHour(venue);
        const isWithinOperatingHours = checkOperatingHours(venue, now);

        return {
            hourlyQueueSkips,
            isWithinOperatingHours
        };
    }, [venue, now]);

    // Calculate available queue skips
    const queueSkips = useMemo(() => {
        if (!venue) return 0;
        return Math.max(0, venueCalculations.hourlyQueueSkips - purchasedQueueSkips);
    }, [venue, venueCalculations.hourlyQueueSkips, purchasedQueueSkips]);

    // Calculate next available queue skip
    const nextAvailableQueueSkip = useMemo(() => {
        if (!venue) return null;
        return getNextAvailableQueueSkip(venue, now, queueSkips);
    }, [venue, now, queueSkips]);

    // Early return if no venue
    if (!venue) return { queueSkips: 0, isOpen: false, nextAvailableQueueSkip: null };

    // If outside operating hours, return 0 queue skips
    if (!venueCalculations.isWithinOperatingHours) {
        return {
            queueSkips: 0,
            isOpen: false,
            nextAvailableQueueSkip
        };
    }

    // If we're still loading or there's an error, default to closed
    if (isLoading || error) {
        return {
            queueSkips: 0,
            isOpen: false,
            nextAvailableQueueSkip
        };
    }

    return {
        queueSkips,
        isOpen: queueSkips > 0,
        nextAvailableQueueSkip
    };
}

