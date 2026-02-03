# Venue Manager Dashboard MVP — Pre-Code Setup Protocol

**Status:** SETUP PHASE ONLY — Do not start coding until ALL items in "Ready to Code Gate" are complete.

---

## A) Repo Verification (Facts Found)

### Current Database Schema Summary
**Venues table (`venues`):**
- PK: `id` (type: **TEXT**)
- Columns: `name`, `image_url`, `price` (numeric), `time_zone`, `created_at`, `updated_at`
- **Status:** Does NOT have description, cover_image_path, queue_skip_enabled, entry_fee, or price_display_mode yet

**Transaction Log table (`transactions_log`):**
- **EXISTS** ✓
- Columns: `session_id` (varchar 255, not PK), `venue_id` (text, FK to venues.id), `customer_email`, `customer_name`, `payment_status` (varchar 50), `amount_total` (integer), `created_at` (timestamptz)
- Indexes: `idx_transactions_log_venue_id`, `idx_transactions_log_venue_created`
- **Status:** READY for dashboard use (has venue_id, created_at, payment_status)

**Queue Skip Config tables:**
- `qs_config_days`: FK venue_id (text), day_of_week, slots_per_hour, is_active ✓
- `qs_config_hours`: FK config_day_id, start_time, end_time, custom_slots, is_active ✓

### Key Constraints to Respect
- **venues.id is TEXT** (not UUID) — all foreign keys must reference TEXT
- **transactions_log is the transaction feed** — use for dashboard views
- **transactions table exists separately** (confirmed transactions only) — NOT the primary feed
- All timestamps are `timestamptz` (with timezone)

---

## B) Supabase Database Changes (Exact SQL/Migrations Required)

### 1) New Table: `venue_managers`

**Purpose:** Map Supabase Auth users (1:1) to venues for venue manager authentication.

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS public.venue_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL UNIQUE REFERENCES public.venues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  
  CONSTRAINT unique_venue_per_manager UNIQUE(venue_id),
  CONSTRAINT unique_user_per_venue UNIQUE(user_id)
);

CREATE INDEX idx_venue_managers_user_id ON public.venue_managers(user_id);
CREATE INDEX idx_venue_managers_venue_id ON public.venue_managers(venue_id);
CREATE INDEX idx_venue_managers_email ON public.venue_managers(email);
```

**Drizzle Schema Addition:**
Add to `src/lib/db/schema.ts`:
```typescript
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
```

**Note:** `auth.users` is Supabase's built-in auth table (not in our schema). In RLS, we reference it directly.

---

### 2) Alter Table: `venues` — Add Venue Manager Dashboard Columns

**SQL:**
```sql
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT,
  ADD COLUMN IF NOT EXISTS queue_skip_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS entry_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS price_display_mode TEXT DEFAULT 'queue_skip_only';

CREATE INDEX IF NOT EXISTS idx_venues_queue_skip_enabled ON public.venues(queue_skip_enabled);
```

**Drizzle Schema Update:**
Update `src/lib/db/schema.ts` `venues` table definition:
```typescript
export const venues = pgTable("venues", {
  // ... existing fields ...
  description: text("description"),
  coverImagePath: text("cover_image_path"),
  queueSkipEnabled: boolean("queue_skip_enabled").default(true),
  entryFee: numeric("entry_fee"),
  priceDisplayMode: text("price_display_mode").default('queue_skip_only'),
});
```

**Justification:**
- `cover_image_path` (not `cover_image_url`): Store the object path in Supabase Storage (e.g., `{venue_id}/timestamp_photo.jpg`). The public URL can be reconstructed client-side using `${SUPABASE_URL}/storage/v1/object/public/venue-covers/${path}`.
- `queue_skip_enabled` (boolean): Simple flag for panic off button; checked before slot validation.
- `price_display_mode` (text enum): Either `'queue_skip_only'` or `'includes_entry_fee'` to control how prices display on patron-facing pages.

---

### 3) Ensure `transactions_log` Ready for Dashboard Filtering

**Status:** ✓ Table already exists and has all required fields:
- `venue_id` (text, FK) — can filter by venue
- `created_at` (timestamptz) — can filter by date range
- `payment_status` (varchar 50) — can filter by status (paid/pending/failed)
- `customer_email`, `customer_name`, `amount_total` — displayable fields

**No migration needed.** The table is ready to power the transaction logs dashboard page.

---

### 4) Optional: Audit Log Table (Recommended)

**Purpose:** Track venue manager config changes (price updates, panic button, etc.) for compliance.

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS public.audit_log (
  id SERIAL PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_venue_id ON public.audit_log(venue_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
```

