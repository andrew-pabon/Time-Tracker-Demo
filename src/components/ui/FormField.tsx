import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Label + input + error message wrapper.
 * Provides consistent spacing and error display across all forms.
 */
export function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-surface-600">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
