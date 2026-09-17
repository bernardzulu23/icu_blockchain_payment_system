import { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { authService } from '../api/services';
import type { User } from '../api/services';

export function useAuth() {
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const { data: user, isLoading, isFetching, error, isError } = useQuery(
    'auth-user',
    () => authService.me().then((r) => r.data),
    {
      enabled: !!token,
      retry: false,
      staleTime: 60_000,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    // Failed /me with a token and no cached user → clear session (avoid stuck 95% spinner)
    if (token && isError && !isFetching && !user) {
      localStorage.removeItem('token');
      queryClient.setQueryData('auth-user', null);
      queryClient.removeQueries('auth-user');
    }
  }, [token, isError, isFetching, user, queryClient]);

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    // Only block UI when we have a token but no user yet
    isLoading: !!token && !user && (isLoading || isFetching),
    error,
    setUser: (next: User | null) => queryClient.setQueryData('auth-user', next),
  };
}
