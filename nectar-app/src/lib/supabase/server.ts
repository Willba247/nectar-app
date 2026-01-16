import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy initialization function - only throws error when actually used
function getSupabaseClient(): SupabaseClient {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("Missing required Supabase environment variables server");
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY:",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    throw new Error("Missing Supabase environment variables");
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

// Create a proxy that lazily initializes the client
let _supabaseClient: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol): unknown {
    _supabaseClient ??= getSupabaseClient();
    return Reflect.get(_supabaseClient, prop) as unknown;
  },
});
