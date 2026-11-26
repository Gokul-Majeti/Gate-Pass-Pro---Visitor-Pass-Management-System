import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { AuditLogsPage } from './pages/admin/AuditLogsPage.jsx';
import { OrganizationSettingsPage } from './pages/admin/OrganizationSettingsPage.jsx';
import { ReportsPage } from './pages/admin/ReportsPage.jsx';
import { StaffManagementPage } from './pages/admin/StaffManagementPage.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { VerifyOtpPage } from './pages/auth/VerifyOtpPage.jsx';
import { HostDashboardPage } from './pages/host/HostDashboardPage.jsx';
import { InviteVisitorPage } from './pages/host/InviteVisitorPage.jsx';
import { SecurityScannerPage } from './pages/security/SecurityScannerPage.jsx';
import { WalkInPage } from './pages/security/WalkInPage.jsx';
import { CheckLogsPage } from './pages/shared/CheckLogsPage.jsx';
import { NotificationsPage } from './pages/shared/NotificationsPage.jsx';
import { PassesPage } from './pages/shared/PassesPage.jsx';
import { VisitorsDirectoryPage } from './pages/shared/VisitorsDirectoryPage.jsx';
import { PreRegisterPage } from './pages/visitor/PreRegisterPage.jsx';
import { VisitorDashboardPage } from './pages/visitor/VisitorDashboardPage.jsx';

function homeRouteForRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'security') return '/security';
  if (role === 'host') return '/host';
  return '/visitor';
}

function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeRouteForRole(user.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />

          {/* Visitor Routes */}
          <Route
            path="/visitor"
            element={
              <ProtectedRoute allowedRoles={['visitor', 'admin']}>
                <VisitorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitor/pre-register"
            element={
              <ProtectedRoute allowedRoles={['visitor', 'admin']}>
                <PreRegisterPage />
              </ProtectedRoute>
            }
          />

          {/* Host Routes */}
          <Route
            path="/host"
            element={
              <ProtectedRoute allowedRoles={['host', 'admin']}>
                <HostDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/host/invite"
            element={
              <ProtectedRoute allowedRoles={['host', 'admin']}>
                <InviteVisitorPage />
              </ProtectedRoute>
            }
          />

          {/* Security Routes */}
          <Route
            path="/security"
            element={
              <ProtectedRoute allowedRoles={['security', 'admin']}>
                <SecurityScannerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security/walk-in"
            element={
              <ProtectedRoute allowedRoles={['security', 'admin']}>
                <WalkInPage />
              </ProtectedRoute>
            }
          />

          {/* Shared Authenticated Views */}
          <Route
            path="/passes"
            element={
              <ProtectedRoute allowedRoles={['visitor', 'host', 'security', 'admin']}>
                <PassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitors"
            element={
              <ProtectedRoute allowedRoles={['host', 'security', 'admin']}>
                <VisitorsDirectoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checklogs"
            element={
              <ProtectedRoute allowedRoles={['host', 'security', 'admin']}>
                <CheckLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={['visitor', 'host', 'security', 'admin']}>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StaffManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/organization"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrganizationSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
