// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LibrarySessionProvider } from './context/LibrarySessionContext';
import { RequireAuth, RequireRole, RequireGuest } from './components/shared/RouteGuard';
import AppLayout from './components/shared/AppLayout';

import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import DashboardPage       from './pages/DashboardPage';
import VisitorKioskPage    from './pages/VisitorKioskPage';
import LoggerPage          from './pages/LoggerPage';
import UserManagementPage  from './pages/admin/UserManagementPage';
import ReportsPage         from './pages/admin/ReportsPage';
import EditRequestsPage    from './pages/admin/EditRequestsPage';
import StaffKioskPage      from './pages/staff/StaffKioskPage';
import { useAuth }         from './context/AuthContext';

function Layout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}

function DashboardRouter() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  if (role === 'visitor') return <VisitorKioskPage />;
  return <Layout><DashboardPage /></Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LibrarySessionProvider>
          <Routes>
            <Route path="/login"    element={<RequireGuest><LoginPage /></RequireGuest>} />
            <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />

            <Route path="/dashboard" element={
              <RequireAuth><DashboardRouter /></RequireAuth>
            } />

            <Route path="/logger" element={
              <RequireAuth>
                <RequireRole roles={['staff','admin']}>
                  <Layout><LoggerPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />

            <Route path="/staff/kiosk" element={
              <RequireAuth>
                <RequireRole roles={['staff','admin']}>
                  <Layout><StaffKioskPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />

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
            <Route path="/admin/edit-requests" element={
              <RequireAuth>
                <RequireRole roles={['admin']}>
                  <Layout><EditRequestsPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LibrarySessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
