# Venue Manager Dashboard — Detailed Implementation Plan (Phases 1–6)

**Date:** February 2026  
**Status:** Implementation-Ready  
**Author:** WA & Copilot

---

## Assumptions (Core)

These assumptions are **locked in** and must be respected throughout implementation:

1. **Auth Model:** Supabase Auth (email/password only). One venue per manager. JWT-based session validation.
2. **Database Access:** 100% server-side through tRPC. Zero client-side Supabase `.from()` calls. venueId derived from auth context, never from client input.
3. **Security Model:** RLS enforced on all tables + storage. `venueManagerProcedure` middleware is the single gatekeeper. Ignore all client-supplied venue identifiers.
4. **Scope:** Venue managers only. This is NOT an admin panel. No multi-venue switching, no master admin features, no guest access.
5. **Storage (MVP):** Direct authenticated browser upload to Supabase Storage bucket `venue-covers`. Client uploads directly using anon key + user JWT session (RLS enforces `{venue_id}/*` path isolation). After successful upload, client calls `confirmUpload` tRPC mutation to store ONLY the storage path in `venues.cover_image_path`. Public URL derived at render time. (Note: `venue-image` bucket uses server-side uploads for backward compat; `venue-covers` is new and uses direct authenticated browser uploads by design.)
6. **Data Constraints:** Transaction queries capped at 1000 rows per request (hard limit). Date range requests capped at 31 days (reject or clamp beyond this). Enforced server-side in `getTransactionLogs`.
7. **Polling:** React Query with 5-second intervals. Pause when tab hidden. No WebSocket.
8. **Exports:** Client-side CSV generation. No server-side bulk export for MVP.
9. **Audit:** Optional for MVP. Recommended for Phase 6.

## Current Status & Immediate Work (Phase 1 Polish)

**Foundation Complete:** Database, RLS, Supabase Auth, venueManagerProcedure, and auth flow are all implemented and verified. Test dashboard proves JWT → RLS security model works end-to-end.

**Next:** Convert proof-of-concept dashboard into production shell with UI components and stub pages for Phase 2+ feature development.

### Phase 1: Dashboard Shell & Layout

```
/venue/
├── login                  ← Supabase Auth form (public)
└── dashboard/             ← Protected layout (auth guard)
    ├── (layout)           ← Guards session, redirects to /venue/login if needed
    ├── page               ← Redirect to /transactions (default)
    ├── transactions/      ← Live transaction log view
    ├── queue-skip/        ← Config + panic toggle
    └── venue-card/        ← Profile editor + cover image upload
```

### Route Responsibilities

#### `/venue/login`

- **Component Type:** Client-only interactive page
- **Responsibility:**
  - Render Supabase Auth login form (email/password)
  - Validate credentials client-side first (UX)
  - On success: redirect to `/venue/dashboard`
  - On load: detect existing session → redirect if already logged in
  - Error boundary: display auth errors (invalid creds, user not found, etc.)
- **Data Needed:** None (form is self-contained)
- **External Calls:** `supabase.auth.signInWithPassword()`
- **Why Client-Only:** Auth state is browser-local; no server-side session needed yet

#### `/venue/dashboard` (Layout)

- **Component Type:** Server-side layout with RLS boundary
- **Responsibility:**
  - Guard: Extract JWT from request headers and validate with Supabase Auth
  - If no valid session: redirect to `/venue/login`
  - If valid: inject `ctx.venue` (userId, email, venueId) into child pages
  - Render navbar, sidebar, breadcrumbs
  - Render `{children}` (transaction, queue-skip, venue-card pages)
- **Data Needed:** Supabase auth session (from headers)
- **External Calls:** Server-side Supabase Auth validation
- **Why Server-Side:** Must validate JWT before rendering protected pages; ensures no unauthorized access to child routes

#### `/venue/dashboard/page` (Default)

- **Component Type:** Server redirect component
- **Responsibility:**
  - Redirect to `/venue/dashboard/transactions`
- **Why:** Single source of truth for "dashboard home"

#### `/venue/dashboard/transactions`

- **Component Type:** Client component (interactive, polling)
- **Responsibility:**
  - Display live (near real-time) transaction logs
  - Filters: date range, paid-only toggle, search by email/name
  - Pagination: 25/50/100 rows per page
  - Polling every 5s via React Query
  - CSV export button (client-side generation)
  - Pause polling when tab inactive (Page Visibility API)
- **Data Needed:**
  - Transaction list (paginated, filtered)
  - Total count for pagination
  - Venue summary (name, for export filename)
- **External Calls:** `api.venueManager.getTransactionLogs()` (tRPC)
- **Why Client Component:** Needs polling, visibility tracking, user interactivity

#### `/venue/dashboard/queue-skip`

- **Component Type:** Client component (form + live state)
- **Responsibility:**
  - Display current queue skip configuration (days/times/price)
  - Edit: price slider, add/remove days, configure time windows
  - Toggle: "Panic Off" — blocks new purchases (big red button)
  - Show confirmation dialog before panic off
  - Real-time feedback: "Changes saved" toast
  - Polling optional: refresh config every 30s to detect admin changes
- **Data Needed:**
  - Venue queue skip price + features
  - Day/time configuration (all days, slots per hour)
  - Panic state (boolean)
  - Entry fee (read-only or editable)
