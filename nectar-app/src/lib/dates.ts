export function nightlyWindow(dateISO: string, tz = "Australia/Melbourne") {
  // 6 PM of date → 3 AM next day (local time)
  const d = new Date(dateISO + "T00:00:00");
  const start = new Date(d);
  start.setHours(18, 0, 0, 0); // 6PM
  const end = new Date(d);
  end.setDate(end.getDate() + 1);
  end.setHours(3, 0, 0, 0); // 3AM next day
  return { start, end };
}
