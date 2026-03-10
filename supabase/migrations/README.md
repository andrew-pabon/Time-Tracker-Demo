# Database Migrations

These 11 SQL files set up the complete TimeTrack database schema.
Run them **in numerical order** — each file depends on tables or
functions created by earlier files.

## Files

| # | File | What it creates |
|---|---|---|
| 1 | `00001_extensions.sql` | uuid-ossp and pgcrypto extensions |
| 2 | `00002_profiles_and_roles.sql` | `profiles` and `user_roles` tables |
| 3 | `00003_taxonomy.sql` | `service_lines`, `workstreams`, `activity_types` |
| 4 | `00004_customers.sql` | `customers` table with indexes |
| 5 | `00005_reporting_periods.sql` | `reporting_periods` table |
| 6 | `00006_time_entries.sql` | `time_entries` table with all indexes |
| 7 | `00007_import_logs.sql` | `customer_import_logs` table |
| 8 | `00008_functions_and_triggers.sql` | All functions (get_my_role, is_period_locked, etc.) and triggers (auth sync, updated_at, auto-create period, status transition) |
| 9 | `00009_report_function.sql` | `get_monthly_report()` RPC function |
| 10 | `00010_rls_policies.sql` | Enables RLS on all tables + creates all policies |
| 11 | `00011_seed_taxonomy.sql` | Inserts initial service lines, workstreams, activity types |

## How to Run

### Option A: Supabase SQL Editor (quickest for initial setup)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. For each file in order (00001 through 00011):
   - Click **New query**
   - Paste the file contents
   - Click **Run**
   - Verify "Success" in the output panel
4. Go to **Database → Tables** and verify all 8 tables exist
5. Verify each table shows **RLS Enabled**

### Option B: Supabase CLI

```bash
# Link to your project
supabase link --project-ref <your-project-id>

# Push all migrations
supabase db push
```

### Option C: Concatenated single-file run

If you prefer to run everything as one script, concatenate:

```bash
cat supabase/migrations/*.sql > all_migrations.sql
```

Then paste `all_migrations.sql` into the SQL Editor and run once.

## After Running Migrations

### Bootstrap the first admin user

The first user to sign in via Google SSO gets the `consultant` role
by default. Promote yourself to admin:

```sql
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (
    SELECT id FROM public.profiles
    WHERE email = 'your-email@yourcompany.com'
);
```

### Generate TypeScript types

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```

This replaces the hand-written placeholder types with the real ones.

## Troubleshooting

**"relation does not exist"** — You ran a migration out of order. Rerun from 00001.

**"policy already exists"** — You ran 00010 twice. Drop the existing policies first:
```sql
-- Example: drop all policies on a table
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
-- ... repeat for each table
```
Then rerun 00010.

**"trigger already exists"** — The functions use `CREATE OR REPLACE` but triggers
don't support that syntax. Drop and recreate:
```sql
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
-- Then rerun 00008
```

**Auth trigger not firing** — Verify the trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
If missing, rerun 00008.
