# TimeTrack MVP — Scaffold Setup Notes

## Quick Start

```bash
# 1. Clone and install
cd timetrack
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in your Supabase URL and anon key

# 3. Start dev server
npm run dev
```

## Supabase Project Setup

Before the app will work, you need a Supabase project configured:

### 1. Create Supabase Project
- Go to https://supabase.com/dashboard
- Create a new project
- Note the project URL and anon key → put them in `.env.local`

### 2. Enable Google OAuth
- In Supabase Dashboard → Authentication → Providers → Google
- Enable Google provider
- Create OAuth credentials in Google Cloud Console:
  - Go to https://console.cloud.google.com
  - Create an OAuth 2.0 Client ID (Web application)
  - Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
  - Copy Client ID and Client Secret into Supabase
- Optional: Restrict to your Google Workspace domain via
  Supabase → Authentication → URL Configuration → Allowed Domains

### 3. Run Database Migrations
Apply the migrations from `TimeTrack_Schema_and_RLS.md` using either:

**Option A — Supabase CLI (recommended):**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-id>

# Split the SQL into migration files in supabase/migrations/
# Then push
supabase db push
```

**Option B — SQL Editor:**
Run the SQL blocks from the schema document directly in
Supabase Dashboard → SQL Editor, in order.

### 4. Generate TypeScript Types
After migrations are applied:
```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```
This replaces the placeholder types with accurate generated types.

### 5. Seed Data
Run the seed SQL (taxonomy values) from the schema document
via SQL Editor or include it as the last migration.

## Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

The `vite.config.ts` is configured for SPA mode.
Add a `vercel.json` for client-side routing:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

## File Structure Overview

```
src/
├── main.tsx                         # Entry: React root + providers
├── App.tsx                          # Router with all routes
├── index.css                        # Tailwind + global styles
│
├── lib/
│   ├── supabase.ts                  # Supabase client (single instance)
│   ├── utils.ts                     # cn(), formatDuration(), formatDate(), etc.
│   └── constants.ts                 # Role hierarchy, status config, limits
│
├── types/
│   └── database.ts                  # Supabase generated types (or placeholder)
│
├── hooks/
│   ├── useAuth.tsx                  # AuthProvider + useAuth hook (real auth)
│   └── useToast.tsx                 # ToastProvider + useToast hook
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx               # Variant button (primary/secondary/ghost/danger)
│   │   ├── PageHeader.tsx           # Page title + actions slot
│   │   ├── StatusBadge.tsx          # Draft/In Review/Approved badges
│   │   └── EmptyState.tsx           # Empty state with icon + message
│   └── layout/
│       ├── AppShell.tsx             # Sidebar + content layout
│       ├── Sidebar.tsx              # Role-aware navigation
│       └── ProtectedRoute.tsx       # Route-level role gating
│
├── pages/
│   ├── LoginPage.tsx                # Google SSO login
│   ├── DashboardPage.tsx            # Quick entry + recent entries
│   ├── MyEntriesPage.tsx            # Full entry history with filters
│   ├── ReportsPage.tsx              # Monthly report generator
│   ├── ReviewPage.tsx               # Reporting period list
│   ├── ReviewDetailPage.tsx         # Single period detail
│   ├── NotFoundPage.tsx             # 404
│   └── admin/
│       ├── AdminCustomersPage.tsx   # Customer CRUD + CSV import
│       ├── AdminCategoriesPage.tsx  # Taxonomy management
│       └── AdminUsersPage.tsx       # User role assignment
```

## What's Real vs. Stubbed

### Fully implemented:
- Auth flow (Google SSO via Supabase, session management, profile + role fetch)
- Auth context provider with loading/error states
- Toast notification system
- Route structure with nested layout routes
- Role-based route protection (ProtectedRoute)
- Role-aware sidebar navigation
- AppShell layout
- Shared UI components (Button, PageHeader, StatusBadge, EmptyState)
- All page shells with correct layout structure

### Stubbed (ready for data wiring in next phases):
- Time entry form (structure present, no submit handler)
- All data tables (structure present, no data queries)
- Filter controls (URL param state management works, no queries)
- Admin CRUD dialogs (commented out, structure defined)
- CSV import dialog (structure defined in UI plan)
- Report grouped table (structure present, no RPC call)
- Status transition buttons (present, no mutations)

## Next Implementation Steps

**Phase 2 — Core Time Entry:**
1. Create `useCustomers` hook (fetch active customers)
2. Create `useTaxonomy` hook (fetch service lines, workstreams, activity types)
3. Create `useTimeEntries` hook (CRUD with TanStack Query)
4. Build `TimeEntryForm` component with React Hook Form + Zod
5. Build `DurationInput` component
6. Wire dashboard form and recent entries table

**Phase 3 — Admin Management:**
7. Wire `AdminCustomersPage` with customer CRUD
8. Build `CsvUploadDialog` with PapaParse + Edge Function call
9. Wire `AdminCategoriesPage` with inline editing
10. Wire `AdminUsersPage` with role dropdown

**Phase 4 — Reporting:**
11. Create `useReportData` hook (calls `get_monthly_report` RPC)
12. Build grouped `ReportTable` component
13. Implement CSV export (client-side blob download)

**Phase 5 — Review Workflow:**
14. Create `useReportingPeriods` hook
15. Wire review page with status transitions
16. Wire review detail page with entries table
17. Implement confirmation dialogs for approve/reopen

## Conventions

- **Imports**: Use `@/` path alias (maps to `src/`)
- **Styling**: Tailwind utility classes. `cn()` for conditional classes.
- **Data fetching**: TanStack Query hooks in `src/hooks/`. One hook per domain.
- **Forms**: React Hook Form + Zod schemas.
- **Tables**: TanStack Table for sortable/paginated tables.
- **State**: URL search params for filters. React state for UI-only state. No global store.
- **Naming**: PascalCase components, camelCase hooks/functions, kebab-case files.
