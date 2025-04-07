import { HydrateClient } from "@/trpc/server";
import VenueCard from "./_components/venue-card";
import { venues } from "@/data/venues";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-black">
        <div className="flex flex-col gap-4 w-full px-4 items-center">
          <div className="w-full max-w-md mb-6">
            <input
              type="text"
              placeholder="Search venues..."
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-[#0DD2B6]"
            />
          </div>
          {venues.map((venue) => (
            <VenueCard
              key={venue.id}
              name={venue.name}
              queueSkips={venue.queueSkips}
              price={venue.price}
              imageUrl={venue.imageUrl}
            />
          ))}
        </div>
      </main>
    </HydrateClient>
  );
}
