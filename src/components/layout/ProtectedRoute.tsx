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
  const { user, isLoading } = useAuth();
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
