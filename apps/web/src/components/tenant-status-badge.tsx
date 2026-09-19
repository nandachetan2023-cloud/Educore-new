import type { TenantRow } from '@/lib/types';

export function TenantStatusBadge({ status }: { status: TenantRow['status'] }) {
  const styles: Record<TenantRow['status'], string> = {
    active: 'bg-green-500/15 text-green-600',
    pending_setup: 'bg-amber-500/15 text-amber-600',
    past_due: 'bg-amber-500/15 text-amber-600',
    suspended: 'bg-red-500/15 text-red-600',
  };

  return <span className={`badge ${styles[status]}`}>{status.replace('_', ' ')}</span>;
}
