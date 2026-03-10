import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";

/**
 * The main app shell: sidebar + content area.
 * All authenticated routes render inside this layout.
 *
 * Redirects to /login if the user is not authenticated.
 * Shows a loading screen while auth is being resolved.
 */
export function AppShell() {
  const { user, isLoading } = useAuth();

  // Still resolving auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-300 border-t-brand-600" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
