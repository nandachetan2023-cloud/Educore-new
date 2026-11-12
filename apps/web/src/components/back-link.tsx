import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Standard in-page back affordance. Shown on top of sub-pages so users can
 * always return to the parent module without relying on the browser or sidebar.
 */
export function BackLink({
  href,
  label = 'Back',
  className = 'mb-4',
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {label}
      </Link>
    </div>
  );
}