**Drizzle Schema Addition** (optional for MVP):
```typescript
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
```

**MVP Decision:** Audit log is **OPTIONAL** — implement if time allows; focus on core features first.

---

## C) Supabase RLS Policies (Exact Policies to Apply)

**IMPORTANT:** These policies must be applied in Supabase Dashboard → SQL Editor or via migration files.

### RLS Enabling
First, **enable RLS** on these tables:
- `public.venue_managers`
- `public.venues`
- `public.transactions_log`
- `public.qs_config_days`
- `public.qs_config_hours`
- `public.queue`
- `public.audit_log` (if created)

---

### Policy 1: `venue_managers` — Users Can Read Own Manager Record

**Table:** `venue_managers`  
**Operation:** SELECT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "venue_managers_select_own"
ON public.venue_managers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

**Logic:** A logged-in user can see their own manager record (linking them to a venue_id).

---

### Policy 2: `venue_managers` — Service Role Can Insert/Update (Admin)

**Table:** `venue_managers`  
**Operations:** INSERT, UPDATE, DELETE  
**For role:** `service_role`

**SQL:**
```sql
CREATE POLICY "venue_managers_admin_all"
ON public.venue_managers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**Logic:** Admin (via Supabase service role key or dashboard) can create/modify manager mappings.

---

### Policy 3: `venues` — Venue Managers Can SELECT Own Venue

**Table:** `venues`  
**Operation:** SELECT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "venues_select_own"
ON public.venues
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can see only the venue they manage (if their manager record is active).

---

### Policy 4: `venues` — Venue Managers Can UPDATE Own Venue

**Table:** `venues`  
**Operation:** UPDATE  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "venues_update_own"
ON public.venues
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can update (via tRPC or direct client call) only their own venue's details (description, price, display mode, etc.).

---

### Policy 5: `transactions_log` — Venue Managers Can SELECT Own Venue Logs

**Table:** `transactions_log`  
**Operation:** SELECT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "transactions_log_select_own_venue"
ON public.transactions_log
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can fetch transaction logs only for their managed venue.

---

### Policy 6: `qs_config_days` — Venue Managers Can SELECT/UPDATE Own Venue Config

**Table:** `qs_config_days`  
**Operations:** SELECT, UPDATE  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "qs_config_days_select_own_venue"
ON public.qs_config_days
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "qs_config_days_update_own_venue"
ON public.qs_config_days
FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "qs_config_days_delete_own_venue"
ON public.qs_config_days
FOR DELETE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can manage queue skip schedule only for their venue.

---

### Policy 7: `qs_config_hours` — Venue Managers Can SELECT/UPDATE (via config_day FK)

**Table:** `qs_config_hours`  
**Operations:** SELECT, UPDATE, DELETE  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "qs_config_hours_select_own_venue"
ON public.qs_config_hours
FOR SELECT
TO authenticated
USING (
  config_day_id IN (
    SELECT id FROM public.qs_config_days 
    WHERE venue_id IN (
      SELECT venue_id FROM public.venue_managers 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

CREATE POLICY "qs_config_hours_update_own_venue"
ON public.qs_config_hours
FOR UPDATE
TO authenticated
USING (
  config_day_id IN (
    SELECT id FROM public.qs_config_days 
    WHERE venue_id IN (
      SELECT venue_id FROM public.venue_managers 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
)
WITH CHECK (
  config_day_id IN (
    SELECT id FROM public.qs_config_days 
    WHERE venue_id IN (
      SELECT venue_id FROM public.venue_managers 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

CREATE POLICY "qs_config_hours_delete_own_venue"
ON public.qs_config_hours
FOR DELETE
TO authenticated
USING (
  config_day_id IN (
    SELECT id FROM public.qs_config_days 
    WHERE venue_id IN (
      SELECT venue_id FROM public.venue_managers 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);
```