- **External Calls:**
  - `api.venueManager.getQueueSkipConfig()` (load)
  - `api.venueManager.updateQueueSkipPrice()` (save price)
  - `api.venueManager.updateQueueSkipConfig()` (save days/times)
  - `api.venueManager.setPanicOff()` (toggle panic)
- **Why Client Component:** Form state, optimistic updates, user feedback loops

#### `/venue/dashboard/venue-card`

- **Component Type:** Client component (form + upload)
- **Responsibility:**
  - Display current venue card: name, description, price, cover image
  - Edit form: description text area, entry fee input, price display mode selector
  - Upload control: file input or drag-and-drop (JPG/PNG, max 5MB)
  - Progress bar: upload in progress (via tRPC mutation)
  - Validation: file type, size, image dimensions
  - Real-time preview: show new cover immediately after upload
  - Save workflow: client uploads directly to Supabase Storage `venue-covers` → confirmUpload tRPC call stores path in DB → success toast
- **Data Needed:**
  - Venue name, description, current cover_image_path (storage path only, not full URL)
  - Entry fee, price display mode
  - Authenticated session for direct storage upload (anon key + JWT)
- **External Calls:**
  - `supabase.storage.from('venue-covers').upload()` (direct browser upload, RLS validates path)
  - `api.venueManager.getVenueSummary()` (load profile)
  - `api.venueManager.updateVenueDescription()` (save description)
  - `api.venueManager.updatePriceDisplay()` (save fee + mode)
  - `api.venueManager.confirmUpload()` (store storage path in DB only, no full URL)
- **Why Client Component:** Form state + file upload + progress tracking (no server hop needed for upload itself)
- **Storage Note:** Direct authenticated browser upload to `venue-covers` bucket. RLS on storage enforces path isolation (`{venue_id}/*`). Client validation on file type/size; server validation in confirmUpload.

---

## Part 2: File & Folder Structure

### Top-Level Organization

```
src/
├── app/
│   └── venue/                          ← Venue manager namespace
│       ├── login/
│       │   └── page.tsx               ← Login form (client)
│       └── dashboard/
│           ├── layout.tsx             ← Auth guard + navbar layout (server)
│           ├── page.tsx               ← Redirect to /transactions
│           ├── transactions/
│           │   ├── page.tsx           ← Transaction log view (client)
│           │   └── _components/
│           │       ├── TransactionTable.tsx      ← Presentational table
│           │       ├── TransactionFilters.tsx    ← Filter UI
│           │       └── ExportButton.tsx          ← CSV export
│           ├── queue-skip/
│           │   ├── page.tsx           ← Queue config view (client)
│           │   └── _components/
│           │       ├── ConfigForm.tsx           ← Config editor
│           │       ├── PriceSlider.tsx          ← Price input
│           │       ├── DayTimePicker.tsx        ← Day/time selector
│           │       └── PanicOffButton.tsx       ← Panic toggle (red, scary)
│           └── venue-card/
│               ├── page.tsx           ← Profile editor (client)
│               └── _components/
│                   ├── ProfileForm.tsx         ← Text fields + mode selector
│                   ├── ImageUpload.tsx         ← Drag-drop upload control
│                   └── PreviewCard.tsx         ← Live preview
│
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  ← UPDATED: Browser client (auth + storage)
│   │   └── server.ts                  ← EXISTING: Service role (admin only)
│   │
│   ├── db/
│   │   ├── schema.ts                  ← UPDATED: venue_managers + extras
│   │   ├── queries/
│   │   │   └── venueManager.ts        ← NEW: Parameterized queries scoped to venueId
│   │   └── index.ts
│   │
│   └── utils/
│       ├── csv-export.ts              ← NEW: CSV generation for transactions
│       ├── file-validation.ts         ← NEW: File type/size checks
│       └── formatting.ts              ← EXISTING: Phone, currency, etc.
│
└── components/
    └── ui/
        ├── dialog.tsx                 ← Use for panic confirmation
        ├── tabs.tsx                   ← Use for dashboard nav
        └── ... (existing ShadCN)
```

### Key Principles

1. **Server vs Client:**

   - **Server:** `layout.tsx` (auth guard), `trpc.ts` (middleware), queries in `server/api`
   - **Client:** All `page.tsx` under `/venue/dashboard/*`, form components, polling logic
   - **Shared:** Database schema, types (Drizzle exports)

2. **Components vs Pages:**

   - **Pages** (`page.tsx`): Data loading, polling setup, error boundaries, route-level guards
   - **Components** (underscore folders `_components/`): Presentational only, accept data via props, no tRPC calls
   - **Exception:** Form buttons may call tRPC directly (for mutation feedback), but prefer parent page passing handler

3. **Query Layer:**

   - Create parameterized Drizzle queries in `src/lib/db/queries/venueManager.ts`
   - Accept `venueId` as parameter (required)
   - tRPC procedures call these queries with `ctx.venue.venueId` (never client input)

4. **Storage:**

- **Convention:** `{venue_id}/{timestamp}_{filename}`
- **Example:** `venue-abc-123/1707520400000_cover.jpg`
- **Important:** Storage policy scopes writes to user's venue folder only (RLS-enforced via SQL at bucket level, not implicit trust)
- **MVP Upload Model:** Direct authenticated browser upload to Supabase Storage bucket `venue-covers`. Client uses anon key + JWT session. RLS validates path starts with `{venue_id}/`

