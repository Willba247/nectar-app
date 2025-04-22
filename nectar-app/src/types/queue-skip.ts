export type Venue = {
  id: string;
  name: string;
  time_zone: string;
  queueSkipConfig: QSConfigDay[];
};

export type QSConfigDay = {
  id: number;
  venue_id: string;
  day_of_week: number;
  is_active: boolean;
  slots_per_hour: number;
  created_at?: string;
  updated_at?: string;
};

export type TimeSlotEntry = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slots_per_hour: number;
  id?: number;
};

export const DEFAULT_TIME_SLOT: TimeSlotEntry = {
  day_of_week: 0,
  start_time: "17:00",
  end_time: "23:00",
  slots_per_hour: 10,
};

export const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
