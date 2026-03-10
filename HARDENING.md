# TimeTrack MVP — Hardening & Deployment Guide

---

## 1. Hardening Recommendations

### 1.1 Issues Found and Fixed in This Pass

| # | Area | Issue | Fix Applied |
|---|---|---|---|
| 1 | **Error handling** | No global error boundary — unhandled render errors produce a white screen | Added `ErrorBoundary` component wrapping `<App />` in `main.tsx` |
| 2 | **Animation** | Toast references `animate-[slideIn_0.2s_ease-out]` keyframe but it was never defined in CSS | Added `@keyframes slideIn` to `index.css` |
| 3 | **Dialog styling** | Native `<dialog>` has browser-default border/padding that leaks through in some browsers | Added `dialog { border: none; padding: 0; }` and `dialog::backdrop` rules to `index.css` |
| 4 | **Report query performance** | `useReportingPeriods` fetched ALL time entries for matched customer IDs with no date scoping — pulls entire history | Scoped the entry fetch to `gte(earliestMonth)` / `lt(endDate)` covering only the visible reporting periods |

### 1.2 Remaining Recommendations (Not Code-Changed, But Important)

#### Validation gaps

- **Time entry date lower bound**: The Zod schema prevents future dates but not unreasonably old ones. Consider adding a `.refine()` that rejects dates more than 1 year in the past, or make this configurable. Exact rule depends on business policy.
- **Duration edge case**: `duration_minutes` allows 1440 (24h in a single entry). This is technically valid but worth flagging in the UI with a soft warning like "This entry is 24 hours — is that correct?" if the business wants a sanity check.
- **Customer name whitespace**: The `customerSchema` trims on submission via `.trim()` in the hook, but doesn't reject whitespace-only names. The Zod `.min(1)` check runs before the hook trims. To fix: add `.trim()` as a Zod transform before `.min(1)`, or rely on the hook-level trim (which is what currently happens — a name of `"   "` would be trimmed to `""` and fail the DB NOT NULL constraint).

#### Loading and error states

- **Query error display**: The pages show loading spinners but don't have a visible error state when a query fails after retry. TanStack Query exposes `isError` and `error` on every query. Each page should add a condition like:
  ```tsx
  if (isError) return <ErrorMessage message="Failed to load data. Please try again." />;
  ```
  This is a mechanical change across all pages — check `isError` from each `useQuery` call and render an error panel.

- **Mutation error propagation**: All mutations already catch errors and show toasts, which is correct for most cases. No change needed.

#### Access control completeness

- **Route protection**: The current setup is complete — `AppShell` requires authentication, `ProtectedRoute` gates on role level. The `/reports` route is open to all authenticated users including viewers, which matches the spec.
- **RLS is the real enforcement**: Frontend role checks are UX conveniences. Even if every frontend check were removed, RLS would prevent unauthorized data access. This is the correct design.
- **Domain restriction**: Not currently enforced. If the organization wants to restrict Google SSO to a specific email domain, configure it in Supabase Dashboard → Authentication → URL Configuration → Allowed Domains, or add a database trigger that checks `NEW.email LIKE '%@yourcompany.com'` on `auth.users` insert.

#### Audit field consistency

- **`created_by` / `updated_by` on time entries**: Correctly set in `useCreateTimeEntry` (both fields set to `user.id`) and `useUpdateTimeEntry` (`updated_by` set to `user.id`). The trigger-managed `updated_at` handles timestamps automatically.
- **`created_by` / `updated_by` on customers**: Set in `useCreateCustomer`, `useUpdateCustomer`, and the CSV import upsert. On upsert, the `updated_by` field is set correctly. The `created_by` field is set on INSERT but the `ON CONFLICT DO UPDATE` clause only updates name + updated_by, so `created_by` is preserved on subsequent imports. Correct behavior.
- **Taxonomy tables**: These tables don't have `created_by`/`updated_by` columns in the schema (intentional — they're simple reference data managed only by admins). The `updated_at` trigger covers temporal auditing.

#### Approval locking consistency

