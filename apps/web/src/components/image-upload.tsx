'use client';

import { useState } from 'react';
import { tokenStore, ApiError } from '@/lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Uploads a file via multipart to /uploads and returns the public URL. */
export function ImageUpload({ value, onChange, label = 'Image' }: { value?: string; onChange: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/uploads`, {
        method: 'POST',
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new ApiError(res.status, 'Upload failed');
      const data = await res.json();
      onChange(data.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-brand-soft">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted">No image</div>
          )}
        </div>
        <label className="btn-ghost cursor-pointer">
          {busy ? 'Uploading…' : 'Choose file'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      </div>
      {err && <p className="mt-1 text-sm text-red-500">{err}</p>}
    </div>
  );
}
