import { NextRequest, NextResponse } from 'next/server';

export const DEV_TENANT_COOKIE = 'educore.devTenant';

/**
 * Dev-only tenant simulation for local testing without owning a real custom
 * domain: visit any page with `?tenant=<id>` (the tenant's numeric id, as
 * shown in the Superadmin console) and it's remembered in a cookie for the
 * rest of the session. `lib/api.ts` forwards it as the API's dev
 * `X-Tenant-Id` header. No-op once real custom domains (Host-based
 * resolution) are in use.
 */
export function middleware(req: NextRequest) {
  const tenant = req.nextUrl.searchParams.get('tenant');
  if (!tenant) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(DEV_TENANT_COOKIE, tenant, { path: '/', sameSite: 'lax' });
  return res;
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
