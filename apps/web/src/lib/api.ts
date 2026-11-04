/**
 * Base URL for client-side API calls. Defaults to the same origin (`/api`),
 * which `next.config.mjs` rewrites to the backend — so no API host is baked
 * into the browser bundle and no CORS is needed. Set NEXT_PUBLIC_API_URL to
 * call the API directly instead (e.g. dev, or an API on its own domain).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/**
 * Base for server-side (SSR) fetches, which can't use relative URLs.
 * Falls back to the API's local origin — matches the deployment where both
 * apps run on the same host.
 */
export const API_INTERNAL_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const BASE = API_BASE;

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

/**
 * Builds the backend URL that starts an OAuth sign-in (full-page redirect).
 * Carries the same tenant context as API calls (dev cookie id or page
 * hostname for custom domains) plus the requested role, so the callback
 * can create the account in the right workspace.
 */
export function oauthStartUrl(provider: 'google' | 'github', role: 'student' | 'instructor' = 'student'): string {
  const params = new URLSearchParams({ role });
  if (typeof document !== 'undefined') {
    const devTenant = readCookie(DEV_TENANT_COOKIE);
    if (devTenant) params.set('tenant', devTenant);
    else if (window.location.hostname) params.set('domain', window.location.hostname);
  }
  return `${BASE}/auth/oauth/${provider}?${params.toString()}`;
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

// ── Transparent access-token refresh ─────────────────────────────────
// Access tokens live only 15 minutes; without this, every admin console
// page kicks the user back to /login after 15 minutes of use (stored
// refreshToken was never exchanged). On a 401 we swap the refresh token
// for a fresh pair once, then replay the failed request. Auth endpoints
// that must surface their own errors are excluded from the retry.

/** In-flight refresh round-trip shared by all concurrent 401 responses. */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken =
    typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  // Single flight: N parallel 401s share N-1 no-ops.
  refreshInFlight ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken?: string };
      if (!data?.accessToken) return false;
      tokenStore.set(data.accessToken, data.refreshToken ?? refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Says "this 401 is a real auth problem, do not exchange tokens for it". */
function notRetryable(path: string): boolean {
  return /^\/auth\/(refresh|login|admin\/login|register)\b/.test(path);
}

/** Sends a request; transparently retries once after a successful refresh. */
async function sendWithRetry(path: string, init: RequestInit): Promise<Response> {
  let res = await fetch(`${BASE}${path}`, init);
  if (
    res.status === 401 &&
    typeof window !== 'undefined' &&
    localStorage.getItem(REFRESH_KEY) &&
    !notRetryable(path) &&
    (await tryRefresh())
  ) {
    const headers = new Headers(init.headers);
    if (tokenStore.access) headers.set('Authorization', `Bearer ${tokenStore.access}`);
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  }
  return res;
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

  const res = await sendWithRetry(path, { ...options, headers, cache: 'no-store' });

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
  const res = await sendWithRetry(path, { headers });
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
