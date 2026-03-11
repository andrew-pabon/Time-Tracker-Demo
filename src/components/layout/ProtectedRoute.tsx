import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { ROLE_HIERARCHY, type UserRole } from "@/lib/constants";
import { useEffect, useRef } from "react";

interface ProtectedRouteProps {
  /** Minimum role required to access child routes. */
  minRole?: UserRole;
}

/**
 * Wraps child routes and enforces authentication + role requirements.
 *
 * If the user is not authenticated → redirect to /login.
 * If the user's role is below minRole → redirect to / with a toast.
 * While auth is loading → render a full-page loading state.
 */
export function ProtectedRoute({ minRole }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth();
  const { toast } = useToast();
  const hasToasted = useRef(false);

  const isUnauthorized =
    !isLoading &&
    user &&
    minRole &&
    ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minRole];

  useEffect(() => {
    if (isUnauthorized && !hasToasted.current) {
      toast("You don't have permission to access that page.", "error");
      hasToasted.current = true;
    }
  }, [isUnauthorized, toast]);

  // Still loading auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Session is valid but profile couldn't be loaded (e.g. cold DB) — don't
  // force re-login, just let the user refresh to retry.
  if (!user && session) {
    return <DatabaseUnavailableScreen />;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role too low
  if (isUnauthorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * Full-page loading indicator shown during initial auth check.
 */
function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-300 border-t-brand-600" />
        <p className="text-sm text-surface-500">Loading…</p>
      </div>
    </div>
  );
}

/**
 * Shown when the user is authenticated but the database couldn't be reached
 * (e.g. Supabase free-tier cold start). Prompts a refresh rather than
 * forcing re-login.
 */
function DatabaseUnavailableScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-base font-medium text-surface-800">
          Having trouble connecting
        </p>
        <p className="max-w-xs text-sm text-surface-500">
          The database took too long to respond. This can happen after a period
          of inactivity. Please refresh to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
