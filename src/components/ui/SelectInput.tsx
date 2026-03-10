import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/**
 * Styled <select> that matches the rest of the form inputs.
 */
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
          "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-surface-300",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

SelectInput.displayName = "SelectInput";
