import { useState } from "react";
import { useCustomers } from "@/hooks/useCustomers";
import { useReportData, type StructuredReport } from "@/hooks/useReportData";
import { useReportingPeriodStatus } from "@/hooks/useReportingPeriodStatus";
import { exportReportCsv } from "@/lib/csv-export";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { firstOfMonth, formatMonthYear, minutesToHours } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { BarChart3, Download } from "lucide-react";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const { data: customers } = useCustomers();

  // Filter state
  const [customerId, setCustomerId] = useState("");
  const [month, setMonth] = useState(firstOfMonth());
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Data
  const {
    data: report,
    isLoading,
    isFetching,
  } = useReportData(
    customerId || undefined,
    month || undefined,
    weeklyMode,
    shouldFetch && !!customerId
  );

  const { data: periodStatus } = useReportingPeriodStatus(
    customerId || undefined,
    month ? month.slice(0, 10) : undefined
  );

  const customerName =
    customers?.find((c) => c.id === customerId)?.name ?? "Customer";

  const hasData = report && report.groups.length > 0;

  function handleGenerate() {
    if (!customerId) return;
    setShouldFetch(true);
  }

  function handleFilterChange() {
    setShouldFetch(false);
  }

  function handleExportCsv() {
    if (!report || !hasData) return;
    exportReportCsv(report, customerName, month);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Monthly customer usage reports."
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Customer
          </span>
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              handleFilterChange();
            }}
            className="block w-56 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            <option value="">Select customer…</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Month
          </span>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => {
              setMonth(e.target.value + "-01");
              handleFilterChange();
            }}
            className="block w-44 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={weeklyMode}
            onChange={(e) => {
              setWeeklyMode(e.target.checked);
              // If report is already showing, re-fetch with new mode
              if (shouldFetch) setShouldFetch(true);
            }}
            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-surface-600">Weekly subtotals</span>
        </label>

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={!customerId || isLoading}
          >
            {isFetching ? "Loading…" : "Generate Report"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={!hasData}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report content */}
      {shouldFetch ? (
        isLoading ? (
          <div className="rounded-lg border border-surface-200 bg-white py-16 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
            <p className="mt-3 text-sm text-surface-500">
              Generating report…
            </p>
          </div>
        ) : (
          <>
            {/* Report header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-section-title text-surface-800">
                    {customerName}
                  </h2>
                  <p className="text-sm text-surface-500">
                    {formatMonthYear(month)}
                  </p>
                </div>
                {periodStatus && (
                  <StatusBadge
                    status={periodStatus.status}
                    showLock
                    size="md"
                  />
                )}
              </div>
              <span className="text-lg font-semibold tabular-nums text-surface-800">
                {report?.grandTotalHours.toFixed(2) ?? "0.00"} hours
              </span>
            </div>

            {/* Report table */}
            {hasData ? (
              <ReportTable report={report} weeklyMode={weeklyMode} />
            ) : (
              <div className="rounded-lg border border-surface-200 bg-white">
                <EmptyState
                  icon={BarChart3}
                  title="No time entries found"
                  description={`No entries have been logged for ${customerName} in ${formatMonthYear(month)}.`}
                />
              </div>
            )}
          </>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-surface-300 bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-surface-300" />
          <p className="text-sm text-surface-500">
            Select a customer and month, then click Generate Report.
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Grouped report table
// ---------------------------------------------------------------------------

function ReportTable({
  report,
  weeklyMode,
}: {
  report: StructuredReport;
  weeklyMode: boolean;
}) {
  const showWeeks = weeklyMode && report.weekStarts.length > 0;

  return (
    <div className="rounded-lg border border-surface-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100 text-left">
            <th className="px-4 py-3 font-medium text-surface-500">
              Service Line
            </th>
            <th className="px-4 py-3 font-medium text-surface-500">
              Workstream
            </th>
            {showWeeks &&
              report.weekStarts.map((ws) => (
                <th
                  key={ws}
                  className="px-3 py-3 font-medium text-surface-500 text-right whitespace-nowrap text-xs"
                >
                  {formatWeekLabel(ws, report.weekStarts)}
                </th>
              ))}
            <th className="px-4 py-3 font-medium text-surface-500 text-right">
              Hours
            </th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((sl) => (
            <ServiceLineRows
              key={sl.name}
              group={sl}
              weekStarts={showWeeks ? report.weekStarts : []}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-surface-200 font-semibold">
            <td className="px-4 py-3 text-surface-800">Total</td>
            <td />
            {showWeeks &&
              report.weekStarts.map((ws) => {
                let weekTotal = 0;
                for (const sl of report.groups) {
                  weekTotal += sl.weeklyHours.get(ws) ?? 0;
                }
                return (
                  <td
                    key={ws}
                    className="px-3 py-3 text-right tabular-nums text-surface-800"
                  >
                    {weekTotal > 0 ? weekTotal.toFixed(2) : "—"}
                  </td>
                );
              })}
            <td className="px-4 py-3 text-right tabular-nums text-surface-800">
              {report.grandTotalHours.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service line group + workstream rows
// ---------------------------------------------------------------------------

function ServiceLineRows({
  group,
  weekStarts,
}: {
  group: import("@/hooks/useReportData").ServiceLineGroup;
  weekStarts: string[];
}) {
  const showWeeks = weekStarts.length > 0;

  return (
    <>
      {/* Service line subtotal row */}
      <tr className="border-b border-surface-100 bg-surface-50/70">
        <td className="px-4 py-2.5 font-semibold text-surface-800">
          {group.name}
        </td>
        <td />
        {showWeeks &&
          weekStarts.map((ws) => {
            const hrs = group.weeklyHours.get(ws);
            return (
              <td
                key={ws}
                className="px-3 py-2.5 text-right tabular-nums font-semibold text-surface-700 text-xs"
              >
                {hrs ? hrs.toFixed(2) : "—"}
              </td>
            );
          })}
        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-surface-800">
          {group.totalHours.toFixed(2)}
        </td>
      </tr>

      {/* Workstream rows */}
      {group.workstreams.map((ws) => (
        <tr
          key={ws.name}
          className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors"
        >
          <td />
          <td className="px-4 py-2 text-surface-600 pl-8">{ws.name}</td>
          {showWeeks &&
            weekStarts.map((wk) => {
              const hrs = ws.weeklyHours.get(wk);
              return (
                <td
                  key={wk}
                  className="px-3 py-2 text-right tabular-nums text-surface-500 text-xs"
                >
                  {hrs ? hrs.toFixed(2) : "—"}
                </td>
              );
            })}
          <td className="px-4 py-2 text-right tabular-nums text-surface-700">
            {ws.totalHours.toFixed(2)}
          </td>
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Week label helper
// ---------------------------------------------------------------------------

function formatWeekLabel(weekStart: string, _allWeeks: string[]): string {
  const d = new Date(weekStart + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const endD = new Date(d);
  endD.setDate(endD.getDate() + 6);
  return `${month} ${day}–${endD.getDate()}`;
}
