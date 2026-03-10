import { useState, useDeferredValue } from "react";
import {
  useAdminUsers,
  useUpdateUserRole,
  type UserWithRole,
} from "@/hooks/useAdminUsers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate, cn } from "@/lib/utils";
import type { UserRole } from "@/lib/constants";
import { Users, Search, ShieldAlert } from "lucide-react";

// ---------------------------------------------------------------------------
// Role config
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] =
  [
    {
      value: "viewer",
      label: "Viewer",
      description: "Read-only access to reports",
    },
    {
      value: "consultant",
      label: "Consultant",
      description: "Log time, view own entries",
    },
    {
      value: "manager",
      label: "Manager",
      description: "View all entries, approve periods",
    },
    {
      value: "admin",
      label: "Admin",
      description: "Full access, manage users and settings",
    },
  ];

const ROLE_COLORS: Record<UserRole, string> = {
  viewer: "bg-surface-100 text-surface-600",
  consultant: "bg-brand-50 text-brand-700",
  manager: "bg-amber-50 text-amber-700",
  admin: "bg-emerald-50 text-emerald-700",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: users, isLoading } = useAdminUsers({
    search: deferredSearch || undefined,
  });

  const updateMutation = useUpdateUserRole();

  // Confirmation state for role changes
  const [pendingChange, setPendingChange] = useState<{
    user: UserWithRole;
    newRole: UserRole;
  } | null>(null);

  async function handleRoleChange(
    targetUser: UserWithRole,
    newRole: UserRole
  ) {
    // If promoting to admin or demoting from admin, require confirmation
    if (targetUser.role === "admin" || newRole === "admin") {
      setPendingChange({ user: targetUser, newRole });
      return;
    }
    await executeRoleChange(targetUser, newRole);
  }

  async function executeRoleChange(
    targetUser: UserWithRole,
    newRole: UserRole
  ) {
    try {
      await updateMutation.mutateAsync({
        userId: targetUser.id,
        roleRowId: targetUser.role_row_id,
        newRole,
      });
      toast(
        `${targetUser.full_name ?? targetUser.email} is now ${ROLE_OPTIONS.find((r) => r.value === newRole)?.label ?? newRole}.`
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update role.",
        "error"
      );
    }
  }

  async function handleConfirmRoleChange() {
    if (!pendingChange) return;
    await executeRoleChange(pendingChange.user, pendingChange.newRole);
    setPendingChange(null);
  }

  // Count by role for the summary
  const roleCounts = users
    ? ROLE_OPTIONS.map((opt) => ({
        ...opt,
        count: users.filter((u) => u.role === opt.value).length,
      })).filter((r) => r.count > 0)
    : [];

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage user roles. Users are created when they sign in with Google."
      />

      {/* Search + summary */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-md border border-surface-300 bg-white py-1.5 pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Role summary chips */}
        {roleCounts.length > 0 && (
          <div className="flex gap-2">
            {roleCounts.map((r) => (
              <span
                key={r.value}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  ROLE_COLORS[r.value]
                )}
              >
                {r.count} {r.label}
                {r.count !== 1 ? "s" : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="rounded-lg border border-surface-200 bg-white">
        {isLoading ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
          </div>
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              deferredSearch
                ? `No users match "${deferredSearch}"`
                : "No users found"
            }
            description={
              deferredSearch
                ? "Try a different search term."
                : "Users appear here after signing in with Google."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-4 py-3 font-medium text-surface-500">
                    User
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500 w-44">
                    Role
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-500">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUser?.id}
                    onRoleChange={(newRole) => handleRoleChange(u, newRole)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count footer */}
      {users && users.length > 0 && (
        <p className="mt-2 text-xs text-surface-400">
          {users.length} user{users.length !== 1 && "s"}
        </p>
      )}

      {/* Confirmation dialog for admin promotions/demotions */}
      <ConfirmDialog
        open={!!pendingChange}
        title={
          pendingChange?.newRole === "admin"
            ? `Promote to Admin?`
            : `Remove Admin access?`
        }
        message={
          pendingChange?.newRole === "admin"
            ? `Grant ${pendingChange.user.full_name ?? pendingChange.user.email} full admin access? They will be able to manage customers, categories, users, and settings.`
            : `Change ${pendingChange?.user.full_name ?? pendingChange?.user.email} from Admin to ${ROLE_OPTIONS.find((r) => r.value === pendingChange?.newRole)?.label ?? pendingChange?.newRole}? They will lose admin privileges immediately.`
        }
        confirmLabel={
          pendingChange?.newRole === "admin"
            ? "Grant Admin"
            : "Change Role"
        }
        variant={pendingChange?.newRole === "admin" ? "primary" : "danger"}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setPendingChange(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// User row with inline role dropdown
// ---------------------------------------------------------------------------

function UserRow({
  user,
  isSelf,
  onRoleChange,
}: {
  user: UserWithRole;
  isSelf: boolean;
  onRoleChange: (newRole: UserRole) => void;
}) {
  return (
    <tr className="border-b border-surface-50 hover:bg-surface-50/60 transition-colors">
      {/* Avatar + name */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-surface-800">
              {user.full_name ?? "—"}
            </p>
            {isSelf && (
              <span className="text-[10px] font-medium text-brand-600">
                You
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-2.5 text-surface-600">{user.email}</td>

      {/* Role dropdown */}
      <td className="px-4 py-2.5">
        <div className="relative">
          <select
            value={user.role}
            disabled={isSelf}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            title={
              isSelf
                ? "You cannot change your own role"
                : `Change role for ${user.full_name ?? user.email}`
            }
            className={cn(
              "block w-full rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm appearance-none pr-7",
              "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
              isSelf
                ? "bg-surface-50 text-surface-400 border-surface-200 cursor-not-allowed"
                : cn("border-surface-300 bg-white cursor-pointer", ROLE_COLORS[user.role])
            )}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          {!isSelf && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <svg
                className="h-3.5 w-3.5 text-surface-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          )}
        </div>
        {isSelf && (
          <p className="mt-0.5 text-[10px] text-surface-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            Cannot change own role
          </p>
        )}
      </td>

      {/* Joined date */}
      <td className="px-4 py-2.5 text-surface-500 whitespace-nowrap">
        {formatDate(user.created_at)}
      </td>
    </tr>
  );
}
