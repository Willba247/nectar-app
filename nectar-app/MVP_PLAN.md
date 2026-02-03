# Nectar Venue Manager Dashboard — MVP Plan

## Quick Repo Read
- Framework: Next.js 15 App Router under `src/app` (e.g., `src/app/admin`).
- API layer: tRPC v11 in `src/server/api`, routers registered in `src/server/api/root.ts`.
- DB layer: Drizzle ORM in `src/lib/db` with schema in `src/lib/db/schema.ts` and query modules under `src/lib/db/queries`.
- Auth (current): Admin password via env + localStorage (not secure; needs change for venue managers).
- UI kit: Radix/ShadCN components in `src/components/ui`.
- Storage: Supabase client present (server), Next images allow Supabase storage host in `next.config.js`.
- Transactions: `transactions` and `transactions_log` tables already exist.

## Clarifying Answers (applied)
1) Supabase Auth for venue managers.
2) One venue per manager (no venue switching UI).
3) Default log view = paid only; toggle to include pending/failed.
4) Panic off blocks new queue skips; existing/pending remain valid.
5) Images in public Supabase bucket (public URLs).
6) Default price display hides entry fee; optional “including entry fee of $X”.
7) Polling every 5s with rate limiting.
8) Exports are client-generated.
9) Separate URL namespace: `/venue/dashboard/*`.

## MVP Skeleton Plan

### Auth / Access Control
**Recommended namespace:** `/venue/dashboard/*`

**Tables (new):**
- `venue_managers`
  - Why: Map Supabase Auth user → venue.
  - Responsibility: 1:1 mapping, session enforcement.
  - Mirror/reuse: Supabase auth user_id.
  - Security: RLS: user can read only own row; service role manages.

**Policies:**
- `venue_managers`: SELECT where `auth.uid() = user_id`.
- `venues`: SELECT/UPDATE only where user is mapped to venue.
- `transactions`, `transactions_log`, `queue`, `qs_config_days`, `qs_config_hours`: SELECT/UPDATE scoped to venue_id from mapping.

**Files (plan):**
- `src/lib/supabase/client.ts` (populate): Browser client for Supabase Auth.
- `src/lib/supabase/server.ts` (update): Server auth helper for SSR and tRPC.
- `src/server/api/trpc.ts` (update): Add `venueManagerProcedure` middleware to validate Supabase session and resolve venue_id.
- `src/server/api/routers/venueManager.ts` (new): All venue manager procedures.

**Routes (plan):**
- `/venue/login`: Supabase Auth login page.
- `/venue/dashboard`: Protected layout (SSR session guard). Default redirect to `/venue/dashboard/transactions`.

Security implications: no localStorage auth; must validate session server-side and enforce venue scoping for every request.

---

### Dashboard Pages

#### 1) Transaction Logs
- **Route:** `/venue/dashboard/transactions`
- **Why:** Live (near real-time) log view and exports.
- **Responsibility:**
  - Default paid-only list
  - Toggle to include pending/failed
  - Date range filters
  - Pagination
  - Client CSV export
  - Polling every 5s with rate limiting
- **Mirror/reuse:** `src/app/admin/tabs/TransactionsTab.tsx`
- **Security:** Use `venueManagerProcedure` and RLS; ignore client venue_id.

#### 2) Queue Skip Configuration + Operations
- **Route:** `/venue/dashboard/queue-skip`
- **Why:** Price updates, day/time config, panic off.
- **Responsibility:**
  - Change queue skip price
  - Manage days/times
  - Panic off toggle (block new purchases)
- **Mirror/reuse:** Queue-skip config UI in `src/app/admin/tabs/VenuesTab.tsx`
- **Security:** Server-side validation of venue ownership; audit changes.

#### 3) Venue Card Content Management
- **Route:** `/venue/dashboard/venue-card`
- **Why:** Cover photo, description, price display.
- **Responsibility:**
  - Upload cover image
  - Edit description
  - Configure price display (queue skip only vs includes entry fee)
- **Mirror/reuse:** Existing venue fields and public card UI.
- **Security:** Authenticated uploads only; validate mime/size; RLS on storage.

---

### API / Server Procedures (tRPC)
**New router:** `venueManagerRouter`

1) `getVenueSummary`
- Why: Load venue details for dashboard
- Responsibility: Return venue profile, pricing, config, display settings
- Mirror/reuse: `venueRouter.getVenueById` + query layer
- Security: Use context venue_id

