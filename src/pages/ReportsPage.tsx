import { useState, useEffect, useRef } from "react";
import { useCustomers } from "@/hooks/useCustomers";
import { useDateRangeReportData, type StructuredReport } from "@/hooks/useReportData";
import { useReportingPeriodStatus } from "@/hooks/useReportingPeriodStatus";
import { useAllTimeEntries, type AllTimeEntryRow } from "@/hooks/useAllTimeEntries";
import {
  exportReportCsv,
  exportOverviewCsv,
  exportSignatureCareCsv,
  exportDashboardCsv,
} from "@/lib/csv-export";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { firstOfMonth, todayISO, formatDate, formatDuration, minutesToHours } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Download, Users, Star, LayoutDashboard } from "lucide-react";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type Tab = "detailed" | "overview" | "signature-care" | "dashboard";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "detailed", label: "Detailed Report", icon: BarChart3 },
  { id: "overview", label: "Customers Overview", icon: Users },
  { id: "signature-care", label: "Signature Care", icon: Star },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const { data: customers } = useCustomers();

  // Shared date range state
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());

  // Active tab
  const [activeTab, setActiveTab] = useState<Tab>("detailed");

  // Detailed report specific state
  const [customerId, setCustomerId] = useState("");
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Detailed report data
  const {
    data: report,
    isLoading: reportLoading,
    isFetching: reportFetching,
  } = useDateRangeReportData(
    customerId || undefined,
    dateFrom || undefined,
    dateTo || undefined,
    weeklyMode,
    shouldFetch && !!customerId
  );

  const { data: periodStatus } = useReportingPeriodStatus(
    customerId || undefined,
    dateFrom ? dateFrom.slice(0, 10) : undefined
  );

  // Cross-user data for overview / signature care / dashboard tabs
  const { data: allEntries, isLoading: allLoading } = useAllTimeEntries(
    activeTab !== "detailed" ? { dateFrom, dateTo } : {}
  );

  const customerName =
    customers?.find((c) => c.id === customerId)?.name ?? "Customer";

  const hasData = report && report.groups.length > 0;

  function handleGenerate() {
    if (!customerId) return;
    setShouldFetch(true);
  }

  function handleDateChange(field: "from" | "to", value: string) {
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
    setShouldFetch(false);
  }

  function handleExportCsv() {
    if (!report || !hasData) return;
    exportReportCsv(report, customerName, dateFrom);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Customer usage reports and analytics."
      />

      {/* Shared date range filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            From
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="block w-40 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            To
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="block w-40 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-surface-200 bg-surface-50 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-white text-brand-700 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "detailed" && (
        <DetailedReportTab
          customers={customers ?? []}
          customerId={customerId}
          setCustomerId={(id) => { setCustomerId(id); setShouldFetch(false); }}
          weeklyMode={weeklyMode}
          setWeeklyMode={setWeeklyMode}
          shouldFetch={shouldFetch}
          setShouldFetch={setShouldFetch}
          report={report}
          isLoading={reportLoading}
          isFetching={reportFetching}
          periodStatus={periodStatus}
          customerName={customerName}
          hasData={!!hasData}
          onGenerate={handleGenerate}
          onExportCsv={handleExportCsv}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {activeTab === "overview" && (
        <CustomersOverviewTab
          entries={allEntries ?? []}
          isLoading={allLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {activeTab === "signature-care" && (
        <SignatureCareTab
          entries={allEntries ?? []}
          isLoading={allLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {activeTab === "dashboard" && (
        <DashboardTab
          entries={allEntries ?? []}
          isLoading={allLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Searchable customer combo (text filter + dropdown)
// ---------------------------------------------------------------------------

function CustomerSearchCombo({
  customers,
  value,
  onChange,
}: {
  customers: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) setInputValue("");
    else {
      const found = customers.find((c) => c.id === value);
      if (found) setInputValue(found.name);
    }
  }, [value, customers]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = inputValue
    ? customers.filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase()))
    : customers;

  function handleSelect(c: { id: string; name: string }) {
    onChange(c.id);
    setInputValue(c.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-56">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search customer…"
        className="block w-full rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-surface-200 bg-white shadow-lg max-h-60 overflow-auto py-1 text-sm">
          {filtered.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => handleSelect(c)}
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-surface-50",
                c.id === value && "bg-brand-50 text-brand-700"
              )}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detailed Report Tab
// ---------------------------------------------------------------------------

function DetailedReportTab({
  customers,
  customerId,
  setCustomerId,
  weeklyMode,
  setWeeklyMode,
  shouldFetch,
  setShouldFetch,
  report,
  isLoading,
  isFetching,
  periodStatus,
  customerName,
  hasData,
  onGenerate,
  onExportCsv,
  dateFrom,
  dateTo,
}: {
  customers: { id: string; name: string }[];
  customerId: string;
  setCustomerId: (id: string) => void;
  weeklyMode: boolean;
  setWeeklyMode: (v: boolean) => void;
  shouldFetch: boolean;
  setShouldFetch: (v: boolean) => void;
  report: StructuredReport | undefined;
  isLoading: boolean;
  isFetching: boolean;
  periodStatus: { status: string } | undefined | null;
  customerName: string;
  hasData: boolean;
  onGenerate: () => void;
  onExportCsv: () => void;
  dateFrom: string;
  dateTo: string;
}) {
  return (
    <>
      {/* Detailed report controls */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Customer
          </span>
          <CustomerSearchCombo
            customers={customers}
            value={customerId}
            onChange={setCustomerId}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={weeklyMode}
            onChange={(e) => {
              setWeeklyMode(e.target.checked);
              if (shouldFetch) setShouldFetch(true);
            }}
            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-surface-600">Weekly subtotals</span>
        </label>

        <div className="flex gap-2">
          <Button onClick={onGenerate} disabled={!customerId || isLoading}>
            {isFetching ? "Loading…" : "Generate Report"}
          </Button>
          <Button variant="secondary" onClick={onExportCsv} disabled={!hasData}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {shouldFetch ? (
        isLoading ? (
          <div className="rounded-lg border border-surface-200 bg-white py-16 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
            <p className="mt-3 text-sm text-surface-500">Generating report…</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-section-title text-surface-800">
                    {customerName}
                  </h2>
                  <p className="text-sm text-surface-500">
                    {formatDate(dateFrom)} – {formatDate(dateTo)}
                  </p>
                </div>
                {periodStatus && (
                  <StatusBadge
                    status={periodStatus.status as "draft" | "in_review" | "approved"}
                    showLock
                    size="md"
                  />
                )}
              </div>
              <span className="text-lg font-semibold tabular-nums text-surface-800">
                {report?.grandTotalHours.toFixed(2) ?? "0.00"} hours
              </span>
            </div>

            {hasData && report ? (
              <ReportTable report={report} weeklyMode={weeklyMode} />
            ) : (
              <div className="rounded-lg border border-surface-200 bg-white">
                <EmptyState
                  icon={BarChart3}
                  title="No time entries found"
                  description={`No entries have been logged for ${customerName} in this date range.`}
                />
              </div>
            )}
          </>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-surface-300 bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-surface-300" />
          <p className="text-sm text-surface-500">
            Select a customer and click Generate Report.
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Customers Overview Tab
// ---------------------------------------------------------------------------

function CustomersOverviewTab({
  entries,
  isLoading,
  dateFrom,
  dateTo,
}: {
  entries: AllTimeEntryRow[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  const [filterCustomerId, setFilterCustomerId] = useState("");

  if (isLoading) return <LoadingSpinner />;

  // Aggregate by customer
  const byCustomer = new Map<string, { id: string; name: string; minutes: number; count: number }>();
  for (const e of entries) {
    const existing = byCustomer.get(e.customer_id) ?? { id: e.customer_id, name: e.customer_name, minutes: 0, count: 0 };
    existing.minutes += e.duration_minutes;
    existing.count += 1;
    byCustomer.set(e.customer_id, existing);
  }

  const rows = Array.from(byCustomer.values()).sort((a, b) => a.name.localeCompare(b.name));
  const customerList = rows.map((r) => ({ id: r.id, name: r.name }));
  const displayRows = filterCustomerId ? rows.filter((r) => r.id === filterCustomerId) : rows;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-surface-200 bg-white">
        <EmptyState
          icon={Users}
          title="No time entries found"
          description="No entries have been logged in this date range."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Filter by Customer
          </span>
          <CustomerSearchCombo
            customers={customerList}
            value={filterCustomerId}
            onChange={setFilterCustomerId}
          />
        </div>
        <Button variant="secondary" onClick={() => exportOverviewCsv(rows, dateFrom, dateTo)}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-lg border border-surface-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left">
              <th className="px-4 py-3 font-medium text-surface-500">Customer</th>
              <th className="px-4 py-3 font-medium text-surface-500 text-right">Total Hours</th>
              <th className="px-4 py-3 font-medium text-surface-500 text-right">Entries</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.id} className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors">
                <td className="px-4 py-2.5 font-medium text-surface-800">{row.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-surface-700">
                  {minutesToHours(row.minutes)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-surface-500">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-200 font-semibold">
              <td className="px-4 py-3 text-surface-800">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-surface-800">
                {minutesToHours(rows.reduce((s, r) => s + r.minutes, 0))}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-surface-800">
                {rows.reduce((s, r) => s + r.count, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature Care Tab
// ---------------------------------------------------------------------------

function SignatureCareTab({
  entries,
  isLoading,
  dateFrom,
  dateTo,
}: {
  entries: AllTimeEntryRow[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  const [filterCustomerId, setFilterCustomerId] = useState("");

  if (isLoading) return <LoadingSpinner />;

  const scEntries = entries.filter((e) => e.service_line_name === "Signature Care");

  if (scEntries.length === 0) {
    return (
      <div className="rounded-lg border border-surface-200 bg-white">
        <EmptyState
          icon={Star}
          title="No Signature Care entries found"
          description="No Signature Care time has been logged in this date range."
        />
      </div>
    );
  }

  // Group by customer
  const byCustomer = new Map<string, { id: string; name: string; minutes: number; entries: AllTimeEntryRow[] }>();
  for (const e of scEntries) {
    const existing = byCustomer.get(e.customer_id) ?? { id: e.customer_id, name: e.customer_name, minutes: 0, entries: [] };
    existing.minutes += e.duration_minutes;
    existing.entries.push(e);
    byCustomer.set(e.customer_id, existing);
  }

  const groups = Array.from(byCustomer.values()).sort((a, b) => a.name.localeCompare(b.name));
  const customerList = groups.map((g) => ({ id: g.id, name: g.name }));
  const filteredGroups = filterCustomerId
    ? groups.filter((g) => g.id === filterCustomerId)
    : groups;

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Filter by Customer
          </span>
          <CustomerSearchCombo
            customers={customerList}
            value={filterCustomerId}
            onChange={setFilterCustomerId}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => exportSignatureCareCsv(groups, dateFrom, dateTo)}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {filteredGroups.map((group) => (
        <div key={group.name} className="rounded-lg border border-surface-200 bg-white overflow-x-auto">
          {/* Customer header */}
          <div className="flex items-center justify-between border-b border-surface-100 bg-surface-50/70 px-4 py-2.5">
            <span className="font-semibold text-surface-800">{group.name}</span>
            <span className="tabular-nums text-sm font-medium text-surface-600">
              {minutesToHours(group.minutes)} hours
            </span>
          </div>
          {/* Entry rows */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left">
                <th className="px-4 py-2 font-medium text-surface-400">Date</th>
                <th className="px-4 py-2 font-medium text-surface-400">Consultant</th>
                <th className="px-4 py-2 font-medium text-surface-400">Workstream</th>
                <th className="px-4 py-2 font-medium text-surface-400">Activity Type</th>
                <th className="px-4 py-2 font-medium text-surface-400 text-right">Duration</th>
                <th className="px-4 py-2 font-medium text-surface-400">Notes</th>
              </tr>
            </thead>
            <tbody>
              {group.entries
                .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
                .map((e) => (
                  <tr key={e.id} className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors">
                    <td className="px-4 py-2 text-surface-600 whitespace-nowrap">{formatDate(e.entry_date)}</td>
                    <td className="px-4 py-2 text-surface-700">{e.consultant_name}</td>
                    <td className="px-4 py-2 text-surface-600">{e.workstream_name}</td>
                    <td className="px-4 py-2 text-surface-600">{e.activity_type_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-surface-700 whitespace-nowrap">
                      {formatDuration(e.duration_minutes)}
                    </td>
                    <td className="px-4 py-2 text-surface-500 max-w-xs truncate">{e.notes || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------

function DashboardTab({
  entries,
  isLoading,
  dateFrom,
  dateTo,
}: {
  entries: AllTimeEntryRow[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  if (isLoading) return <LoadingSpinner />;

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-surface-200 bg-white">
        <EmptyState
          icon={LayoutDashboard}
          title="No time entries found"
          description="No entries have been logged in this date range."
        />
      </div>
    );
  }

  // Aggregate by consultant
  const byConsultant = new Map<string, { name: string; minutes: number; count: number }>();
  // Aggregate by customer
  const byCustomer = new Map<string, { name: string; minutes: number; count: number }>();
  // Aggregate by activity type
  const byActivity = new Map<string, { name: string; minutes: number; count: number }>();

  for (const e of entries) {
    // By consultant
    const c = byConsultant.get(e.user_id) ?? { name: e.consultant_name, minutes: 0, count: 0 };
    c.minutes += e.duration_minutes;
    c.count += 1;
    byConsultant.set(e.user_id, c);

    // By customer
    const cu = byCustomer.get(e.customer_id) ?? { name: e.customer_name, minutes: 0, count: 0 };
    cu.minutes += e.duration_minutes;
    cu.count += 1;
    byCustomer.set(e.customer_id, cu);

    // By activity type
    const at = byActivity.get(e.activity_type_id) ?? { name: e.activity_type_name, minutes: 0, count: 0 };
    at.minutes += e.duration_minutes;
    at.count += 1;
    byActivity.set(e.activity_type_id, at);
  }

  const consultantRows = Array.from(byConsultant.values()).sort((a, b) => b.minutes - a.minutes);
  const customerRows = Array.from(byCustomer.values()).sort((a, b) => b.minutes - a.minutes);
  const activityRows = Array.from(byActivity.values()).sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = entries.reduce((s, e) => s + e.duration_minutes, 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() =>
            exportDashboardCsv(consultantRows, customerRows, activityRows, dateFrom, dateTo)
          }
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardTable
          title="By Consultant"
          rows={consultantRows}
          totalMinutes={totalMinutes}
        />
        <DashboardTable
          title="By Customer"
          rows={customerRows}
          totalMinutes={totalMinutes}
        />
        <DashboardTable
          title="By Activity Type"
          rows={activityRows}
          totalMinutes={totalMinutes}
        />
      </div>
    </div>
  );
}

function DashboardTable({
  title,
  rows,
  totalMinutes,
}: {
  title: string;
  rows: { name: string; minutes: number; count: number }[];
  totalMinutes: number;
}) {
  return (
    <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
      <div className="border-b border-surface-100 px-4 py-3">
        <h3 className="font-semibold text-surface-800">{title}</h3>
        <p className="text-xs text-surface-400">{minutesToHours(totalMinutes)} total hours</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100 text-left">
            <th className="px-4 py-2 font-medium text-surface-400">Name</th>
            <th className="px-4 py-2 font-medium text-surface-400 text-right">Hours</th>
            <th className="px-4 py-2 font-medium text-surface-400 text-right">Entries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = totalMinutes > 0 ? (row.minutes / totalMinutes) * 100 : 0;
            return (
              <tr key={row.name} className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors">
                <td className="px-4 py-2">
                  <div className="font-medium text-surface-700">{row.name}</div>
                  <div className="mt-0.5 h-1 w-full rounded-full bg-surface-100">
                    <div
                      className="h-1 rounded-full bg-brand-400"
                      style={{ width: `${pct.toFixed(1)}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-surface-700">
                  {minutesToHours(row.minutes)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-surface-500">
                  {row.count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared loading spinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="rounded-lg border border-surface-200 bg-white py-16 text-center">
      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
      <p className="mt-3 text-sm text-surface-500">Loading…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped report table (Detailed Report)
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
            <th className="px-4 py-3 font-medium text-surface-500">Service Line</th>
            <th className="px-4 py-3 font-medium text-surface-500">Workstream</th>
            {showWeeks &&
              report.weekStarts.map((ws) => (
                <th
                  key={ws}
                  className="px-3 py-3 font-medium text-surface-500 text-right whitespace-nowrap text-xs"
                >
                  {formatWeekLabel(ws)}
                </th>
              ))}
            <th className="px-4 py-3 font-medium text-surface-500 text-right">Hours</th>
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
                  <td key={ws} className="px-3 py-3 text-right tabular-nums text-surface-800">
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
      <tr className="border-b border-surface-100 bg-surface-50/70">
        <td className="px-4 py-2.5 font-semibold text-surface-800">{group.name}</td>
        <td />
        {showWeeks &&
          weekStarts.map((ws) => {
            const hrs = group.weeklyHours.get(ws);
            return (
              <td key={ws} className="px-3 py-2.5 text-right tabular-nums font-semibold text-surface-700 text-xs">
                {hrs ? hrs.toFixed(2) : "—"}
              </td>
            );
          })}
        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-surface-800">
          {group.totalHours.toFixed(2)}
        </td>
      </tr>

      {group.workstreams.map((ws) => (
        <tr key={ws.name} className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors">
          <td />
          <td className="px-4 py-2 text-surface-600 pl-8">{ws.name}</td>
          {showWeeks &&
            weekStarts.map((wk) => {
              const hrs = ws.weeklyHours.get(wk);
              return (
                <td key={wk} className="px-3 py-2 text-right tabular-nums text-surface-500 text-xs">
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

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const endD = new Date(d);
  endD.setDate(endD.getDate() + 6);
  return `${month} ${day}–${endD.getDate()}`;
}
