import { useQuery } from 'react-query';
import { authService } from '../api/services';

export function useAuth() {
  const token = localStorage.getItem('token');
  const { data: user, isLoading, error } = useQuery(
    'auth-user',
    () => authService.me().then((r) => r.data),
    { enabled: !!token, retry: false }
  );

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading: !!token && isLoading,
    error,
  };
}
