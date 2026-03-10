import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { TimeEntry } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  userId?: string;
}

/** A time entry row joined with related names for display. */
export interface TimeEntryWithNames extends TimeEntry {
  customer_name: string;
  service_line_name: string;
  workstream_name: string;
  activity_type_name: string;
  period_status: "draft" | "in_review" | "approved" | null;
}

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

// ---------------------------------------------------------------------------
// Query: list time entries with joined names + period status
// ---------------------------------------------------------------------------

/**
 * Fetches time entries for the current user with joined reference data.
 *
 * The query joins customers, service_lines, workstreams, and activity_types
 * to get display names, and left-joins reporting_periods to get lock status.
 *
 * Default: current user's entries. Pass userId override for admin views.
 */
export function useTimeEntries(filters: TimeEntryFilters = {}) {
  const { user } = useAuth();
  const effectiveUserId = filters.userId ?? user?.id;

  return useQuery({
    queryKey: ["time-entries", { ...filters, userId: effectiveUserId }],
    queryFn: async (): Promise<TimeEntryWithNames[]> => {
      // Build the query with joins via Supabase's select syntax.
      // We fetch related names using foreign key relationships.
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

      // Apply filters
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

      // Now fetch reporting period statuses for each unique customer+month
      // so we can display lock state per row.
      const periodKeys = new Set<string>();
      const entries = (data ?? []).map((row) => {
        const periodKey = `${row.customer_id}|${row.entry_date.slice(0, 7)}-01`;
        periodKeys.add(periodKey);
        return row;
      });

      // Batch-fetch reporting periods for all relevant customer+months
      const periodMap = new Map<string, "draft" | "in_review" | "approved">();

      if (periodKeys.size > 0) {
        // Build an OR filter for each unique customer_id + period_month pair
        const customerMonthPairs = Array.from(periodKeys).map((k) => {
          const [custId, month] = k.split("|");
          return { customer_id: custId!, period_month: month! };
        });

        // Fetch all relevant periods in one query using .in() on customer_id
        // then filter client-side for exact month match.
        const uniqueCustomerIds = [
          ...new Set(customerMonthPairs.map((p) => p.customer_id)),
        ];
        const uniqueMonths = [
          ...new Set(customerMonthPairs.map((p) => p.period_month)),
        ];

        const { data: periods } = await supabase
          .from("reporting_periods")
          .select("customer_id, period_month, status")
          .in("customer_id", uniqueCustomerIds)
          .in("period_month", uniqueMonths);

        if (periods) {
          for (const p of periods) {
            periodMap.set(`${p.customer_id}|${p.period_month}`, p.status);
          }
        }
      }

      // Flatten joined data into our display type
      return entries.map((row): TimeEntryWithNames => {
        const r = row as Record<string, unknown>;
        const customers = r.customers as { name: string } | null;
        const serviceLines = r.service_lines as { name: string } | null;
        const workstreams = r.workstreams as { name: string } | null;
        const activityTypes = r.activity_types as { name: string } | null;

        const periodKey = `${row.customer_id}|${row.entry_date.slice(0, 7)}-01`;

        return {
          id: row.id,
          user_id: row.user_id,
          customer_id: row.customer_id,
          service_line_id: row.service_line_id,
          workstream_id: row.workstream_id,
          activity_type_id: row.activity_type_id,
          entry_date: row.entry_date,
          duration_minutes: row.duration_minutes,
          notes: row.notes ?? "",
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by,
          updated_by: row.updated_by,
          customer_name: customers?.name ?? "Unknown",
          service_line_name: serviceLines?.name ?? "Unknown",
          workstream_name: workstreams?.name ?? "Unknown",
          activity_type_name: activityTypes?.name ?? "Unknown",
          period_status: periodMap.get(periodKey) ?? null,
        };
      });
    },
    enabled: !!effectiveUserId,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create time entry
// ---------------------------------------------------------------------------

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
        // RLS denials come back as 403 or as a specific error code.
        // The is_period_locked() check in the INSERT policy triggers this.
        if (
          error.code === "42501" ||
          error.message?.includes("row-level security")
        ) {
          throw new Error(
            "Cannot save entry. The reporting period for this customer has been approved."
          );
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all time-entries queries so lists refresh
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      // Also invalidate reporting period status since a new period
      // may have been auto-created by the trigger
      queryClient.invalidateQueries({
        queryKey: ["reporting-period-status"],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: update time entry
// ---------------------------------------------------------------------------

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
        if (
          error.code === "42501" ||
          error.message?.includes("row-level security")
        ) {
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
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: delete time entry (with optimistic removal)
// ---------------------------------------------------------------------------

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", entryId);

      if (error) {
        if (
          error.code === "42501" ||
          error.message?.includes("row-level security")
        ) {
          throw new Error(
            "This entry cannot be deleted. The reporting period has been approved."
          );
        }
        throw error;
      }
    },
    onMutate: async (entryId) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ["time-entries"] });

      // Snapshot all time-entries queries for rollback
      const previousQueries = queryClient.getQueriesData<
        TimeEntryWithNames[]
      >({ queryKey: ["time-entries"] });

      // Optimistically remove the entry from all cached query results
      queryClient.setQueriesData<TimeEntryWithNames[]>(
        { queryKey: ["time-entries"] },
        (old) => old?.filter((e) => e.id !== entryId)
      );

      return { previousQueries };
    },
    onError: (_err, _entryId, context) => {
      // Roll back on error
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}