---

## Part 3: tRPC Procedure Design

### Core Pattern: `venueManagerProcedure`

**Already Exists (from Phase 0):**

```
venueManagerProcedure = publicProcedure
  .use(middleware that:)
    - Extracts Authorization: Bearer {token} from request headers
    - Validates token with Supabase Auth
    - Queries venue_managers table (RLS enforces user isolation)
    - Injects ctx.venue = { userId, email, venueId }
    - Throws UNAUTHORIZED if any step fails
```

**Usage:**
All venue manager procedures inherit from `venueManagerProcedure`, not `publicProcedure`.

---

### Required tRPC Procedures

#### Query: `getVenueSummary`

- **Input:** None (venue_id from context)
- **Output:**
  ```typescript
  {
    venue_id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    coverImagePath: string | null;
    price: string(numeric);
    entryFee: string | null;
    queueSkipEnabled: boolean;
    priceDisplayMode: "queue_skip_only" | "includes_entry_fee";
    timeZone: string;
    createdAt: Date;
    lastUpdatedAt: Date;
  }
  ```
- **Responsibility:** Load full venue profile for dashboard
- **Query Pattern:**
  ```typescript
  SELECT * FROM venues WHERE id = ctx.venue.venueId
  ```
- **RLS:** Already scoped by user auth (see Part 4)
- **Used By:** `/venue/dashboard/venue-card` (on load)

#### Query: `getTransactionLogs`

- **Input:**
  ```typescript
  {
    filter: 'paid' | 'all'; // all = paid + pending + failed
    dateStart?: Date;
    dateEnd?: Date;
    searchEmail?: string;
    searchName?: string;
    page: number; // 0-indexed
    limit: 25 | 50 | 100;
  }
  ```
- **Output:**
  ```typescript
  {
    transactions: Array<{
      sessionId: string;
      email: string;
      name: string;
      paymentStatus: 'paid' | 'pending' | 'failed';
      amountTotal: number (cents);
      createdAt: Date;
    }>;
    total: number; // For pagination
  }
  ```
- **Responsibility:** Paginated, filtered transaction logs with server-side data constraints
- **Server-Side Constraints (enforced):**
  - MAX rows returned per request: 1000 (hard cap, even if client requests higher limit or uses aggressive pagination)
  - MAX date range: 31 days (reject requests with dateEnd - dateStart > 31 days, or clamp to last 31 days)
  - Validated server-side to prevent client exploit of data limits
- **Query Pattern:**
  ```typescript
  SELECT * FROM transactions_log
  WHERE venue_id = ctx.venue.venueId
    AND (filter='all' OR payment_status='paid')
    AND (dateStart IS NULL OR created_at >= dateStart)
    AND (dateEnd IS NULL OR created_at <= dateEnd)
    AND (searchEmail IS NULL OR email ILIKE searchEmail)
    AND (searchName IS NULL OR name ILIKE searchName)
  ORDER BY created_at DESC
  LIMIT MIN(limit, 1000) OFFSET page * limit
  ```
- **Validation:** Throw error if dateRange > 31 days
- **RLS:** Scoped to ctx.venue.venueId
- **Used By:** `/venue/dashboard/transactions` (polling every 5s)

#### Query: `getQueueSkipConfig`

- **Input:** None (venue_id from context)
- **Output:**
  ```typescript
  {
    price: string(numeric);
    days: Array<{
      dayOfWeek: number; // 0 = Sunday, 6 = Saturday
      slotsPerHour: number;
      isActive: boolean;
      times: Array<{
        configHourId: number;
        startTime: string; // HH:MM
        endTime: string; // HH:MM
        customSlots?: number;
        isActive: boolean;
      }>;
    }>;
  }
  ```
- **Responsibility:** Load current configuration for editing
- **Query Pattern:**
  ```typescript
  SELECT d.*, h.* FROM qs_config_days d
  LEFT JOIN qs_config_hours h ON d.id = h.config_day_id
  WHERE d.venue_id = ctx.venue.venueId
  ORDER BY d.day_of_week, h.start_time
  ```
- **RLS:** Scoped to ctx.venue.venueId
- **Used By:** `/venue/dashboard/queue-skip` (on load + 30s polling)

---

#### Mutation: `updateQueueSkipPrice`

- **Input:** `{ price: string (numeric decimal) }`
- **Output:** `{ success: boolean; newPrice: string; message: string }`
- **Responsibility:** Update queue skip base price
- **Mutation Pattern:**
  ```typescript
  UPDATE venues
  SET price = input.price, updated_at = NOW()
  WHERE id = ctx.venue.venueId
  ```
- **Validation:**
  - Price >= 0, <= 999.99
  - Numeric format check
  - Return clear error message if invalid
- **Audit:** Optional: INSERT into audit_log
- **Used By:** `/venue/dashboard/queue-skip` (price slider change)

#### Mutation: `updateQueueSkipConfig`

- **Input:**
  ```typescript
  {
    action: 'add' | 'update' | 'delete';
    dayOfWeek: number; // 0-6
    slotsPerHour?: number;
    times?: Array<{
      startTime: string;   // HH:MM
      endTime: string;     // HH:MM
      customSlots?: number;
    }>;
    configHourId?: number; // For delete
  }
  ```
