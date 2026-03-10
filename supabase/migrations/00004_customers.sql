-- 00004_customers.sql

create table public.customers (
    id                   uuid primary key default gen_random_uuid(),
    external_account_id  text not null,
    name                 text not null,
    is_active            boolean not null default true,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    created_by           uuid references public.profiles(id),
    updated_by           uuid references public.profiles(id),

    constraint uq_customers_external_account_id unique (external_account_id)
);

comment on column public.customers.external_account_id is
    'Durable import key from source system. Used as the upsert match key during CSV import.';

create index idx_customers_name on public.customers(name);
create index idx_customers_active on public.customers(is_active) where is_active = true;
