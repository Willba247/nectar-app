"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: async () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");

            // Inject admin password header if available (admin pages only)
            if (typeof window !== "undefined") {
              const adminPw = localStorage.getItem("adminPassword");
              if (adminPw) {
                headers.set("x-admin-password", adminPw);
              }
            }

            try {
              const supabase = getSupabaseBrowserClient();
              const { data: sessionData } = await supabase.auth.getSession();
              let accessToken = sessionData.session?.access_token;

              // DEV DIAGNOSTIC: Log session state
              if (process.env.NODE_ENV === "development") {
                console.log(
                  "[tRPC Auth] Session exists:",
                  !!sessionData.session,
                  "| Token exists:",
                  !!accessToken,
                );
              }

              // If getSession() returned null but we expect to be logged in,
              // try getUser() as a fallback diagnostic (dev only)
              if (!accessToken && process.env.NODE_ENV === "development") {
                const { data: userData, error: userError } =
                  await supabase.auth.getUser();
                if (userData?.user && !userError) {
                  console.warn(
                    "[tRPC Auth] DESYNC: getUser() has user but getSession() is null.",
                    "User ID:",
                    userData.user.id,
                  );
                }
              }

              if (accessToken) {
                headers.set("authorization", `Bearer ${accessToken}`);
              }
              // Note: If no session/token, server will fallback to cookie-based auth
            } catch (e) {
              // Ignore - server will fallback to cookie-based auth
              if (process.env.NODE_ENV === "development") {
                console.error("[tRPC Auth] Exception:", e);
              }
            }

            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