- **Output:** `{ success: boolean; config: {...}; message: string }`
- **Responsibility:** Add/update/delete day and time configurations
- **Mutation Pattern:**
  ```typescript
  // On 'add': INSERT into qs_config_days + qs_config_hours
  // On 'update': UPDATE qs_config_days, manage qs_config_hours
  // On 'delete': DELETE FROM qs_config_hours (cascade to days if needed)
  WHERE venue_id = ctx.venue.venueId
  ```
- **Validation:**
  - Time format HH:MM
  - startTime < endTime
  - No overlaps (optional, complex)
  - slotsPerHour > 0
- **Audit:** Optional: INSERT into audit_log
- **Used By:** `/venue/dashboard/queue-skip` (form submit)

#### Mutation: `setPanicOff`

- **Input:** `{ enabled: boolean }`
- **Output:** `{ success: boolean; state: boolean; message: string }`
- **Responsibility:** Toggle queue skip sales on/off
- **Mutation Pattern:**
  ```typescript
  UPDATE venues
  SET queue_skip_enabled = input.enabled, updated_at = NOW()
  WHERE id = ctx.venue.venueId
  ```
- **Validation:** None (boolean)
- **Audit:** MANDATORY — Log panic state change with timestamp
  ```typescript
  INSERT into audit_log (venue_id, user_id, action, changes)
  VALUES (ctx.venue.venueId, ctx.venue.userId, 'panic_off_toggled', {...})
  ```
- **Enforcement:** Queue reservation API must check `venues.queue_skip_enabled` before accepting new purchases
- **Used By:** `/venue/dashboard/queue-skip` (red panic button)

#### Mutation: `updateVenueDescription`

- **Input:** `{ description: string }`
- **Output:** `{ success: boolean; description: string; message: string }`
- **Responsibility:** Update venue card description text
- **Mutation Pattern:**
  ```typescript
  UPDATE venues
  SET description = input.description, updated_at = NOW()
  WHERE id = ctx.venue.venueId
  ```
- **Validation:**
  - Length: 1-500 chars
  - Sanitize HTML (strip tags, allow safe markdown or plain text)
  - No SQL injection (Drizzle parameterized query handles this)
- **Audit:** Optional: INSERT into audit_log
- **Used By:** `/venue/dashboard/venue-card` (form submit)

#### Mutation: `updatePriceDisplay`

- **Input:**
  ```typescript
  {
    mode: 'queue_skip_only' | 'includes_entry_fee';
    entryFee?: string (numeric decimal);
  }
  ```
- **Output:** `{ success: boolean; mode: string; entryFee: string | null; message: string }`
- **Responsibility:** Update display mode + entry fee field
- **Mutation Pattern:**
  ```typescript
  UPDATE venues
  SET price_display_mode = input.mode,
      entry_fee = input.entryFee,
      updated_at = NOW()
  WHERE id = ctx.venue.venueId
  ```
- **Validation:**
  - mode must be one of allowed values
  - entryFee >= 0, <= 999.99 (if provided and mode includes entry fee)
- **Audit:** Optional: INSERT into audit_log
- **Used By:** `/venue/dashboard/venue-card` (form submit)

#### Mutation: `confirmUpload`

- **Input:**
  ```typescript
  {
    storagePath: string; // e.g., "venue-abc-123/1707520400000_cover.jpg" (storage path only, no full URL)
  }
  ```
- **Output:** `{ success: boolean; storagePath: string; message: string }`
- **Responsibility:** Save storage path to venues.cover_image_path after client-side direct upload succeeds
- **Mutation Pattern:**
  ```typescript
  UPDATE venues
  SET cover_image_path = input.storagePath,  -- Store only the path, not full URL
      updated_at = NOW()
  WHERE id = ctx.venue.venueId
  ```
- **Important:** Public URLs are derived at render time using `SUPABASE_PUBLIC_URL + cover_image_path`. Never store full URLs in the database.
- **Validation:**
  - Verify storagePath starts with `{ctx.venue.venueId}/` (prevent cross-venue overwrites)
  - Verify file exists in storage (optional, but recommended)
  - Throw error if path validation fails
- **Used By:** `/venue/dashboard/venue-card` (after direct browser upload completes)

### Procedure Registration

In `src/server/api/root.ts`:

```typescript
export const appRouter = router({
  auth: authRouter,
  venue: venueRouter,
  transaction: transactionRouter,
  stripe: stripeRouter,
  email: emailRouter,
  price: priceRouter,
  venueManager: venueManagerRouter,
  // ... others
});
```

---

## Part 4: Data Flow & Security

### End-to-End Auth Flow

