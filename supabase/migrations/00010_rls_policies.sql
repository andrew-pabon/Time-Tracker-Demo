-- 00010_rls_policies.sql
--
-- Enables RLS on every table and defines all access policies.
-- This MUST run after all tables and functions are created.

-- ============================================================================
-- Enable RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.customers enable row level security;
alter table public.service_lines enable row level security;
alter table public.workstreams enable row level security;
alter table public.activity_types enable row level security;
alter table public.time_entries enable row level security;
alter table public.reporting_periods enable row level security;
alter table public.customer_import_logs enable row level security;


-- ============================================================================
-- PROFILES
-- ============================================================================

create policy profiles_select on public.profiles
    for select using (
        id = auth.uid()
        or public.get_my_role() in ('manager', 'admin')
    );

create policy profiles_update on public.profiles
    for update using (
        id = auth.uid()
    )
    with check (
        id = auth.uid()
    );


-- ============================================================================
-- USER_ROLES
-- ============================================================================

create policy user_roles_select on public.user_roles
    for select using (
        user_id = auth.uid()
        or public.get_my_role() = 'admin'
    );

create policy user_roles_insert on public.user_roles
    for insert with check (
        public.get_my_role() = 'admin'
    );

create policy user_roles_update on public.user_roles
    for update using (
        public.get_my_role() = 'admin'
    )
    with check (
        public.get_my_role() = 'admin'
    );


-- ============================================================================
-- CUSTOMERS
-- ============================================================================

create policy customers_select on public.customers
    for select using (
        is_active = true
        or public.get_my_role() = 'admin'
    );

create policy customers_insert on public.customers
    for insert with check (
        public.get_my_role() = 'admin'
    );

create policy customers_update on public.customers
    for update using (
        public.get_my_role() = 'admin'
    )
    with check (
        public.get_my_role() = 'admin'
    );


-- ============================================================================
-- SERVICE_LINES
-- ============================================================================

create policy service_lines_select on public.service_lines
    for select using (
        is_active = true
        or public.get_my_role() = 'admin'
    );

create policy service_lines_insert on public.service_lines
    for insert with check (
        public.get_my_role() = 'admin'
    );

create policy service_lines_update on public.service_lines
    for update using (
        public.get_my_role() = 'admin'
    )
    with check (
        public.get_my_role() = 'admin'
    );


-- ============================================================================
-- WORKSTREAMS
-- ============================================================================

create policy workstreams_select on public.workstreams
    for select using (
        is_active = true
        or public.get_my_role() = 'admin'
    );

create policy workstreams_insert on public.workstreams
    for insert with check (
        public.get_my_role() = 'admin'
    );

create policy workstreams_update on public.workstreams
    for update using (
        public.get_my_role() = 'admin'
    )
    with check (
        public.get_my_role() = 'admin'
    );


-- ============================================================================
-- ACTIVITY_TYPES
-- ============================================================================

create policy activity_types_select on public.activity_types
    for select using (
        is_active = true
        or public.get_my_role() = 'admin'
    );

create policy activity_types_insert on public.activity_types
    for insert with check (
        public.get_my_role() = 'admin'
    );

create policy activity_types_update on public.activity_types
    for update using (
        public.get_my_role() = 'admin'
    )
    with check (
        public.get_my_role() = 'admin'
    );


-- ============================================================================
-- TIME_ENTRIES
-- ============================================================================

create policy time_entries_select on public.time_entries
    for select using (
        user_id = auth.uid()
        or public.get_my_role() in ('manager', 'admin', 'viewer')
    );

create policy time_entries_insert on public.time_entries
    for insert with check (
        public.get_my_role() in ('consultant', 'manager', 'admin')
        and (
            public.get_my_role() = 'admin'
            or not public.is_period_locked(customer_id, entry_date)
        )
    );

create policy time_entries_update on public.time_entries
    for update using (
        (user_id = auth.uid() and not public.is_period_locked(customer_id, entry_date))
        or public.get_my_role() = 'admin'
    )
    with check (
        (user_id = auth.uid() and not public.is_period_locked(customer_id, entry_date))
        or public.get_my_role() = 'admin'
    );

create policy time_entries_delete on public.time_entries
    for delete using (
        (user_id = auth.uid() and not public.is_period_locked(customer_id, entry_date))
        or public.get_my_role() = 'admin'
    );


-- ============================================================================
-- REPORTING_PERIODS
-- ============================================================================

create policy reporting_periods_select on public.reporting_periods
    for select using (true);

create policy reporting_periods_insert on public.reporting_periods
    for insert with check (
        public.get_my_role() in ('manager', 'admin')
    );

create policy reporting_periods_update on public.reporting_periods
    for update using (
        public.get_my_role() in ('manager', 'admin')
    )
    with check (
        public.get_my_role() in ('manager', 'admin')
    );


-- ============================================================================
-- CUSTOMER_IMPORT_LOGS
-- ============================================================================

create policy customer_import_logs_select on public.customer_import_logs
    for select using (
        public.get_my_role() = 'admin'
    );

create policy customer_import_logs_insert on public.customer_import_logs
    for insert with check (
        public.get_my_role() = 'admin'
    );
