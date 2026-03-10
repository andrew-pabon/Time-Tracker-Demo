import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// Pages
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MyEntriesPage } from "@/pages/MyEntriesPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { ReviewDetailPage } from "@/pages/ReviewDetailPage";
import { AdminCustomersPage } from "@/pages/admin/AdminCustomersPage";
import { AdminCategoriesPage } from "@/pages/admin/AdminCategoriesPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — no shell, no auth required */}
        <Route path="/login" element={<LoginPage />} />

        {/* All authenticated routes share the AppShell layout.
            AppShell itself handles redirect to /login if not authed. */}
        <Route element={<AppShell />}>
          {/* Dashboard: any authenticated user */}
          <Route path="/" element={<DashboardPage />} />

          {/* Reports: any authenticated user */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* My Entries: consultant+ */}
          <Route element={<ProtectedRoute minRole="consultant" />}>
            <Route path="/entries" element={<MyEntriesPage />} />
          </Route>

          {/* Review: manager+ */}
          <Route element={<ProtectedRoute minRole="manager" />}>
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/review/:periodId" element={<ReviewDetailPage />} />
          </Route>

          {/* Admin: admin only */}
          <Route element={<ProtectedRoute minRole="admin" />}>
            <Route path="/admin/customers" element={<AdminCustomersPage />} />
            <Route
              path="/admin/categories"
              element={<AdminCategoriesPage />}
            />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
        </Route>

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