```
1. User @ /venue/login
   ↓ enters email + password
   ↓ calls supabase.auth.signInWithPassword()

2. Supabase returns session + access_token (JWT)
   ↓ browser stores token in Supabase auth state
   ↓ redirects to /venue/dashboard

3. /venue/dashboard layout (server component)
   ↓ validates JWT from request context (implementation-agnostic: may use cookies via auth helpers or headers)
   ↓ calls Supabase.auth.getUser(accessToken)
   ↓ confirms user exists + is active
   ↓ if invalid → redirect to /venue/login

4. tRPC context setup (on every API call)
   ↓ Client attaches access_token to request (headers or auth context)
   ↓ Server venueManagerProcedure middleware validates token
   ↓ Queries venue_managers table (RLS enforces user_id match)
   ↓ Injects ctx.venue = { userId, email, venueId }
   ↓ Throws UNAUTHORIZED if validation fails

5. Downstream tRPC procedure
   ↓ Uses ctx.venue.venueId (NEVER client input)
   ↓ Queries tables (RLS scopes to venue)
   ↓ Returns data or error

6. Client receives response
   ↓ Updates React state
   ↓ Displays in UI
```

### RLS Policy Reference (✅ Already Applied)

**Status:** RLS is enabled on all relevant tables and has been tested end-to-end. The policies below serve as reference documentation and a security audit trail. Do NOT redefine or reapply these policies unless explicitly required by a Supabase migration.

**Key Property:** RLS acts as a **backup security layer**. The primary gatekeeper is `venueManagerProcedure` middleware (which validates JWT and resolves venue_id from auth context). RLS ensures that even if tRPC logic has a bug, database-level security prevents unauthorized data access.

#### Applied Policies (Reference)

```sql
CREATE POLICY "manager_read_own"
  ON venue_managers
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Purpose:** Venue manager can read only their own mapping.

#### Table: `venues`

```sql
CREATE POLICY "manager_read_own_venue"
  ON venues
  FOR SELECT
  USING (
    id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "manager_update_own_venue"
  ON venues
  FOR UPDATE
  USING (
    id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );
```

**Purpose:** Venue manager can read/update only their assigned venue.

#### Table: `transactions_log`

```sql
CREATE POLICY "manager_read_venue_transactions"
  ON transactions_log
  FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );
```

**Purpose:** Manager can read transactions only for their venue.

#### Table: `qs_config_days` & `qs_config_hours`

```sql
CREATE POLICY "manager_read_own_config"
  ON qs_config_days
  FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "manager_update_own_config"
  ON qs_config_days
  FOR UPDATE
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    )
  );

-- Similar for qs_config_hours
```

**Purpose:** Manager can read/update configuration for their venue only.

#### Storage: `venue-covers` Bucket

**⚠️ SECURITY-CRITICAL: RLS-scoped by venue folder**

```sql
-- Authenticated users can upload to their own venue folder only
CREATE POLICY "manager_upload_own_venue"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'venue-covers'
    AND (
      SELECT venue_id FROM venue_managers WHERE user_id = auth.uid()
    ) = (string_to_array(name, '/'))[1]  -- First part of path = venue_id
  );

-- Public read (anon + authenticated)
CREATE POLICY "public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'venue-covers');
```

**Purpose:** Manager can upload ONLY to their own venue folder (e.g., `venue-abc-123/...`). Path isolation enforced by RLS, not application logic. Public read for displaying covers.

**Path Format:** `{venue_id}/{timestamp}_{filename}` (e.g., `venue-abc-123/1707520400000_cover.jpg`)

---

### Key Security Properties

| Property             | Mechanism               | Enforcer             |
| -------------------- | ----------------------- | -------------------- |
| Only see own venue   | `venue_managers` RLS    | Auth header + DB RLS |
| Only write own venue | `venues` RLS + tRPC     | Same                 |
| No client venue_id   | tRPC context injection  | Middleware           |
| No admin escape      | `venueManagerProcedure` | Middleware           |
| No storage hijack    | RLS paths + signed URLs | Supabase Storage     |
| Transacted updates   | Drizzle + tRPC          | Server layer         |

---

## Part 5: UI & Styling Conventions

### Styling Approach: Tailwind CSS

**Why:** Existing repo uses Tailwind + ShadCN. Consistent with codebase.

### Layout Structure

```
/venue/dashboard/ (layout)
├── Navbar (top)
│   ├── Logo / "Venue Manager Dashboard"
│   ├── Venue Name (from summary)
│   └── Sign Out button
├── Sidebar (left)
│   ├── Transactions
│   ├── Queue Skip Settings
│   │── Venue Profile
│   └── (Divider)
├── Main content (flex-1)
│   ├── Route-specific component
│   └── Breadcrumbs optional
└── Footer (optional)
    └── Feedback link or version
```

### Component Design Principles

#### Presentational Components

- Accept all data via props (no tRPC calls)
- Pure function rendering
- Example: `TransactionTable`, `DayTimePicker`, `PriceSlider`

#### Data Components (Pages)

- Load data from tRPC on mount / effect
- Manage polling via React Query `refetchInterval`
- Pass data + handlers to presentational children
- Example: `/venue/dashboard/transactions/page.tsx`

#### Form Components

- Use React Hook Form for state management
- Uncontrolled inputs (ref-based) preferred for performance
- Validation on submit, not onChange
- Show loading spinner during mutation
- Toast notifications: success / error

#### Buttons & Actions

- **Primary Action:** Filled blue button (save, submit)
- **Secondary Action:** Outlined button (cancel, reset)
- **Danger Action:** Red filled button (panic off)
- **Loading State:** Disabled + spinner
- **Confirmation:** Modal dialog (especially panic off)

### Specific Patterns

#### Transaction Table

```
Columns:
- Date (formatted)
- Name
- Email
- Status (badge: green=paid, yellow=pending, red=failed)
- Amount ($)

