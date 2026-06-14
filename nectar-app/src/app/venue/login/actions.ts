"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function venueLoginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email");
  const password = formData.get("password");

  // Validate inputs
  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Invalid input format" };
  }

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Server configuration error. Please try again later." };
  }

  // Create SSR-aware Supabase client
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
        } catch (error) {
          console.error("Error setting cookies:", error);
        }
      },
    },
  });

  // Sign in with Supabase Auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  // Successful login — redirect to dashboard
  redirect("/venue/dashboard");
}
