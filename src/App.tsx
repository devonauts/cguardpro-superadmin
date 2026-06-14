import { Routes, Route } from "react-router-dom";
import ProtectedRoute, { PublicOnlyRoute } from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TenantsList from "./pages/tenants/TenantsList";
import TenantDetail from "./pages/tenants/TenantDetail";
import BillingPage from "./pages/billing/BillingPage";
import TenantBillingDetail from "./pages/billing/TenantBillingDetail";
import UsersPage from "./pages/users/UsersPage";
import ObservabilityPage from "./pages/observability/ObservabilityPage";
import AuditLogPage from "./pages/audit/AuditLogPage";
import StripeSettingsPage from "./pages/settings/StripeSettingsPage";
import AddonCoursesPage from "./pages/training/AddonCoursesPage";
import GrantsPage from "./pages/training/GrantsPage";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tenants" element={<TenantsList />} />
        <Route path="tenants/:id" element={<TenantDetail />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/tenants/:id" element={<TenantBillingDetail />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="training/courses" element={<AddonCoursesPage />} />
        <Route path="training/grants" element={<GrantsPage />} />
        <Route path="observability" element={<ObservabilityPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="settings/stripe" element={<StripeSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