**Logic:** User can modify hours only for their venue's schedule.

---

### Policy 8: `queue` — Venue Managers Can SELECT Own Venue Queue

**Table:** `queue`  
**Operation:** SELECT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "queue_select_own_venue"
ON public.queue
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can see pending queue items only for their venue (optional; useful for admin dashboard).

---

### Policy 9: `audit_log` — Venue Managers Can SELECT Own Venue Audit Log

**Table:** `audit_log` (optional)  
**Operation:** SELECT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "audit_log_select_own_venue"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can review audit trail only for their venue.

---

## D) Supabase Storage Setup (PUBLIC Bucket + Authenticated Write)

### Bucket Creation

**In Supabase Dashboard → Storage:**
1. Create new public bucket named: `venue-covers`
2. Set to **Public** (allow unauthenticated reads)
3. File size limit: **10 MB** (recommended; adjust if needed)

---

### Storage Policies

**Allowed MIME Types:** `image/jpeg`, `image/png`, `image/webp`

**Storage RLS Policies:**

#### Policy 1: Public Read Access
**Bucket:** `venue-covers`  
**Operation:** SELECT  
**For role:** `public` (unauthenticated)

**SQL:**
```sql
CREATE POLICY "Public read venue covers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'venue-covers');
```

**Logic:** Anyone can view cover photos (needed for patron-facing pages).

---

#### Policy 2: Authenticated Upload (Own Venue Folder)
**Bucket:** `venue-covers`  
**Operation:** INSERT  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "Venue managers upload own covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'venue-covers' AND
  (storage.foldername(name))[1] IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** Authenticated user can upload files to `{venue_id}/...` path only if they manage that venue.

**Path Convention:** `{venue_id}/{timestamp}_{original_filename}.{ext}`  
Example: `nyc-club-1/1706826000_cover.jpg`

---

#### Policy 3: Authenticated Delete (Own Venue Folder)
**Bucket:** `venue-covers`  
**Operation:** DELETE  
**For role:** `authenticated`

**SQL:**
```sql
CREATE POLICY "Venue managers delete own covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'venue-covers' AND
  (storage.foldername(name))[1] IN (
    SELECT venue_id FROM public.venue_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Logic:** User can only delete files in their venue's folder.

---

### Storage File Handling in Code

**Public URL Construction:**
```
https://hktqsyuhyubbhilohpdp.supabase.co/storage/v1/object/public/venue-covers/{venue_id}/{filename}
```

**In app code:**
- Store `cover_image_path` = `{venue_id}/{timestamp}_{filename}` in DB
- Generate public URL on the fly when needed: `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-covers/${cover_image_path}`
- Next.js Image component: allow this hostname in `next.config.js` (already configured in this repo)

---

## E) Environment Variables & Redirect URLs

### Environment Variables Required

**Already in repo (verify they exist in `.env.local` or `.env.production`):**
```
NEXT_PUBLIC_SUPABASE_URL=https://hktqsyuhyubbhilohpdp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Verify in `src/lib/supabase/server.ts`:**
The server client uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Both must be set.

**Do NOT add new env vars for venue manager auth** — Supabase Auth uses the existing keys.

---

### Supabase Auth Configuration

**In Supabase Dashboard → Authentication → URL Configuration:**

