// src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard from '../components/admin/AdminDashboard';
import StaffDashboard from '../components/staff/StaffDashboard';

// NOTE: Visitors are NOT rendered here — App.jsx routes them directly to
// VisitorKioskPage which has its own full-screen layout (no sidebar).
// This component only handles admin and staff.
export default function DashboardPage() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  // Fallback — should not reach here for visitors
  return null;
}
