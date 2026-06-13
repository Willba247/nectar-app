import Link from "next/link";
import { useAvailableQueueSkips } from "../hooks/useAvailableQSkips";
import type { ExternalCountState } from "../hooks/useAvailableQSkips";
import type { VenueWithConfigs } from "@/server/api/routers/venue";

interface VenueCardProps {
  venue: VenueWithConfigs;
  countState?: ExternalCountState;
}

export default function VenueCard({ venue, countState }: VenueCardProps) {
  // Use the actual venue ID for navigation (matches database primary key)
  const venueId = venue.id;
  const { queueSkips, isOpen, nextAvailableQueueSkip, isLoadingAvailability } =
    useAvailableQueueSkips(venue, countState);

  const showQueueSkipPrice =
    venue.price_display_mode === "queue_skip_only" ||
    venue.price_display_mode === "both" ||
    !venue.price_display_mode;
  const showEntryFee =
    venue.price_display_mode === "entry_fee_only" ||
    venue.price_display_mode === "both";

  // Button text based on availability
  const getButtonText = () => {
    if (isOpen) return "Skip The Queue";
    if (nextAvailableQueueSkip?.next_available_time) {
      const day = nextAvailableQueueSkip.day;
      const time = nextAvailableQueueSkip.next_available_time;
      return day ? `Next Available: ${day} ${time}` : `Next Available: ${time}`;
    }
    return "Currently Unavailable";
  };

  // Determine cover image URL - prefer coverImagePath from Supabase storage, fallback to image_url
  const coverUrl = venue.cover_image_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-covers/${venue.cover_image_path}`
    : venue.image_url;

  return (
    <div className="block w-full max-w-sm rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[3px]">
      <div className="overflow-hidden rounded-lg bg-gray-900 shadow-md transition-shadow hover:shadow-xl">
        {/* Cover Image */}
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={venue.name}
            className="h-48 w-full object-cover"
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-gray-800 text-gray-400">
            No cover image
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white">{venue.name}</h3>

          {venue.street_address && (
            <p className="mt-1 text-sm text-gray-400">{venue.street_address}</p>
          )}

          {venue.description && (
            <p className="mt-2 line-clamp-3 text-sm text-gray-300">
              {venue.description}
            </p>
          )}

          {isOpen && (
            <p className="mt-2 text-sm text-gray-400">
              {isLoadingAvailability
                ? "Checking availability..."
                : `${queueSkips} queue skips available`}
            </p>
          )}

          {/* Pricing */}
          <div className="mt-4 flex items-center gap-4">
            {showQueueSkipPrice && (
              <div>
                <span className="text-xs text-gray-400">Queue Skip</span>
                <p className="font-bold text-green-400">
                  ${venue.price.toFixed(2)}
                </p>
              </div>
            )}
            {showEntryFee && venue.entry_fee && (
              <div>
                <span className="text-xs text-gray-400">Entry Fee</span>
                <p className="font-bold text-white">
                  ${venue.entry_fee.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-4 w-full">
            <Link
              href={`${isOpen ? `/${venueId}` : ""}`}
              className={`block w-full rounded-md bg-[#0DD2B6] px-4 py-2 text-center font-medium text-white transition-colors ${
                isOpen ? "hover:bg-[#0BB89F]" : "cursor-not-allowed opacity-50"
              }`}
            >
              {getButtonText()}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