- **Three-layer enforcement is complete**: Database RLS (`is_period_locked`), hook error translation (catches `42501`), UI lock indicators (disabled buttons + lock icons). All three layers agree.
- **Admin bypass is intentional**: Admin users bypass `is_period_locked` in the RLS policy. The `updated_by` field records who made the change. This is correct — admins need to fix errors in approved periods.
- **Status transition trigger**: The `trg_validate_period_status_transition` trigger prevents invalid transitions like `draft → approved` (must go through `in_review`). The frontend enforces the same rules by only showing valid transition buttons. If the trigger rejects, the mutation throws and the hook shows a toast.

#### CSV import safety

- **File size limit**: 5MB enforced client-side before parsing. Supabase PostgREST has a default body size limit of ~2MB for single requests. For large imports (>1000 rows), the upsert payload could exceed this. Recommendation: for production, add batch chunking (500 rows per upsert call) in `useCustomerImport`. For MVP with typical file sizes (<500 customers), the current single-call approach works.
- **SQL injection**: Not a risk — Supabase's `.upsert()` parameterizes values. The CSV data never touches raw SQL.
- **XSS via customer names**: Customer names are rendered via React JSX which auto-escapes HTML. No risk of stored XSS even if a CSV contains `<script>` tags in the name field.

#### Report query performance

- **`get_monthly_report` RPC**: This function queries a single month for a single customer with indexed columns. Even at 10,000 entries per customer per month, this is a sub-second query. No materialized views needed.
- **Reporting periods list** (fixed in this pass): The entry fetch for aggregating hours/counts is now scoped to the date range of displayed periods instead of pulling all history for matched customers.
- **Supabase PostgREST default limit**: Supabase returns at most 1000 rows by default. For the time entries list, this means a user with >1000 entries in their filtered range will get truncated results. For MVP this is acceptable. For production, add `.limit(1000)` explicitly and show a "showing first 1000 entries" message, or implement server-side pagination.

#### Usability rough edges

- **No pagination**: The My Entries and Review pages display all results without pagination. For MVP volumes (<500 entries per user per month), this is fine. The architecture supports adding TanStack Table pagination later without restructuring.
- **No keyboard shortcut for quick entry**: Consultants logging time daily would benefit from Ctrl+Enter to submit the form. This is a small enhancement — add `onKeyDown` on the form that triggers submit on Ctrl+Enter.
- **Month picker browser inconsistency**: `<input type="month">` renders differently across browsers. Chrome shows a nice picker; Firefox shows a text input. For MVP this is acceptable. A custom month picker component is a post-MVP enhancement.

---

## 2. Specific Code Adjustments Made

### 2.1 New file: `src/components/ui/ErrorBoundary.tsx`
Class-based React error boundary wrapping the entire app. Catches unhandled render errors and shows a recovery screen with the error message and a "Return to Dashboard" button.

### 2.2 Modified: `src/main.tsx`
Wrapped the provider stack with `<ErrorBoundary>`.

### 2.3 Modified: `src/index.css`
Added `@keyframes slideIn` for toast animation, and `dialog` reset rules for cross-browser consistency.

### 2.4 Modified: `src/hooks/useReportingPeriods.ts`
Scoped the time entries aggregation query to only fetch entries within the date range of the displayed reporting periods, instead of fetching all entries for matched customer IDs.

---

## 3. Deployment Guide

### 3.1 Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + `.env.local` | Yes | Supabase project URL, e.g. `https://abcdef.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Yes | Supabase anonymous/public key (safe to expose client-side) |

These are the only two environment variables. The anon key is designed to be client-side — it has no special privileges. All data access is gated by RLS policies.

**Do NOT expose the Supabase `service_role` key in the frontend.** If you add an Edge Function later for CSV import, that function uses the service role key server-side only.

### 3.2 Supabase Setup Checklist

