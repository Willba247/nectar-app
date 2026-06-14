import { createServerClient } from "@supabase/ssr";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Navbar, Sidebar, ThemeProvider } from "./_components";

export const dynamic = "force-dynamic";

export default async function VenueDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get Supabase environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Create SSR-aware Supabase client (properly reads/manages session cookies)
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore errors if cookies can't be set in middleware context
        }
      },
    },
  });

  // Validate session (Supabase SSR will read from properly-named cookies)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/venue/login");
  }

  // Query venue_managers table (RLS-enforced)
  const { data: manager, error: managerError } = await supabase
    .from("venue_managers")
    .select("venue_id, email, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  // Handle user not in venue_managers or deactivated
  if (managerError) {
    console.error("Error querying venue_managers:", managerError);
    throw new Error("System error. Please try again later.");
  }

  if (!manager) {
    notFound();
  }

  if (manager.is_active === false) {
    redirect("/venue/login");
  }

  // Query venues table for name (RLS-enforced)
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("name")
    .eq("id", manager.venue_id)
    .maybeSingle();

  if (venueError) {
    console.error("Error querying venues:", venueError);
    throw new Error("System error. Please try again later.");
  }

  if (!venue) {
    throw new Error("System error. Please try again later.");
  }

  const venueName = venue.name ?? "Venue Manager";

  return (
    <ThemeProvider>
      <div className="flex h-screen flex-col">
        <Navbar venueName={venueName} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
