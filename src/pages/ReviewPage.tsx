import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useCustomers } from "@/hooks/useCustomers";
import {
  useReportingPeriods,
  useUpdatePeriodStatus,
  type ReportingPeriodWithDetails,
} from "@/hooks/useReportingPeriods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { firstOfMonth, formatMonthYear, minutesToHours } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PeriodStatus } from "@/lib/constants";
import {
  REPORTING_PERIOD_STATUSES,
} from "@/lib/constants";
import { ClipboardCheck, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReviewPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: customers } = useCustomers();

  // Filters from URL
  const month = searchParams.get("month") ?? firstOfMonth();
  const customerId = searchParams.get("customer") ?? "";
  const statusFilter =
    searchParams.get("status") ?? "draft,in_review,approved";
  const activeStatuses = new Set(statusFilter.split(",") as PeriodStatus[]);

  // Data
  const { data: periods, isLoading } = useReportingPeriods({
    month: month || undefined,
    customerId: customerId || undefined,
    statuses: Array.from(activeStatuses) as PeriodStatus[],
  });

  const statusMutation = useUpdatePeriodStatus();

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    periodId: string;
    targetStatus: PeriodStatus;
    customerName: string;
    month: string;
  } | null>(null);

  // Filter helpers
  function updateParam(key: string, value: string) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    });
  }

  function toggleStatus(status: PeriodStatus) {
    const next = new Set(activeStatuses);
    if (next.has(status)) {
      if (next.size > 1) next.delete(status); // Keep at least one
    } else {
      next.add(status);
    }
    updateParam("status", Array.from(next).join(","));
  }

  // Status transition handler
  async function handleStatusChange() {
    if (!confirmAction) return;
    try {
      await statusMutation.mutateAsync({
        periodId: confirmAction.periodId,
        status: confirmAction.targetStatus,
      });
      const label =
        REPORTING_PERIOD_STATUSES[confirmAction.targetStatus].label;
      toast(`Period moved to ${label}.`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Status update failed.",
        "error"
      );
    } finally {
      setConfirmAction(null);
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <>
      <PageHeader
        title="Review Periods"
        description="Review and approve reporting periods."
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Month
          </span>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => updateParam("month", e.target.value + "-01")}
            className="block w-44 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          />
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Customer
          </span>
          <select
            value={customerId}
            onChange={(e) => updateParam("customer", e.target.value)}
            className="block w-48 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            <option value="">All Customers</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-medium text-surface-400">
            Status
          </span>
          <div className="flex gap-1.5">
            {(["draft", "in_review", "approved"] as PeriodStatus[]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    activeStatuses.has(status)
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-surface-200 bg-surface-50 text-surface-400"
                  )}
                >
                  {REPORTING_PERIOD_STATUSES[status].label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Periods table */}
      <div className="rounded-lg border border-surface-200 bg-white">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
          </div>
        ) : !periods || periods.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No reporting periods match your filters"
            description="Reporting periods are created automatically when consultants log time."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Month
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 text-right">
                    Hours
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 text-right">
                    Entries
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Reviewed By
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <PeriodRow
                    key={p.id}
                    period={p}
                    isAdmin={isAdmin}
                    onStatusChange={(targetStatus) =>
                      setConfirmAction({
                        periodId: p.id,
                        targetStatus,
                        customerName: p.customer_name,
                        month: p.period_month,
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {periods && periods.length > 0 && (
        <p className="mt-2 text-xs text-surface-400">
          {periods.length} period{periods.length !== 1 && "s"}
        </p>
      )}

      {/* Status change confirmation */}
      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.targetStatus === "approved"
            ? "Approve Reporting Period?"
            : confirmAction?.targetStatus === "draft"
              ? "Return to Draft?"
              : "Submit for Review?"
        }
        message={
          confirmAction?.targetStatus === "approved"
            ? `Approve ${confirmAction.customerName} for ${formatMonthYear(confirmAction.month)}? Time entries will be locked for editing.`
            : confirmAction?.targetStatus === "draft"
              ? `Return ${confirmAction?.customerName} ${formatMonthYear(confirmAction?.month ?? "")} to draft? Entries will become editable.`
              : `Submit ${confirmAction?.customerName} ${formatMonthYear(confirmAction?.month ?? "")} for review?`
        }
        confirmLabel={
          confirmAction?.targetStatus === "approved"
            ? "Approve"
            : confirmAction?.targetStatus === "draft"
              ? "Return to Draft"
              : "Submit"
        }
        variant={
          confirmAction?.targetStatus === "approved" ? "primary" : "primary"
        }
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Period row with status action buttons
// ---------------------------------------------------------------------------

function PeriodRow({
  period,
  isAdmin,
  onStatusChange,
}: {
  period: ReportingPeriodWithDetails;
  isAdmin: boolean;
  onStatusChange: (status: PeriodStatus) => void;
}) {
  return (
    <tr className="border-b border-surface-50 hover:bg-surface-50/60 transition-colors">
      <td className="px-4 py-2.5 font-medium text-surface-800">
        {period.customer_name}
      </td>
      <td className="px-4 py-2.5 text-surface-600">
        {formatMonthYear(period.period_month)}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={period.status} showLock />
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-surface-700">
        {minutesToHours(period.total_minutes)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-surface-500">
        {period.entry_count}
      </td>
      <td className="px-4 py-2.5 text-surface-500">
        {period.reviewer_name ?? "—"}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {/* Status transition buttons */}
          {period.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange("in_review")}
            >
              Submit
            </Button>
          )}
          {period.status === "in_review" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatusChange("draft")}
              >
                Return
              </Button>
              <Button
                size="sm"
                onClick={() => onStatusChange("approved")}
              >
                Approve
              </Button>
            </>
          )}
          {period.status === "approved" && isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange("draft")}
            >
              Reopen
            </Button>
          )}

          {/* View detail link */}
          <Link
            to={`/review/${period.id}`}
            className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
            title="View entries"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
