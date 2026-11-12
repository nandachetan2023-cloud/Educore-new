import { notFound } from 'next/navigation';
import { API_INTERNAL_BASE } from '@/lib/api';
import Link from 'next/link';
import { PageBlocks } from '@/components/page-blocks';
import { coerceBlocks } from '@/lib/page-builder';

interface CustomPage {
  id: number;
  title: string;
  slug: string;
  content?: string | null;
  blocks?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

async function getPage(slug: string): Promise<CustomPage | null> {
  const res = await fetch(`${API_INTERNAL_BASE}/pages/${slug}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) return { title: 'Page not found' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      type: 'website',
    },
  };
}

export default async function CustomPageView({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  const blocks = coerceBlocks(page.blocks);
  if (blocks.length > 0) {
    return <PageBlocks blocks={blocks} />;
  }

  return (
    <div className="container-page max-w-3xl py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-brand"
      >
        <span aria-hidden>&larr;</span> Back to home
      </Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{page.title}</h1>
      <div
        className="rich-text mt-8"
        dangerouslySetInnerHTML={{ __html: page.content ?? '' }}
      />
    </div>
  );
}
