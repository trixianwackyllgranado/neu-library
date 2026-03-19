// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LibrarySessionProvider } from './context/LibrarySessionContext';
import { RequireAuth, RequireRole, RequireGuest } from './components/shared/RouteGuard';
import AppLayout from './components/shared/AppLayout';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import VisitorKioskPage from './pages/VisitorKioskPage';
import LoggerPage       from './pages/LoggerPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ReportsPage      from './pages/admin/ReportsPage';
import { useAuth }      from './context/AuthContext';

// Layout wrapper for admin/staff only
function Layout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}

// Smart dashboard router — visitors bypass AppLayout entirely and go to
// the full-screen kiosk. Admin/staff get the sidebar layout.
function DashboardRouter() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  // Visitor (student or faculty) → full-screen kiosk, no sidebar
  if (role === 'visitor') return <VisitorKioskPage />;

  // Admin / Staff → sidebar layout with their dashboards
  return <Layout><DashboardPage /></Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LibrarySessionProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<RequireGuest><LoginPage /></RequireGuest>} />
            <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />

            {/* Dashboard — role-aware layout split happens inside DashboardRouter */}
            <Route path="/dashboard" element={
              <RequireAuth>
                <DashboardRouter />
              </RequireAuth>
            } />

            {/* Logger — staff and admin only */}
            <Route path="/logger" element={
              <RequireAuth>
                <RequireRole roles={['staff', 'admin']}>
                  <Layout><LoggerPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />

            {/* Admin only */}
            <Route path="/admin/users" element={
              <RequireAuth>
                <RequireRole roles={['admin']}>
                  <Layout><UserManagementPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/admin/reports" element={
              <RequireAuth>
                <RequireRole roles={['admin']}>
                  <Layout><ReportsPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LibrarySessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
