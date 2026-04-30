import { pgTable, text, integer, timestamp, boolean, numeric, serial, varchar, uuid, time, index } from "drizzle-orm/pg-core";

// Venues table
export const venues = pgTable("venues", {
  id: text("id").primaryKey().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  imageUrl: varchar("image_url", { length: 255 }).notNull(),
  price: numeric("price").notNull(),
  timeZone: text("time_zone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Queue Skip Configuration - Days
export const qsConfigDays = pgTable("qs_config_days", {
  id: serial("id").primaryKey().notNull(),
  venueId: text("venue_id").notNull().references(() => venues.id),
  dayOfWeek: integer("day_of_week").notNull(),
  slotsPerHour: integer("slots_per_hour").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_qs_config_days_venue_id").on(table.venueId),
  index("idx_qs_config_days_venue_day").on(table.venueId, table.dayOfWeek),
]);

// Queue Skip Configuration - Hours
export const qsConfigHours = pgTable("qs_config_hours", {
  id: serial("id").primaryKey().notNull(),
  configDayId: integer("config_day_id").notNull().references(() => qsConfigDays.id, { onDelete: "cascade" }),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  customSlots: integer("custom_slots"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_qs_config_hours_config_day_id").on(table.configDayId),
]);

// Confirmed Transactions
export const transactions = pgTable("transactions", {
  sessionId: varchar("session_id", { length: 255 }).primaryKey().notNull(),
  venueId: text("venue_id").notNull().references(() => venues.id),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerName: text("customer_name"),
  paymentStatus: varchar("payment_status", { length: 50 }),
  amountTotal: integer("amount_total"),
  receivePromo: boolean("receive_promo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_transactions_venue_id").on(table.venueId),
  index("idx_transactions_venue_status_created").on(table.venueId, table.paymentStatus, table.createdAt),
]);

// Transaction Log (all attempts)
export const transactionsLog = pgTable("transactions_log", {
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  venueId: text("venue_id").notNull().references(() => venues.id),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerName: text("customer_name"),
  paymentStatus: varchar("payment_status", { length: 50 }),
  amountTotal: integer("amount_total"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_transactions_log_venue_id").on(table.venueId),
  index("idx_transactions_log_venue_created").on(table.venueId, table.createdAt),
]);

// Queue (pending reservations)
export const queue = pgTable("queue", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sessionId: text("session_id").notNull(),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  amountTotal: integer("amount_total").notNull(),
  receivePromo: boolean("receive_promo").default(false),
  paymentStatus: text("payment_status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_queue_session_id").on(table.sessionId),
  index("idx_queue_venue_status_expires").on(table.venueId, table.paymentStatus, table.expiresAt),
]);


//venue managers table
export const venueManagers = pgTable("venue_managers", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => auth.users.id, { onDelete: "cascade" }),
  venueId: text("venue_id").notNull().unique().references(() => venues.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (table) => [
  index("idx_venue_managers_user_id").on(table.userId),
  index("idx_venue_managers_venue_id").on(table.venueId),
  index("idx_venue_managers_email").on(table.email),
]);


// Venue table alterations
export const venues = pgTable("venues", {
  // ... existing fields ...
  description: text("description"),
  coverImagePath: text("cover_image_path"),
  queueSkipEnabled: boolean("queue_skip_enabled").default(true),
  entryFee: numeric("entry_fee"),
  priceDisplayMode: text("price_display_mode").default('queue_skip_only'),
});

// Audit Logs table
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  venueId: text("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => auth.users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_audit_log_venue_id").on(table.venueId),
  index("idx_audit_log_created_at").on(table.createdAt),
  index("idx_audit_log_user_id").on(table.userId),
]);

