/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Skip bundling heavy server-only packages — use native require() instead.
  // Reduces server compile/bundle time in dev (does NOT affect TS type-check).
  serverExternalPackages: ["stripe", "resend", "postgres"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hktqsyuhyubbhilohpdp.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default config;
