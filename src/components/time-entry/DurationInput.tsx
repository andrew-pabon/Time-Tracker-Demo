import { forwardRef, type InputHTMLAttributes } from "react";
import { cn, formatDuration } from "@/lib/utils";

interface DurationInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number | "";
  onChange: (value: number | "") => void;
  error?: string;
}

/**
 * Number input that accepts minutes and displays "Xh Ym" beside it.
 *
 * Designed for React Hook Form's Controller pattern:
 *   field.value is number | ""
 *   field.onChange accepts number | ""
 */
export const DurationInput = forwardRef<HTMLInputElement, DurationInputProps>(
  ({ value, onChange, error, className, ...props }, ref) => {
    const numericValue = typeof value === "number" ? value : 0;

    return (
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          step={1}
          value={value === "" ? "" : value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange("");
              return;
            }
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed)) {
              onChange(parsed);
            }
          }}
          className={cn(
            "block w-28 rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
            "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-surface-300",
            className
          )}
          placeholder="90"
          aria-invalid={!!error}
          {...props}
        />
        <span className="text-sm text-surface-400 tabular-nums min-w-[60px]">
          {numericValue > 0 ? formatDuration(numericValue) : "—"}
        </span>
      </div>
    );
  }
);

DurationInput.displayName = "DurationInput";
