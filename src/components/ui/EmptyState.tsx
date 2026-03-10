import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionTo,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100">
        <Icon className="h-6 w-6 text-surface-400" />
      </div>
      <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-surface-500">{description}</p>
      )}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}
