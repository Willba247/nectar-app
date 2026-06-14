"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { exportToCSV } from "@/lib/utils/csv-export";
import { formatDateForCSV } from "@/lib/utils/date-formatters";

interface ExportButtonProps {
  filter: "all" | "paid";
  dateStart?: Date;
  dateEnd?: Date;
  search: string;
  venueName: string;
  canExport: boolean;
}

export function ExportButton({
  filter,
  dateStart,
  dateEnd,
  search,
  venueName,
  canExport,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Use query with enabled: false to fetch on-demand
  const exportQuery = api.venueManager.getTransactionLogsForExport.useQuery(
    {
      filter,
      dateStart,
      dateEnd,
      search,
    },
    {
      enabled: false, // Don't fetch automatically
      retry: false, // Don't retry on error
    },
  );

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);

    try {
      // Refetch with current filters (query key already updated on render)
      const { data: result } = await exportQuery.refetch();

      if (!result?.transactions.length) {
        alert("No transactions to export");
        setIsExporting(false);
        return;
      }

      const csvData = result.transactions.map(
        (t: (typeof result.transactions)[number]) => ({
          "Created At": formatDateForCSV(t.createdAt),
          "Customer Name": t.customerName ?? "N/A",
          "Customer Email": t.customerEmail ?? "N/A",
          Amount: `$${((t.amountTotal ?? 0) / 100).toFixed(2)}`,
          Status: t.paymentStatus,
          "Session ID": t.sessionId,
        }),
      );

      const filename = `${venueName.replace(/\s+/g, "-")}-transactions-${new Date().toISOString().split("T")[0]}.csv`;
      exportToCSV(csvData, filename);

      // Show success message
      alert(`Export complete. Downloaded ${result.total} rows.`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={!canExport || isExporting}
      className="whitespace-nowrap"
    >
      {isExporting ? "Exporting..." : "Export to CSV"}
    </Button>
  );
}
