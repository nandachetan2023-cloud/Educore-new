'use client';

import {
  Award, BarChart3, Bell, BookOpen, Briefcase, Camera, Check, ChevronDown, Clock, Code2,
  FileText, Globe, GraduationCap, HeartPulse, Lock, Megaphone, Music, Palette, Play,
  Search, ShieldCheck, ShoppingCart, Sprout, Star, TrendingUp, Users,
} from 'lucide-react';
import { useBranding } from '@/lib/providers';

export const Icons = {
  Award, BarChart3, Bell, BookOpen, Briefcase, Camera, Check, ChevronDown, Clock, Code2,
  FileText, Globe, GraduationCap, HeartPulse, Lock, Megaphone, Music, Palette, Play,
  Search, ShieldCheck, ShoppingCart, Sprout, Star, TrendingUp, Users,
};

/** White-label graduation-cap logo tile (reference header/footer brand mark). */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const branding = useBranding();
  const dims = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  if (branding?.logo && !branding.logo.endsWith('.svg')) {
    return <img src={branding.logo} alt={branding.name} className="h-8 w-auto max-w-[140px] object-contain" />;
  }
  return (
    <span className={`grid ${dims} shrink-0 place-items-center rounded-full bg-brand text-white`}>
      <GraduationCap className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
    </span>
  );
}

export function BrandName({ className = '' }: { className?: string }) {
  const branding = useBranding();
  return <span className={className}>{branding?.name ?? 'EduCore'}</span>;
}

/** Blue star rating row (reference style), with optional count. */
export function Stars({ rating = 5, count, size = 'sm' }: { rating?: number; count?: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm font-bold text-brand">{(rating ?? 0).toFixed(1)}</span>
      <span className="inline-flex gap-px" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`${cls} ${i < Math.round(rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'fill-line text-line'}`} />
        ))}
      </span>
      {typeof count === 'number' && count > 0 && (
        <span className="text-xs text-muted">({count.toLocaleString()})</span>
      )}
    </span>
  );
}

/** Deterministic photo fallback so cards look like the reference even without thumbnails. */
export function thumbFor(seed: string | number, w = 640, h = 360): string {
  return `https://picsum.photos/seed/educore-${seed}/${w}/${h}`;
}

/** Course thumbnail with photo fallback. */
export function CourseThumb({
  src, seed, alt, className = 'h-full w-full object-cover',
}: {
  src?: string | null; seed: string | number; alt: string; className?: string;
}) {
  return <img src={src || thumbFor(seed)} alt={alt} loading="lazy" className={className} />;
}

const CATEGORY_ICON_KEYS: { match: string[]; icon: keyof typeof Icons }[] = [
  { match: ['develop', 'code', 'program', 'software', 'web'], icon: 'Code2' },
  { match: ['design', 'ui', 'ux', 'art', 'creativ'], icon: 'Palette' },
  { match: ['business', 'manag', 'leader', 'entrepreneur'], icon: 'Briefcase' },
  { match: ['market'], icon: 'Megaphone' },
  { match: ['financ', 'account', 'invest', 'money'], icon: 'TrendingUp' },
  { match: ['health', 'fitness', 'medic', 'yoga'], icon: 'HeartPulse' },
  { match: ['music', 'audio', 'guitar', 'piano'], icon: 'Music' },
  { match: ['photo', 'camera', 'video', 'film'], icon: 'Camera' },
  { match: ['personal', 'growth', 'mind', 'productiv', 'life'], icon: 'Sprout' },
  { match: ['academ', 'science', 'math', 'physic', 'cognit', 'learn'], icon: 'GraduationCap' },
  { match: ['data', 'analy', 'stat', 'ai', 'machine'], icon: 'BarChart3' },
  { match: ['language', 'english', 'spanish'], icon: 'Globe' },
];

/** Line-icon tile for a category name (reference category cards). */
export function CategoryIcon({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  const found = CATEGORY_ICON_KEYS.find((k) => k.match.some((m) => lower.includes(m)));
  const Icon = Icons[found?.icon ?? 'BookOpen'];
  return <Icon className={className} strokeWidth={1.75} />;
}
