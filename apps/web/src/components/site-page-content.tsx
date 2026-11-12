'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PageBlocks } from '@/components/page-blocks';
import { api, ApiError } from '@/lib/api';
import { coerceBlocks, sitePageForPath } from '@/lib/page-builder';
import type { PageBlock } from '@/lib/page-builder';

interface PageContent {
  blocks?: unknown;
}

export function SitePageContent() {
  const pathname = usePathname();
  const [blocks, setBlocks] = useState<PageBlock[]>([]);

  useEffect(() => {
    let active = true;
    setBlocks([]);
    if (!pathname) return () => { active = false; };

    const page = sitePageForPath(pathname);
    if (!page) return () => { active = false; };
    api<PageContent>(`/pages/${page.slug}`, { auth: false })
      .then((content) => {
        if (active) setBlocks(coerceBlocks(content.blocks));
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return;
        console.error(`Could not load page-builder content for ${page.path}`, error);
      });

    return () => { active = false; };
  }, [pathname]);

  return blocks.length ? <PageBlocks blocks={blocks} /> : null;
}
