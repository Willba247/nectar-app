import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabaseClient: SupabaseClient | null = null;

/**
 * Get the singleton Supabase browser client.
 * Uses @supabase/ssr createBrowserClient for Next.js App Router compatibility.
 * This reads/writes from the sb-*-auth-token cookie, ensuring getSession() works.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables for browser client",
    );
  }

  // createBrowserClient from @supabase/ssr automatically:
  // - Reads session from cookies (sb-*-auth-token)
  // - Persists session updates back to cookies
  // - Auto-refreshes tokens
  _supabaseClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey);

  return _supabaseClient;
}
