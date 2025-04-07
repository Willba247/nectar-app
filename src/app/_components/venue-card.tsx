import Link from 'next/link';
import { createVenueSlug } from '@/data/venues';

interface VenueCardProps {
    name: string;
    queueSkips: number;
    price: number;
    imageUrl: string;
}

export default function VenueCard({ name, queueSkips, price, imageUrl }: VenueCardProps) {
    // Create URL-friendly venue name
    const venueSlug = createVenueSlug(name);

    return (
        <Link href={`/${venueSlug}`} className="block w-full max-w-sm">
            <div className="relative w-full rounded-lg overflow-hidden shadow-lg bg-white hover:shadow-xl transition-shadow">
                {/* Image container with fixed aspect ratio */}
                <div className="relative h-48 w-full">
                    <img
                        src={imageUrl}
                        alt={name}
                        className="absolute w-full h-full object-cover"
                    />
                </div>

                {/* Content container */}
                <div className="p-4">
                    <h2 className="text-xl font-bold mb-2 text-black">{name}</h2>

                    {/* Info lines */}
                    <div className="space-y-1 mb-4">
                        <p className="text-sm text-gray-600">
                            Queue skips available: {queueSkips}
                        </p>
                        <p className="text-sm text-gray-600">
                            Price: ${price.toFixed(2)}
                        </p>
                    </div>

                    {/* Button */}
                    <button className="w-full bg-[#0DD2B6] text-white py-2 px-4 rounded-md hover:bg-[#0DD2B6]/80 transition-colors">
                        Skip The Queue
                    </button>
                </div>
            </div>
        </Link>
    );
}
