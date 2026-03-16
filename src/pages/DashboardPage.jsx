// src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard      from '../components/admin/AdminDashboard';
import StaffDashboard      from '../components/staff/StaffDashboard';
import StudentDashboard    from '../components/student/StudentDashboard';
import ProfessorDashboard  from '../components/professor/ProfessorDashboard';

// Special Google accounts that can toggle between student/admin views
const ALLOWED_GOOGLE_EMAILS = [
  'jcesperanza@neu.edu.ph',
  'trixianwackyll.granado@neu.edu.ph'
];

export default function DashboardPage() {
  const { userProfile, currentUser } = useAuth();
  const role = userProfile?.role;

  // Google users with special permissions get custom routing
  const isGoogleUser = currentUser?.email && ALLOWED_GOOGLE_EMAILS.includes(currentUser.email);
  
  if (isGoogleUser) {
    // When in admin role, show normal admin dashboard
    if (role === 'admin') return <AdminDashboard />;
    // When in student role, show professor dashboard (no QR code issues)
    return <ProfessorDashboard />;
  }

  // Regular users (registered with ID number) - normal routing
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  return <StudentDashboard />;
}