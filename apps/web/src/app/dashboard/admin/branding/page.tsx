'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Branding now lives on the consolidated White Label page alongside custom domain.
export default function BrandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/white-label');
  }, [router]);
  return <div className="container-page py-20 text-center text-muted">Redirecting…</div>;
}