1. **Site URL**
   - Local: `http://localhost:3000`
   - Production: `https://your-domain.com`

2. **Redirect URLs** (add all that apply)
   - `http://localhost:3000/venue/dashboard` (local post-login)
   - `http://localhost:3000/venue/login` (local fallback)
   - `https://your-domain.com/venue/dashboard` (prod)
   - `https://your-domain.com/venue/login` (prod fallback)

3. **Email Provider**
   - Use Supabase's built-in email (free tier: 30 emails/month)
   - OR configure external SMTP provider if needed

---

## F) "Ready to Code" Gate — Pre-Implementation Checklist

**Do NOT proceed to coding until ALL items below are complete and tested.**

### Database & Schema
- [ ] `venue_managers` table created in Supabase
- [ ] `venues` table altered with new columns: description, cover_image_path, queue_skip_enabled, entry_fee, price_display_mode
- [ ] (Optional) `audit_log` table created
- [ ] Run `npm run db:push` to sync Drizzle schema with DB
- [ ] Verify all tables exist in Supabase SQL Editor (e.g., `SELECT COUNT(*) FROM venue_managers;` returns 0, no error)

### RLS Policies
- [ ] All 9 policies (or 8 if audit_log skipped) applied via Supabase SQL Editor
- [ ] RLS **enabled** on all tables: `ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;`
- [ ] Test policy isolation (below)

### Supabase Auth Setup
- [ ] Email/password auth enabled in Supabase Dashboard
- [ ] Site URL and Redirect URLs configured
- [ ] Create a test Supabase Auth user for testing (use dashboard → Auth Users)

### Storage Setup
- [ ] `venue-covers` bucket created (public read enabled)
- [ ] File size limit set to 10 MB
- [ ] All 3 storage policies applied (public read, authenticated upload, authenticated delete)
- [ ] Bucket is in **public** mode, not private

### Environment
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and repo can connect
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (for server operations like audit logs, admin queries)
- [ ] Run `npm run dev` and verify Supabase connection in console (no errors)

### Integration Tests (Manual, in Supabase)

#### Test 1: RLS Isolation — Two Different Venues
1. Create two venue manager users (user1 and user2 in Supabase Auth)
2. Create two venues in the DB with IDs `venue-1` and `venue-2`
3. Insert rows in `venue_managers`:
   - user1 → venue-1
   - user2 → venue-2
4. Insert test data in `transactions_log`:
   - 5 transactions for venue-1
   - 5 transactions for venue-2
5. **Test:** Log in as user1, run query:
   ```sql
   SELECT COUNT(*) FROM transactions_log WHERE venue_id = 'venue-1';
   -- Should return 5
   
   SELECT COUNT(*) FROM transactions_log WHERE venue_id = 'venue-2';
   -- Should return 0 (RLS blocks access)
   ```
6. **Result:** If user1 sees 5 and 0, RLS is working. ✓

#### Test 2: Venue Manager Can Update Own Venue
1. Log in as user1 (manager of venue-1)
2. Run update via tRPC or direct SQL:
   ```sql
   UPDATE venues SET description = 'Updated by user1' WHERE id = 'venue-1';
   -- Should succeed
   
   UPDATE venues SET description = 'Hacked' WHERE id = 'venue-2';
   -- Should fail (RLS blocks)
   ```
3. **Result:** First succeeds, second blocked. ✓

#### Test 3: Storage Upload Policy
1. Log in as user1 (manager of venue-1)
2. Upload a file to `venue-covers` bucket via Supabase dashboard or SDK:
   - Path: `venue-1/test.jpg` — should succeed ✓
   - Path: `venue-2/hacked.jpg` — should fail ✓
3. **Result:** User can only write to their venue folder. ✓

#### Test 4: Public Can Read Storage
1. Unauthenticated request to:
   ```
   GET https://hktqsyuhyubbhilohpdp.supabase.co/storage/v1/object/public/venue-covers/venue-1/test.jpg
   ```
