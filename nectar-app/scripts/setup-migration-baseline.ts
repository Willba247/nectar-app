import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString);

async function setupMigrationBaseline() {
  console.log("🔧 Setting up Drizzle migration baseline...\n");

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
    console.log("⚠️  Migrations already tracked:");
    existingMigrations.forEach((m) => {
      console.log(`   - ${m.hash}`);
    });
    await sql.end();
    return;
  }

  // Read the journal to get the baseline migration tag
  const journalPath = resolve(process.cwd(), "drizzle/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

  if (journal.entries.length === 0) {
    console.log("❌ No migrations found in journal");
    await sql.end();
    return;
  }

  const baselineMigration = journal.entries[0];
  const migrationHash = baselineMigration.tag;
  const timestamp = baselineMigration.when;

  // Mark the baseline migration as applied WITHOUT running it
  await sql`
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES (${migrationHash}, ${timestamp})
  `;

  console.log(`✅ Marked baseline migration '${migrationHash}' as applied`);
  console.log("\n🎉 Setup complete! Your database is now tracked by Drizzle.");
  console.log("\n📝 Future workflow:");
  console.log("   1. Modify src/lib/db/schema.ts (add tables, columns, etc.)");
  console.log("   2. Run 'npm run db:generate' to create migration files");
  console.log("   3. Review the generated SQL in drizzle/");
  console.log("   4. Apply with 'drizzle-kit migrate' or use a migration runner");

  await sql.end();
}

setupMigrationBaseline().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
