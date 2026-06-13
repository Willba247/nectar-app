"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ModeToggleBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const utils = api.useUtils();

  // Match /venue/... (dashboard, login, signup) but NOT /venue-xyz patron pages
  const isVenueSide =
    pathname === "/venue" || pathname.startsWith("/venue/");

  useEffect(() => {
    setMounted(true);
    const supabase = getSupabaseBrowserClient();

    // Case 1: singleton already initialised — getSession() resolves immediately
    // with the session. Invalidate now so whoami gets a second attempt with a
    // real token (the first mount attempt may have fired before the client
    // recovered the session from cookies).
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void utils.venueManager.whoami.invalidate();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" && session) {
        // Case 2: client just finished recovering session from cookies.
        // Invalidate so whoami refetches now that getSession() will work.
        void utils.venueManager.whoami.invalidate();
      }
      if (event === "SIGNED_OUT") {
        utils.venueManager.whoami.setData(undefined, undefined);
      }
      if (event === "SIGNED_IN") {
        void utils.venueManager.whoami.invalidate();
      }
    });
    return () => subscription.unsubscribe();
  }, [utils]);

  // Fire immediately on mount. retry: false means an unauthenticated call
  // fails silently — status stays "error" and the banner stays hidden.
  const { data: managerData, status, refetch: refetchWhoami } =
    api.venueManager.whoami.useQuery(undefined, {
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
    });

  const venueName =
    mounted && status === "success" ? managerData?.venue?.name : undefined;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex rounded-full bg-white/10 p-1">
        <button
          onClick={() => {
            if (isVenueSide) {
              void refetchWhoami();
              router.replace("/");
            }
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            !isVenueSide
              ? "bg-[#0DD2B6] text-black"
              : "text-white/70 hover:text-white"
          }`}
        >
          Skip The Line
        </button>
        <button
          onClick={() => {
            if (!isVenueSide) router.replace("/venue/dashboard");
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            isVenueSide
              ? "bg-[#FF69B4] text-black"
              : "text-white/70 hover:text-white"
          }`}
        >
          For Venues
        </button>
      </div>
      {venueName && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]" />
          <span className="text-xs text-gray-300">
            Logged in as manager of {venueName}
          </span>
        </div>
      )}
    </div>
  );
}
