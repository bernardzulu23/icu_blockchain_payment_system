import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center page-bg">
        <div className="glass-card p-8">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 dark:text-slate-400 mt-4">Loading...</p>
        </div>
      </div>
    );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
