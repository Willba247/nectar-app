import Link from 'next/link';
import { createVenueSlug } from '@/data/venues';
import InfoLines from './info-lines';
import { useAvailableQueueSkips } from '../hooks/getAvailableQSkips';
import type { VenueWithConfigs } from '@/server/api/routers/venue';

interface VenueCardProps {
    venue: VenueWithConfigs;
}

export default function VenueCard({ venue }: VenueCardProps) {
    // Create URL-friendly venue name
    const venueSlug = createVenueSlug(venue.name);
    const queueSkips = useAvailableQueueSkips(venue);
    const isOpen = queueSkips > 0;

    return (
        <div className="block w-full max-w-sm p-[4px] rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6]">
            <div className="relative w-full rounded-lg overflow-hidden bg-black/90 hover:shadow-xl transition-shadow opacity-90">
                {/* Image container with fixed aspect ratio */}
                <div className="relative h-48 w-full">
                    <img
                        src={venue.image_url}
                        alt={venue.name}
                        className="absolute w-full h-full object-cover"
                    />
                </div>

                {/* Content container */}
                <div className="p-4">
                    <h2 className="text-xl font-bold mb-2 text-white">{venue.name}</h2>

                    {/* Info lines */}
                    <InfoLines queueSkips={queueSkips} price={venue.price} isOpen={isOpen} />

                    {/* Full-width Link */}
                    <div className="w-full">
                        <Link
                            href={`${isOpen ? `/${venueSlug}` : ''}`}
                            className={`block w-full bg-[#0DD2B6] text-white py-2 px-4 rounded-md transition-colors text-center ${isOpen ? 'hover:bg-[#0DD2B6]/80' : 'opacity-50 cursor-not-allowed'
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