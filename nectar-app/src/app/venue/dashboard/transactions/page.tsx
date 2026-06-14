"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { useDocumentVisibility } from "@/app/hooks/useDocumentVisibility";
import { useAdaptivePolling } from "@/app/hooks/useAdaptivePolling";
import { TransactionTable } from "./_components/TransactionTable";
import { TransactionFilters } from "./_components/TransactionFilters";
import { Pagination } from "./_components/Pagination";
import { ExportButton } from "./_components/ExportButton";
import { GrossSalesBox } from "./_components/GrossSalesBox";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";
import { PayoutSettingsPanel } from "./_components/PayoutSettingsPanel";

export default function TransactionsPage() {
  // State Management
  const [filters, setFilters] = useState({
    filter: "all" as "all" | "paid",
    dateStart: undefined as Date | undefined,
    dateEnd: undefined as Date | undefined,
    search: "",
    page: 0,
    limit: 25 as 25 | 50 | 100,
  });

  // Monitor document visibility for polling
  const isVisible = useDocumentVisibility();

  // Adaptive polling - backs off when data doesn't change
  const {
    interval: pollInterval,
    trackDataChange,
    reset: resetPolling,
  } = useAdaptivePolling({
    baseInterval: 5000,
    maxInterval: 20000,
    idleThreshold: 120000, // 2 minutes
    backoffMultiplier: 2,
  });

  // Reset polling interval when filters change
  useEffect(() => {
    resetPolling();
  }, [
    filters.filter,
    filters.dateStart,
    filters.dateEnd,
    filters.search,
    resetPolling,
  ]);

  // Fetch transaction logs with adaptive polling
  const { data, isLoading, error } =
    api.venueManager.getTransactionLogs.useQuery(
      {
        filter: filters.filter,
        dateStart: filters.dateStart,
        dateEnd: filters.dateEnd,
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
      },
      {
        refetchInterval: isVisible ? pollInterval : false, // Adaptive polling when tab visible
        refetchOnWindowFocus: true,
        staleTime: 4000, // Consider data stale after 4s
      },
    );

  // Track data changes for adaptive polling
  useEffect(() => {
    if (data?.total !== undefined) {
      trackDataChange(data.total);
    }
  }, [data?.total, trackDataChange]);

  // Filter change handler
  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => {
      // Reset to page 0 if any filter changes (except pagination changes)
      const hasFilterChange =
        newFilters.filter !== undefined ||
        newFilters.dateStart !== undefined ||
        newFilters.dateEnd !== undefined ||
        newFilters.search !== undefined ||
        newFilters.limit !== undefined;

      return {
        ...prev,
        ...newFilters,
        page: hasFilterChange ? 0 : prev.page,
      };
    });
  };

  // Clear filters handler
  const handleClearFilters = () => {
    setFilters({
      filter: "all",
      dateStart: undefined,
      dateEnd: undefined,
      search: "",
      page: 0,
      limit: 25,
    });
  };

  // Pagination handler
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;

  // Get venue name for export (from whoami or default)
  const venueName = "Venue"; // TODO: Get from auth context/whoami if available

  return (
    <DashboardErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <ExportButton
            filter={filters.filter}
            dateStart={filters.dateStart}
            dateEnd={filters.dateEnd}
            search={filters.search}
            venueName={venueName}
            canExport={total > 0}
          />
        </div>

        <TransactionFilters
          filter={filters.filter}
          dateStart={filters.dateStart}
          dateEnd={filters.dateEnd}
          search={filters.search}
          limit={filters.limit}
          onFilterChange={handleFiltersChange}
          onClear={handleClearFilters}
        />

        <GrossSalesBox
          grossSales={data?.grossSales ?? 0}
          isLoading={isLoading}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Error loading transactions</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}

        <TransactionTable transactions={transactions} isLoading={isLoading} />

        <Pagination
          page={filters.page}
          limit={filters.limit}
          total={total}
          onPageChange={handlePageChange}
        />

        <PayoutSettingsPanel />
      </div>
    </DashboardErrorBoundary>
  );
}
