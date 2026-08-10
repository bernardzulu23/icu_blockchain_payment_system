import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';
import { getHomeForRole } from '../utils/routing';

type Props = {
  children: React.ReactNode;
  roles: Array<'admin' | 'accountant' | 'registrar' | 'student'>;
};

export default function RoleRoute({ children, roles }: Props) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg">
        <div className="glass-card p-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const role = user?.role as Props['roles'][number] | undefined;
  if (!role || !roles.includes(role)) {
    return <Navigate to={getHomeForRole(role)} replace />;
  }

  return <>{children}</>;
}
