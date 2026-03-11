import type { StructuredReport } from "@/hooks/useReportData";
import type { AllTimeEntryRow } from "@/hooks/useAllTimeEntries";
import { minutesToHours, formatDate } from "@/lib/utils";

/**
 * Generate a CSV string from structured report data and trigger a browser download.
 *
 * In non-weekly mode, produces:
 *   Service Line, Workstream, Hours
 *
 * In weekly mode, produces:
 *   Service Line, Workstream, Week1, Week2, ..., Total
 */
export function exportReportCsv(
  report: StructuredReport,
  customerName: string,
  month: string
): void {
  const isWeekly = report.weekStarts.length > 0;
  const rows: string[][] = [];

  // Header row
  const header = ["Service Line", "Workstream"];
  if (isWeekly) {
    for (const ws of report.weekStarts) {
      header.push(formatWeekHeader(ws, month));
    }
  }
  header.push("Total Hours");
  rows.push(header);

  // Data rows
  for (const sl of report.groups) {
    // Service line subtotal row
    const slRow = [sl.name, ""];
    if (isWeekly) {
      for (const ws of report.weekStarts) {
        const hrs = sl.weeklyHours.get(ws);
        slRow.push(hrs ? hrs.toFixed(2) : "");
      }
    }
    slRow.push(sl.totalHours.toFixed(2));
    rows.push(slRow);

    // Workstream rows
    for (const w of sl.workstreams) {
      const wRow = ["", w.name];
      if (isWeekly) {
        for (const ws of report.weekStarts) {
          const hrs = w.weeklyHours.get(ws);
          wRow.push(hrs ? hrs.toFixed(2) : "");
        }
      }
      wRow.push(w.totalHours.toFixed(2));
      rows.push(wRow);
    }
  }

  // Grand total row
  const totalRow = ["TOTAL", ""];
  if (isWeekly) {
    for (const ws of report.weekStarts) {
      let weekTotal = 0;
      for (const sl of report.groups) {
        weekTotal += sl.weeklyHours.get(ws) ?? 0;
      }
      totalRow.push(weekTotal > 0 ? weekTotal.toFixed(2) : "");
    }
  }
  totalRow.push(report.grandTotalHours.toFixed(2));
  rows.push(totalRow);

  const safeName = customerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const monthStr = month.slice(0, 7); // "2025-06"
  triggerDownload(buildCsv(rows), `${safeName}_${monthStr}_report.csv`);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Customers Overview export
// ---------------------------------------------------------------------------

export function exportOverviewCsv(
  rows: { name: string; minutes: number; count: number }[],
  dateFrom: string,
  dateTo: string
): void {
  const data: string[][] = [["Customer", "Total Hours", "Entries"]];
  for (const r of rows) {
    data.push([r.name, minutesToHours(r.minutes), String(r.count)]);
  }
  const totalMins = rows.reduce((s, r) => s + r.minutes, 0);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  data.push(["TOTAL", minutesToHours(totalMins), String(totalCount)]);

  triggerDownload(
    buildCsv(data),
    `customers_overview_${dateFrom}_${dateTo}.csv`
  );
}

// ---------------------------------------------------------------------------
// Signature Care export
// ---------------------------------------------------------------------------

export function exportSignatureCareCsv(
  groups: { name: string; minutes: number; entries: AllTimeEntryRow[] }[],
  dateFrom: string,
  dateTo: string
): void {
  const data: string[][] = [
    ["Customer", "Date", "Consultant", "Workstream", "Activity Type", "Duration (hrs)", "Notes", "Customer Total (hrs)"],
  ];

  for (const group of groups) {
    const sorted = [...group.entries].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date)
    );
    const customerTotal = minutesToHours(group.minutes);
    for (const e of sorted) {
      data.push([
        group.name,
        formatDate(e.entry_date),
        e.consultant_name,
        e.workstream_name,
        e.activity_type_name,
        minutesToHours(e.duration_minutes),
        e.notes ?? "",
        customerTotal,
      ]);
    }
  }

  triggerDownload(
    buildCsv(data),
    `signature_care_${dateFrom}_${dateTo}.csv`
  );
}

// ---------------------------------------------------------------------------
// Dashboard export
// ---------------------------------------------------------------------------

export function exportDashboardCsv(
  consultantRows: { name: string; minutes: number; count: number }[],
  customerRows: { name: string; minutes: number; count: number }[],
  activityRows: { name: string; minutes: number; count: number }[],
  dateFrom: string,
  dateTo: string
): void {
  function section(
    title: string,
    rows: { name: string; minutes: number; count: number }[]
  ): string[][] {
    const out: string[][] = [[title, "Hours", "Entries"]];
    for (const r of rows) {
      out.push([r.name, minutesToHours(r.minutes), String(r.count)]);
    }
    out.push([]); // blank separator row
    return out;
  }

  const data: string[][] = [
    ...section("By Consultant", consultantRows),
    ...section("By Customer", customerRows),
    ...section("By Activity Type", activityRows),
  ];

  triggerDownload(buildCsv(data), `dashboard_${dateFrom}_${dateTo}.csv`);
}

// ---------------------------------------------------------------------------

/**
 * Format a week_start date as a short header label like "Jun 2–8".
 * Trims the display to not exceed the month boundary.
 */
function formatWeekHeader(weekStart: string, month: string): string {
  const ws = new Date(weekStart + "T00:00:00");
  const monthStart = new Date(month + "T00:00:00");
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(monthEnd.getDate() - 1);

  // Clamp start to month start
  const displayStart = ws < monthStart ? monthStart : ws;

  // Week ends on Saturday (6 days after Monday start)
  const weekEnd = new Date(ws);
  weekEnd.setDate(weekEnd.getDate() + 6);
  // Clamp end to month end
  const displayEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

  const startDay = displayStart.getDate();
  const endDay = displayEnd.getDate();
  const monthLabel = displayStart.toLocaleDateString("en-US", {
    month: "short",
  });

  return `${monthLabel} ${startDay}–${endDay}`;
}