```
[ ] 1. Create a new Supabase project at https://supabase.com/dashboard
[ ] 2. Note the project URL and anon key from Settings → API
[ ] 3. Run database migrations (see section 3.6)
[ ] 4. Run seed data (taxonomy values)
[ ] 5. Enable Google OAuth provider:
       Dashboard → Authentication → Providers → Google → Enable
[ ] 6. Enter Google Client ID and Client Secret (see section 3.3)
[ ] 7. Copy the Supabase callback URL shown in the Google provider settings
[ ] 8. Optional: restrict email domain
       Dashboard → Authentication → URL Configuration → Allowed Domains
       Add: yourcompany.com
[ ] 9. Set site URL:
       Dashboard → Authentication → URL Configuration → Site URL
       Set to: https://your-app.vercel.app (or localhost:5173 for dev)
[ ] 10. Add redirect URLs:
        Dashboard → Authentication → URL Configuration → Redirect URLs
        Add: https://your-app.vercel.app/**
        Add: http://localhost:5173/** (for dev)
[ ] 11. Verify RLS is enabled on all tables:
        Dashboard → Database → Tables → each table should show "RLS enabled"
```

### 3.3 Google SSO Setup Checklist

```
[ ] 1. Go to https://console.cloud.google.com
[ ] 2. Create a new project (or use existing)
[ ] 3. Enable the Google+ API (or Google Identity API)
[ ] 4. Go to APIs & Services → Credentials
[ ] 5. Create OAuth 2.0 Client ID:
       - Application type: Web application
       - Name: TimeTrack
       - Authorized JavaScript origins:
           https://your-app.vercel.app
           http://localhost:5173
       - Authorized redirect URIs:
           https://<your-project>.supabase.co/auth/v1/callback
[ ] 6. Copy Client ID and Client Secret
[ ] 7. Paste into Supabase Dashboard → Authentication → Providers → Google
[ ] 8. Configure OAuth consent screen:
       - User type: Internal (if Google Workspace) or External
       - App name: TimeTrack
       - Authorized domains: your-app.vercel.app, supabase.co
[ ] 9. Test: sign in with a Google account in your domain
```

### 3.4 Vercel Deployment Checklist

```
[ ] 1. Install Vercel CLI: npm i -g vercel
[ ] 2. From the project root: vercel
[ ] 3. Follow prompts to link to a Vercel project
[ ] 4. Set environment variables in Vercel dashboard:
       Settings → Environment Variables
       VITE_SUPABASE_URL = https://your-project.supabase.co
       VITE_SUPABASE_ANON_KEY = your-anon-key
[ ] 5. Verify vercel.json is present with SPA rewrite rule:
       { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
[ ] 6. Deploy: vercel --prod
[ ] 7. Set custom domain (optional):
       Vercel dashboard → Domains → Add
[ ] 8. Update Supabase Site URL and Redirect URLs to match production domain
[ ] 9. Update Google OAuth authorized origins and redirect URIs
[ ] 10. Verify: open production URL, sign in, create a test entry
```

### 3.5 Local Development Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd timetrack

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 4. Start dev server
npm run dev
# Opens at http://localhost:5173

# 5. Verify: visit http://localhost:5173, sign in with Google
```

### 3.6 Migration and Seed Steps

**Option A — Supabase CLI (recommended for repeatable deployments):**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref <your-project-id>

# Create migration files from the SQL in TimeTrack_Schema_and_RLS.md
# Split into the numbered files listed in that document's appendix,
# then place them in supabase/migrations/

# Apply migrations
supabase db push

# Generate TypeScript types
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

**Option B — SQL Editor (faster for initial setup):**

```
1. Open Supabase Dashboard → SQL Editor
2. Copy each migration section from TimeTrack_Schema_and_RLS.md
3. Run them in order:
   - Extensions and utility functions
   - Profiles and roles
   - Taxonomy reference tables
   - Customers
   - Reporting periods
   - Time entries
   - Customer import logs
   - Helper functions and triggers
   - Report aggregation function
   - RLS policies (enable RLS + all policy statements)
   - Seed data (taxonomy values)
