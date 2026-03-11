-- 00012_date_range_report.sql
--
-- get_date_range_report(): returns aggregated time entries for a customer+date range,
-- grouped by service line and workstream, with optional weekly breakdown.
-- SECURITY INVOKER so it respects the caller's RLS context.

create or replace function public.get_date_range_report(
    p_customer_id  uuid,
    p_date_from    date,
    p_date_to      date,
    p_weekly       boolean default false
)
returns table (
    service_line_name  text,
    service_line_order integer,
    workstream_name    text,
    workstream_order   integer,
    week_start         date,
    total_minutes      bigint,
    total_hours        numeric
)
language sql
stable
security invoker
set search_path = public
as $$
    select
        sl.name                             as service_line_name,
        sl.display_order                    as service_line_order,
        ws.name                             as workstream_name,
        ws.display_order                    as workstream_order,
        case
            when p_weekly then date_trunc('week', te.entry_date)::date
            else null
        end                                 as week_start,
        sum(te.duration_minutes)            as total_minutes,
        round(sum(te.duration_minutes) / 60.0, 2) as total_hours
    from public.time_entries te
    join public.service_lines sl on sl.id = te.service_line_id
    join public.workstreams ws   on ws.id = te.workstream_id
    where te.customer_id = p_customer_id
      and te.entry_date >= p_date_from
      and te.entry_date <= p_date_to
    group by
        sl.name,
        sl.display_order,
        ws.name,
        ws.display_order,
        case
            when p_weekly then date_trunc('week', te.entry_date)::date
            else null
        end
    order by
        sl.display_order,
        sl.name,
        ws.display_order,
        ws.name,
        week_start nulls first;
$$;

comment on function public.get_date_range_report(uuid, date, date, boolean) is
    'Returns aggregated time entries for a customer+date range, grouped by service line and workstream. Optional weekly breakdown.';
