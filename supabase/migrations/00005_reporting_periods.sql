-- 00005_reporting_periods.sql

create table public.reporting_periods (
    id            uuid primary key default gen_random_uuid(),
    customer_id   uuid not null references public.customers(id) on delete restrict,
    period_month  date not null,
    status        text not null default 'draft'
                      check (status in ('draft', 'in_review', 'approved')),
    reviewed_by   uuid references public.profiles(id),
    reviewed_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    constraint uq_reporting_periods_customer_month
        unique (customer_id, period_month),

    constraint chk_period_month_first_of_month
        check (period_month = date_trunc('month', period_month)::date)
);

comment on table public.reporting_periods is
    'Tracks review status per customer per month. Controls edit-locking of time_entries.';
comment on column public.reporting_periods.period_month is
    'Always the first day of the month (e.g. 2025-06-01). Enforced by CHECK constraint.';
comment on column public.reporting_periods.status is
    'draft -> in_review -> approved. Transitions enforced by trigger.';

create index idx_reporting_periods_customer on public.reporting_periods(customer_id);
create index idx_reporting_periods_status on public.reporting_periods(status);
