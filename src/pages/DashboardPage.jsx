// src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard   from '../components/admin/AdminDashboard';
import StaffDashboard   from '../components/staff/StaffDashboard';
import StudentDashboard from '../components/student/StudentDashboard';

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  // This will naturally route the Professor based on whatever their role is toggled to!
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  return <StudentDashboard />;
}