-- 00003_taxonomy.sql

create table public.service_lines (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    display_order  integer not null default 0,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint uq_service_lines_name unique (name)
);

create table public.workstreams (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    display_order  integer not null default 0,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint uq_workstreams_name unique (name)
);

create table public.activity_types (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    display_order  integer not null default 0,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint uq_activity_types_name unique (name)
);

comment on table public.service_lines is
    'Admin-managed reference table. Soft-delete via is_active.';
comment on table public.workstreams is
    'Admin-managed reference table. Independent of service_lines.';
comment on table public.activity_types is
    'Admin-managed reference table for categorizing the nature of work.';
