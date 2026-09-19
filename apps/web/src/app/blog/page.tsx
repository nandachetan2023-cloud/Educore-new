'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Post { id: number; title: string; slug: string; image?: string; shortDescription?: string; createdAt: string; category?: { name: string } }

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Post[] }>('/blog', { auth: false })
      .then((r) => setPosts(r.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-extrabold">Blog</h1>
      <p className="mt-2 text-muted">Insights, tips, and stories from our community.</p>

      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card aspect-[4/3] animate-pulse bg-line/30" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="card mt-8 p-16 text-center text-muted">No posts yet.</div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="card group overflow-hidden transition hover:shadow-lift">
              <div className="aspect-[16/9] bg-brand-soft">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-3xl font-black text-brand/30">{p.title[0]}</div>
                )}
              </div>
              <div className="p-5">
                {p.category && <span className="badge">{p.category.name}</span>}
                <h3 className="mt-2 line-clamp-2 font-bold group-hover:text-brand">{p.title}</h3>
                {p.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.shortDescription}</p>}
                <div className="mt-3 text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
