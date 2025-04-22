'use client'
import VenueCard from "./_components/venue-card";
import { useState } from 'react';
import { api } from "@/trpc/react";

function VenueCardSkeleton() {
  return (
    <div className="block w-full max-w-sm p-[4px] rounded-lg bg-gradient-to-br from-[#FF69B4] via-[#4169E1] to-[#0DD2B6]">
      <div className="relative w-full rounded-lg overflow-hidden bg-black/90">
        <div className="relative h-48 w-full bg-gray-700 animate-pulse" />
        <div className="p-4">
          <div className="h-6 w-3/4 bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="space-y-1 mb-4">
            <div className="h-4 w-1/2 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="w-full">
            <div className="h-10 w-full bg-gray-700 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: venues, isLoading } = api.venue.getAllVenues.useQuery();


  return (
    <main className="flex min-h-screen flex-col items-center  bg-black">
      <div className="flex flex-col gap-4 w-full px-4 items-center">
        <div className="w-full max-w-md mb-6">
          <input
            type="text"
            placeholder="Search venues..."
            className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-[#0DD2B6]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-4 w-full items-center">
            {[...Array(3)].map((_, index) => (
              <VenueCardSkeleton key={index} />
            ))}
          </div>
        ) : venues && venues.length > 0 ? (
          venues.map((venue) => {
            return (
              <VenueCard
                key={venue.id}
                venue={venue}
              />
            );
          })
        ) : (
          <div className="text-white text-2xl">No venues found</div>
        )}
      </div>
    </main>
  );
}
