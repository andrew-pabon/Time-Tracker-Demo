import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { TimeEntry } from "@/types/database";
import type { PeriodStatus } from "@/lib/constants";

export interface TimeEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  userId?: string;
}

/** A time entry row joined with related names for display. */
export type TimeEntryWithNames = TimeEntry & {
  customer_name: string;
  service_line_name: string;
  workstream_name: string;
  activity_type_name: string;
  period_status: PeriodStatus | null;
};

export interface CreateTimeEntryInput {
  entry_date: string;
  customer_id: string;
  service_line_id: string;
  workstream_id: string;
  activity_type_id: string;
  duration_minutes: number;
  notes?: string;
}

export interface UpdateTimeEntryInput extends CreateTimeEntryInput {
  id: string;
}

type JoinedEntryRow = TimeEntry & {
  customers?: { name: string } | null;
  service_lines?: { name: string } | null;
  workstreams?: { name: string } | null;
  activity_types?: { name: string } | null;
};

type ReportingPeriodLookupRow = {
  customer_id: string;
  period_month: string;
  status: string;
};

function toPeriodMonth(entryDate: string): string {
  return `${entryDate.slice(0, 7)}-01`;
}

export function useTimeEntries(filters: TimeEntryFilters = {}) {
  const { user } = useAuth();
  const effectiveUserId = filters.userId ?? user?.id;

  return useQuery({
    queryKey: ["time-entries", { ...filters, userId: effectiveUserId }],
    queryFn: async (): Promise<TimeEntryWithNames[]> => {
      let query = supabase
        .from("time_entries")
        .select(
          `
          *,
          customers!inner ( name ),
          service_lines!inner ( name ),
          workstreams!inner ( name ),
          activity_types!inner ( name )
        `
        )
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (effectiveUserId) {
        query = query.eq("user_id", effectiveUserId);
      }

      if (filters.dateFrom) {
        query = query.gte("entry_date", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("entry_date", filters.dateTo);
      }

      if (filters.customerId) {
        query = query.eq("customer_id", filters.customerId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const entries = ((data ?? []) as unknown as JoinedEntryRow[]).map((row) => row);

      const periodKeys = new Set<string>();
      for (const row of entries) {
        periodKeys.add(`${row.customer_id}|${toPeriodMonth(row.entry_date)}`);
      }

      const periodMap = new Map<string, PeriodStatus>();

      if (periodKeys.size > 0) {
        const customerMonthPairs = Array.from(periodKeys)
  .map((key) => {
    const [customer_id, period_month] = key.split("|");
    if (!customer_id || !period_month) return null;
    return { customer_id, period_month };
  })
  .filter((p): p is { customer_id: string; period_month: string } => p !== null);

const uniqueCustomerIds = [...new Set(customerMonthPairs.map((p) => p.customer_id))];
const uniqueMonths = [...new Set(customerMonthPairs.map((p) => p.period_month))];

        const { data: periods, error: periodsError } = await supabase
          .from("reporting_periods")
          .select("customer_id, period_month, status")
          .in("customer_id", uniqueCustomerIds)
          .in("period_month", uniqueMonths);

        if (periodsError) throw periodsError;

        for (const p of (periods ?? []) as ReportingPeriodLookupRow[]) {
          periodMap.set(`${p.customer_id}|${p.period_month}`, p.status as PeriodStatus);
        }
      }

      return entries.map((row): TimeEntryWithNames => {
        const periodKey = `${row.customer_id}|${toPeriodMonth(row.entry_date)}`;

        return {
          ...row,
          customer_name: row.customers?.name ?? "Unknown",
          service_line_name: row.service_lines?.name ?? "Unknown",
          workstream_name: row.workstreams?.name ?? "Unknown",
          activity_type_name: row.activity_types?.name ?? "Unknown",
          period_status: periodMap.get(periodKey) ?? null,
        };
      });
    },
    enabled: !!effectiveUserId,
    staleTime: 30 * 1000,
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTimeEntryInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          customer_id: input.customer_id,
          service_line_id: input.service_line_id,
          workstream_id: input.workstream_id,
          activity_type_id: input.activity_type_id,
          entry_date: input.entry_date,
          duration_minutes: input.duration_minutes,
          notes: input.notes ?? "",
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error(
            "Cannot save entry. The reporting period for this customer has been approved."
          );
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["reporting-period-status"] });
      queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateTimeEntryInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          customer_id: input.customer_id,
          service_line_id: input.service_line_id,
          workstream_id: input.workstream_id,
          activity_type_id: input.activity_type_id,
          entry_date: input.entry_date,
          duration_minutes: input.duration_minutes,
          notes: input.notes ?? "",
          updated_by: user.id,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error(
            "This entry can no longer be edited. The reporting period has been approved."
          );
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", entryId);

      if (error) {
        if (error.code === "42501" || error.message?.includes("row-level security")) {
          throw new Error(
            "This entry cannot be deleted. The reporting period has been approved."
          );
        }
        throw error;
      }
    },
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: ["time-entries"] });

      const previousQueries = queryClient.getQueriesData<TimeEntryWithNames[]>({
        queryKey: ["time-entries"],
      });

      queryClient.setQueriesData<TimeEntryWithNames[]>(
        { queryKey: ["time-entries"] },
        (old) => old?.filter((e) => e.id !== entryId)
      );

      return { previousQueries };
    },
    onError: (_err, _entryId, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["reporting-periods"] });
    },
  });
}