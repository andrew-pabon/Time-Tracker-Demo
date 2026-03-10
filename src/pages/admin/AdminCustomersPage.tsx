import { useState, useDeferredValue } from "react";
import {
  useAdminCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useToggleCustomerArchive,
} from "@/hooks/useAdminCustomers";
import { CustomerFormDialog } from "@/components/admin/CustomerFormDialog";
import { CsvUploadDialog } from "@/components/admin/CsvUploadDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/database";
import type { CustomerFormValues } from "@/lib/schemas";
import {
  Building2,
  Upload,
  Plus,
  Search,
  Pencil,
  Archive,
  RotateCcw,
} from "lucide-react";

export function AdminCustomersPage() {
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showArchived, setShowArchived] = useState(false);

  // Data
  const { data: customers, isLoading } = useAdminCustomers({
    search: deferredSearch || undefined,
    includeArchived: showArchived,
  });

  // Mutations
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const archiveMutation = useToggleCustomerArchive();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Handlers
  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditTarget(customer);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  async function handleFormSubmit(values: CustomerFormValues) {
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({
          id: editTarget.id,
          name: values.name,
        });
        toast("Customer updated.");
      } else {
        await createMutation.mutateAsync(values);
        toast("Customer created.");
      }
      closeForm();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to save customer.",
        "error"
      );
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    const restoring = !archiveTarget.is_active;
    try {
      await archiveMutation.mutateAsync({
        id: archiveTarget.id,
        is_active: restoring,
      });
      toast(restoring ? "Customer restored." : "Customer archived.");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Operation failed.",
        "error"
      );
    } finally {
      setArchiveTarget(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage customer accounts and import data."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name or account ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-md border border-surface-300 bg-white py-1.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          Show Archived
        </label>
      </div>

      {/* Customer table */}
      <div className="rounded-lg border border-surface-200 bg-white">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
          </div>
        ) : !customers || customers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={
              deferredSearch
                ? `No customers match "${deferredSearch}"`
                : "No customers yet"
            }
            description={
              deferredSearch
                ? "Try a different search term."
                : "Add a customer manually or import from CSV."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Name
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    External Account ID
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 w-24">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Created
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 w-24 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className={cn(
                      "border-b border-surface-50 transition-colors hover:bg-surface-50/60",
                      !customer.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-surface-800">
                      {customer.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-surface-500">
                      {customer.external_account_id}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                          customer.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-100 text-surface-500"
                        )}
                      >
                        {customer.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-surface-500">
                      {formatDate(customer.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(customer)}
                          className="rounded p-1 text-surface-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setArchiveTarget(customer)}
                          className={cn(
                            "rounded p-1 transition-colors",
                            customer.is_active
                              ? "text-surface-400 hover:bg-amber-50 hover:text-amber-600"
                              : "text-surface-400 hover:bg-emerald-50 hover:text-emerald-600"
                          )}
                          title={customer.is_active ? "Archive" : "Restore"}
                        >
                          {customer.is_active ? (
                            <Archive className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count footer */}
      {customers && customers.length > 0 && (
        <p className="mt-2 text-xs text-surface-400">
          {customers.length} customer{customers.length !== 1 && "s"}
          {showArchived && " (including archived)"}
        </p>
      )}

      {/* Form dialog */}
      <CustomerFormDialog
        customer={editTarget}
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Archive/restore confirmation */}
      <ConfirmDialog
        open={!!archiveTarget}
        title={
          archiveTarget?.is_active
            ? `Archive "${archiveTarget?.name}"?`
            : `Restore "${archiveTarget?.name}"?`
        }
        message={
          archiveTarget?.is_active
            ? "This customer will be hidden from time entry forms. Existing entries will not be affected."
            : "This customer will appear in time entry forms again."
        }
        confirmLabel={archiveTarget?.is_active ? "Archive" : "Restore"}
        variant={archiveTarget?.is_active ? "danger" : "primary"}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />

      {/* CSV import dialog */}
      <CsvUploadDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
