import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerFormValues } from "@/lib/schemas";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/database";

interface CustomerFormDialogProps {
  /** Pass an existing customer to edit. Null for create. */
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function CustomerFormDialog({
  customer,
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: CustomerFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEditing = !!customer;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      external_account_id: customer?.external_account_id ?? "",
    },
  });

  // Sync form with customer prop when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? "",
        external_account_id: customer?.external_account_id ?? "",
      });
    }
  }, [open, customer, reset]);

  // Manage native dialog element
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  async function handleFormSubmit(values: CustomerFormValues) {
    await onSubmit(values);
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl border border-surface-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-surface-900">
            {isEditing ? "Edit Customer" : "Add Customer"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-surface-400 hover:text-surface-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <FormField label="Customer Name" error={errors.name?.message}>
            <input
              type="text"
              autoFocus
              placeholder="Acme Corporation"
              {...register("name")}
              className={cn(
                "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
                errors.name ? "border-red-300" : "border-surface-300"
              )}
            />
          </FormField>

          <FormField
            label="External Account ID"
            error={errors.external_account_id?.message}
          >
            <input
              type="text"
              placeholder="ACC-001"
              {...register("external_account_id")}
              disabled={isEditing}
              className={cn(
                "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
                "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
                isEditing && "bg-surface-50 text-surface-500 cursor-not-allowed",
                errors.external_account_id
                  ? "border-red-300"
                  : "border-surface-300"
              )}
            />
            {isEditing && (
              <p className="text-xs text-surface-400 mt-1">
                The external ID cannot be changed after creation.
              </p>
            )}
          </FormField>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-surface-100 px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEditing ? "Save Changes" : "Create Customer"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
