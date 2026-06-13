/**
 * CSV Export Utility
 * Converts JSON array to CSV string and triggers browser download
 */

export function exportToCSV(
  data: Record<string, string | number | null | undefined>[],
  filename: string,
): void {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  const firstRow = data[0];
  if (!firstRow) {
    throw new Error("No data to export");
  }

  // Get headers from first object
  const headers = Object.keys(firstRow);

  // Build CSV content
  const csvContent = [
    // Header row
    headers.map(escapeCSVField).join(","),
    // Data rows
    ...data.map((row) =>
      headers.map((header) => escapeCSVField(row[header])).join(","),
    ),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Escape CSV field values (handle quotes, commas, newlines)
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
