import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useTimeEntries,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  type TimeEntryWithNames,
} from "@/hooks/useTimeEntries";
import { useCustomers } from "@/hooks/useCustomers";
import { TimeEntryForm } from "@/components/time-entry/TimeEntryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { formatDuration, formatDate, truncate, firstOfMonth, todayISO } from "@/lib/utils";
import type { TimeEntryFormValues } from "@/lib/schemas";
import { Clock, Pencil, Trash2, Lock, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MyEntriesPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters from URL search params
  const dateFrom = searchParams.get("from") ?? firstOfMonth();
  const dateTo = searchParams.get("to") ?? todayISO();
  const customerId = searchParams.get("customer") ?? "";

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Data
  const { data: customers } = useCustomers();
  const { data: entries, isLoading } = useTimeEntries({
    dateFrom,
    dateTo,
    customerId: customerId || undefined,
  });

  const updateMutation = useUpdateTimeEntry();
  const deleteMutation = useDeleteTimeEntry();

  // Summary
  const totalMinutes = useMemo(
    () => (entries ?? []).reduce((sum, e) => sum + e.duration_minutes, 0),
    [entries]
  );

  // Filter helpers
  function updateFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  function clearFilters() {
    setSearchParams({});
  }

  const hasActiveFilters = searchParams.toString() !== "";

  // Edit handler
  async function handleUpdate(values: TimeEntryFormValues) {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({ ...values, id: editingId });
      toast("Entry updated.");
      setEditingId(null);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update entry.",
        "error"
      );
      throw err;
    }
  }

  // Delete handler
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
    <>
      <PageHeader
        title="My Entries"
        description="View and manage your time entries."
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 bg-white px-4 py-3">
        <FilterField label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilter("from", e.target.value)}
            className="block w-40 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={dateTo}
            max={todayISO()}
            onChange={(e) => updateFilter("to", e.target.value)}
            className="block w-40 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </FilterField>
        <FilterField label="Customer">
          <select
            value={customerId}
            onChange={(e) => updateFilter("customer", e.target.value)}
            className="block w-52 rounded-md border border-surface-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          >
            <option value="">All Customers</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mb-0.5 flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-700"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="mb-3 text-sm text-surface-500">
        {isLoading
          ? "Loading…"
          : `Showing ${entries?.length ?? 0} entries · Total: ${formatDuration(totalMinutes)}`}
      </div>

      {/* Entries table */}
      <div className="rounded-lg border border-surface-200 bg-white">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No entries match your filters"
            description="Try adjusting your date range or clearing filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-4 py-3 font-medium text-surface-500">Date</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Customer</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Service Line</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Workstream</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Activity</th>
                  <th className="px-4 py-3 font-medium text-surface-500 text-right">Duration</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Notes</th>
                  <th className="px-4 py-3 font-medium text-surface-500">Status</th>
                  <th className="px-4 py-3 font-medium text-surface-500 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    isEditing={editingId === entry.id}
                    onEdit={() => setEditingId(entry.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onUpdate={handleUpdate}
                    isUpdating={updateMutation.isPending}
                    onDelete={() => setDeleteTarget(entry.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Entry"
        message="Delete this time entry? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Single entry row with inline edit expansion
// ---------------------------------------------------------------------------

function EntryRow({
  entry,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  isUpdating,
  onDelete,
}: {
  entry: TimeEntryWithNames;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (values: TimeEntryFormValues) => Promise<void>;
  isUpdating: boolean;
  onDelete: () => void;
}) {
  const locked = entry.period_status === "approved";

  return (
    <>
      {/* Data row */}
      <tr className="border-b border-surface-50 hover:bg-surface-50/60 transition-colors">
        <td className="px-4 py-2.5 text-surface-700 whitespace-nowrap">
          {formatDate(entry.entry_date)}
        </td>
        <td className="px-4 py-2.5 text-surface-700">
          {entry.customer_name}
        </td>
        <td className="px-4 py-2.5 text-surface-600">
          {entry.service_line_name}
        </td>
        <td className="px-4 py-2.5 text-surface-600">
          {entry.workstream_name}
        </td>
        <td className="px-4 py-2.5 text-surface-600">
          {entry.activity_type_name}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-surface-700 tabular-nums">
          {formatDuration(entry.duration_minutes)}
        </td>
        <td className="px-4 py-2.5 text-surface-500 max-w-[200px]">
          <span title={entry.notes || undefined}>
            {entry.notes ? truncate(entry.notes, 40) : "—"}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {entry.period_status ? (
            <StatusBadge
              status={entry.period_status}
              showLock={entry.period_status === "approved"}
            />
          ) : (
            <span className="text-xs text-surface-400">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {locked ? (
            <span title="Reporting period approved — entry locked">
              <Lock className="h-4 w-4 text-surface-300" />
            </span>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={onEdit}
                className="rounded p-1 text-surface-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                title="Edit entry"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="rounded p-1 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Delete entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Inline edit form — expands below the row */}
      {isEditing && (
        <tr>
          <td colSpan={9} className="bg-surface-50 px-4 py-4">
            <div className="mx-auto max-w-lg">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-400">
                Edit Entry
              </p>
              <TimeEntryForm
                initialValues={{
                  entry_date: entry.entry_date,
                  customer_id: entry.customer_id,
                  service_line_id: entry.service_line_id,
                  workstream_id: entry.workstream_id,
                  activity_type_id: entry.activity_type_id,
                  duration_minutes: entry.duration_minutes,
                  notes: entry.notes ?? undefined,
                }}
                isEditing
                onSubmit={onUpdate}
                onCancel={onCancelEdit}
                isSubmitting={isUpdating}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter field helper
// ---------------------------------------------------------------------------

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium text-surface-400">
        {label}
      </span>
      {children}
    </div>
  );
}
