"use client";

import { api } from "@/trpc/react";
import { ProfileForm } from "./_components/ProfileForm";
import { VenuePreview } from "./_components/VenuePreview";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { DashboardErrorBoundary } from "../_components/DashboardErrorBoundary";

const ImageUpload = dynamic(
  () => import("./_components/ImageUpload").then((mod) => mod.ImageUpload),
  { ssr: false },
);

export default function VenueCardPage() {
  const {
    data: profile,
    isLoading,
    refetch,
  } = api.venueManager.getVenueProfile.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return <div className="text-red-500">Failed to load venue profile</div>;
  }

  return (
    <DashboardErrorBoundary>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Venue Profile</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Forms */}
          <div className="space-y-6">
            <ProfileForm profile={profile} onSave={refetch} />
            <ImageUpload
              uploadPrefix={profile.uploadPrefix}
              currentPath={profile.coverImagePath}
              onUploadComplete={refetch}
            />
          </div>

          {/* Right: Preview */}
          <div>
            <VenuePreview profile={profile} />
          </div>
        </div>
      </div>
    </DashboardErrorBoundary>
  );
}
