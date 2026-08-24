/**
 * Convert stored paths to authenticated /api/files/... URLs.
 * Supports local /uploads/..., Supabase sb:bucket/path, and remote https URLs.
 */
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  const bad = /your-backend-host|YOUR-BACKEND|YOUR-API|example\.com|your-domain/i;

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.endsWith('.vercel.app')) return '/api';
    if (protocol === 'https:' && (!raw || bad.test(raw))) return '/api';
  }

  if (!raw || bad.test(raw)) return '/api';
  if (/^https?:\/\//i.test(raw)) {
    try {
      if (bad.test(new URL(raw).hostname)) return '/api';
    } catch {
      return '/api';
    }
  }
  return raw.replace(/\/$/, '');
}

export function getAuthenticatedFileUrl(storedPath: string | undefined | null): string {
  if (!storedPath) return '';

  const apiBase = resolveApiBase();
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
