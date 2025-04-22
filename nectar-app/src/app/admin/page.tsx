'use client'

import QueueSkipAdmin from "./Admin";
import { api } from "@/trpc/react";

export default function page() {
    const { data: venues, isLoading } = api.venue.getAllVenues.useQuery();

    if (isLoading) {
        return <div className="text-white">Loading...</div>;
    }

    if (!venues) {
        return <div className="text-white">No venues found</div>;
    }

    return (
        <div>
            <QueueSkipAdmin venues={venues} />
        </div>
    )
}

