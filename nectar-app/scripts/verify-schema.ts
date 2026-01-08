import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString);

async function verifySchema() {
  console.log("🔍 Verifying database schema...\n");

  // Get all tables
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log("📋 Tables found:");
  tables.forEach((t) => console.log(`  - ${t.table_name}`));
  console.log();

  // Get columns for each table
  for (const table of tables) {
    console.log(`\n📊 Table: ${table.table_name}`);
    console.log("─".repeat(80));

    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table.table_name}
      ORDER BY ordinal_position
    `;

    columns.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const type = col.character_maximum_length
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(`  ${col.column_name.padEnd(20)} ${type.padEnd(20)} ${nullable}${defaultVal}`);
    });
  }

  // Get foreign keys
  console.log("\n\n🔗 Foreign Keys:");
  console.log("─".repeat(80));

  const foreignKeys = await sql`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `;

  foreignKeys.forEach((fk) => {
    console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
  });

  // Get check constraints
  console.log("\n\n✓ Check Constraints:");
  console.log("─".repeat(80));

  const checkConstraints = await sql`
    SELECT
      tc.table_name,
      tc.constraint_name,
      cc.check_clause
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.check_constraints AS cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `;

  if (checkConstraints.length === 0) {
    console.log("  No check constraints found");
  } else {
    checkConstraints.forEach((cc) => {
      console.log(`  ${cc.table_name}.${cc.constraint_name}`);
      console.log(`    ${cc.check_clause}`);
    });
  }

  console.log("\n\n✅ Schema verification complete!");

  await sql.end();
}

verifySchema().catch((error) => {
  console.error("❌ Error verifying schema:", error);
  process.exit(1);
});
