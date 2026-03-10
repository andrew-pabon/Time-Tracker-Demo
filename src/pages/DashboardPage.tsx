import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useTimeEntries,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  type TimeEntryWithNames,
} from "@/hooks/useTimeEntries";
import { TimeEntryForm } from "@/components/time-entry/TimeEntryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { formatDuration, formatDate, truncate, todayISO } from "@/lib/utils";
import { DASHBOARD_RECENT_DAYS } from "@/lib/constants";
import type { TimeEntryFormValues } from "@/lib/schemas";
import {
  Clock,
  Trash2,
  Lock,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";

  if (isViewer) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="View reports across all customers."
        />
        <ViewerWelcome />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Log your time and view recent entries."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,400px)_1fr]">
        <EntryFormPanel />
        <RecentEntriesPanel />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Viewer variant
// ---------------------------------------------------------------------------

function ViewerWelcome() {
  return (
    <div className="rounded-lg border border-surface-200 bg-white px-6 py-12 text-center">
      <h2 className="text-section-title text-surface-800">
        Welcome to TimeTrack
      </h2>
      <p className="mt-2 text-sm text-surface-500">
        You have read-only access. Head to Reports to view customer usage data.
      </p>
      <Link
        to="/reports"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Go to Reports <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left column: Time Entry Form
// ---------------------------------------------------------------------------

function EntryFormPanel() {
  const { toast } = useToast();
  const createMutation = useCreateTimeEntry();

  async function handleSubmit(values: TimeEntryFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast("Entry logged.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save entry.";
      toast(msg, "error");
      throw err;
    }
  }

  return (
    <div className="rounded-lg border border-surface-200 bg-white p-5">
      <h2 className="mb-4 text-section-title text-surface-800">Log Time</h2>
      <TimeEntryForm
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        retainContext
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right column: Recent Entries
// ---------------------------------------------------------------------------

function RecentEntriesPanel() {
  const { toast } = useToast();
  const deleteMutation = useDeleteTimeEntry();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Date range for "recent" entries
  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DASHBOARD_RECENT_DAYS);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: entries, isLoading } = useTimeEntries({
    dateFrom,
    dateTo: todayISO(),
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast("Entry deleted.");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to delete entry.",
        "error"
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="rounded-lg border border-surface-200 bg-white">
      <div className="flex items-center justify-between border-b border-surface-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-surface-800">
          Recent Entries
        </h2>
        <Link
          to="/entries"
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View All →
        </Link>
      </div>

      {isLoading && (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
        </div>
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <EmptyState
          icon={Clock}
          title="No entries in the last 7 days"
          description="Use the form to log your first entry."
        />
      )}

      {!isLoading && entries && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left">
                <th className="px-4 py-2.5 font-medium text-surface-500">Date</th>
                <th className="px-4 py-2.5 font-medium text-surface-500">Customer</th>
                <th className="px-4 py-2.5 font-medium text-surface-500">Work</th>
                <th className="px-4 py-2.5 font-medium text-surface-500 text-right">Dur.</th>
                <th className="px-4 py-2.5 font-medium text-surface-500 w-14" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-surface-50 hover:bg-surface-50/60 transition-colors"
                >
                  <td className="px-4 py-2.5 text-surface-700 whitespace-nowrap">
                    {formatDate(entry.entry_date)}
                  </td>
                  <td className="px-4 py-2.5 text-surface-700">
                    <span className="block max-w-[160px] truncate">
                      {entry.customer_name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-surface-600">
                    <span className="block text-xs">
                      {entry.service_line_name} · {entry.workstream_name}
                    </span>
                    <span className="block text-xs text-surface-400">
                      {entry.activity_type_name}
                      {entry.notes ? ` — ${truncate(entry.notes, 30)}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-surface-700 tabular-nums">
                    {formatDuration(entry.duration_minutes)}
                  </td>
                  <td className="px-4 py-2.5">
                    {entry.period_status === "approved" ? (
                      <span title="Reporting period approved — entry locked">
                        <Lock className="h-4 w-4 text-surface-300" />
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget(entry.id)}
                        className="rounded p-1 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Entry"
        message="Delete this time entry? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
