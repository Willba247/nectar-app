"use client";

import { api } from "@/trpc/react";
import { PriceEditor } from "./_components/PriceEditor";
import { PanicOffButton } from "./_components/PanicOffButton";
import { DayTimeConfig } from "./_components/DayTimeConfig";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";

export default function QueueSkipPage() {
  const { data, isLoading, error } =
    api.venueManager.getQueueSkipConfig.useQuery(undefined, {
      refetchInterval: 10000, // 10s polling
      refetchOnWindowFocus: true,
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Queue Skip Settings</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-lg bg-gray-200" />
          <div className="h-64 rounded-lg bg-gray-200" />
          <div className="h-24 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Queue Skip Settings</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600">Failed to load configuration</p>
          <p className="mt-2 text-sm text-red-500">{error.message}</p>
        </div>
      </div>
    );
  }

  // Type guard: data is guaranteed to be defined after loading/error checks
  if (!data) {
    return null;
  }

  return (
    <DashboardErrorBoundary>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Queue Skip Settings</h1>

        {/* Panic status banner */}
        {!data.queueSkipEnabled && (
          <div className="rounded-lg border border-red-300 bg-red-100 p-4">
            <p className="font-medium text-red-800">
              ⚠️ Queue skip purchases are currently DISABLED
            </p>
            <p className="text-sm text-red-600">
              New customers cannot purchase queue skips. Enable below to resume
              sales.
            </p>
          </div>
        )}

        {/* Price editor section */}
        <section>
          <PriceEditor currentPrice={data.price} />
        </section>

        {/* Day/time configuration */}
        <section>
          <DayTimeConfig days={data.days} />
        </section>

        {/* Panic off button (always visible, bottom of page) */}
        <section className="border-t pt-6">
          <PanicOffButton enabled={data.queueSkipEnabled} />
        </section>
      </div>
    </DashboardErrorBoundary>
  );
}
