import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AllTimeEntryRow {
  id: string;
  user_id: string;
  consultant_name: string;
  entry_date: string;
  duration_minutes: number;
  notes: string;
  customer_id: string;
  customer_name: string;
  service_line_id: string;
  service_line_name: string;
  workstream_id: string;
  workstream_name: string;
  activity_type_id: string;
  activity_type_name: string;
}

export interface AllTimeEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

/**
 * Fetches time entries across all users visible to the current user.
 * Managers/admins see all entries; consultants/viewers see only their own
 * (enforced by RLS). Includes consultant full_name via profiles join.
 */
export function useAllTimeEntries(filters: AllTimeEntryFilters = {}) {
  return useQuery({
    queryKey: ["all-time-entries", filters],
    queryFn: async (): Promise<AllTimeEntryRow[]> => {
      let query = supabase
        .from("time_entries")
        .select(
          `
          id,
          user_id,
          entry_date,
          duration_minutes,
          notes,
          customer_id,
          service_line_id,
          workstream_id,
          activity_type_id,
          profiles!time_entries_user_id_fkey ( full_name ),
          customers!inner ( name ),
          service_lines!inner ( name ),
          workstreams!inner ( name ),
          activity_types!inner ( name )
        `
        )
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

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

      return ((data ?? []) as unknown as Record<string, unknown>[]).map(
        (row): AllTimeEntryRow => {
          const profile = row.profiles as { full_name: string | null } | null;
          const customer = row.customers as { name: string } | null;
          const sl = row.service_lines as { name: string } | null;
          const ws = row.workstreams as { name: string } | null;
          const at = row.activity_types as { name: string } | null;

          return {
            id: row.id as string,
            user_id: row.user_id as string,
            consultant_name: profile?.full_name ?? "Unknown",
            entry_date: row.entry_date as string,
            duration_minutes: row.duration_minutes as number,
            notes: (row.notes as string) ?? "",
            customer_id: row.customer_id as string,
            customer_name: customer?.name ?? "Unknown",
            service_line_id: row.service_line_id as string,
            service_line_name: sl?.name ?? "Unknown",
            workstream_id: row.workstream_id as string,
            workstream_name: ws?.name ?? "Unknown",
            activity_type_id: row.activity_type_id as string,
            activity_type_name: at?.name ?? "Unknown",
          };
        }
      );
    },
    staleTime: 30 * 1000,
  });
}
