// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LibrarySessionProvider } from './context/LibrarySessionContext';
import { RequireAuth, RequireRole, RequireGuest } from './components/shared/RouteGuard';
import AppLayout from './components/shared/AppLayout';

import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import DashboardPage      from './pages/DashboardPage';
import CatalogPage        from './pages/CatalogPage';
import LoggerPage         from './pages/LoggerPage';
import BorrowingPage      from './pages/BorrowingPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ReportsPage        from './pages/admin/ReportsPage';
import StudentRecordsPage from './pages/staff/StudentRecordsPage';
import QRLoggerPage       from './pages/staff/QRLoggerPage';
import AuthActionPage     from './pages/AuthActionPage';

function Layout({ children }) {
  return <AppLayout>{children}</AppLayout>;
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

            {/* App shell — all auth-required routes */}
            <Route path="/dashboard" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
            <Route path="/catalog"   element={<RequireAuth><Layout><CatalogPage /></Layout></RequireAuth>} />
            <Route path="/logger"    element={<RequireAuth><Layout><LoggerPage /></Layout></RequireAuth>} />
            <Route path="/borrows"   element={<RequireAuth><Layout><BorrowingPage /></Layout></RequireAuth>} />
            <Route path="/student/borrows" element={<RequireAuth><Layout><BorrowingPage /></Layout></RequireAuth>} />

            {/* Staff + Admin */}
            <Route path="/staff/students" element={
              <RequireAuth>
                <RequireRole roles={['admin', 'staff']}>
                  <Layout><StudentRecordsPage /></Layout>
                </RequireRole>
              </RequireAuth>
            } />
            <Route path="/staff/qr-logger" element={
              <RequireAuth>
                <RequireRole roles={['admin', 'staff']}>
                  <Layout><QRLoggerPage /></Layout>
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

            {/* Firebase out-of-band action handler */}
            <Route path="/auth/action" element={<AuthActionPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LibrarySessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
