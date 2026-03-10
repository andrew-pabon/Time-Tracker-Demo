-- 00008_functions_and_triggers.sql
--
-- Contains: get_my_role(), is_period_locked(), status transition trigger,
-- auth user sync trigger, updated_at trigger, auto-create reporting period trigger.

-- ============================================================================
-- get_my_role(): returns the current user's role for RLS checks
-- SECURITY DEFINER so it can read user_roles regardless of RLS context
-- ============================================================================

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.user_roles where user_id = auth.uid();
$$;

comment on function public.get_my_role() is
    'Returns the role of the currently authenticated user. SECURITY DEFINER so it can read user_roles regardless of RLS.';


-- ============================================================================
-- is_period_locked(): checks if a reporting period is approved
-- Used by RLS policies on time_entries to prevent edits
-- ============================================================================

create or replace function public.is_period_locked(
    p_customer_id uuid,
    p_entry_date  date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.reporting_periods
        where customer_id = p_customer_id
          and period_month = date_trunc('month', p_entry_date)::date
          and status = 'approved'
    );
$$;

comment on function public.is_period_locked(uuid, date) is
    'Returns true if the reporting period for the given customer and entry date is approved. Blocks edits via RLS.';


-- ============================================================================
-- Status transition trigger for reporting_periods
-- Enforces: draft -> in_review -> approved, with reject-to-draft and admin reopen
-- ============================================================================

create or replace function public.trg_validate_period_status_transition()
returns trigger
language plpgsql
as $$
begin
    if TG_OP = 'INSERT' then
        return NEW;
    end if;

    -- Valid transitions
    if OLD.status = 'draft' and NEW.status = 'in_review' then
        return NEW;
    elsif OLD.status = 'in_review' and NEW.status = 'approved' then
        NEW.reviewed_at := now();
        NEW.reviewed_by := auth.uid();
        return NEW;
    elsif OLD.status = 'in_review' and NEW.status = 'draft' then
        NEW.reviewed_at := null;
        NEW.reviewed_by := null;
        return NEW;
    elsif OLD.status = 'approved' and NEW.status = 'draft' then
        NEW.reviewed_at := null;
        NEW.reviewed_by := null;
        return NEW;
    elsif OLD.status = NEW.status then
        return NEW;
    else
        raise exception 'Invalid status transition: % -> %', OLD.status, NEW.status;
    end if;
end;
$$;

create trigger trg_reporting_periods_status_transition
    before update on public.reporting_periods
    for each row
    when (OLD.status is distinct from NEW.status)
    execute function public.trg_validate_period_status_transition();


-- ============================================================================
-- Auto-create profile + default role when a new user signs up via Google SSO
-- ============================================================================

create or replace function public.trg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url)
    values (
        NEW.id,
        NEW.email,
        coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
        coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
    );

    insert into public.user_roles (user_id, role)
    values (NEW.id, 'consultant');

    return NEW;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.trg_handle_new_user();


-- ============================================================================
-- Generic updated_at trigger — auto-sets updated_at on every UPDATE
-- ============================================================================

create or replace function public.trg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    NEW.updated_at := now();
    return NEW;
end;
$$;

-- Apply to all tables that have updated_at
create trigger set_updated_at before update on public.profiles
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.user_roles
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.customers
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.service_lines
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.workstreams
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.activity_types
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.time_entries
    for each row execute function public.trg_set_updated_at();

create trigger set_updated_at before update on public.reporting_periods
    for each row execute function public.trg_set_updated_at();


-- ============================================================================
-- Auto-create reporting period when a time entry is inserted
-- for a new customer+month combination
-- ============================================================================

create or replace function public.trg_ensure_reporting_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period_month date;
begin
    v_period_month := date_trunc('month', NEW.entry_date)::date;

    insert into public.reporting_periods (customer_id, period_month)
    values (NEW.customer_id, v_period_month)
    on conflict (customer_id, period_month) do nothing;

    return NEW;
end;
$$;

create trigger trg_time_entry_ensure_period
    after insert on public.time_entries
    for each row
    execute function public.trg_ensure_reporting_period();
