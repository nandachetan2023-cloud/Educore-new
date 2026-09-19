'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Custom domain now lives on the consolidated White Label page alongside branding.
export default function DomainRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/admin/white-label');
  }, [router]);
  return <div className="container-page py-20 text-center text-muted">Redirecting…</div>;
}
