export function getHomeForRole(role?: string): string {
  switch (role) {
    case 'student':
      return '/student-portal';
    case 'accountant':
      return '/accountant';
    case 'registrar':
      return '/registrar';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
