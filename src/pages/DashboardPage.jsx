// src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard      from '../components/admin/AdminDashboard';
import StaffDashboard      from '../components/staff/StaffDashboard';
import StudentDashboard    from '../components/student/StudentDashboard';
import ProfessorDashboard  from '../components/professor/ProfessorDashboard';
import VisitorStatsPage    from '../components/professor/VisitorStatsPage';

const PROFESSOR_EMAIL = 'jcesperanza@neu.edu.ph';

export default function DashboardPage() {
  const { userProfile, currentUser } = useAuth();
  const role = userProfile?.role;

  // Professor (Google account) gets their own views based on their current role
  if (currentUser?.email === PROFESSOR_EMAIL) {
    if (role === 'admin') return <VisitorStatsPage />;
    return <ProfessorDashboard />;          // role === 'student' → regular user view
  }

  // All existing users — completely unchanged
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  return <StudentDashboard />;
}
