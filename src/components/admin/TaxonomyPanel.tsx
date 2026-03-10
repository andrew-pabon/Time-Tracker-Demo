import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taxonomyItemSchema, type TaxonomyItemFormValues } from "@/lib/schemas";
import {
  useAdminTaxonomy,
  useCreateTaxonomyItem,
  useUpdateTaxonomyItem,
  useToggleTaxonomyArchive,
  type TaxonomyTable,
  type TaxonomyItem,
} from "@/hooks/useAdminTaxonomy";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Tags,
  Check,
  X,
  Pencil,
  Archive,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaxonomyPanelProps {
  table: TaxonomyTable;
  /** Human label like "Service Line" (singular). */
  singularLabel: string;
  showArchived: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaxonomyPanel({
  table,
  singularLabel,
  showArchived,
}: TaxonomyPanelProps) {
  const { toast } = useToast();

  // Data
  const { data: items, isLoading } = useAdminTaxonomy(table, showArchived);
  const createMutation = useCreateTaxonomyItem(table);
  const updateMutation = useUpdateTaxonomyItem(table);
  const archiveMutation = useToggleTaxonomyArchive(table);

  // UI state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaxonomyItem | null>(
    null
  );

  // Compute next display_order for the add row
  const nextOrder =
    items && items.length > 0
      ? Math.max(...items.map((i) => i.display_order)) + 10
      : 10;

  // Handlers
  async function handleCreate(values: TaxonomyItemFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast(`${singularLabel} created.`);
      setIsAdding(false);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create.",
        "error"
      );
    }
  }

  async function handleUpdate(id: string, values: TaxonomyItemFormValues) {
    try {
      await updateMutation.mutateAsync({ id, ...values });
      toast(`${singularLabel} updated.`);
      setEditingId(null);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update.",
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
      toast(
        restoring
          ? `${singularLabel} restored.`
          : `${singularLabel} archived.`
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Operation failed.",
        "error"
      );
    } finally {
      setArchiveTarget(null);
    }
  }

  // Render
  return (
    <>
      {/* Add button */}
      <div className="mb-3 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          disabled={isAdding}
        >
          <Plus className="h-4 w-4" />
          Add {singularLabel}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-surface-200 bg-white">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
          </div>
        ) : !items || (items.length === 0 && !isAdding) ? (
          <EmptyState
            icon={Tags}
            title={`No ${singularLabel.toLowerCase()}s defined`}
            description={`Click "Add ${singularLabel}" to create one.`}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left">
                <th className="px-4 py-3 font-medium text-surface-500 w-20">
                  Order
                </th>
                <th className="px-4 py-3 font-medium text-surface-500">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-surface-500 w-24">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-surface-500 w-28 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Inline add row */}
              {isAdding && (
                <InlineFormRow
                  defaultValues={{ name: "", display_order: nextOrder }}
                  onSave={handleCreate}
                  onCancel={() => setIsAdding(false)}
                  isSaving={createMutation.isPending}
                />
              )}

              {/* Data rows */}
              {items?.map((item) =>
                editingId === item.id ? (
                  <InlineFormRow
                    key={item.id}
                    defaultValues={{
                      name: item.name,
                      display_order: item.display_order,
                    }}
                    onSave={(values) => handleUpdate(item.id, values)}
                    onCancel={() => setEditingId(null)}
                    isSaving={updateMutation.isPending}
                  />
                ) : (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-surface-50 transition-colors",
                      !item.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-surface-500 tabular-nums">
                      {item.display_order}
                    </td>
                    <td className="px-4 py-2.5 text-surface-800 font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                          item.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-100 text-surface-500"
                        )}
                      >
                        {item.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setIsAdding(false);
                          }}
                          className="rounded p-1 text-surface-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setArchiveTarget(item)}
                          className={cn(
                            "rounded p-1 transition-colors",
                            item.is_active
                              ? "text-surface-400 hover:bg-amber-50 hover:text-amber-600"
                              : "text-surface-400 hover:bg-emerald-50 hover:text-emerald-600"
                          )}
                          title={item.is_active ? "Archive" : "Restore"}
                        >
                          {item.is_active ? (
                            <Archive className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

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
            ? `This ${singularLabel.toLowerCase()} will be hidden from new time entry forms. Existing entries using it will not be affected.`
            : `This ${singularLabel.toLowerCase()} will appear in time entry forms again.`
        }
        confirmLabel={archiveTarget?.is_active ? "Archive" : "Restore"}
        variant={archiveTarget?.is_active ? "danger" : "primary"}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline form row — used for both add and edit
// ---------------------------------------------------------------------------

function InlineFormRow({
  defaultValues,
  onSave,
  onCancel,
  isSaving,
}: {
  defaultValues: TaxonomyItemFormValues;
  onSave: (values: TaxonomyItemFormValues) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaxonomyItemFormValues>({
    resolver: zodResolver(taxonomyItemSchema),
    defaultValues,
  });

  return (
    <tr className="border-b border-brand-100 bg-brand-50/30">
      <td className="px-4 py-2">
        <input
          type="number"
          min={0}
          step={1}
          {...register("display_order", { valueAsNumber: true })}
          className={cn(
            "block w-16 rounded-md border bg-white px-2 py-1.5 text-sm shadow-sm font-mono",
            "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
            errors.display_order ? "border-red-300" : "border-surface-300"
          )}
        />
        {errors.display_order && (
          <p className="text-[10px] text-red-600 mt-0.5">
            {errors.display_order.message}
          </p>
        )}
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          autoFocus
          placeholder="Enter name…"
          {...register("name")}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          className={cn(
            "block w-full rounded-md border bg-white px-2 py-1.5 text-sm shadow-sm",
            "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
            errors.name ? "border-red-300" : "border-surface-300"
          )}
        />
        {errors.name && (
          <p className="text-[10px] text-red-600 mt-0.5">
            {errors.name.message}
          </p>
        )}
      </td>
      <td className="px-4 py-2">
        <span className="text-xs text-surface-400">—</span>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={handleSubmit(onSave)}
            disabled={isSaving}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-surface-400 hover:bg-surface-100 transition-colors"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
