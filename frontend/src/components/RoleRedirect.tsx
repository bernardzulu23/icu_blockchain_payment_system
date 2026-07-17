import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getHomeForRole } from '../utils/routing';

export default function RoleRedirect() {
  const { user } = useAuth();
  return <Navigate to={getHomeForRole(user?.role)} replace />;
}
