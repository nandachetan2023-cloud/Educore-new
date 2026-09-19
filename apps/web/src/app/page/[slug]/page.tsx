import { notFound } from 'next/navigation';

interface CustomPage { id: number; title: string; slug: string; content?: string | null }

async function getPage(slug: string): Promise<CustomPage | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  const res = await fetch(`${base}/pages/${slug}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  return { title: page?.title ?? 'Page not found' };
}

export default async function CustomPageView({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  return (
    <div className="container-page max-w-3xl py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">{page.title}</h1>
      <div
        className="prose mt-8 max-w-none text-ink"
        dangerouslySetInnerHTML={{ __html: page.content ?? '' }}
      />
    </div>
  );
}
