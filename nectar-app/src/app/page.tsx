'use client'
import { Button } from "@/components/ui/button";
import VenueCard from "./_components/venue-card";
import { venues } from "@/data/venues";
import { useState } from 'react';
import { api } from "@/trpc/react";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const sendEmail = api.email.sendEmail.useMutation();
  const filteredVenues = venues.filter(venue =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex min-h-screen flex-col items-center  bg-black">
      <Button onClick={() => {
        sendEmail.mutate({ email: "michael@extensa.studio" });
      }}>
        Send Email
      </Button>
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
        {filteredVenues.length > 0 ? filteredVenues.map((venue) => (
          <VenueCard
            key={venue.id}
            name={venue.name}
            queueSkips={venue.queueSkips}
            price={venue.price}
            imageUrl={venue.imageUrl}
          />
        )) : (
          <div className="text-white text-2xl">No venues found</div>
        )}
      </div>
    </main>
  );
}
