/** Read double-submit CSRF token from document.cookie */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfFetchPromise: Promise<void> | null = null;

/** Fetch fresh CSRF cookie from API (call before login / forms). */
export async function ensureCsrfToken(apiBase = '/api'): Promise<void> {
  if (getCsrfTokenFromCookie()) return;

  if (!csrfFetchPromise) {
    const base = apiBase.replace(/\/$/, '');
    csrfFetchPromise = fetch(`${base}/auth/csrf`, { credentials: 'include' })
      .then(() => undefined)
      .finally(() => {
        csrfFetchPromise = null;
      });
  }

  await csrfFetchPromise;
}
