-- 00006_time_entries.sql

create table public.time_entries (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references public.profiles(id) on delete restrict,
    customer_id       uuid not null references public.customers(id) on delete restrict,
    service_line_id   uuid not null references public.service_lines(id) on delete restrict,
    workstream_id     uuid not null references public.workstreams(id) on delete restrict,
    activity_type_id  uuid not null references public.activity_types(id) on delete restrict,
    entry_date        date not null,
    duration_minutes  integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
    notes             text default '',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    created_by        uuid not null references public.profiles(id),
    updated_by        uuid not null references public.profiles(id)
);

comment on table public.time_entries is
    'Core data table. One row per work session logged by a consultant.';
comment on column public.time_entries.duration_minutes is
    'Duration in minutes. Min 1, max 1440 (24 hours).';
comment on column public.time_entries.entry_date is
    'Calendar date of the work. Stored as plain date (no timezone).';
comment on column public.time_entries.user_id is
    'The consultant who performed the work. May differ from created_by if admin creates on behalf.';

-- Primary query patterns
create index idx_time_entries_user_date
    on public.time_entries(user_id, entry_date desc);

create index idx_time_entries_customer_date
    on public.time_entries(customer_id, entry_date);

-- Report aggregation index
create index idx_time_entries_report
    on public.time_entries(customer_id, entry_date, service_line_id, workstream_id);

-- Expression index for is_period_locked() checks
create index idx_time_entries_customer_month
    on public.time_entries(customer_id, (date_trunc('month', entry_date)::date));
