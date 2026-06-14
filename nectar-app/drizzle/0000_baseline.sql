CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demand_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"submitted_by" uuid,
	"wait_time_minutes" integer NOT NULL,
	"sales_last_15_min" integer NOT NULL,
	"price_before" numeric NOT NULL,
	"price_after" numeric NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qs_config_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"slots_per_hour" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qs_config_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_day_id" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"end_day_offset" integer DEFAULT 0 NOT NULL,
	"custom_slots" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"config_hour_id" integer,
	"customer_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"amount_total" integer NOT NULL,
	"receive_promo" boolean DEFAULT false,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"session_id" varchar(255) PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"customer_email" varchar(255),
	"customer_name" text,
	"payment_status" varchar(50),
	"amount_total" integer,
	"receive_promo" boolean,
	"config_hour_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions_log" (
	"session_id" varchar(255) NOT NULL,
	"venue_id" text NOT NULL,
	"customer_email" varchar(255),
	"customer_name" text,
	"payment_status" varchar(50),
	"amount_total" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_login_at" timestamp with time zone,
	CONSTRAINT "venue_managers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "venue_managers_venue_id_unique" UNIQUE("venue_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" varchar(255) NOT NULL,
	"price" numeric NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"street_address" text,
	"description" text,
	"cover_image_path" text,
	"queue_skip_enabled" boolean DEFAULT true,
	"entry_fee" numeric,
	"price_display_mode" text DEFAULT 'queue_skip_only',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qs_config_days" ADD CONSTRAINT "qs_config_days_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qs_config_hours" ADD CONSTRAINT "qs_config_hours_config_day_id_qs_config_days_id_fk" FOREIGN KEY ("config_day_id") REFERENCES "public"."qs_config_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_config_hour_id_qs_config_hours_id_fk" FOREIGN KEY ("config_hour_id") REFERENCES "public"."qs_config_hours"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_config_hour_id_qs_config_hours_id_fk" FOREIGN KEY ("config_hour_id") REFERENCES "public"."qs_config_hours"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_log" ADD CONSTRAINT "transactions_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_managers" ADD CONSTRAINT "venue_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_managers" ADD CONSTRAINT "venue_managers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_venue_id" ON "audit_log" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user_id" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_demand_signals_venue_id" ON "demand_signals" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_demand_signals_venue_submitted" ON "demand_signals" USING btree ("venue_id","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_qs_config_days_venue_id" ON "qs_config_days" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_qs_config_days_venue_day" ON "qs_config_days" USING btree ("venue_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_qs_config_hours_config_day_id" ON "qs_config_hours" USING btree ("config_day_id");--> statement-breakpoint
CREATE INDEX "idx_queue_session_id" ON "queue" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_queue_venue_status_expires" ON "queue" USING btree ("venue_id","payment_status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_venue_id" ON "transactions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_venue_status_created" ON "transactions" USING btree ("venue_id","payment_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_log_venue_id" ON "transactions_log" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_log_venue_created" ON "transactions_log" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_venue_managers_user_id" ON "venue_managers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_venue_managers_venue_id" ON "venue_managers" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_venue_managers_email" ON "venue_managers" USING btree ("email");