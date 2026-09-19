'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

interface Comment { id: number; name: string; comment: string; createdAt: string }
interface Post {
  id: number; title: string; slug: string; image?: string; description?: string; createdAt: string;
  category?: { name: string }; comments: Comment[];
}

export default function BlogDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', comment: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    api<Post>(`/blog/${slug}`, { auth: false }).then(setPost).catch(() => setPost(null)).finally(() => setLoading(false));
  };
  useEffect(load, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    setMsg(null);
    try {
      await api(`/blog/${post.id}/comments`, { method: 'POST', auth: false, body: JSON.stringify(form) });
      setMsg('Thanks! Your comment will appear after moderation.');
      setForm({ name: '', email: '', comment: '' });
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed to post comment'); }
  };

  if (loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  if (!post) return <div className="container-page py-20 text-center text-muted">Post not found.</div>;

  return (
    <article className="container-page max-w-3xl py-12">
      <Link href="/blog" className="text-sm text-muted hover:text-brand">← All posts</Link>
      {post.category && <span className="badge mt-4 block w-fit">{post.category.name}</span>}
      <h1 className="mt-3 text-4xl font-extrabold">{post.title}</h1>
      <div className="mt-2 text-sm text-muted">{new Date(post.createdAt).toLocaleDateString()}</div>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover" />
      )}
      <div className="prose mt-8 max-w-none text-ink" dangerouslySetInnerHTML={{ __html: post.description ?? '' }} />

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-xl font-bold">Comments ({post.comments.length})</h2>
        <div className="mt-4 space-y-4">
          {post.comments.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="font-semibold">{c.name}</div>
              <p className="mt-2 text-sm text-muted">{c.comment}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="card mt-6 space-y-3 p-6">
          <h3 className="font-bold">Leave a comment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input required type="email" className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <textarea required rows={3} className="input" placeholder="Your comment…" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          {msg && <p className="text-sm text-brand">{msg}</p>}
          <button className="btn-primary">Post comment</button>
        </form>
      </section>
    </article>
  );
}
