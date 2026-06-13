import { api } from "@/trpc/react";
import type { VenueWithConfigs } from "@/server/api/routers/venue";
import { dayNames } from "@/types/queue-skip";
import { useEffect, useMemo, useState } from "react";

export type ExternalCountState = {
  count: number | undefined;
  isLoading: boolean;
  isError: boolean;
};

// Utility function to parse time string into hours and minutes
export function parseTimeString(
  timeStr: string,
): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const [hoursStr, minutesStr] = timeStr.split(":").slice(0, 2);
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
  endTime: { hours: number; minutes: number },
): boolean {
  const currentTotalMinutes = currentTime.hours * 60 + currentTime.minutes;
  const startTotalMinutes = startTime.hours * 60 + startTime.minutes;
  const endTotalMinutes = endTime.hours * 60 + endTime.minutes;

  return (
    currentTotalMinutes >= startTotalMinutes &&
    currentTotalMinutes <= endTotalMinutes
  );
}

const DEFAULT_TIME_ZONE =
  (typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : undefined) ?? "UTC";

type VenueLocalTime = {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type VenueTimeInfo = {
  localTime: VenueLocalTime;
  offsetMs: number;
};

function resolveTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;

  if (typeof Intl === "undefined") {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function getVenueTimeInfo(date: Date, timeZone: string): VenueTimeInfo {
  const fallbackLocalTime: VenueLocalTime = {
    dayOfWeek: date.getUTCDay(),
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
  };

  if (typeof Intl === "undefined") {
    return {
      localTime: fallbackLocalTime,
      offsetMs: 0,
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const getPartValue = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    const toNumber = (value: string | undefined, fallback: number) => {
      if (!value) return fallback;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const year = toNumber(getPartValue("year"), fallbackLocalTime.year);
    const month = toNumber(getPartValue("month"), fallbackLocalTime.month);
    const day = toNumber(getPartValue("day"), fallbackLocalTime.day);
    const hours = toNumber(getPartValue("hour"), fallbackLocalTime.hours);
    const minutes = toNumber(getPartValue("minute"), fallbackLocalTime.minutes);
    const seconds = toNumber(getPartValue("second"), fallbackLocalTime.seconds);

    const weekdayName =
      getPartValue("weekday") ?? dayNames[fallbackLocalTime.dayOfWeek];
    const weekdayIndex = dayNames.findIndex((name) => name === weekdayName);
    const dayOfWeek =
      weekdayIndex === -1 ? fallbackLocalTime.dayOfWeek : weekdayIndex;

    const localDateMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const offsetMs = date.getTime() - localDateMs;

    return {
      localTime: {
        year,
        month,
        day,
        dayOfWeek,
        hours,
        minutes,
        seconds,
      },
      offsetMs,
    };
  } catch {
    return {
      localTime: fallbackLocalTime,
      offsetMs: 0,
    };
  }
}

// Utility function to check if current time is within operating hours
// Handles cross-midnight slots using end_day_offset
function checkOperatingHours(
  venue: VenueWithConfigs,
  localTime: VenueLocalTime,
): boolean {
  const currentDay = localTime.dayOfWeek;
  const yesterdayDay = (currentDay + 6) % 7; // 0=Sunday, so yesterday of Sunday(0) is Saturday(6)
  const currentMinutes = localTime.hours * 60 + localTime.minutes;

  // Helper to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const parsed = parseTimeString(timeStr);
    if (!parsed) return 0;
    return parsed.hours * 60 + parsed.minutes;
  };

  // Check today's configurations (both same-day and cross-midnight starting today)
  const todayConfig = venue.qs_config_days.find(
    (config) => config.day_of_week === currentDay && config.is_active,
  );

  if (todayConfig) {
    const isActiveToday = todayConfig.qs_config_hours.some((hour) => {
      if (!hour.start_time || !hour.end_time || !hour.is_active) return false;

      const startMins = timeToMinutes(hour.start_time);
      const endDayOffset = hour.end_day_offset ?? 0;

      if (endDayOffset === 1) {
        // Cross-midnight slot starting today: active from startTime until midnight (1440)
        // e.g., 19:00 → 02:00 means active from 19:00 today until 02:00 tomorrow
        // Today portion: currentMinutes >= startMins
        return currentMinutes >= startMins;
      } else {
        // Same-day slot: current time must be within [startMins, endMins)
        const endMins = timeToMinutes(hour.end_time);
        return currentMinutes >= startMins && currentMinutes < endMins;
      }
    });

    if (isActiveToday) return true;
  }

  // Check yesterday's cross-midnight configs that spill into today
  const yesterdayConfig = venue.qs_config_days.find(
    (config) => config.day_of_week === yesterdayDay && config.is_active,
  );

  if (yesterdayConfig) {
    const isActiveFromYesterday = yesterdayConfig.qs_config_hours.some(
      (hour) => {
        if (!hour.start_time || !hour.end_time || !hour.is_active) return false;

        const endDayOffset = hour.end_day_offset ?? 0;
        if (endDayOffset !== 1) return false; // Only cross-midnight slots spill over

        // Yesterday's cross-midnight slot spilling into today:
        // Active from midnight (0) until endTime
        const endMins = timeToMinutes(hour.end_time);
        return currentMinutes < endMins;
      },
    );

    if (isActiveFromYesterday) return true;
  }

  return false;
}
function getDayName(day: number) {
  return dayNames[day];
}

function getNextAvailableQueueSkip(
  venue: VenueWithConfigs | undefined,
  localTime: VenueLocalTime,
  availableQueueSkips: number,
) {
  if (!venue) return null;
  const currentDay = localTime.dayOfWeek;
  const currentTime = { hours: localTime.hours, minutes: localTime.minutes };

  // First check if there's an active config for today
  const todayConfig = venue.qs_config_days?.find(
    (config) => config.day_of_week === currentDay && config.is_active,
  );

  if (todayConfig) {
    // Check if we're within operating hours
    const currentHourConfig = todayConfig.qs_config_hours.find((hour) => {
      if (!hour.start_time || !hour.end_time) return false;
      const startTime = parseTimeString(hour.start_time);
      const endTime = parseTimeString(hour.end_time);
      if (!startTime || !endTime) return false;
      return isTimeWithinRange(currentTime, startTime, endTime);
    });

    // If we're within operating hours and queue skips are used up
    if (currentHourConfig && availableQueueSkips === 0) {
      // Get the next 15-minute period
      const currentTotalMinutes = currentTime.hours * 60 + currentTime.minutes;
      const next15MinPeriod = Math.ceil((currentTotalMinutes + 1) / 15) * 15;
      const nextHour = Math.floor(next15MinPeriod / 60);
      const nextMinute = next15MinPeriod % 60;
      const endTime = parseTimeString(currentHourConfig.end_time);

      if (
        endTime &&
        (nextHour < endTime.hours ||
          (nextHour === endTime.hours && nextMinute <= endTime.minutes))
      ) {
        // Format the next 15-minute period as HH:MM
        const nextPeriodTime = `${nextHour.toString().padStart(2, "0")}:${nextMinute.toString().padStart(2, "0")}`;
        return {
          day: getDayName(currentDay),
          next_available_time: nextPeriodTime,
        };
      }
    }

    // If we're not in operating hours or no next period today, look for future hours today
    const futureHoursToday = todayConfig.qs_config_hours
      .filter((hour) => {
        if (!hour.start_time) return false;
        const startTime = parseTimeString(hour.start_time);
        if (!startTime) return false;
        const startTotalMinutes = startTime.hours * 60 + startTime.minutes;
        const currentTotalMinutes =
          currentTime.hours * 60 + currentTime.minutes;
        return startTotalMinutes > currentTotalMinutes;
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
        next_available_time: futureHoursToday[0]?.start_time?.slice(0, 5) ?? "",
      };
    }
  }

  // If no slots available today, look for the next consecutive day with an active config
  let daysChecked = 0;
  let nextDay = (currentDay + 1) % 7;

  while (daysChecked < 7) {
    const config = venue.qs_config_days?.find(
      (config) => config.day_of_week === nextDay && config.is_active,
    );

    if (config && config.qs_config_hours.length > 0) {
      const firstHour = config.qs_config_hours[0];
      if (firstHour?.start_time) {
        return {
          day: getDayName(nextDay),
          next_available_time: firstHour.start_time.slice(0, 5),
        };
      }
    }

    nextDay = (nextDay + 1) % 7;
    daysChecked++;
  }

  return null;
}

function getTotalQueueSkipsPer15Min(
  venue: VenueWithConfigs,
  dayOfWeek: number,
) {
  const config = venue.qs_config_days?.find(
    (config) => config.day_of_week === dayOfWeek,
  );

  if (!config) {
    return 0;
  }

  return config.slots_per_hour; // Note: This field now represents slots per 15-minute period
}
export function useAvailableQueueSkips(
  venue: VenueWithConfigs | undefined,
  externalCount?: ExternalCountState,
) {
  const resolvedTimeZone = useMemo(
    () => resolveTimeZone(venue?.time_zone ?? null),
    [venue?.time_zone],
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const venueTimeInfo = useMemo(
    () => getVenueTimeInfo(now, resolvedTimeZone),
    [now, resolvedTimeZone],
  );
  const { localTime, offsetMs } = venueTimeInfo;

  const periodStart = useMemo(() => {
    const roundedMinutes = Math.floor(localTime.minutes / 15) * 15;
    const localPeriodStartMs = Date.UTC(
      localTime.year,
      localTime.month - 1,
      localTime.day,
      localTime.hours,
      roundedMinutes,
      0,
    );

    return new Date(localPeriodStartMs + offsetMs);
  }, [localTime, offsetMs]);

  const periodEnd = useMemo(() => {
    const date = new Date(periodStart);
    return new Date(date.getTime() + 15 * 60 * 1000);
  }, [periodStart]);

  // Always make the API call, but use enabled option to control when it runs
  const {
    data: transactionCount,
    error,
    isLoading,
  } = api.transaction.getTransactionByTime.useQuery(
    {
      start_time: periodStart.toISOString(),
      end_time: periodEnd.toISOString(),
      venue_id: venue?.id ?? "",
    },
    {
      retry: false,
      staleTime: 30_000,
      enabled: !!venue?.id && !externalCount,
    },
  );

  // Purchased queue skips — now a direct count from the server
  const purchasedQueueSkips = externalCount
    ? (externalCount.count ?? 0)
    : (transactionCount?.count ?? 0);
  const effectiveIsLoading = externalCount
    ? externalCount.isLoading
    : isLoading;
  const effectiveError = externalCount ? externalCount.isError : !!error;

  // Memoize all calculations that depend on venue
  const venueCalculations = useMemo(() => {
    if (!venue) {
      return {
        periodicQueueSkips: 0,
        isWithinOperatingHours: false,
      };
    }

    // Respect the venue manager's panic-off flag before anything else
    if (!venue.queue_skip_enabled) {
      return {
        periodicQueueSkips: 0,
        isWithinOperatingHours: false,
      };
    }

    const periodicQueueSkips = getTotalQueueSkipsPer15Min(
      venue,
      localTime.dayOfWeek,
    );
    const isWithinOperatingHours = checkOperatingHours(venue, localTime);

    return {
      periodicQueueSkips,
      isWithinOperatingHours,
    };
  }, [venue, localTime]);

  // Calculate available queue skips
  const queueSkips = useMemo(() => {
    if (!venue) return 0;
    return Math.max(
      0,
      venueCalculations.periodicQueueSkips - purchasedQueueSkips,
    );
  }, [venue, venueCalculations.periodicQueueSkips, purchasedQueueSkips]);

  // Calculate next available queue skip - but be careful during loading
  const nextAvailableQueueSkip = useMemo(() => {
    if (!venue) return null;
    // Don't calculate next available if we're WITHIN operating hours AND still loading
    // This prevents showing incorrect "unavailable" messages during initial load
    // BUT if we're OUTSIDE operating hours, it's safe to show next available time
    if (isLoading && venueCalculations.isWithinOperatingHours) return null;
    return getNextAvailableQueueSkip(venue, localTime, queueSkips);
  }, [
    venue,
    localTime,
    queueSkips,
    isLoading,
    venueCalculations.isWithinOperatingHours,
  ]);

  // Early return if no venue
  if (!venue)
    return {
      queueSkips: 0,
      isOpen: false,
      isSoldOut: false,
      nextAvailableQueueSkip: null,
      isLoadingAvailability: false,
    };

  // If panic is off, venue is closed regardless of schedule
  if (!venue.queue_skip_enabled) {
    return {
      queueSkips: 0,
      isOpen: false,
      isSoldOut: false,
      nextAvailableQueueSkip: null,
      isLoadingAvailability: false,
    };
  }

  // If we're still loading, show loading state rather than false "unavailable"
  // This prevents the flash of incorrect "unavailable until..." message
  if (effectiveIsLoading) {
    return {
      queueSkips: 0,
      isOpen: venueCalculations.isWithinOperatingHours, // True if within operating hours
      isSoldOut: false,
      nextAvailableQueueSkip: null, // Don't show "next available" during loading
      isLoadingAvailability: true,
    };
  }

  // If there's an error, default to closed
  if (effectiveError) {
    return {
      queueSkips: 0,
      isOpen: false,
      isSoldOut: false,
      nextAvailableQueueSkip: null,
      isLoadingAvailability: false,
    };
  }

  // If outside operating hours, return 0 queue skips
  if (!venueCalculations.isWithinOperatingHours) {
    return {
      queueSkips: 0,
      isOpen: false,
      isSoldOut: false,
      nextAvailableQueueSkip,
      isLoadingAvailability: false,
    };
  }

  // Within operating hours — open only if slots remain
  const isSoldOut = queueSkips === 0;
  return {
    queueSkips,
    isOpen: !isSoldOut,
    isSoldOut,
    nextAvailableQueueSkip,
    isLoadingAvailability: false,
  };
}

export function useBatchQueueSkipCounts(venueIds: string[]) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // All IANA tz offsets are multiples of 15 min, so flooring UTC to a
  // 15-min boundary is identical to per-venue local-time flooring.
  const PERIOD_MS = 15 * 60 * 1000;
  const periodStart = new Date(
    Math.floor(now.getTime() / PERIOD_MS) * PERIOD_MS,
  );
  const periodEnd = new Date(periodStart.getTime() + PERIOD_MS);

  const sortedIds = useMemo(() => [...venueIds].sort(), [venueIds]);

  const { data, isLoading, isError } =
    api.transaction.getTransactionCountsByTime.useQuery(
      {
        start_time: periodStart.toISOString(),
        end_time: periodEnd.toISOString(),
        venue_ids: sortedIds,
      },
      {
        retry: false,
        staleTime: 30_000,
        enabled: sortedIds.length > 0,
      },
    );

  return { counts: data?.counts, isLoading, isError };
}
