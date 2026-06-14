'use client'
import VenueCard from "./_components/venue-card";
import { useState, useMemo, useRef, useEffect } from 'react';
import gsap from "gsap";
import { api } from "@/trpc/react";
import { useBatchQueueSkipCounts } from "./hooks/useAvailableQSkips";
import GridBackdrop from "./venue/_components/GridBackdrop";
import { useMotionSafe } from "./venue/_components/useMotionSafe";

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

  const venueIds = useMemo(() => (venues ?? []).map((v) => v.id), [venues]);
  const { counts, isLoading: countsLoading, isError: countsError } =
    useBatchQueueSkipCounts(venueIds);

  // Filter venues based on search query
  const filteredVenues = useMemo(() => {
    if (!venues) return [];

    const query = searchQuery.toLowerCase().trim();
    if (!query) return venues;

    return venues.filter((venue) =>
      venue.name.toLowerCase().includes(query)
    );
  }, [venues, searchQuery]);

  // Show "No venues found" when search yields no results, or when there are no venues at all
  const hasNoResults = !isLoading && venues && venues.length > 0 && filteredVenues.length === 0;
  const hasNoVenues = !isLoading && venues && venues.length === 0;

  const gridRef = useRef<HTMLDivElement>(null);
  const { allowMotion } = useMotionSafe();

  useEffect(() => {
    if (!allowMotion || isLoading || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".venue-card-anim", {
        y: 26,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
      });
    }, gridRef);
    return () => ctx.revert();
  }, [allowMotion, isLoading, filteredVenues.length]);

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#05030c]">
      <GridBackdrop intensity="ambient" />
      <div className="relative z-10 flex flex-col gap-4 w-full px-4 items-center pt-2">
        <div className="w-full max-w-md mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search venues..."
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-white/40 focus:border-[#0DD2B6] focus:outline-none focus:ring-2 focus:ring-[#0DD2B6]/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {isLoading ? (
          <div className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <VenueCardSkeleton key={index} />
            ))}
          </div>
        ) : filteredVenues.length > 0 ? (
          <div
            ref={gridRef}
            className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredVenues.map((venue) => {
              return (
                <div key={venue.id} className="venue-card-anim flex justify-center">
                  <VenueCard
                    venue={venue}
                    countState={{
                      count: counts?.[venue.id],
                      isLoading: countsLoading,
                      isError: countsError,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : hasNoResults ? (
          <div className="text-white text-2xl">No venues match your search</div>
        ) : hasNoVenues ? (
          <div className="text-white text-2xl">No venues found</div>
        ) : null}
      </div>
    </main>
  );
}
