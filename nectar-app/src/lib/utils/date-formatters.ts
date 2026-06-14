/**
 * Date Formatting Utilities
 * Provides consistent date formatting for display and CSV export
 */

/**
 * Format date for display in the table
 * Example: "Feb 11, 2026 3:45 PM"
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  return d.toLocaleDateString("en-US", options);
}

/**
 * Format date for CSV export
 * Example: "2026-02-11 15:45:00"
 */
export function formatDateForCSV(date: Date | string): string {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
