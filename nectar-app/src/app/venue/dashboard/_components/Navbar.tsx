"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

interface NavbarProps {
  venueName: string;
}

export function Navbar({ venueName }: NavbarProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/venue/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Venue Manager Dashboard</h1>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-medium text-foreground">{venueName}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Dark mode pill toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm" aria-hidden>☀️</span>
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                theme === "dark" ? "bg-[#0DD2B6]" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  theme === "dark" ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
            <span className="text-sm" aria-hidden>🌙</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
