"use client";

import { api } from "@/trpc/react";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";
import { CurrentPriceBanner } from "./_components/CurrentPriceBanner";
import { WaitTimeInput } from "./_components/WaitTimeInput";
import { RecentSignalsFeed } from "./_components/RecentSignalsFeed";

export default function LiveModePage() {
  const { data, isLoading, error, refetch } =
    api.venueManager.getLiveModeData.useQuery(undefined, {
      refetchInterval: 15000,
    });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Live Mode</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-28 rounded-xl bg-foreground/20" />
          <div className="h-48 rounded-xl bg-foreground/20" />
          <div className="h-32 rounded-xl bg-foreground/20" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Live Mode</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600">Failed to load live mode data</p>
          <p className="mt-2 text-sm text-red-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <DashboardErrorBoundary>
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Live Mode</h1>
        <CurrentPriceBanner
          price={data.currentPrice}
          enabled={data.queueSkipEnabled}
        />
        <WaitTimeInput onSuccess={() => void refetch()} />
        <RecentSignalsFeed signals={data.recentSignals} />
      </div>
    </DashboardErrorBoundary>
  );
}