2) `getTransactionLogs`
- Why: Filtered, paginated logs
- Responsibility: Query `transactions` (+ optional `transactions_log` for pending/failed)
- Mirror/reuse: `transactionRouter.getTransactions`
- Security: Scope to ctx.venueId

3) `updateQueueSkipPrice`
- Why: Change price
- Responsibility: Update `venues.price`
- Mirror/reuse: `priceRouter.updateVenuePrice`
- Security: Validate price range; ctx.venueId only

4) `getQueueSkipConfig`
- Why: Load day/time config
- Responsibility: Return `qs_config_days` + `qs_config_hours`
- Mirror/reuse: `venueRouter.getVenueQueueSkipConfig`
- Security: Scope to ctx.venueId

5) `updateQueueSkipConfig`
- Why: Add/update config
- Responsibility: Create/update day and hour rows
- Mirror/reuse: `venueRouter.createVenueQueueSkipConfig`
- Security: Validate times; ctx.venueId

6) `deleteQueueSkipConfig`
- Why: Remove time config
- Responsibility: Delete day/hour rows
- Mirror/reuse: `deleteConfigDay` / `deleteConfigHour`
- Security: Confirm config belongs to ctx.venueId

7) `setPanicOff`
- Why: Halt new purchases
- Responsibility: Set `venues.queue_skip_enabled`
- Mirror/reuse: venue update query
- Security: Audit log; ctx.venueId only

8) `updateVenueDescription`
- Why: Edit venue card copy
- Responsibility: Update `venues.description`
- Mirror/reuse: venue update query
- Security: Sanitize + length validation

9) `updatePriceDisplay`
- Why: Control display mode + entry fee
- Responsibility: Update `price_display_mode` + `entry_fee`
- Security: Validate entry fee input

10) `getUploadUrl` / `confirmUpload`
- Why: Cover photo upload
- Responsibility: Signed upload → store public URL in `venues.cover_image_url`
- Security: Validate type/size, enforce venue path

---

### Database Schema Additions / Changes
**Add to `venues` table:**
- `description` (text)
- `cover_image_url` (text)
- `queue_skip_enabled` (boolean, default true)
- `entry_fee` (numeric)
- `price_display_mode` (text, default `queue_skip_only`)

**New table:** `venue_managers`
- `id` (uuid)
- `venue_id` (text, FK to venues.id)
- `user_id` (uuid, FK to Supabase auth.users)
- `email` (text)
- `created_at`, `last_login_at`, `is_active`

**Optional:** `audit_log` table for change history.

Security: RLS policies on all tables to enforce venue-only access.

---

### Storage / Media Handling
- Supabase Storage public bucket (e.g., `venue-covers`).
- Path convention: `{venue_id}/{timestamp}_{filename}`.
- Public read, authenticated write (RLS: user must match venue_id).
- Update `venues.cover_image_url` to public URL.

---

### Export Pipeline (Client-side)
- CSV generation in client (no server export for MVP).
- Export current filters/date range.
- Filename: `transactions_{venue}_{YYYY-MM-DD}.csv`.
- Optional future: XLSX via SheetJS, PDF via jsPDF.

---

### Realtime Updates Approach
- Polling every 5s using React Query `refetchInterval`.
- Rate limit: do not fetch if last fetch < 5s.
- Pause polling when tab not visible.

---

## Security Checklist
- Supabase Auth enforced for all `/venue/dashboard/*` pages.
- All tRPC procedures use `venueManagerProcedure` (server-side auth).
- Ignore client-supplied venue_id; always use context venue_id.
- RLS policies across tables + storage bucket.
- Validate and sanitize description input.
- Validate file size/type for uploads.
- Panic off enforced inside queue reservation logic before DB transaction.
- Audit log for config changes (recommended).
- Rate limit exports and polling to prevent DB abuse.

---

## Implementation Sequence
1) Configure Supabase Auth (email/password) + redirect URLs.
2) Add DB schema: `venue_managers`, venue columns, optional `audit_log`.
3) Add RLS policies for venue manager access.
4) Implement Supabase client/server helpers.
5) Add `venueManagerProcedure` in tRPC context.
6) Build `/venue/login` and protected `/venue/dashboard` layout.
7) Implement Transactions page with polling + CSV export.
8) Implement Queue Skip page + panic off toggle.
9) Add panic off enforcement in queue reservation logic.
10) Implement Venue Card page + upload flow.
11) Add client-side CSV helper + export UI.
12) QA: RLS tests, auth tests, file upload tests, polling load tests.
