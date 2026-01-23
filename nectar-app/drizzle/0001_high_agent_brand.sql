CREATE INDEX "idx_qs_config_days_venue_id" ON "qs_config_days" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_qs_config_days_venue_day" ON "qs_config_days" USING btree ("venue_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_qs_config_hours_config_day_id" ON "qs_config_hours" USING btree ("config_day_id");--> statement-breakpoint
CREATE INDEX "idx_queue_session_id" ON "queue" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_queue_venue_status_expires" ON "queue" USING btree ("venue_id","payment_status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_venue_id" ON "transactions" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_venue_status_created" ON "transactions" USING btree ("venue_id","payment_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_log_venue_id" ON "transactions_log" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_log_venue_created" ON "transactions_log" USING btree ("venue_id","created_at");