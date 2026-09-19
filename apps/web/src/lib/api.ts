const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'educore.accessToken';
const REFRESH_KEY = 'educore.refreshToken';

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
