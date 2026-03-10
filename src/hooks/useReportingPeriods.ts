import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PeriodStatus } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportingPeriodWithDetails {
  id: string;
  customer_id: string;
  customer_name: string;
  period_month: string;
  status: PeriodStatus;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  total_minutes: number;
  entry_count: number;
  created_at: string;
}

export interface PeriodFilters {
  month?: string;
  customerId?: string;
  statuses?: PeriodStatus[];
}

/** An entry within a reporting period, with joined names. */
export interface PeriodEntry {
  id: string;
  user_id: string;
  consultant_name: string;
  entry_date: string;
  service_line_name: string;
  workstream_name: string;
  activity_type_name: string;
  duration_minutes: number;
  notes: string;
}

export interface PeriodDetail {
  period: ReportingPeriodWithDetails;
  entries: PeriodEntry[];
}

// ---------------------------------------------------------------------------
// Query: list reporting periods with joined customer + aggregated totals
// ---------------------------------------------------------------------------

export function useReportingPeriods(filters: PeriodFilters = {}) {
  return useQuery({
    queryKey: ["reporting-periods", filters],
    queryFn: async (): Promise<ReportingPeriodWithDetails[]> => {
      // Fetch periods with customer name and reviewer name
      let query = supabase
        .from("reporting_periods")
        .select(
          `
          *,
          customers!inner ( name ),
          profiles:reviewed_by ( full_name )
        `
        )
        .order("period_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.month) {
        query = query.eq("period_month", filters.month);
      }
      if (filters.customerId) {
        query = query.eq("customer_id", filters.customerId);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      const { data: periods, error } = await query;
      if (error) throw error;
      if (!periods || periods.length === 0) return [];

      // Fetch entry counts and total minutes per period.
      // Scope to the specific months displayed to avoid pulling
      // the entire history for each customer.
      const periodKeys = periods.map((p) => ({
        customer_id: p.customer_id,
        period_month: p.period_month,
      }));

      const uniqueCustomerIds = [...new Set(periodKeys.map((k) => k.customer_id))];
      const uniqueMonths = [...new Set(periodKeys.map((k) => k.period_month))];

      // Compute date range that covers all visible months
      const sortedMonths = [...uniqueMonths].sort();
      const earliestMonth = sortedMonths[0]!;
      const latestMonthDate = new Date(sortedMonths[sortedMonths.length - 1]! + "T00:00:00");
      latestMonthDate.setMonth(latestMonthDate.getMonth() + 1);
      const endDate = `${latestMonthDate.getFullYear()}-${String(latestMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

      // Fetch entries scoped to date range + customer set
      const { data: entries } = await supabase
        .from("time_entries")
        .select("customer_id, entry_date, duration_minutes")
        .in("customer_id", uniqueCustomerIds)
        .gte("entry_date", earliestMonth)
        .lt("entry_date", endDate);

      // Aggregate client-side by customer+month
      const aggregates = new Map<
        string,
        { total_minutes: number; entry_count: number }
      >();

      if (entries) {
        for (const e of entries) {
          const month = e.entry_date.slice(0, 7) + "-01";
          if (!uniqueMonths.includes(month)) continue;
          const key = `${e.customer_id}|${month}`;
          const agg = aggregates.get(key) ?? {
            total_minutes: 0,
            entry_count: 0,
          };
          agg.total_minutes += e.duration_minutes;
          agg.entry_count += 1;
          aggregates.set(key, agg);
        }
      }

      return periods.map((p): ReportingPeriodWithDetails => {
        const r = p as Record<string, unknown>;
        const customers = r.customers as { name: string } | null;
        const reviewer = r.profiles as { full_name: string | null } | null;
        const key = `${p.customer_id}|${p.period_month}`;
        const agg = aggregates.get(key);

        return {
          id: p.id,
          customer_id: p.customer_id,
          customer_name: customers?.name ?? "Unknown",
          period_month: p.period_month,
          status: p.status as PeriodStatus,
          reviewed_by: p.reviewed_by,
          reviewer_name: reviewer?.full_name ?? null,
          reviewed_at: p.reviewed_at,
          total_minutes: agg?.total_minutes ?? 0,
          entry_count: agg?.entry_count ?? 0,
          created_at: p.created_at,
        };
      });
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Query: single reporting period detail with all entries
// ---------------------------------------------------------------------------

export function useReportingPeriodDetail(periodId: string | undefined) {
  return useQuery({
    queryKey: ["reporting-period-detail", periodId],
    queryFn: async (): Promise<PeriodDetail | null> => {
      if (!periodId) return null;

      // Fetch the period
      const { data: period, error: pErr } = await supabase
        .from("reporting_periods")
        .select(
          `
          *,
          customers!inner ( name ),
          profiles:reviewed_by ( full_name )
        `
        )
        .eq("id", periodId)
        .single();

      if (pErr) throw pErr;
      if (!period) return null;

      const r = period as Record<string, unknown>;
      const customers = r.customers as { name: string } | null;
      const reviewer = r.profiles as { full_name: string | null } | null;

      // Fetch all entries for this customer + month
      const monthStart = period.period_month;
      const monthEnd = nextMonth(monthStart);

      const { data: rawEntries, error: eErr } = await supabase
        .from("time_entries")
        .select(
          `
          *,
          profiles!time_entries_user_id_fkey ( full_name ),
          service_lines!inner ( name ),
          workstreams!inner ( name ),
          activity_types!inner ( name )
        `
        )
        .eq("customer_id", period.customer_id)
        .gte("entry_date", monthStart)
        .lt("entry_date", monthEnd)
        .order("entry_date")
        .order("created_at");

      if (eErr) throw eErr;

      const entries: PeriodEntry[] = (rawEntries ?? []).map((e) => {
        const er = e as Record<string, unknown>;
        const profile = er.profiles as { full_name: string | null } | null;
        const sl = er.service_lines as { name: string } | null;
        const ws = er.workstreams as { name: string } | null;
        const at = er.activity_types as { name: string } | null;

        return {
          id: e.id,
          user_id: e.user_id,
          consultant_name: profile?.full_name ?? "Unknown",
          entry_date: e.entry_date,
          service_line_name: sl?.name ?? "Unknown",
          workstream_name: ws?.name ?? "Unknown",
          activity_type_name: at?.name ?? "Unknown",
          duration_minutes: e.duration_minutes,
          notes: e.notes ?? "",
        };
      });

      const totalMinutes = entries.reduce(
        (sum, e) => sum + e.duration_minutes,
        0
      );

      return {
        period: {
          id: period.id,
          customer_id: period.customer_id,
          customer_name: customers?.name ?? "Unknown",
          period_month: period.period_month,
          status: period.status as PeriodStatus,
          reviewed_by: period.reviewed_by,
          reviewer_name: reviewer?.full_name ?? null,
          reviewed_at: period.reviewed_at,
          total_minutes: totalMinutes,
          entry_count: entries.length,
          created_at: period.created_at,
        },
        entries,
      };
    },
    enabled: !!periodId,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: update reporting period status
// ---------------------------------------------------------------------------

export function useUpdatePeriodStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      periodId,
      status,
    }: {
      periodId: string;
      status: PeriodStatus;
    }) => {
      const { data, error } = await supabase
        .from("reporting_periods")
        .update({ status })
        .eq("id", periodId)
        .select()
        .single();

      if (error) {
        if (error.message?.includes("Invalid status transition")) {
          throw new Error(error.message);
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
      queryClient.invalidateQueries({
        queryKey: ["reporting-period-detail"],
      });
      queryClient.invalidateQueries({
        queryKey: ["reporting-period-status"],
      });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function nextMonth(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
