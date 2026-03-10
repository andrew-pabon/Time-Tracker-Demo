import type { StructuredReport } from "@/hooks/useReportData";

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

  // Build CSV string
  const csv = rows
    .map((row) =>
      row.map((cell) => {
        // Escape cells containing commas, quotes, or newlines
        if (/[",\n\r]/.test(cell)) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(",")
    )
    .join("\n");

  // Download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = customerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const monthStr = month.slice(0, 7); // "2025-06"
  a.href = url;
  a.download = `${safeName}_${monthStr}_report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
