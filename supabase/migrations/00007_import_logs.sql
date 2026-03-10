-- 00007_import_logs.sql

create table public.customer_import_logs (
    id              uuid primary key default gen_random_uuid(),
    uploaded_by     uuid not null references public.profiles(id),
    file_name       text not null,
    row_count       integer not null default 0,
    inserted_count  integer not null default 0,
    updated_count   integer not null default 0,
    error_count     integer not null default 0,
    errors          jsonb default '[]'::jsonb,
    status          text not null default 'pending'
                        check (status in ('pending', 'processing', 'completed', 'failed')),
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz not null default now()
);

comment on table public.customer_import_logs is
    'Audit trail for CSV customer imports. One row per upload attempt.';
