-- 00002_profiles_and_roles.sql

create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text not null,
    full_name   text,
    avatar_url  text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'User profiles synced from Supabase Auth. One row per authenticated user.';

create table public.user_roles (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    role        text not null check (role in ('consultant', 'manager', 'admin', 'viewer')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    updated_by  uuid references public.profiles(id),

    constraint uq_user_roles_user_id unique (user_id)
);

comment on table public.user_roles is
    'Exactly one role per user. Role determines RLS access.';
comment on column public.user_roles.role is
    'One of: consultant, manager, admin, viewer.';

create index idx_user_roles_user_id on public.user_roles(user_id);
