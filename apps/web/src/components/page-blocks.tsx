import type { ComponentType } from 'react';
import {
  Award, BarChart3, BookOpen, Briefcase, Clock, Globe, GraduationCap, HeartPulse,
  Lock, Mail, MapPin, Megaphone, Music, Palette, Phone, Play, Quote, ShieldCheck,
  Sprout, Star, TrendingUp, Users, Zap,
} from 'lucide-react';
import type { PageBlock } from '@/lib/page-builder';

type IconComponent = ComponentType<{ className?: string }>;

const ICONS: Record<string, IconComponent> = {
  Award, BarChart3, BookOpen, Briefcase, Clock, Globe, GraduationCap, HeartPulse, Lock,
  Megaphone, Music, Palette, Play, ShieldCheck, Sprout, Star, TrendingUp, Users, Zap,
};

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
}

function paragraphs(value: string): string[] {
  return value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function safeHref(value: string): string | undefined {
  const href = value.trim();
  if (!href) return undefined;
  if (href.startsWith('/') || href.startsWith('#')) return href;
  if (/^https?:\/\//i.test(href) || /^(mailto|tel):/i.test(href)) return href;
  return undefined;
}

function safeImage(value: string): string | undefined {
  const src = value.trim();
  if (!src) return undefined;
  if (src.startsWith('/')) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return undefined;
}

function youtubeEmbed(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (!/(^|\.)youtube\.com$/.test(parsed.hostname)) return undefined;
    if (parsed.pathname.startsWith('/embed/')) return url;
    const id = parsed.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  } catch {
    return undefined;
  }
}

function Button({ label, href, secondary = false }: { label: string; href: string; secondary?: boolean }) {
  const safe = safeHref(href);
  if (!label || !safe) return null;
  return (
    <a
      href={safe}
      className={
        secondary
          ? 'inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10'
          : 'inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:brightness-110'
      }
    >
      {label}
    </a>
  );
}

function Hero({ data }: { data: Record<string, unknown> }) {
  const image = safeImage(str(data, 'image'));
  const centered = str(data, 'align') === 'center';
  return (
    <section className="relative overflow-hidden bg-[#101418] text-white">
      {image ? (
        <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-35" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#101418] via-[#18202a] to-brand/40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#101418]/90 via-[#101418]/60 to-transparent" />
      <div className={`container-page relative py-20 sm:py-28 ${centered ? 'text-center' : ''}`}>
        {str(data, 'eyebrow') && (
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">{str(data, 'eyebrow')}</p>
        )}
        <h1 className={`mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl ${centered ? 'mx-auto' : ''}`}>
          {str(data, 'title')}
        </h1>
        {str(data, 'subtitle') && (
          <p className={`mt-5 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-white/70 ${centered ? 'mx-auto' : ''}`}>
            {str(data, 'subtitle')}
          </p>
        )}
        {(str(data, 'primaryLabel') || str(data, 'secondaryLabel')) && (
          <div className={`mt-8 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>
            <Button label={str(data, 'primaryLabel')} href={str(data, 'primaryHref')} />
            <Button label={str(data, 'secondaryLabel')} href={str(data, 'secondaryHref')} secondary />
          </div>
        )}
      </div>
    </section>
  );
}

function RichText({ data }: { data: Record<string, unknown> }) {
  const bullets = str(data, 'bullets').split('\n').map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  return (
    <section className="container-page max-w-3xl py-14">
      {str(data, 'heading') && (
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'heading')}</h2>
      )}
      <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-ink/80">
        {paragraphs(str(data, 'body')).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">{paragraph}</p>
        ))}
      </div>
      {bullets.length > 0 && (
        <ul className="mt-6 space-y-2.5 text-[17px] text-ink/80">
          {bullets.map((bullet, index) => (
            <li key={index} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Features({ data }: { data: Record<string, unknown> }) {
  const items = rows(data.items);
  return (
    <section className="bg-surface py-16">
      <div className="container-page">
        {(str(data, 'heading') || str(data, 'intro')) && (
          <div className="max-w-2xl">
            {str(data, 'heading') && (
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'heading')}</h2>
            )}
            {str(data, 'intro') && <p className="mt-3 whitespace-pre-line text-muted">{str(data, 'intro')}</p>}
          </div>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const Icon = ICONS[str(item, 'icon')] ?? Star;
            return (
              <article key={index} className="rounded-2xl border border-line bg-card p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{str(item, 'title')}</h3>
                {str(item, 'description') && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{str(item, 'description')}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stats({ data }: { data: Record<string, unknown> }) {
  const items = rows(data.items);
  return (
    <section className="bg-brand-soft py-12">
      <div className="container-page">
        {str(data, 'heading') && (
          <h2 className="text-center font-display text-2xl font-semibold text-ink">{str(data, 'heading')}</h2>
        )}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <div key={index} className="text-center">
              <p className="font-display text-4xl font-semibold text-brand">{str(item, 'value')}</p>
              <p className="mt-1 text-sm font-medium text-muted">{str(item, 'label')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImageBlock({ data }: { data: Record<string, unknown> }) {
  const src = safeImage(str(data, 'src'));
  if (!src) return null;
  const contained = str(data, 'size') === 'contained';
  return (
    <section className={`py-12 ${contained ? 'container-page max-w-4xl' : ''}`}>
      <figure className={contained ? '' : 'container-page'}>
        <img
          src={src}
          alt={str(data, 'alt')}
          className="max-h-[620px] w-full rounded-2xl object-cover shadow-sm"
        />
        {str(data, 'caption') && (
          <figcaption className="mt-3 text-center text-sm text-muted">{str(data, 'caption')}</figcaption>
        )}
      </figure>
    </section>
  );
}

function VideoBlock({ data }: { data: Record<string, unknown> }) {
  const url = str(data, 'url');
  const embed = youtubeEmbed(url);
  const direct = /^https?:\/\/.*\.(mp4|webm|ogg)(\?.*)?$/i.test(url) ? url : undefined;
  if (!embed && !direct) {
    return url ? (
      <section className="container-page py-12">
        <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">
          Watch the video
        </a>
      </section>
    ) : null;
  }
  return (
    <section className="container-page max-w-4xl py-14">
      {str(data, 'title') && (
        <h2 className="mb-5 font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'title')}</h2>
      )}
      <div className="overflow-hidden rounded-2xl border border-line bg-black shadow-sm">
        {embed ? (
          <iframe
            src={embed}
            title={str(data, 'title') || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        ) : (
          <video src={direct} controls className="aspect-video w-full" />
        )}
      </div>
      {str(data, 'caption') && <p className="mt-3 text-center text-sm text-muted">{str(data, 'caption')}</p>}
    </section>
  );
}

function CallToAction({ data }: { data: Record<string, unknown> }) {
  const tone = str(data, 'tone');
  const panel =
    tone === 'dark'
      ? 'bg-[#101418] text-white'
      : tone === 'light'
        ? 'border border-line bg-card text-ink'
        : 'bg-brand text-white';
  return (
    <section className="container-page py-14">
      <div className={`rounded-3xl px-6 py-12 text-center shadow-sm sm:px-12 ${panel}`}>
        <h2 className="font-display text-3xl font-semibold tracking-tight">{str(data, 'title')}</h2>
        {str(data, 'text') && (
          <p className={`mx-auto mt-3 max-w-2xl whitespace-pre-line ${tone === 'light' ? 'text-muted' : 'text-white/80'}`}>
            {str(data, 'text')}
          </p>
        )}
        {(() => {
          const href = safeHref(str(data, 'buttonHref'));
          const label = str(data, 'buttonLabel');
          if (!href || !label) return null;
          return (
            <a
              href={href}
              className={`mt-7 inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110 ${
                tone === 'light' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-white text-ink'
              }`}
            >
              {label}
            </a>
          );
        })()}
      </div>
    </section>
  );
}

function Faq({ data }: { data: Record<string, unknown> }) {
  const items = rows(data.items);
  return (
    <section className="container-page max-w-3xl py-16">
      {str(data, 'heading') && (
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'heading')}</h2>
      )}
      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-card">
        {items.map((item, index) => (
          <details key={index} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
              {str(item, 'question')}
              <span className="text-brand transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            {str(item, 'answer') && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{str(item, 'answer')}</p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

function Testimonials({ data }: { data: Record<string, unknown> }) {
  const items = rows(data.items);
  return (
    <section className="bg-surface py-16">
      <div className="container-page">
        {str(data, 'heading') && (
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'heading')}</h2>
        )}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure key={index} className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <Quote className="h-6 w-6 text-brand/50" />
              <blockquote className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">
                {str(item, 'quote')}
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-semibold text-ink">{str(item, 'name')}</span>
                {str(item, 'role') && <span className="block text-muted">{str(item, 'role')}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ data }: { data: Record<string, unknown> }) {
  const rowsToShow = [
    { icon: Mail, label: str(data, 'email'), href: str(data, 'email') ? `mailto:${str(data, 'email')}` : '' },
    { icon: Phone, label: str(data, 'phone'), href: str(data, 'phone') ? `tel:${str(data, 'phone')}` : '' },
    { icon: MapPin, label: str(data, 'address'), href: '' },
    { icon: Clock, label: str(data, 'hours'), href: '' },
  ].filter((row) => row.label);
  return (
    <section className="container-page max-w-4xl py-16">
      {str(data, 'heading') && (
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{str(data, 'heading')}</h2>
      )}
      {str(data, 'intro') && <p className="mt-3 whitespace-pre-line text-muted">{str(data, 'intro')}</p>}
      {rowsToShow.length > 0 && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {rowsToShow.map(({ icon: Icon, label, href }, index) => (
            <div key={index} className="flex gap-3 rounded-2xl border border-line bg-card p-5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              {href ? (
                <a href={href} className="whitespace-pre-line text-sm text-ink/80 hover:text-brand">{label}</a>
              ) : (
                <p className="whitespace-pre-line text-sm text-ink/80">{label}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Divider({ data }: { data: Record<string, unknown> }) {
  const size = str(data, 'size');
  const space = size === 'sm' ? 'py-4' : size === 'lg' ? 'py-20' : 'py-10';
  return (
    <div className={`container-page ${space}`}>
      {str(data, 'label') ? (
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted">{str(data, 'label')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      ) : (
        <hr className="border-line" />
      )}
    </div>
  );
}

function Block({ block }: { block: PageBlock }) {
  const data = block.data ?? {};
  switch (block.type) {
    case 'hero':
      return <Hero data={data} />;
    case 'richText':
      return <RichText data={data} />;
    case 'features':
      return <Features data={data} />;
    case 'stats':
      return <Stats data={data} />;
    case 'image':
      return <ImageBlock data={data} />;
    case 'video':
      return <VideoBlock data={data} />;
    case 'cta':
      return <CallToAction data={data} />;
    case 'faq':
      return <Faq data={data} />;
    case 'testimonials':
      return <Testimonials data={data} />;
    case 'contact':
      return <Contact data={data} />;
    case 'divider':
      return <Divider data={data} />;
    default:
      return null;
  }
}

/** Renders a page's builder blocks. Blocks are plain data — all text is escaped by React. */
export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  const visible = blocks.filter((block) => !block.hidden);
  if (visible.length === 0) return null;
  return (
    <div>
      {visible.map((block) => (
        <Block key={block.id} block={block} />
      ))}
    </div>
  );
}
