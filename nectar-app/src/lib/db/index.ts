import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type PostgresClient = ReturnType<typeof postgres>;
type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  postgresClient?: PostgresClient;
  drizzleClient?: DrizzleClient;
};

// Lazy initialization function - only throws error when actually used
function getDbClient(): DrizzleClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForDb.postgresClient) {
    const client = postgres(connectionString, {
      max: 10, // CRITICAL: Increased from 1 to support concurrent requests
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Fail fast if can't connect within 10 seconds
      prepare: false, // Required for PgBouncer transaction mode (Supabase pooler).
    });

    if (process.env.NODE_ENV !== "production") {
      globalForDb.postgresClient = client;
    }

    globalForDb.drizzleClient = drizzle(client, { schema });
  }

  return globalForDb.drizzleClient!;
}

// Create a proxy that lazily initializes the client
export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop: string | symbol): unknown {
    const client = getDbClient();
    return Reflect.get(client, prop) as unknown;
  },
});
