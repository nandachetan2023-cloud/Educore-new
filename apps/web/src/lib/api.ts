const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'educore.accessToken';
const REFRESH_KEY = 'educore.refreshToken';
const DEV_TENANT_COOKIE = 'educore.devTenant';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Tells the API which tenant this request belongs to. The API's own origin
 * differs from a tenant's custom domain, so it can't infer this from its own
 * Host header — the web app has to say so explicitly. Prefers the
 * `middleware.ts`-set dev cookie (local testing without owning real DNS),
 * falling back to the page's own hostname for real custom domains.
 */
function tenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const devTenant = readCookie(DEV_TENANT_COOKIE);
  return devTenant ? { 'X-Tenant-Id': devTenant } : { 'X-Tenant-Domain': window.location.hostname };
}

export const tokenStore = {
  get access() {
    return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.auth !== false && tokenStore.access) {
    headers.set('Authorization', `Bearer ${tokenStore.access}`);
  }
  for (const [k, v] of Object.entries(tenantHeaders())) headers.set(k, v);

  const res = await fetch(`${BASE}${path}`, { ...options, headers, cache: 'no-store' });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? message;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Fetches a binary endpoint (e.g. a PDF) with auth and triggers a download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  if (tokenStore.access) headers.set('Authorization', `Bearer ${tokenStore.access}`);
  for (const [k, v] of Object.entries(tenantHeaders())) headers.set(k, v);
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      /* binary or empty body */
    }
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