2. **Result:** Should return the image (200 OK). ✓

#### Test 5: transactions_log Query for Dashboard
1. Log in as user1 (manager of venue-1)
2. Query transactions for a date range:
   ```sql
   SELECT * FROM transactions_log 
   WHERE venue_id = 'venue-1' 
   AND created_at BETWEEN '2025-01-01' AND '2025-02-01'
   AND payment_status = 'paid';
   -- Should return matching rows
   ```
3. **Result:** Returns only paid transactions from venue-1 in date range. ✓

#### Test 6: Panic Off Button (queue_skip_enabled flag)
1. Set a venue's `queue_skip_enabled = false`
2. Verify in tRPC procedure (when we write it) that `validateAndReserveSlot` checks this flag before validating
3. **Result:** New purchases blocked; existing queue items unaffected. ✓ (tested in code, not here)

---

## Summary Checklist

**Before you write a single line of code:**

```
SUPABASE DATABASE:
☐ venue_managers table created + indexed
☐ venues table altered (+ 5 new columns)
☐ audit_log table created (optional)
☐ RLS enabled on all tables
☐ 9 policies applied and tested
☐ transactions_log verified ready
☐ npm run db:push completed successfully

SUPABASE AUTH:
☐ Email/password enabled
☐ Site URL + Redirect URLs configured
☐ Test user created

SUPABASE STORAGE:
☐ venue-covers bucket created (public)
☐ 3 storage policies applied
☐ File size limit 10 MB
☐ Public read verified with test file

ENVIRONMENT:
☐ .env.local has NEXT_PUBLIC_SUPABASE_URL and ANON_KEY
☐ SUPABASE_SERVICE_ROLE_KEY set
☐ npm run dev works with no Supabase errors

INTEGRATION TESTS (All Passing):
☐ Test 1: RLS isolation between two venues
☐ Test 2: Manager can update own venue only
☐ Test 3: Storage upload restricted to own folder
☐ Test 4: Public can read storage files
☐ Test 5: Transaction log queries work
☐ (Test 6: Panic off flag will be tested in code)

ALL ITEMS COMPLETE? → Ready to start Phase 1 coding (Auth + DB setup in tRPC)
```

---

## What Repo Clarifications We Still Need

Before proceeding to code, **confirm these facts:**

1. **Supabase Project URL & Keys:**
   - Exact URL being used (already seen: `hktqsyuhyubbhilohpdp.supabase.co`)
   - Confirm ANON_KEY is set in `.env.local`
   - Confirm SERVICE_ROLE_KEY is set (for server operations)

2. **Next.js Running State:**
   - Can you run `npm run dev` and see the patron-facing pages load without Supabase errors?
   - This verifies DB connection is working.

3. **Existing Supabase Users:**
   - How many Supabase Auth users exist currently?
   - Should we create test users ourselves, or do you have a process?

4. **Patron App Data:**
   - How many venues exist in the DB?
   - Do any have transactions in `transactions_log`?
   - (We'll use these for testing the manager dashboard.)

5. **Deployment Environment:**
   - Will production Supabase project be the same as local, or separate?
   - Are prod env vars already configured in your hosting provider?

---

## Next Steps (When Gate is Complete)

Once all "Ready to Code" items pass:

1. **Phase 1:** Implement Supabase Auth client/server setup + `venueManagerProcedure` in tRPC
2. **Phase 2:** Build `/venue/login` and `/venue/dashboard` protected layout
3. **Phase 3:** Implement Transactions page + polling
4. **Phase 4:** Implement Queue Skip config + Panic Off
5. **Phase 5:** Implement Venue Card editor + image upload
6. **Phase 6:** QA + deployment

**Estimated time to gate completion:** 2–4 hours (mostly Supabase setup + testing)  
**Estimated time to Phase 1 code:** 4–6 hours (once gate is complete)
