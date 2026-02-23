import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RoleRedirect() {
  const { user } = useAuth();
  if (user?.role === 'student') {
    return <Navigate to="/student-portal" replace />;
  }
  return <Navigate to="/" replace />;
}