4. Verify: check each table exists in Database → Tables
5. Verify: RLS shows "enabled" on every table
```

**First admin user setup:**

After running migrations, the first user to sign in gets the `consultant` role by default (via the `on_auth_user_created` trigger). To bootstrap the first admin:

```sql
-- Run in SQL Editor after the first user signs in:
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM public.profiles
  WHERE email = 'your-admin@yourcompany.com'
);
```

---

## 4. QA Checklist

### 4.1 Authentication

```
[ ] Sign in with Google → lands on Dashboard
[ ] Sign out → redirected to /login
[ ] Revisit app after sign-out → stays on /login
[ ] Session persists across browser refresh
[ ] Session expired → redirected to /login with message
[ ] Non-organization email rejected (if domain restriction enabled)
```

### 4.2 Time Entry (Consultant)

```
[ ] Dashboard form loads with dropdowns populated
[ ] All required fields show validation errors on empty submit
[ ] Future dates rejected
[ ] Duration 0 rejected, 1 accepted, 1440 accepted, 1441 rejected
[ ] Duration shows live "Xh Ym" display
[ ] Submit creates entry → success toast → form partially resets (keeps date + customer)
[ ] Recent entries table shows the new entry
[ ] Delete entry → confirm dialog → entry removed → toast
[ ] Entry in approved period shows lock icon, not edit/delete buttons
```

### 4.3 My Entries (Consultant)

```
[ ] Table loads with current month entries
[ ] Date range filter works (change From/To → table updates)
[ ] Customer filter works
[ ] Clear filters resets to defaults
[ ] Summary bar shows correct count and total hours
[ ] Edit button opens inline form below the row
[ ] Edit form pre-fills with correct values
[ ] Update saves → toast → row updates
[ ] Cancel edit closes the inline form
[ ] Delete works with confirmation
[ ] Locked entries show lock icon and disabled actions
[ ] Editing a locked entry via stale UI → error toast from RLS
```

### 4.4 Reports (All Roles)

```
[ ] Customer dropdown populated with active customers
[ ] Month picker works
[ ] "Generate Report" disabled until customer selected
[ ] Report table shows grouped rows: service line headers + workstream rows
[ ] Service line subtotals are correct
[ ] Grand total is correct
[ ] Reporting period status badge shows correctly
[ ] Toggle weekly subtotals → week columns appear
[ ] Week columns show correct date ranges
[ ] Zero-hour cells show "—"
[ ] CSV export downloads file with correct name format
[ ] CSV content matches the table (including weekly columns if active)
[ ] Empty report shows appropriate empty state
```

### 4.5 Manager Review

```
[ ] Review page shows reporting periods
[ ] Month filter works
[ ] Customer filter works
[ ] Status chip toggles filter correctly
[ ] Draft period → "Submit" button visible → transitions to In Review
[ ] In Review period → "Approve" and "Return" buttons visible
[ ] Approve → confirmation dialog → status changes to Approved
[ ] Approved period → lock icon in status badge
[ ] Only admins see "Reopen" button on approved periods
[ ] Click chevron → navigates to detail view
```

### 4.6 Review Detail

```
[ ] Period header shows customer name, month, status, hours, entry count
[ ] Entries table shows all consultants' entries for that period
[ ] Summary sidebar shows correct hours by service line/workstream
[ ] Status action buttons match the current status
[ ] Approve → entries become locked (verify in My Entries page)
[ ] "Back to Review" link works
```

### 4.7 Admin: Customers

```
[ ] Customer table loads with list
[ ] Search filters by name and external account ID
[ ] "Show Archived" toggle reveals archived customers
[ ] Add Customer → dialog → fill fields → Create → appears in list
[ ] Duplicate external_account_id → error toast
[ ] Edit Customer → dialog → name editable, external ID read-only
[ ] Archive customer → confirmation → customer disappears from time entry dropdowns
[ ] Restore customer → appears in dropdowns again
```

### 4.8 Admin: CSV Import

```
[ ] Import CSV button opens dialog
[ ] Drag and drop CSV file works
[ ] Browse files button works
[ ] Missing headers → validation errors shown, Import button disabled
[ ] Empty external_account_id → row-level error shown
[ ] Duplicate IDs within file → error shown
[ ] Valid file → preview table with "New"/"Update" badges
[ ] Import executes → spinner → results screen with counts
[ ] Customer list refreshes after import
[ ] Re-import same file → all rows show as "Update"
[ ] File >5MB → error before parsing
[ ] Non-CSV file → parse error
```

### 4.9 Admin: Users & Roles

```
[ ] Users table shows all signed-in users
[ ] Search filters by name and email
[ ] Role summary chips show correct counts
[ ] Change user role via dropdown → optimistic update → toast
[ ] Own role dropdown is disabled with "Cannot change own role" message
[ ] Promote to admin → confirmation dialog required
[ ] Demote from admin → confirmation dialog required
[ ] Non-admin role changes (consultant → manager) → no confirmation needed
```

### 4.10 Access Control

```
[ ] Viewer: no time entry form on Dashboard, only welcome + Reports link
[ ] Viewer: cannot access /entries → redirect to / with toast
[ ] Consultant: cannot access /review → redirect
[ ] Consultant: cannot access /admin/* → redirect
[ ] Manager: can access /review, cannot access /admin/*
[ ] Admin: can access all pages
[ ] Direct URL to restricted page → redirect + toast
```

---

## 5. Known Limitations and Next Enhancements

### MVP Limitations (Accepted for Launch)

| # | Limitation | Impact | Workaround |
|---|---|---|---|
| 1 | **No pagination** on My Entries, Review, or Admin tables | Slow rendering if >500 rows visible | Filter by date range or customer to reduce row count |
| 2 | **No offline support** | Entries lost if network drops during submit | Form retains values on error; user retries manually |
| 3 | **No bulk time entry** | Can't log a week of entries at once | Each entry is logged individually (form retains date + customer to speed this up) |
| 4 | **Monthly picker browser inconsistency** | `<input type="month">` looks different in Firefox vs Chrome | Functional in all browsers, just visually inconsistent |
| 5 | **No entry duplication** | Can't "copy" a previous entry | Re-select the same values in the form |
| 6 | **Supabase 1000-row default limit** | Queries returning >1000 rows are silently truncated | MVP volumes are expected to be well under this limit |
| 7 | **CSV import runs as a single request** | Files with >1000 customers may exceed Supabase body size limit | Keep import files under 1000 rows, or implement batching |
| 8 | **No email notifications** | Managers aren't notified when periods are submitted for review | Manual communication until notification system is built |
| 9 | **No manager-to-customer assignment** | Any manager can approve any customer's period | Acceptable for small orgs; add assignment table later |
| 10 | **Single tab editing** | If two admins edit the same taxonomy item simultaneously, last write wins | Low risk given admin usage patterns |

### Next Enhancements (Ordered by Value)

| Priority | Enhancement | Description |
|---|---|---|
| 1 | **Pagination** | Add TanStack Table pagination to My Entries, Review, and Admin tables. The hook infrastructure already supports `limit`/`offset` params. |
| 2 | **Bulk time entry** | A "quick week" mode that shows a grid (Mon–Fri) for a single customer, letting consultants fill hours for each day in one submit. |
| 3 | **Email notifications** | Send email when a period is submitted for review (to managers) or approved (to the submitting consultant). Use Supabase Edge Functions + a transactional email provider. |
| 4 | **Dashboard summary cards** | Show "hours this week", "hours this month", "pending approvals" above the entry form. Simple aggregate queries. |
| 5 | **Entry templates / favorites** | Save frequent customer+service line+workstream combinations as one-click presets on the Dashboard. |
| 6 | **PDF export** | Generate a styled PDF report from the same data the CSV export uses. Use a library like `jspdf` or a server-side rendering approach. |
| 7 | **Searchable select dropdowns** | Replace native `<select>` with a combobox component (e.g., cmdk or Headless UI Combobox) for customer/taxonomy selection. Becomes valuable when customer count exceeds ~50. |
| 8 | **Batched CSV import** | Chunk large imports into 500-row batches with progress tracking. Move to a Supabase Edge Function with the service_role key. |
| 9 | **Manager assignment** | A `manager_assignments` table linking managers to specific customers. Filter the Review page to only show assigned customers. |
| 10 | **Audit log viewer** | An admin page that shows recent changes across all tables using the `created_by`/`updated_by`/`updated_at` fields already being tracked. |
