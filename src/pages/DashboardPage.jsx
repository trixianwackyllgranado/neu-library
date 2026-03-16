
import { useAuth } from '../context/AuthContext';
import AdminDashboard      from '../components/admin/AdminDashboard';
import StaffDashboard      from '../components/staff/StaffDashboard';
import StudentDashboard    from '../components/student/StudentDashboard';
import ProfessorDashboard  from '../components/professor/ProfessorDashboard';
import VisitorStatsPage    from '../components/professor/VisitorStatsPage';

const ALLOWED_ADMIN_EMAILS = [
  'jcesperanza@neu.edu.ph',
  'trixianwackyll.granado@neu.edu.ph' // <--- Change this to the exact email you used to log in
];

export default function DashboardPage() {
  const { userProfile, currentUser } = useAuth();
  const role = userProfile?.role;

  // 2. We now check if the logged-in Google user is in our allowed list
  if (currentUser?.email && ALLOWED_ADMIN_EMAILS.includes(currentUser.email)) {
    if (role === 'admin') return <VisitorStatsPage />;
    return <ProfessorDashboard />; // role === 'student' → regular user view
  }

  // All existing users — completely unchanged
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  return <StudentDashboard />;
}