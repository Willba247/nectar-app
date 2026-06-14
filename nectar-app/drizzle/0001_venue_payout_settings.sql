CREATE TABLE "venue_payout_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "venue_id" text NOT NULL,
    "payout_period" text DEFAULT 'monthly' NOT NULL,
    "account_name" varchar(255),
    "bsb" varchar(7),
    "account_number" varchar(20),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "venue_payout_settings_venue_id_unique" UNIQUE("venue_id"),
    CONSTRAINT "venue_payout_settings_payout_period_check"
        CHECK (payout_period IN ('weekly', 'fortnightly', 'monthly'))
);
--> statement-breakpoint
ALTER TABLE "venue_payout_settings"
    ADD CONSTRAINT "venue_payout_settings_venue_id_venues_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_venue_payout_settings_venue_id"
    ON "venue_payout_settings" USING btree ("venue_id");
