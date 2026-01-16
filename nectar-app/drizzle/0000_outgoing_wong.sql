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
CREATE TABLE "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"image_url" varchar(255) NOT NULL,
	"price" numeric NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qs_config_days" ADD CONSTRAINT "qs_config_days_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qs_config_hours" ADD CONSTRAINT "qs_config_hours_config_day_id_qs_config_days_id_fk" FOREIGN KEY ("config_day_id") REFERENCES "public"."qs_config_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue" ADD CONSTRAINT "queue_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_log" ADD CONSTRAINT "transactions_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;