Actions:
- Pagination controls below
- Filters above (date range, toggle paid-only)
- Export CSV button (top-right)
```

#### Queue Skip Configuration

```
Section 1: Price
  Input: number (slider or text)
  Unit: $ per skip
  Save button

Section 2: Days & Times
  Layout: List of days (M-Tu-W-Th-F-Sa-Su)
  For each day:
    - Checkbox: enabled/disabled
    - Slots per hour: input
    - Time windows: list with +/- buttons
      * Start time (HH:MM)
      * End time (HH:MM)
      * Custom slots (optional)
  Save button

Section 3: Panic Off
  Big red button + scary icon
  Confirmation modal:
    "Are you sure? Queue skips will be blocked immediately."
    [Cancel] [Yes, disable]
```

#### Venue Profile

```
Section 1: Cover Image
  Current: preview
  Action: Upload new (drag-drop)
  Progress bar: during upload

Section 2: Description
  Text area (3-4 lines)
  Character count: X / 500
  Save button

Section 3: Price Settings
  Radio buttons:
    - [ ] Queue skip only
    - [ ] Queue skip + $X entry fee
  (Conditional) Entry fee input
  Save button
```

---

## Part 6: Feature Development Phases

---

### Phase 1: Dashboard Shell & Layout (NOW — Current Work)

**Objective:** Productize the proof-of-concept auth foundation into a clean dashboard shell.

**Completed:**

- ✅ `/venue/login` page with Supabase Auth
- ✅ `/venue/dashboard` layout (server-side auth guard)
- ✅ Database schema (venue_managers, venue columns)
- ✅ RLS policies (all tables + storage, applied and tested)
- ✅ tRPC baseline (`venueManagerProcedure`, `getVenueSummary`)
- ✅ Auth proof-of-concept (whoami test showing JWT → RLS works)

**Remaining Work:**

1. Refactor `/venue/dashboard/page.tsx`:
   - Decision: Redirect to transactions OR show summary overview
   - **Recommendation:** Redirect for simplicity, build summary later if needed
2. Create stub pages (empty shells):
   - `/venue/dashboard/transactions/page.tsx`
   - `/venue/dashboard/queue-skip/page.tsx`
   - `/venue/dashboard/venue-card/page.tsx`
3. Add navigation components:
   - Navbar (venue name, logout button)
   - Sidebar (links to 3 sections)
   - Consistent layout wrapper
4. Polish:
   - Logout flow (clear session, redirect to login)
   - Loading states + error boundaries
   - Mobile responsiveness
   - Auth error messaging (invalid creds, session expired)

**Testing:**

- [ ] All routes accessible after login
- [ ] Navigation works between stub pages
- [ ] Logout → session cleared → redirected to login
- [ ] Unauthorized access → redirected to login
- [ ] Session persists across reloads (within same browser tab)
- [ ] Mobile layout responsive

**Done Criteria:**

- Clean dashboard shell ready for feature work
- Auth boundary solid and tested
- Routes prepared for Phase 2+

---

### Phase 2: Transaction Log (Next After Phase 1)

**Objective:** Build live transaction view with filtering and export.

**Deliverables:**

1. `/venue/dashboard/transactions` page
   - React Query polling (5s interval)
   - Pause polling when tab hidden
   - Dynamic filtering
2. Components:
   - `TransactionTable` (presentational)
   - `TransactionFilters` (date range, paid-only toggle, search)
   - Pagination (25/50/100 rows)
   - Export button (client-side CSV)
3. tRPC procedures:
   - `getTransactionLogs` (with filters, pagination)
4. Utilities:
   - CSV export helper
   - Date/currency formatters

**Testing:**

- [ ] Load 100+ transactions without lag
- [ ] Polling at 5s intervals (network tab check)
- [ ] Polling pauses when tab hidden
- [ ] Filters: date range, paid-only, search all work
- [ ] Pagination accurate
- [ ] Export CSV has correct format
- [ ] Request with date range > 31 days is rejected or clamped
- [ ] Request with limit > 1000 returns max 1000 rows
- [ ] Server-side constraints enforced (test by sending invalid client input)

**Done Criteria:**

- Transactions visible and filterable
- Polling responsive without server overload
- Export works correctly
- Data constraints (1000 rows, 31-day range) enforced server-side

---

### Phase 3: Queue Skip Configuration + Panic Off

**Objective:** Enable managers to update pricing and emergency stop sales.

**Deliverables:**

1. `/venue/dashboard/queue-skip` page
   - Current config display
   - Edit form: price, days, times
   - Panic off toggle (big red button + confirmation modal)
2. Components:
   - `ConfigForm`, `PriceSlider`, `DayTimePicker`, `PanicOffButton`
3. tRPC procedures:
   - `updateQueueSkipPrice`
   - `getQueueSkipConfig`
   - `updateQueueSkipConfig`
   - `setPanicOff` (+ audit log)
4. Queue API enforcement:
   - Check `venues.queue_skip_enabled` before accepting purchases
   - Return clear error if disabled

**Testing:**

- [ ] Price changes persist
- [ ] Config changes (add/remove days/times) work
- [ ] Panic off blocks new purchases immediately
- [ ] Existing queue skips remain valid after panic
- [ ] Confirmation modal prevents accidental toggle
- [ ] Audit log created for panic changes

**Done Criteria:**

- Pricing and config fully editable
- Panic off works as emergency stop
- Audit trail captures state changes

---

### Phase 4: Venue Profile Editor + Image Upload

**Objective:** Enable managers to update venue card and cover image.

**Deliverables:**

1. `/venue/dashboard/venue-card` page
2. Components:
   - `ProfileForm` (description, entry fee, price mode)
   - `ImageUpload` (file input + progress)
   - `PreviewCard` (live preview of card)
3. Upload workflow:
   - Client validates file type/size locally (JPG/PNG, < 5MB)
   - Client uploads directly to Supabase Storage `venue-covers` using anon key + JWT session
   - Supabase Storage RLS validates path starts with `{venue_id}/` before accepting upload
   - `confirmUpload` tRPC mutation stores storage path (not full URL) in DB
   - Client renders public URL at display time using `SUPABASE_URL + path`
4. tRPC procedures:
   - `updateVenueDescription`
   - `updatePriceDisplay`
   - `confirmUpload` (saves path only, validates storagePath starts with venue_id)
5. Storage:
   - Bucket: `venue-covers` (public read, auth write via RLS)
   - Path scoping: RLS enforces {venue_id}/\* isolation at storage layer
   - Client-side upload: anon key + JWT session, file validated before sending

**Testing:**

- [ ] Direct browser upload < 5MB → succeeds (bypasses server)
- [ ] Direct browser upload > 5MB → rejected by client validator
- [ ] Invalid file type → rejected by client validator
- [ ] Progress bar updates during upload
- [ ] Storage path stored in DB (not full URL), via confirmUpload
- [ ] Public URL accessible without auth (derived from path + base URL)
- [ ] Manager A cannot upload to Venue B folder (RLS test at Supabase Storage level)
- [ ] confirmUpload rejects paths not starting with current venue_id
- [ ] Description/fee fields persist

**Done Criteria:**

- Images uploadable and displayable
- Storage isolated by venue at RLS level
- Profile fields all editable

---

### Phase 5: QA, Performance & Polish

**Objective:** Production hardening and documentation.

**Work:**

1. Security testing:
   - RLS isolation: Manager A cannot see Manager B data
   - Session expiry: token invalidation → forced re-login
   - Storage isolation: cross-venue upload attempts blocked
   - All mutations logged/audited
2. Performance:
   - React Query cache/stale times optimized
   - Polling doesn't overwhelm server
   - Image loading optimized
   - No memory leaks
3. Error handling:
   - Error boundaries around each feature
   - Graceful fallbacks (loading, error states)
   - Clear user messages
4. Accessibility:
   - ARIA labels on inputs
   - Keyboard navigation (tab order)
   - Color contrast checks
5. Documentation:
   - Developer guide (adding procedures)
   - Runbook (common ops: user creation, permissions)
   - User guide (screenshots, workflows)

#### Testing Checklist

- [ ] Login as Manager A → see only Manager A's venue
- [ ] Login as Manager B → see only Manager B's venue
- [ ] Manager A cannot access Manager B's transactions (RLS test)
- [ ] Session expiry → force re-login
- [ ] Upload image, then check coverage with browser dev tools (public/private)
- [ ] Panic off → blocks new queue skip purchases within 1 second
- [ ] Undo panic off → queue skips can be purchased again
- [ ] Export transactions → CSV has correct format and data
- [ ] Polling pauses when tab hidden (check network tab)
- [ ] All mutations create audit log entries
- [ ] Form validation catches all invalid inputs
- [ ] Error messages are clear and actionable
- [ ] Mobile responsiveness (sidebar collapses on small screens)

#### Deployment Checklist

- [ ] All environment variables documented in `.env.example`
- [ ] Database migrations run successfully
- [ ] RLS policies applied to production DB
- [ ] Storage bucket created with correct RLS
- [ ] Supabase Auth enabled with email/password
- [ ] CORS configured for production domain
- [ ] Stripe webhook (if payment integration needed)
- [ ] Email notifications tested
- [ ] Analytics / logging set up
- [ ] Monitoring alerts configured

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (Venue Manager)                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ /venue/login                      /venue/dashboard/               │
│ [Email] [Password] [Sign In]      ├─ transactions/               │
│     ↓                              ├─ queue-skip/                │
│     └─→ supabase.auth.signInWithPassword()  ├─ venue-card/      │
│         (browser-side, no server)  │         ↓                    │
│                                   │ [React Components]            │
│         ← session + access_token  │ [React Query polling]        │
│         (stored in browser)       │ [Supabase Storage upload]    │
│                                    │                              │
└─────────────────────────────────────────────────────────────────┘
                    ↓ HTTP + Authorization header
┌─────────────────────────────────────────────────────────────────┐
│ Next.js Server (tRPC Handlers)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ /api/trpc/[trpc]                                                 │
│  ├─ Extract Authorization: Bearer {JWT}                          │
│  ├─ Call venueManagerProcedure middleware:                       │
│  │   ├─ supabase.auth.getUser(token)                            │
│  │   ├─ Query venue_managers table (RLS enforced)               │
│  │   └─ Inject ctx.venue = { userId, email, venueId }           │
│  ↓                                                                │
│ venueManagerRouter                                               │
│  ├─ getVenueSummary(ctx.venue.venueId)                          │
│  ├─ getTransactionLogs(filter, dateRange, ..., ctx.venue)       │
│  ├─ updateQueueSkipPrice(price, ctx.venue)                      │
│  ├─ setPanicOff(enabled, ctx.venue) → audit_log INSERT         │
│  ├─ updateVenueDescription(desc, ctx.venue)                     │
│  ├─ confirmUpload(path, ctx.venue)                              │
│              ↓                                                    │
│            [Drizzle ORM queries]                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                    ↓ SQL + RLS validation
┌─────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres + RLS + Storage)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Tables (all with RLS policies):                                 │
│  ├─ venue_managers (user_id → venue_id mapping)               │
│  ├─ venues (price, config, cover_image_path, etc.)             │
│  ├─ transactions_log (user's purchases)                         │
│  ├─ qs_config_days / qs_config_hours (day/time config)         │
│  └─ audit_log (config changes)                                  │
│                                                                   │
│ Storage:                                                         │
│  └─ venue-covers/ (public read, auth write, RLS-scoped paths)  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist (Quick Ref)

### ✅ Foundation (Completed)

- [x] Database schema (venue_managers, venue columns, audit_log)
- [x] RLS policies (all tables + storage, tested)
- [x] Supabase Auth (email/password, redirect URLs)
- [x] CORS configured
- [x] `venueManagerProcedure` middleware
- [x] `/venue/login` + `/venue/dashboard` layout
- [x] Auth flow proof-of-concept (whoami test)

### Phase 1: Dashboard Shell (NOW)

- [ ] Refactor `/venue/dashboard/page.tsx` (redirect or summary)
- [ ] Create stub pages (transactions, queue-skip, venue-card)
- [ ] Add navbar + sidebar components
- [ ] Test: routing, logout, error handling

### Phase 2: Transaction View

- [ ] Transaction table component
- [ ] Filtering (date, paid-only, search)
- [ ] Pagination controls
- [ ] React Query polling (5s, pause when hidden)
- [ ] CSV export helper
- [ ] `getTransactionLogs` tRPC procedure
- [ ] Test: polling, filtering, pagination

### Phase 3: Queue Skip Config + Panic

- [ ] Queue config form (price, days, times)
- [ ] Panic off button (big red + confirmation)
- [ ] `updateQueueSkipPrice`, `updateQueueSkipConfig`, `setPanicOff` procedures
- [ ] Queue API check for `queue_skip_enabled`
- [ ] Audit log for panic toggle
- [ ] Test: config changes, panic enforcement

### Phase 4: Venue Profile + Image Upload

- [ ] Profile form (description, entry fee, price mode)
- [ ] Image upload component (file input, progress)
- [ ] Server-side upload (tRPC mutation)
- [ ] `uploadCoverImage`, `updateVenueDescription`, `updatePriceDisplay`, `confirmUpload` procedures
- [ ] Storage isolation by venue (RLS)
- [ ] Test: upload, storage isolation, public access

### Phase 5: QA & Polish

- [ ] RLS isolation testing (Manager A/B separation)
- [ ] Session security (expiry, reauthentication)
- [ ] Error boundaries + graceful failures
- [ ] Accessibility (ARIA, keyboard nav)
- [ ] Performance tuning (React Query, polling)
- [ ] Documentation (developer guide, runbook, user guide)
- [ ] Deploy to staging, then production

---

## Core Constraints & Assumptions

These are locked in and must not be violated during implementation:

1. **Auth:** Supabase Auth (email/password only), not social or multi-factor.
2. **Venue Scope:** One venue per manager. No multi-venue switching.
3. **Database Access:** 100% server-side via tRPC + Drizzle. Zero client-side `.from()` calls.
4. **Venue Identity:** venueId is ALWAYS derived from auth context (ctx.venue.venueId). NEVER from client input.
5. **RLS:** Postgres RLS is a backstop security layer. Do NOT bypass or replace with application logic.
6. **Storage (MVP):** Direct authenticated browser upload to Supabase Storage bucket `venue-covers`. Client uploads using anon key + JWT session. RLS enforces path isolation by venue_id. Client calls `confirmUpload` tRPC mutation to store path (not URL) in DB.
7. **Data Constraints:** Transaction queries limited to 1000 rows per request. Date range queries limited to 31 days max. Enforced server-side in `getTransactionLogs`.
8. **Polling:** React Query with 5-second intervals. Pause when tab hidden. No WebSocket.
9. **Exports:** Client-side CSV generation only. No server-side bulk export.
10. **Audit:** Optional for MVP. Panic off mutations are MANDATORY to log.
11. **Scope:** Venue managers dashboard only. This is NOT a master admin panel.

---

## Next Immediate Steps

1. **Complete Phase 1 polish:**

   - Refactor `/venue/dashboard/page.tsx` (redirect to transactions)
   - Create 3 stub pages (empty shells)
   - Add navbar + sidebar

2. **Begin Phase 2:**

   - Implement transaction log with filtering
   - Build React Query polling + tab visibility pause
   - Create CSV export utility

3. **Testing:**
   - Verify all Phase 1 routes render
   - Test logout flow
   - Confirm RLS isolation (Manager A cannot see Manager B data)

---

**End of Implementation Plan**
