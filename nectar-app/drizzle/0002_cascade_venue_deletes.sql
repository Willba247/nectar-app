-- Migration: fix missing ON DELETE CASCADE on qs_config_days, transactions, transactions_log
--
-- NOTE: The live "Nectar App" database uses Postgres-default constraint names
-- (<table>_venue_id_fkey), NOT the Drizzle-generated names in 0000_baseline.sql
-- (<table>_venue_id_venues_id_fk). The live DB was created outside Drizzle's
-- migration flow, so this migration targets the actual constraint names that
-- exist in the database. Applied to project hktqsyuhyubbhilohpdp on 2026-06-14.
--> statement-breakpoint
ALTER TABLE "qs_config_days" DROP CONSTRAINT "qs_config_days_venue_id_fkey";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_venue_id_fkey";
--> statement-breakpoint
ALTER TABLE "transactions_log" DROP CONSTRAINT "transactions_log_venue_id_fkey";
--> statement-breakpoint
ALTER TABLE "qs_config_days" ADD CONSTRAINT "qs_config_days_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "transactions_log" ADD CONSTRAINT "transactions_log_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
