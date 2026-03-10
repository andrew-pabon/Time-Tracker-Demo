import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useReportingPeriodDetail,
  useUpdatePeriodStatus,
} from "@/hooks/useReportingPeriods";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  formatDate,
  formatMonthYear,
  formatDuration,
  minutesToHours,
  truncate,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PeriodStatus } from "@/lib/constants";
import { REPORTING_PERIOD_STATUSES } from "@/lib/constants";
import {
  ArrowLeft,
  ClipboardCheck,
  Lock,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReviewDetailPage() {
  const { periodId } = useParams<{ periodId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: detail, isLoading } = useReportingPeriodDetail(periodId);
  const statusMutation = useUpdatePeriodStatus();

  const [confirmAction, setConfirmAction] = useState<{
    targetStatus: PeriodStatus;
  } | null>(null);

  const isAdmin = user?.role === "admin";
  const period = detail?.period;
  const entries = detail?.entries ?? [];

  async function handleStatusChange() {
    if (!confirmAction || !periodId) return;
    try {
      await statusMutation.mutateAsync({
        periodId,
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

  // Build a mini summary: hours by service line → workstream
  const summary = buildSummary(entries);

  // Loading
  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
      </div>
    );
  }

  if (!period) {
    return (
      <>
        <Link
          to="/review"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Link>
        <EmptyState
          icon={ClipboardCheck}
          title="Period not found"
          description="This reporting period may have been removed."
          actionLabel="Back to Review"
          actionTo="/review"
        />
      </>
    );
  }

  return (
    <>
      {/* Back link */}
      <Link
        to="/review"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-surface-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Review
      </Link>

      {/* Period header card */}
      <div className="mb-6 rounded-lg border border-surface-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-page-title text-surface-900">
              {period.customer_name}
            </h1>
            <p className="mt-0.5 text-sm text-surface-500">
              {formatMonthYear(period.period_month)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={period.status} showLock size="md" />
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-surface-800">
                {minutesToHours(period.total_minutes)} hrs
              </p>
              <p className="text-xs text-surface-400">
                {period.entry_count} entr
                {period.entry_count === 1 ? "y" : "ies"}
              </p>
            </div>
          </div>
        </div>

        {/* Locked banner */}
        {period.status === "approved" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
            <Lock className="h-4 w-4 shrink-0" />
            This period is approved. Time entries are locked for editing.
            {period.reviewer_name && (
              <span className="text-emerald-600">
                — Approved by {period.reviewer_name}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2 border-t border-surface-100 pt-4">
          {period.status === "draft" && (
            <Button
              size="sm"
              onClick={() =>
                setConfirmAction({ targetStatus: "in_review" })
              }
              disabled={statusMutation.isPending}
            >
              Submit for Review
            </Button>
          )}
          {period.status === "in_review" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirmAction({ targetStatus: "draft" })
                }
                disabled={statusMutation.isPending}
              >
                Return to Draft
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setConfirmAction({ targetStatus: "approved" })
                }
                disabled={statusMutation.isPending}
              >
                <Shield className="h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          )}
          {period.status === "approved" && isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setConfirmAction({ targetStatus: "draft" })
              }
              disabled={statusMutation.isPending}
            >
              Reopen Period
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout: entries table + summary */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        {/* Entries table */}
        <div className="rounded-lg border border-surface-200 bg-white">
          <div className="border-b border-surface-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-surface-800">
              Time Entries
            </h2>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No entries in this period"
              description="Time entries for this customer and month will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-left">
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Consultant
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Date
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Service Line
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Workstream
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Activity
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500 text-right">
                      Duration
                    </th>
                    <th className="px-4 py-2.5 font-medium text-surface-500">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-surface-50 hover:bg-surface-50/40 transition-colors"
                    >
                      <td className="px-4 py-2 text-surface-700 font-medium">
                        {entry.consultant_name}
                      </td>
                      <td className="px-4 py-2 text-surface-600 whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>
                      <td className="px-4 py-2 text-surface-600">
                        {entry.service_line_name}
                      </td>
                      <td className="px-4 py-2 text-surface-600">
                        {entry.workstream_name}
                      </td>
                      <td className="px-4 py-2 text-surface-600">
                        {entry.activity_type_name}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-surface-700">
                        {formatDuration(entry.duration_minutes)}
                      </td>
                      <td className="px-4 py-2 text-surface-500 max-w-[180px]">
                        <span title={entry.notes || undefined}>
                          {entry.notes ? truncate(entry.notes, 35) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        {summary.length > 0 && (
          <div className="rounded-lg border border-surface-200 bg-white h-fit">
            <div className="border-b border-surface-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-surface-800">
                Summary
              </h2>
            </div>
            <div className="px-5 py-3 space-y-3">
              {summary.map((sl) => (
                <div key={sl.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-surface-700">
                      {sl.name}
                    </span>
                    <span className="font-semibold tabular-nums text-surface-700">
                      {minutesToHours(sl.totalMinutes)}h
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {sl.workstreams.map((ws) => (
                      <div
                        key={ws.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-surface-500 pl-3">
                          {ws.name}
                        </span>
                        <span className="text-surface-500 tabular-nums">
                          {minutesToHours(ws.totalMinutes)}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-surface-100 pt-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-surface-800">Total</span>
                <span className="text-surface-800 tabular-nums">
                  {minutesToHours(period.total_minutes)}h
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
            ? `Approve ${period.customer_name} for ${formatMonthYear(period.period_month)}? Time entries will be locked for editing.`
            : confirmAction?.targetStatus === "draft"
              ? `Return ${period.customer_name} ${formatMonthYear(period.period_month)} to draft? Entries will become editable.`
              : `Submit ${period.customer_name} ${formatMonthYear(period.period_month)} for review?`
        }
        confirmLabel={
          confirmAction?.targetStatus === "approved"
            ? "Approve"
            : confirmAction?.targetStatus === "draft"
              ? "Return to Draft"
              : "Submit"
        }
        variant="primary"
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Build mini summary from entries
// ---------------------------------------------------------------------------

interface SummaryWorkstream {
  name: string;
  totalMinutes: number;
}

interface SummaryServiceLine {
  name: string;
  totalMinutes: number;
  workstreams: SummaryWorkstream[];
}

function buildSummary(
  entries: { service_line_name: string; workstream_name: string; duration_minutes: number }[]
): SummaryServiceLine[] {
  const map = new Map<
    string,
    { totalMinutes: number; wsMap: Map<string, number> }
  >();

  for (const e of entries) {
    let sl = map.get(e.service_line_name);
    if (!sl) {
      sl = { totalMinutes: 0, wsMap: new Map() };
      map.set(e.service_line_name, sl);
    }
    sl.totalMinutes += e.duration_minutes;
    sl.wsMap.set(
      e.workstream_name,
      (sl.wsMap.get(e.workstream_name) ?? 0) + e.duration_minutes
    );
  }

  const result: SummaryServiceLine[] = [];
  for (const [name, sl] of map) {
    const workstreams: SummaryWorkstream[] = [];
    for (const [wsName, mins] of sl.wsMap) {
      workstreams.push({ name: wsName, totalMinutes: mins });
    }
    workstreams.sort((a, b) => a.name.localeCompare(b.name));
    result.push({ name, totalMinutes: sl.totalMinutes, workstreams });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
