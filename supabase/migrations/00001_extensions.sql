-- 00001_extensions.sql
-- Supabase enables these by default, but be explicit.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
