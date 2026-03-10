import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PeriodStatus } from "@/lib/constants";

interface PeriodStatusResult {
  status: PeriodStatus;
  isLocked: boolean;
}

/**
 * Fetches the reporting period status for a given customer + month.
 *
 * Returns null if no reporting period exists yet (entries in that
 * month haven't been created, or the auto-create trigger hasn't fired).
 *
 * The `isLocked` boolean is the frontend convenience flag —
 * actual lock enforcement is via RLS policies calling is_period_locked().
 */
export function useReportingPeriodStatus(
  customerId: string | undefined,
  entryDate: string | undefined
) {
  const periodMonth = entryDate ? entryDate.slice(0, 7) + "-01" : undefined;

  return useQuery({
    queryKey: ["reporting-period-status", customerId, periodMonth],
    queryFn: async (): Promise<PeriodStatusResult | null> => {
      if (!customerId || !periodMonth) return null;

      const { data, error } = await supabase
        .from("reporting_periods")
        .select("status")
        .eq("customer_id", customerId)
        .eq("period_month", periodMonth)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        status: data.status,
        isLocked: data.status === "approved",
      };
    },
    enabled: !!customerId && !!periodMonth,
    staleTime: 30 * 1000,
  });
}
