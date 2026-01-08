import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString);

async function markBaselineMigration() {
  console.log("🔧 Setting up Drizzle migration tracking...\n");

  // Create the __drizzle_migrations table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  console.log("✅ Created __drizzle_migrations table");

  // Check if we already have migrations recorded
  const existingMigrations = await sql`
    SELECT * FROM __drizzle_migrations
  `;

  if (existingMigrations.length > 0) {
    console.log("⚠️  Migrations already exist:");
    existingMigrations.forEach((m) => {
      console.log(`   - Migration ${m.id}: ${m.hash}`);
    });
    console.log("\nNo changes made. Your migration tracking is already set up.");
    await sql.end();
    return;
  }

  // Mark the baseline migration as applied
  // The hash should match what's in drizzle/meta/_journal.json
  const baselineHash = "your-baseline-hash-will-be-here";
  const timestamp = Date.now();

  await sql`
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES (${baselineHash}, ${timestamp})
  `;

  console.log("✅ Marked baseline migration as applied");
  console.log("\n🎉 Done! You can now:");
  console.log("   1. Modify src/lib/db/schema.ts");
  console.log("   2. Run 'npm run db:generate' to create migrations");
  console.log("   3. Run 'npm run db:push' to apply migrations");

  await sql.end();
}

markBaselineMigration().catch((error) => {
  console.error("❌ Error setting up migration tracking:", error);
  process.exit(1);
});
