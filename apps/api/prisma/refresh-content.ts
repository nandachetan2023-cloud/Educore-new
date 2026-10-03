import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import { BLOG_POSTS, CUSTOM_PAGES } from './content-pages';

// One-off: refreshes CMS custom pages + blog article bodies on the LIVE
// database WITHOUT wiping anything (unlike seed.ts, which fully resets).
// Run: npx ts-node prisma/refresh-content.ts
// Safe to re-run — matches rows by (tenantId, slug/title).
const prisma = new PrismaClient();
const slug = (t: string) => slugify(t, { lower: true, strict: true });
const img = (name: string) => `/assets/${name}`;

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  if (tenants.length === 0) {
    console.log('No tenants found — nothing to refresh.');
    return;
  }
  for (const t of tenants) {
    console.log(`› Tenant "${t.slug}" (id=${t.id})…`);

    for (const p of CUSTOM_PAGES) {
      const existing = await prisma.customPage.findFirst({
        where: { tenantId: t.id, slug: p.slug },
      });
      if (existing) {
        await prisma.customPage.update({
          where: { id: existing.id },
          data: { title: p.title, content: p.content, status: true },
        });
        console.log(`  updated page /page/${p.slug}`);
      } else {
        await prisma.customPage.create({ data: { tenantId: t.id, ...p } });
        console.log(`  created page /page/${p.slug}`);
      }
    }

    for (const p of BLOG_POSTS) {
      const postSlug = slug(p.title);
      const existing = await prisma.blog.findFirst({
        where: { tenantId: t.id, slug: postSlug },
      });
      if (existing) {
        await prisma.blog.update({
          where: { id: existing.id },
          data: {
            title: p.title,
            image: img(p.image),
            shortDescription: p.short,
            description: p.body,
            seoDescription: p.short,
            status: true,
          },
        });
        console.log(`  updated blog "${p.title}"`);
      }
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
