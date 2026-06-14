"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { venues, venueManagers } from "@/lib/db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateVenueId(name: string): string {
  const slug = slugify(name);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

export type SignupState = {
  error?: string;
  message?: string;
};

export async function venueSignupAction(
  _prevState: SignupState | undefined,
  formData: FormData,
): Promise<SignupState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const venueName = formData.get("venueName");
  const streetAddress = formData.get("streetAddress");

  // Validate inputs
  if (!email || !password || !venueName || !streetAddress) {
    return { error: "All fields are required" };
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof venueName !== "string" ||
    typeof streetAddress !== "string"
  ) {
    return { error: "Invalid input format" };
  }

  const trimmedName = venueName.trim().slice(0, 100);
  const trimmedAddress = streetAddress.trim().slice(0, 255);
  const trimmedEmail = email.trim();

  if (trimmedName.length === 0) {
    return { error: "Venue name is required" };
  }
  if (trimmedAddress.length === 0) {
    return { error: "Street address is required" };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
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
        } catch {
          // Cookie setting can fail in some contexts
        }
      },
    },
  });

  // 1. Create Supabase auth user
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/venue/login`,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Failed to create account. Please try again." };
  }

  // 2. Generate venue ID and insert venue + venue_manager in a transaction
  let venueId = generateVenueId(trimmedName);

  const insertVenueAndManager = async (id: string) => {
    await db.transaction(async (tx) => {
      await tx.insert(venues).values({
        id,
        name: trimmedName,
        streetAddress: trimmedAddress,
        price: "0",
        imageUrl: "",
        timeZone: "UTC",
      });

      await tx.insert(venueManagers).values({
        userId,
        venueId: id,
        email: trimmedEmail,
        isActive: true,
      });
    });
  };

  try {
    await insertVenueAndManager(venueId);
  } catch (firstError: unknown) {
    // Check for duplicate key — retry once with a new ID
    const isDuplicate =
      firstError instanceof Error &&
      firstError.message.includes("duplicate key");

    if (isDuplicate) {
      venueId = generateVenueId(trimmedName);
      try {
        await insertVenueAndManager(venueId);
      } catch {
        return {
          error: "Failed to create venue. Please try again.",
        };
      }
    } else {
      return {
        error: "Failed to create venue. Please try again.",
      };
    }
  }

  // 3. Check session — redirect or prompt email confirmation
  if (authData.session) {
    redirect("/venue/dashboard");
  }

  return {
    message: "Check your email to confirm your account.",
  };
}
