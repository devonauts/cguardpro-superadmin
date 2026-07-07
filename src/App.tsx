import { Routes, Route } from "react-router-dom";
import ProtectedRoute, { PublicOnlyRoute } from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TenantsList from "./pages/tenants/TenantsList";
import TenantDetail from "./pages/tenants/TenantDetail";
import BillingPage from "./pages/billing/BillingPage";
import TenantBillingDetail from "./pages/billing/TenantBillingDetail";
import PlansPage from "./pages/plans/PlansPage";
import SandboxesPage from "./pages/sandboxes/SandboxesPage";
import UsersPage from "./pages/users/UsersPage";
import ObservabilityPage from "./pages/observability/ObservabilityPage";
import SlowQueriesPage from "./pages/observability/SlowQueriesPage";
import WorkersPage from "./pages/observability/WorkersPage";
import ErrorsPage from "./pages/observability/ErrorsPage";
import AccessLogsPage from "./pages/observability/AccessLogsPage";
import AuditLogPage from "./pages/audit/AuditLogPage";
import StripeSettingsPage from "./pages/settings/StripeSettingsPage";
import TwilioSettingsPage from "./pages/settings/TwilioSettingsPage";
import PhoneCenter from "./pages/phone/PhoneCenter";
import CommsAnalyticsPage from "./pages/comms/CommsAnalyticsPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import BroadcastPushPage from "./pages/broadcast-push/BroadcastPushPage";
import AddonCoursesPage from "./pages/training/AddonCoursesPage";
import GrantsPage from "./pages/training/GrantsPage";
import DemoControlPage from "./pages/demo/DemoControlPage";
import FeedbackList from "./pages/feedback/FeedbackList";
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
        <Route path="plans" element={<PlansPage />} />
        <Route path="sandboxes" element={<SandboxesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="feedback" element={<FeedbackList />} />
        <Route path="phone" element={<PhoneCenter />} />
        <Route path="phone/analytics" element={<CommsAnalyticsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="broadcast-push" element={<BroadcastPushPage />} />
        <Route path="training/courses" element={<AddonCoursesPage />} />
        <Route path="training/grants" element={<GrantsPage />} />
        <Route path="observability" element={<ObservabilityPage />} />
        <Route path="observability/queries" element={<SlowQueriesPage />} />
        <Route path="observability/workers" element={<WorkersPage />} />
        <Route path="observability/errors" element={<ErrorsPage />} />
        <Route path="observability/access" element={<AccessLogsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="settings/stripe" element={<StripeSettingsPage />} />
        <Route path="settings/twilio" element={<TwilioSettingsPage />} />
        <Route path="demo" element={<DemoControlPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
