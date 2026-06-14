"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VenuePreviewProps {
  profile: {
    name: string;
    description: string | null;
    streetAddress: string | null;
    coverImagePath: string | null;
    imageUrl: string | null;
    price: string;
    entryFee: string | null;
    priceDisplayMode: string | null;
  };
}

export function VenuePreview({ profile }: VenuePreviewProps) {
  const coverUrl = profile.coverImagePath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-covers/${profile.coverImagePath}`
    : profile.imageUrl;

  const showQueueSkipPrice =
    profile.priceDisplayMode === "queue_skip_only" ||
    profile.priceDisplayMode === "both";
  const showEntryFee =
    profile.priceDisplayMode === "entry_fee_only" ||
    profile.priceDisplayMode === "both";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
          <div className="overflow-hidden rounded-lg bg-gray-900 shadow-md">
            {/* Cover Image */}
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={profile.name}
                className="h-48 w-full object-cover"
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-gray-800 text-gray-400">
                No cover image
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white">
                {profile.name}
              </h3>

              {profile.streetAddress && (
                <p className="mt-1 text-xs text-gray-400">
                  {profile.streetAddress}
                </p>
              )}

              {profile.description && (
                <p className="mt-2 line-clamp-3 text-sm text-gray-300">
                  {profile.description}
                </p>
              )}

              {/* Pricing */}
              <div className="mt-4 flex items-center gap-4">
                {showQueueSkipPrice && (
                  <div>
                    <span className="text-xs text-gray-400">Queue Skip</span>
                    <p className="font-bold text-green-400">${profile.price}</p>
                  </div>
                )}
                {showEntryFee && profile.entryFee && (
                  <div>
                    <span className="text-xs text-gray-400">Entry Fee</span>
                    <p className="font-bold text-white">${profile.entryFee}</p>
                  </div>
                )}
              </div>

              {/* Preview Button */}
              <div className="mt-4 w-full">
                <div className="block w-full rounded-md bg-[#0DD2B6] px-4 py-2 text-center font-medium text-white">
                  Skip The Queue
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          This is how patrons will see your venue card
        </p>
      </CardContent>
    </Card>
  );
}
