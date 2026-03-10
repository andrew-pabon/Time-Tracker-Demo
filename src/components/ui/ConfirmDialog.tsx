import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation dialog. Used for delete, archive, and status transitions.
 *
 * Uses a native <dialog> element for accessibility (focus trap, escape key).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto max-w-sm rounded-xl border border-surface-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
          <button
            onClick={onCancel}
            className="rounded p-0.5 text-surface-400 hover:text-surface-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-surface-600">{message}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-100 px-5 py-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          size="sm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
