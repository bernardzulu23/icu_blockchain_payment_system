/**
 * Convert stored paths to authenticated /api/files/... URLs.
 * Supports local /uploads/..., Supabase sb:bucket/path, and remote https URLs.
 */
export function getAuthenticatedFileUrl(storedPath: string | undefined | null): string {
  if (!storedPath) return '';

  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

  const withToken = (url: string) => {
    if (!token) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  };

  if (storedPath.startsWith('sb:')) {
    const ref = storedPath.slice(3);
    return withToken(`${apiBase}/files/_sb/${encodeURIComponent(ref)}`);
  }

  if (/^https?:\/\//i.test(storedPath) && !storedPath.includes('/uploads/')) {
    return withToken(`${apiBase}/files?ref=${encodeURIComponent(storedPath)}`);
  }

  let relative = storedPath;
  if (relative.startsWith('/uploads/')) {
    relative = relative.slice('/uploads/'.length);
  } else if (relative.includes('/uploads/')) {
    relative = relative.split('/uploads/')[1];
  } else {
    relative = relative.replace(/^\//, '');
  }

  return withToken(`${apiBase}/files/${relative}`);
}
