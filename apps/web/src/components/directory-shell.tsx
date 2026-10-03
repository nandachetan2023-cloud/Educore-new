'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Building2, ChevronsUpDown, LogOut, Search, type LucideIcon } from 'lucide-react';
import { isValidElement } from 'react';
import { useBranding } from '@/lib/providers';
import { BrandMark, BrandName } from '@/components/ui';

export interface ShellLink {
  /** Route link. Omit for an in-page action (rendered as a button). */
  href?: string;
  label: string;
  /** Lucide component or a pre-rendered element (both render the same). */
  icon: LucideIcon | React.ReactNode;
  /** Prefix match for detail pages (defaults to href + '/'). Use '' to disable. */
  match?: string;
  badge?: number;
  onClick?: () => void;
  /** Force active state (for action links tied to local tab state). */
  active?: boolean;
}

export interface ShellSection {
  heading: string;
  links: ShellLink[];
}

interface DirectoryShellProps {
  /** Small caption under the brand name, e.g. "Admin Console". */
  eyebrow: string;
  /** Workspace chip, e.g. tenant brand name. Falls back to brand name. */
  tenantName?: string;
  sections: ShellSection[];
  userName: string;
  userCaption: string;
  userImage?: string | null;
  onLogout: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (v: string) => void;
  notifCount?: number;
  children: React.ReactNode;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

function isActive(pathname: string, link: ShellLink): boolean {
  if (link.active !== undefined) return link.active;
  if (link.href && pathname === link.href) return true;
  const prefix = link.match === undefined ? (link.href ? `${link.href}/` : '') : link.match;
  return prefix !== '' && pathname.startsWith(prefix);
}

function linkKey(link: ShellLink): string {
  return `${link.href ?? 'action'}:${link.label}`;
}

function renderIcon(icon: ShellLink['icon'], className: string): React.ReactNode {
  if (isValidElement(icon)) return icon;
  const Icon = icon as LucideIcon;
  return <Icon className={className} />;
}

/**
 * Shared light directory shell (fixed w-64 sidebar + fixed header),
 * used by every dashboard so the left navbar design stays consistent.
 */
export function DirectoryShell({
  eyebrow,
  tenantName,
  sections,
  userName,
  userCaption,
  userImage,
  onLogout,
  searchPlaceholder = 'Search…',
  searchValue,
  onSearch,
  notifCount = 0,
  children,
}: DirectoryShellProps) {
  const pathname = usePathname();
  const branding = useBranding();
  const workspace = tenantName ?? branding?.name ?? 'Workspace';

  const allLinks = sections.flatMap((s) => s.links);

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sidebar (desktop) ─────────────────────────── */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col justify-between overflow-y-auto border-r border-line bg-card py-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:flex">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 px-6">
            <BrandMark size="sm" />
            <div className="flex min-w-0 flex-col">
              <BrandName className="truncate text-[15px] font-extrabold leading-tight text-ink" />
              <span className="text-[11px] font-medium text-muted">{eyebrow}</span>
            </div>
          </div>

          <div className="px-4">
            <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand text-[11px] font-bold text-white">
                  {workspace[0]?.toUpperCase() ?? 'W'}
                </span>
                <span className="truncate text-[13px] font-semibold text-ink">{workspace}</span>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-4">
            {sections.map((section) => (
              <div key={section.heading}>
                <p className="px-4 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted first:pt-0">
                  {section.heading}
                </p>
                {section.links.map((l) => {
                  const active = isActive(pathname, l);
                  const cls = `flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] transition ${
                    active
                      ? 'bg-brand font-semibold text-white shadow-sm'
                      : 'font-medium text-muted hover:bg-surface hover:text-ink'
                  }`;
                  const inner = (
                    <>
                      {renderIcon(l.icon, 'h-[18px] w-[18px] shrink-0')}
                      <span className="flex-1 truncate">{l.label}</span>
                      {l.badge != null && l.badge > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand'
                          }`}
                        >
                          {l.badge}
                        </span>
                      )}
                    </>
                  );
                  return l.href ? (
                    <Link
                      key={linkKey(l)}
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button key={linkKey(l)} onClick={l.onClick} className={`${cls} w-full text-left`}>
                      {inner}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 px-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
            {userImage ? (
              <img src={userImage} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {initials(userName || 'U')}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{userName}</p>
              <p className="truncate text-[11px] text-muted">{userCaption}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-muted transition hover:bg-card hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" />
            </span>
            <span className="text-[11px] font-semibold text-green-700">Environment: Live</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile nav ────────────────────────────────── */}
      <div className="border-b border-line bg-card lg:hidden">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <BrandMark size="sm" />
          <BrandName className="text-[15px] font-extrabold text-ink" />
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {allLinks.map((l) => {
            const active = isActive(pathname, l);
            const cls = `flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold ${
              active ? 'bg-brand text-white' : 'border border-line text-muted'
            }`;
            const inner = (
              <>
                {renderIcon(l.icon, 'h-4 w-4')} {l.label}
              </>
            );
            return l.href ? (
              <Link key={linkKey(l)} href={l.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={linkKey(l)} onClick={l.onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Main column ───────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md flex-1">
              {onSearch ? (
                <label className="relative flex items-center">
                  <Search className="absolute left-4 h-4 w-4 text-muted" />
                  <input
                    value={searchValue ?? ''}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 w-full rounded-xl bg-surface py-2 pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                </label>
              ) : (
                <span className="hidden items-center gap-2.5 sm:flex">
                  <Building2Icon />
                  <span className="truncate text-sm font-semibold text-ink">{workspace}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                title="Notifications"
                className="relative rounded-xl p-2 text-muted transition hover:bg-surface hover:text-ink"
              >
                <Bell className="h-5 w-5" />
                {notifCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {notifCount}
                  </span>
                )}
              </button>
              <div className="hidden items-center gap-2.5 sm:flex">
                {userImage ? (
                  <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                    {initials(userName || 'U')}
                  </span>
                )}
                <div className="hidden flex-col leading-tight md:flex">
                  <span className="text-[13px] font-semibold text-ink">{userName}</span>
                  <span className="text-[11px] text-muted">{userCaption}</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Building2Icon() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft">
      <Building2 className="h-4 w-4 text-brand" />
    </span>
  );
}
