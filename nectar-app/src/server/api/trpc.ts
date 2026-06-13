/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { TRPCError, initTRPC } from "@trpc/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import superjson from "superjson";
import { ZodError } from "zod";

export type VenueAuthContext = {
  userId: string;
  email: string;
  venueId: string;
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    ...opts,
    authHeader: opts.headers.get("authorization") ?? "",
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Extract access_token from Supabase auth cookie (sb-*-auth-token)
 * Cookie value format: "base64-<base64-encoded-json>"
 * JSON contains: { access_token, refresh_token, ... }
 * Returns null if cookie not found or parsing fails
 */
function extractAccessTokenFromCookie(cookieHeader: string): string | null {
  try {
    // Find the Supabase auth cookie (sb-<project>-auth-token=...)
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const authCookie = cookies.find(
      (c) => c.includes("sb-") && c.includes("-auth-token="),
    );

    if (!authCookie) {
      return null;
    }

    // Extract the value after the "="
    const eqIndex = authCookie.indexOf("=");
    if (eqIndex === -1) {
      return null;
    }

    let cookieValue = authCookie.substring(eqIndex + 1);

    // URL decode the value (cookies may be URL-encoded)
    cookieValue = decodeURIComponent(cookieValue);

    // Strip the "base64-" prefix if present
    if (cookieValue.startsWith("base64-")) {
      cookieValue = cookieValue.substring(7);
    }

    // Decode base64 to JSON string
    const jsonString = Buffer.from(cookieValue, "base64").toString("utf-8");

    // Parse JSON and extract access_token
    const parsed = JSON.parse(jsonString) as { access_token?: string };

    return parsed.access_token ?? null;
  } catch {
    // Any parsing error = return null (defensive)
    return null;
  }
}

function getSupabaseRlsClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for RLS client");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Admin procedure — validates admin password server-side on every request.
 * Password is sent via the x-admin-password header from the admin frontend.
 */
export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    const adminPassword = ctx.headers.get("x-admin-password");

    if (!adminPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Admin password required",
      });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword || adminPassword !== expectedPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid admin password",
      });
    }

    return next({ ctx });
  });

// DEV: Track cookie fallback usage (should be ~0 during normal operation)
let _cookieFallbackCount = 0;
let _headerAuthCount = 0;

export const venueManagerProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    const authHeader = ctx.authHeader ?? "";
    const cookieHeader = ctx.headers.get("cookie") ?? "";

    // Try Authorization header first (Bearer token) - preferred path
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    let accessToken = tokenMatch?.[1] ?? null;
    let tokenSource: "header" | "cookie" | "none" = "none";

    if (accessToken) {
      tokenSource = "header";
      _headerAuthCount++;
    } else {
      // Fallback: extract from Supabase auth cookie if no Authorization header
      // This is a backstop - normal operation should use header auth
      accessToken = extractAccessTokenFromCookie(cookieHeader);
      if (accessToken) {
        tokenSource = "cookie";
        _cookieFallbackCount++;
      }
    }

    // Dev-only logging with fallback tracking
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[AUTH] Token source: ${tokenSource} | Stats: header=${_headerAuthCount}, cookie=${_cookieFallbackCount}`,
      );
    }

    if (!accessToken) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Supabase env vars not configured",
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } =
      await supabaseAuth.auth.getUser(accessToken);

    if (userError || !userData.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const supabaseRls = getSupabaseRlsClient(accessToken);
    const { data: manager, error: managerError } = await supabaseRls
      .from("venue_managers")
      .select("venue_id, user_id, email, is_active")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (managerError || !manager || manager.is_active === false) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const venue: VenueAuthContext = {
      userId: userData.user.id,
      email: manager.email ?? userData.user.email ?? "",
      venueId: manager.venue_id,
    };

    return next({
      ctx: {
        ...ctx,
        venue,
        supabaseRls,
      },
    });
  });
