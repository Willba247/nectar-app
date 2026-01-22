import Link from "next/link";
import { createVenueSlug } from "@/data/venues";
import InfoLines from "./info-lines";
import { useAvailableQueueSkips } from "../hooks/useAvailableQSkips";
import type { VenueWithConfigs } from "@/server/api/routers/venue";

interface VenueCardProps {
  venue: VenueWithConfigs;
}

export default function VenueCard({ venue }: VenueCardProps) {
  // Create URL-friendly venue name
  const venueSlug = createVenueSlug(venue.name);
  const { queueSkips, isOpen, nextAvailableQueueSkip, isLoadingAvailability } =
    useAvailableQueueSkips(venue);

  return (
    <div className="block w-full max-w-sm rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6] p-[4px]">
      <div className="relative w-full overflow-hidden rounded-lg bg-black/90 opacity-90 transition-shadow hover:shadow-xl">
        {/* Image container with fixed aspect ratio */}
        <div className="relative h-48 w-full">
          <img
            src={venue.image_url}
            alt={venue.name}
            className="absolute h-full w-full object-cover"
          />
        </div>

        {/* Content container */}
        <div className="p-4">
          <h2 className="mb-2 text-xl font-bold text-white">{venue.name}</h2>

          {/* Info lines */}
          <InfoLines
            queueSkips={queueSkips}
            price={venue.price}
            isOpen={isOpen}
            nextAvailableQueueSkip={nextAvailableQueueSkip}
          />

          {/* Full-width Link */}
          <div className="w-full">
            <Link
              href={`${isOpen ? `/${venueSlug}` : ""}`}
              className={`block w-full rounded-md bg-[#0DD2B6] px-4 py-2 text-center text-white transition-colors ${
                isOpen
                  ? "hover:bg-[#0DD2B6]/80"
                  : "cursor-not-allowed opacity-50"
              }`}
            >
              Skip The Queue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
