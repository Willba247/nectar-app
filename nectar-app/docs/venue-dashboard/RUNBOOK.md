# Venue Dashboard — Runbook

## Table of Contents

1. [Creating a New Venue Manager Account](#creating-a-new-venue-manager-account)
2. [Resetting a Manager's Password](#resetting-a-managers-password)
3. [Deactivating / Reactivating a Manager](#deactivating--reactivating-a-manager)
4. [Debugging Common Issues](#debugging-common-issues)
5. [Database Maintenance](#database-maintenance)
6. [Monitoring and Alerts](#monitoring-and-alerts)

---

## Creating a New Venue Manager Account

### Prerequisites

- The venue must already exist in the `venues` table
- Access to the Supabase dashboard (or Supabase CLI)

### Steps

1. **Create the Supabase auth user:**

   In the Supabase dashboard → Authentication → Users → "Add user":

   - Email: the manager's email
   - Password: a temporary password (manager should reset)
   - Enable "Auto Confirm" (or send confirmation email)

   Note the generated `user_id` (UUID).

2. **Insert into `venue_managers` table:**

   ```sql
   INSERT INTO venue_managers (user_id, venue_id, email, is_active)
   VALUES (
     '<supabase-user-uuid>',
     '<venue-id>',            -- Must match venues.id
     '<manager-email>',
     true
   );
   ```

3. **Verify:**
   - Manager logs in at `/venue/login`
   - Dashboard shows their venue name
   - Transactions, queue skip config, and venue profile all load correctly

### Important Constraints

- **One manager per venue** — `venue_id` has a UNIQUE constraint on `venue_managers`
- **One venue per manager** — `user_id` has a UNIQUE constraint on `venue_managers`
- **Venue ID is never from the client** — always derived from auth context

---

## Resetting a Manager's Password

### Via Supabase Dashboard

1. Go to Authentication → Users
2. Find the user by email
3. Click the user → "Send password reset email"

### Via SQL (Emergency)

If the manager has no email access, update password directly:

1. In Supabase dashboard → SQL Editor:

   ```sql
   -- This uses Supabase's internal auth function
   -- Only use in emergencies. The manager should change it immediately after.
   SELECT auth.change_user_password('<user-uuid>', '<new-temporary-password>');
   ```

2. Communicate the temporary password securely to the manager.

---

## Deactivating / Reactivating a Manager

### Deactivate

```sql
UPDATE venue_managers
SET is_active = false
WHERE email = '<manager-email>';
```

Effects:

- Manager is immediately logged out on next API call
- Dashboard layout redirects to `/venue/login`
- `venueManagerProcedure` middleware rejects requests with `UNAUTHORIZED`

### Reactivate

```sql
UPDATE venue_managers
SET is_active = true
WHERE email = '<manager-email>';
```

No additional steps needed — manager can log in immediately.

---

## Debugging Common Issues

### Manager Cannot Log In

| Symptom                                               | Likely Cause                                        | Fix                                                  |
| ----------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| "Invalid login credentials"                           | Wrong email/password                                | Reset password (see above)                           |
| Successful auth but redirected back to `/venue/login` | No `venue_managers` row                             | Insert row (see creating account)                    |
| Successful auth but sees 404                          | `venue_managers` row exists but `is_active = false` | Reactivate the manager                               |
| Successful auth but "System error"                    | Venue doesn't exist in `venues` table               | Verify `venues.id` matches `venue_managers.venue_id` |

### Dashboard Shows No Data

| Symptom                  | Likely Cause                | Fix                                         |
| ------------------------ | --------------------------- | ------------------------------------------- |
| Transactions table empty | No records for this venue   | Verify `transactions_log.venue_id` matches  |
| Queue skip config empty  | No `qs_config_days` rows    | Manager needs to add days via the config UI |
| "Failed to load" error   | RLS policy blocking queries | Check RLS policies on affected tables       |

### Checking RLS Policies

All dashboard queries use an RLS-enforced Supabase client. If data isn't showing:

```sql
-- Check that RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies for a specific table
SELECT * FROM pg_policies WHERE tablename = 'transactions_log';

-- Test as a specific user (use their JWT access token)
SET request.jwt.claim.sub = '<user-uuid>';
SELECT * FROM transactions_log WHERE venue_id = '<venue-id>';
```

### tRPC Errors in Browser Console

| Error Code              | Meaning                              | Fix                                          |
| ----------------------- | ------------------------------------ | -------------------------------------------- |
| `UNAUTHORIZED`          | No valid session or inactive manager | Re-login or check `venue_managers.is_active` |
| `INTERNAL_SERVER_ERROR` | Server-side exception                | Check server logs for stack trace            |
| `BAD_REQUEST`           | Input validation failed (Zod)        | Check the `zodError` field in the response   |

### Auth Token Issues

The auth flow uses two token sources (in order of priority):

1. **Authorization header** (Bearer token) — preferred path via tRPC client
2. **Supabase auth cookie** (fallback) — extracted from `sb-*-auth-token` cookie

Dev logs show token source stats:

```
[AUTH] Token source: header | Stats: header=42, cookie=0
```

If `cookie` count is climbing, the tRPC client may not be sending the auth header properly.

---

## Database Maintenance

### Audit Log

All dashboard mutations are logged to `audit_log`:

```sql
-- View recent audit entries for a venue
SELECT action, changes, created_at
FROM audit_log
WHERE venue_id = '<venue-id>'
ORDER BY created_at DESC
LIMIT 50;
```

Actions logged include: price changes, queue skip config updates, panic on/off, profile updates.

### Cleaning Old Transaction Logs

Transaction logs grow over time. To archive old records:

```sql
-- Count records older than 90 days
SELECT count(*) FROM transactions_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive to a backup table (create first)
CREATE TABLE IF NOT EXISTS transactions_log_archive (LIKE transactions_log INCLUDING ALL);

INSERT INTO transactions_log_archive
SELECT * FROM transactions_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete archived records
DELETE FROM transactions_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Cleaning Expired Queue Entries

Pending queue entries have an `expires_at` timestamp. Clean up expired ones:

```sql
DELETE FROM queue
WHERE payment_status = 'pending'
AND expires_at < NOW();
```

### Schema Migrations

Migrations are managed by Drizzle Kit:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (dev only, no migration files)
npx drizzle-kit push
```

Migration files are stored in `drizzle/` and tracked in `drizzle/meta/_journal.json`.

---

## Monitoring and Alerts

### Key Metrics to Watch

- **Auth failures:** Spikes in `UNAUTHORIZED` errors may indicate token issues or brute-force attempts
- **Cookie fallback rate:** Should stay at ~0 during normal operation (logged in dev mode)
- **tRPC execution times:** Logged for every procedure call (`[TRPC] path took Xms`)
- **Transaction volume:** Sudden drops may indicate Stripe webhook issues

### Health Checks

- **App health:** Visit the homepage — if it loads, Next.js is running
- **Supabase connectivity:** Dashboard layout auth check validates Supabase on every page load
- **Stripe connectivity:** Stripe procedures will throw `INTERNAL_SERVER_ERROR` if keys are invalid

### Log Locations

- **Server logs:** Visible in the terminal running `npm run dev` or in hosting provider logs (Vercel, etc.)
- **Supabase logs:** Supabase dashboard → Logs → Edge Functions / Auth / Database
- **Stripe logs:** Stripe dashboard → Developers → Logs
