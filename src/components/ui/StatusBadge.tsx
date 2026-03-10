import { cn } from "@/lib/utils";
import {
  REPORTING_PERIOD_STATUSES,
  type PeriodStatus,
} from "@/lib/constants";
import { Lock } from "lucide-react";

interface StatusBadgeProps {
  status: PeriodStatus;
  /** Show a lock icon for approved status. */
  showLock?: boolean;
  /** Render at a larger size. */
  size?: "sm" | "md";
}

const colorMap: Record<string, string> = {
  gray: "bg-surface-100 text-surface-600 border-surface-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({
  status,
  showLock = false,
  size = "sm",
}: StatusBadgeProps) {
  const config = REPORTING_PERIOD_STATUSES[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        colorMap[config.color],
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-3 py-1 text-xs"
      )}
    >
      {showLock && status === "approved" && <Lock className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
