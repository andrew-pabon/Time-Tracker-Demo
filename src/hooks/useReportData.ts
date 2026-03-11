import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row from the get_monthly_report RPC. */
export interface ReportRow {
  service_line_name: string;
  service_line_order: number;
  workstream_name: string;
  workstream_order: number;
  week_start: string | null;
  total_minutes: number;
  total_hours: number;
}

/** A workstream with its total and optional weekly breakdown. */
export interface WorkstreamGroup {
  name: string;
  totalMinutes: number;
  totalHours: number;
  /** Map of week_start ISO date → hours for that week. */
  weeklyHours: Map<string, number>;
}

/** A service line containing its child workstreams. */
export interface ServiceLineGroup {
  name: string;
  order: number;
  totalMinutes: number;
  totalHours: number;
  workstreams: WorkstreamGroup[];
  /** Map of week_start ISO date → hours for that week (service line total). */
  weeklyHours: Map<string, number>;
}

/** The fully structured report, ready for rendering. */
export interface StructuredReport {
  groups: ServiceLineGroup[];
  grandTotalMinutes: number;
  grandTotalHours: number;
  /** Sorted list of all unique week_start dates (only populated in weekly mode). */
  weekStarts: string[];
  raw: ReportRow[];
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function useReportData(
  customerId: string | undefined,
  month: string | undefined,
  weekly: boolean = false,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: ["report", customerId, month, weekly],
    queryFn: async (): Promise<StructuredReport> => {
      if (!customerId || !month) {
        return emptyReport();
      }

      const { data, error } = await supabase.rpc("get_monthly_report", {
        p_customer_id: customerId,
        p_month: month,
        p_weekly: weekly,
      });

      if (error) throw error;

      const rows = (data ?? []) as ReportRow[];
      return structureReport(rows);
    },
    enabled: enabled && !!customerId && !!month,
    staleTime: 60 * 1000,
  });
}

export function useDateRangeReportData(
  customerId: string | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  weekly: boolean = false,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: ["report-range", customerId, dateFrom, dateTo, weekly],
    queryFn: async (): Promise<StructuredReport> => {
      if (!customerId || !dateFrom || !dateTo) {
        return emptyReport();
      }

      const { data, error } = await supabase.rpc("get_date_range_report", {
        p_customer_id: customerId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_weekly: weekly,
      });

      if (error) throw error;

      const rows = (data ?? []) as ReportRow[];
      return structureReport(rows);
    },
    enabled: enabled && !!customerId && !!dateFrom && !!dateTo,
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Structure the flat RPC rows into a nested group hierarchy
// ---------------------------------------------------------------------------

function structureReport(rows: ReportRow[]): StructuredReport {
  if (rows.length === 0) return emptyReport();

  // Collect all unique week starts
  const weekStartSet = new Set<string>();
  for (const r of rows) {
    if (r.week_start) weekStartSet.add(r.week_start);
  }
  const weekStarts = Array.from(weekStartSet).sort();

  // Group by service line → workstream
  const slMap = new Map<
    string,
    {
      order: number;
      wsMap: Map<
        string,
        { totalMinutes: number; totalHours: number; weekly: Map<string, number> }
      >;
    }
  >();

  for (const row of rows) {
    let sl = slMap.get(row.service_line_name);
    if (!sl) {
      sl = { order: row.service_line_order, wsMap: new Map() };
      slMap.set(row.service_line_name, sl);
    }

    let ws = sl.wsMap.get(row.workstream_name);
    if (!ws) {
      ws = { totalMinutes: 0, totalHours: 0, weekly: new Map() };
      sl.wsMap.set(row.workstream_name, ws);
    }

    if (row.week_start) {
      // Weekly mode: each row is a week bucket
      ws.weekly.set(row.week_start, row.total_hours);
      ws.totalMinutes += row.total_minutes;
      ws.totalHours += row.total_hours;
    } else {
      // Non-weekly: single total
      ws.totalMinutes = row.total_minutes;
      ws.totalHours = row.total_hours;
    }
  }

  // Convert to output structure
  const groups: ServiceLineGroup[] = [];
  let grandTotalMinutes = 0;

  for (const [slName, sl] of slMap) {
    let slTotalMinutes = 0;
    let slTotalHours = 0;
    const slWeekly = new Map<string, number>();
    const workstreams: WorkstreamGroup[] = [];

    for (const [wsName, ws] of sl.wsMap) {
      slTotalMinutes += ws.totalMinutes;
      slTotalHours += ws.totalHours;

      for (const [wk, hrs] of ws.weekly) {
        slWeekly.set(wk, (slWeekly.get(wk) ?? 0) + hrs);
      }

      workstreams.push({
        name: wsName,
        totalMinutes: ws.totalMinutes,
        totalHours: ws.totalHours,
        weeklyHours: ws.weekly,
      });
    }

    // Sort workstreams alphabetically within a service line
    workstreams.sort((a, b) => a.name.localeCompare(b.name));

    grandTotalMinutes += slTotalMinutes;

    groups.push({
      name: slName,
      order: sl.order,
      totalMinutes: slTotalMinutes,
      totalHours: slTotalHours,
      workstreams,
      weeklyHours: slWeekly,
    });
  }

  // Sort service line groups by display_order
  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return {
    groups,
    grandTotalMinutes,
    grandTotalHours: parseFloat((grandTotalMinutes / 60).toFixed(2)),
    weekStarts,
    raw: rows,
  };
}

function emptyReport(): StructuredReport {
  return {
    groups: [],
    grandTotalMinutes: 0,
    grandTotalHours: 0,
    weekStarts: [],
    raw: [],
  };
}
