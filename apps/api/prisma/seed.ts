import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import slugify from 'slugify';
import { BLOG_POSTS, CUSTOM_PAGES } from './content-pages';

// Seeding is inherently cross-tenant (it's what CREATES tenants), so this
// uses a plain, unscoped PrismaClient directly — the same thing RAW_PRISMA
// wraps at runtime for the Superadmin console / billing webhooks.
const prisma = new PrismaClient();

// Frontend-served asset path (images live in apps/web/public/assets, from the
// original EduCore template). Rendered directly by the web app on :3000.
const img = (name: string) => `/assets/${name}`;
const slug = (t: string) => slugify(t, { lower: true, strict: true });

async function createTenant(opts: {
  slug: string;
  name: string;
  planId: number;
  adminName: string;
  adminEmail: string;
  adminPasswordHash: string;
}) {
  const admin = await prisma.admin.create({
    data: { name: opts.adminName, email: opts.adminEmail, password: opts.adminPasswordHash, role: 'admin', image: img('footer_logo.png') },
  });
  const tenant = await prisma.tenant.create({
    data: { name: opts.name, slug: opts.slug, ownerAdminId: admin.id, status: 'active' },
  });
  await prisma.admin.update({ where: { id: admin.id }, data: { tenantId: tenant.id } });
  await prisma.subscription.create({ data: { tenantId: tenant.id, planId: opts.planId, status: 'active' } });
  return { admin, tenant };
}

async function main() {
  console.log('› Clearing existing content…');
  // FK-safe delete order, across every tenant (seed always fully resets).
  await prisma.watchHistory.deleteMany();
  await prisma.review.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.courseChapterLession.deleteMany();
  await prisma.courseChapter.deleteMany();
  await prisma.course.deleteMany();
  await prisma.blogComment.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.blogCategory.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.hero.deleteMany();
  await prisma.aboutUsSection.deleteMany();
  await prisma.customPage.deleteMany();
  await prisma.courseCategory.deleteMany();
  await prisma.courseLevel.deleteMany();
  await prisma.courseLanguage.deleteMany();
  await prisma.user.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.resellerPayout.deleteMany();
  await prisma.reseller.deleteMany();
  await prisma.subscription.deleteMany();
  // Admin <-> Tenant is a RESTRICT cycle (admins.tenant_id, tenants.owner_admin_id),
  // so detach admins first — otherwise re-seeding a non-empty DB fails.
  await prisma.admin.updateMany({ data: { tenantId: null } });
  await prisma.tenant.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.plan.deleteMany();

  const [adminPass, userPass] = await Promise.all([
    argon2.hash('password'),
    argon2.hash('12345678'),
  ]);

  console.log('› Platform: superadmin…');
  // The platform operator — tenantId stays null. Sells/creates tenants below.
  await prisma.admin.create({
    data: { name: 'Super Admin', email: 'superadmin@gmail.com', password: adminPass, role: 'super_admin', image: img('footer_logo.png') },
  });

  console.log('› Platform: plans…');
  const starterPlan = await prisma.plan.create({
    data: { name: 'Starter', slug: 'starter', priceMonthly: 4900, currency: 'usd' },
  });
  const proPlan = await prisma.plan.create({
    data: { name: 'Pro', slug: 'pro', priceMonthly: 14900, currency: 'usd' },
  });

  // ───────────────────────────────────────────────────────────
  //  Tenant 1: Acme Academy — the rich, full-catalog demo tenant.
  // ───────────────────────────────────────────────────────────
  console.log('› Tenant "Acme Academy"…');
  const { tenant: acme } = await createTenant({
    slug: 'acme',
    name: 'Acme Academy',
    planId: proPlan.id,
    adminName: 'Acme Admin',
    adminEmail: 'admin@gmail.com',
    adminPasswordHash: adminPass,
  });
  const acmeId = acme.id;

  const acmeInstructorSeeds = [
    { email: 'instructor@gmail.com', name: 'Demo Instructor', image: img('author_img_1.jpg'), headline: 'Full-Stack Web Developer', bio: 'Ten years building web apps and teaching thousands of students online.' },
    { email: 'sarah@educore.com', name: 'Sarah Mitchell', image: img('author_img_2.jpg'), headline: 'UI/UX Design Lead', bio: 'Product designer passionate about clean, accessible interfaces.' },
    { email: 'david@educore.com', name: 'David Chen', image: img('author_img_3.jpg'), headline: 'Data Scientist', bio: 'ML engineer turning data into decisions for the last 8 years.' },
    { email: 'maria@educore.com', name: 'Maria Garcia', image: img('author_img_4.jpg'), headline: 'Digital Marketing Strategist', bio: 'Helped 50+ brands grow through content and paid acquisition.' },
  ];
  const acmeInstructors = [];
  for (const s of acmeInstructorSeeds) {
    acmeInstructors.push(
      await prisma.user.create({
        data: { tenantId: acmeId, ...s, role: 'instructor', approveStatus: 'approved', password: userPass, wallet: 0 },
      }),
    );
  }

  const acmeStudentSeeds = [
    { email: 'user@gmail.com', name: 'Demo Student', image: img('author_img_5.jpg') },
    { email: 'alex@example.com', name: 'Alex Johnson', image: img('author_img_6.jpg') },
    { email: 'priya@example.com', name: 'Priya Sharma', image: img('instructor_1.jpg') },
  ];
  const acmeStudents = [];
  for (const s of acmeStudentSeeds) {
    acmeStudents.push(
      await prisma.user.create({
        data: { tenantId: acmeId, ...s, role: 'student', approveStatus: 'approved', password: userPass, wallet: 0 },
      }),
    );
  }

  console.log('› Acme taxonomy…');
  const acmeCategorySeeds = [
    { name: 'Development', icon: img('category_icon_1.png') },
    { name: 'Design', icon: img('category_icon_2.png') },
    { name: 'Business', icon: img('category_icon_3.png') },
    { name: 'Marketing', icon: img('category_icon_4.png') },
    { name: 'Data Science', icon: img('category_icon_5.png') },
    { name: 'Photography', icon: img('category_icon_6.png') },
  ];
  const acmeCategories: Record<string, number> = {};
  for (const c of acmeCategorySeeds) {
    const cat = await prisma.courseCategory.create({
      data: { tenantId: acmeId, name: c.name, slug: slug(c.name), icon: c.icon, status: true, showAtTrending: true },
    });
    acmeCategories[c.name] = cat.id;
  }
  const acmeLevels: Record<string, number> = {};
  for (const name of ['Beginner', 'Intermediate', 'Advanced']) {
    const l = await prisma.courseLevel.create({ data: { tenantId: acmeId, name, slug: slug(name) } });
    acmeLevels[name] = l.id;
  }
  const acmeLanguages: Record<string, number> = {};
  for (const name of ['English', 'Hindi', 'Spanish']) {
    const l = await prisma.courseLanguage.create({ data: { tenantId: acmeId, name, slug: slug(name) } });
    acmeLanguages[name] = l.id;
  }

  console.log('› Acme courses…');
  const acmeCourseSeeds = [
    { title: 'The Complete Web Development Bootcamp', cat: 'Development', instr: 0, thumb: 'course_product_img_1.jpg', price: 89.99, discount: 40, level: 'Beginner', desc: 'Go from zero to full-stack developer. HTML, CSS, JavaScript, React, Node.js, databases and deployment — everything you need to build and ship real web apps.' },
    { title: 'Advanced React & Next.js Patterns', cat: 'Development', instr: 0, thumb: 'course_product_img_2.jpg', price: 74.99, discount: 25, level: 'Advanced', desc: 'Master server components, data fetching, caching, and production architecture with modern React and Next.js.' },
    { title: 'UI/UX Design Masterclass', cat: 'Design', instr: 1, thumb: 'course_product_img_3.jpg', price: 69.99, discount: 30, level: 'Intermediate', desc: 'Design beautiful, usable products. Learn design systems, prototyping, user research, and hand-off to developers.' },
    { title: 'Figma from Scratch to Pro', cat: 'Design', instr: 1, thumb: 'courses_2_img_1.jpg', price: 49.99, discount: 0, level: 'Beginner', desc: 'Everything you need to become fluent in Figma — components, auto-layout, variants, and collaboration.' },
    { title: 'Python for Data Science & ML', cat: 'Data Science', instr: 2, thumb: 'course_product_img_4.jpg', price: 99.99, discount: 50, level: 'Intermediate', desc: 'NumPy, pandas, visualization, and scikit-learn. Build real machine-learning models on real datasets.' },
    { title: 'Deep Learning with PyTorch', cat: 'Data Science', instr: 2, thumb: 'courses_2_img_2.jpg', price: 119.99, discount: 40, level: 'Advanced', desc: 'Neural networks, CNNs, transformers, and training pipelines using PyTorch, explained clearly.' },
    { title: 'Digital Marketing Complete Course', cat: 'Marketing', instr: 3, thumb: 'course_product_img_5.jpg', price: 59.99, discount: 20, level: 'Beginner', desc: 'SEO, content, social, email, and paid ads — a complete, practical growth playbook.' },
    { title: 'Startup Fundamentals', cat: 'Business', instr: 3, thumb: 'course_product_img_6.jpg', price: 0, discount: 0, level: 'Beginner', desc: 'From idea to launch: validation, MVPs, fundraising basics, and go-to-market. A free primer for founders.' },
    { title: 'Photography Essentials', cat: 'Photography', instr: 1, thumb: 'courses_2_img_3.jpg', price: 39.99, discount: 0, level: 'Beginner', desc: 'Composition, lighting, and editing to take your photos from snapshots to stunning.' },
  ];

  const chapterTitles = ['Getting Started', 'Core Concepts', 'Building Real Projects', 'Going Further'];
  const demoVideoIds = ['dQw4w9WgXcQ', 'ScMzIvxBSi4', 'aircAruvnKk', 'kqtD5dpn9C8'];

  const acmeCourses = [];
  for (const c of acmeCourseSeeds) {
    const course = await prisma.course.create({
      data: {
        tenantId: acmeId,
        instructorId: acmeInstructors[c.instr].id,
        categoryId: acmeCategories[c.cat],
        courseLevelId: acmeLevels[c.level],
        courseLanguageId: acmeLanguages['English'],
        title: c.title,
        slug: slug(c.title),
        thumbnail: img(c.thumb),
        description: c.desc,
        seoDescription: c.desc.slice(0, 150),
        price: c.price,
        discount: c.discount,
        duration: `${6 + Math.floor(Math.random() * 20)}h`,
        certificate: true,
        status: 'active',
        isApproved: 'approved',
      },
    });

    for (let ci = 0; ci < 3; ci++) {
      const chapter = await prisma.courseChapter.create({
        data: { tenantId: acmeId, courseId: course.id, instructorId: course.instructorId, title: chapterTitles[ci], order: ci + 1, status: true },
      });
      for (let li = 0; li < 3; li++) {
        const n = ci * 3 + li + 1;
        await prisma.courseChapterLession.create({
          data: {
            tenantId: acmeId,
            courseId: course.id,
            chapterId: chapter.id,
            instructorId: course.instructorId,
            title: `Lesson ${n}: ${chapterTitles[ci]} — Part ${li + 1}`,
            slug: `${slug(course.title)}-lesson-${n}`,
            description: 'A focused, hands-on lesson.',
            storage: 'youtube',
            filePath: demoVideoIds[n % demoVideoIds.length],
            fileType: 'video',
            lessonType: 'lesson',
            duration: `${4 + (n % 8)}:0${n % 6}`,
            isPreview: n === 1,
            downloadable: false,
            status: true,
            order: li + 1,
          },
        });
      }
    }
    acmeCourses.push(course);
  }

  console.log('› Acme enrollments, reviews, watch history…');
  const reviewTexts = [
    'Fantastic course — clear, practical, and well-paced.',
    'Exactly what I needed. The projects really cement the concepts.',
    'Great instructor. Explains complex topics simply.',
    'Loved it. Already applying what I learned at work.',
  ];
  for (const student of acmeStudents) {
    for (const course of acmeCourses.slice(0, 5)) {
      await prisma.enrollment.create({
        data: { tenantId: acmeId, userId: student.id, courseId: course.id, instructorId: course.instructorId, haveAccess: true },
      });
      const lessons = await prisma.courseChapterLession.findMany({ where: { courseId: course.id }, take: 4 });
      for (const lesson of lessons) {
        await prisma.watchHistory.create({
          data: { tenantId: acmeId, userId: student.id, courseId: course.id, chapterId: lesson.chapterId, lessonId: lesson.id, isCompleted: true },
        });
      }
      await prisma.review.create({
        data: {
          tenantId: acmeId,
          userId: student.id,
          courseId: course.id,
          rating: 4 + (course.id % 2),
          review: reviewTexts[(student.id + course.id) % reviewTexts.length],
          status: true,
        },
      });
    }
  }

  console.log('› Acme homepage CMS…');
  await prisma.hero.create({
    data: {
      tenantId: acmeId,
      title: 'Learn without limits',
      subTitle: 'Build in-demand skills with courses from expert instructors. Learn at your own pace, on any device.',
      image: img('banner_img.png'),
    },
  });
  const features = [
    { icon: img('banner_feature_icon_1.png'), title: 'Expert Instructors', description: 'Learn from industry professionals with real-world experience.' },
    { icon: img('banner_feature_icon_2.png'), title: 'Learn Anywhere', description: 'Access your courses on desktop, tablet, or mobile, anytime.' },
    { icon: img('banner_feature_icon_3.png'), title: 'Certificates', description: 'Earn a certificate of completion for every course you finish.' },
  ];
  for (const f of features) await prisma.feature.create({ data: { tenantId: acmeId, ...f } });

  const testimonials = [
    { name: 'Emily Carter', headline: 'Frontend Developer', image: img('author_img_1.jpg'), comment: 'The courses here landed me my first developer job. Incredible value.', rating: 5 },
    { name: 'James Wilson', headline: 'Product Designer', image: img('author_img_2.jpg'), comment: 'Best learning platform I have used. Clear, practical, and engaging.', rating: 5 },
    { name: 'Sophia Lee', headline: 'Data Analyst', image: img('author_img_3.jpg'), comment: 'The instructors genuinely care. I learned more here than in years of self-study.', rating: 5 },
  ];
  for (const t of testimonials) await prisma.testimonial.create({ data: { tenantId: acmeId, ...t } });

  const counters = [
    { title: 'Active Students', number: '12,500+' },
    { title: 'Expert Instructors', number: '350+' },
    { title: 'Courses', number: '1,200+' },
    { title: 'Certificates Issued', number: '48,000+' },
  ];
  for (const c of counters) await prisma.counter.create({ data: { tenantId: acmeId, ...c } });

  for (let i = 1; i <= 6; i++) await prisma.brand.create({ data: { tenantId: acmeId, image: img(`brand_icon_${i}.png`) } });

  console.log('› Acme blog…');
  const acmeBlogCat = await prisma.blogCategory.create({ data: { tenantId: acmeId, name: 'Learning Tips', slug: 'learning-tips', status: true } });
  for (const p of BLOG_POSTS) {
    await prisma.blog.create({
      data: {
        tenantId: acmeId,
        categoryId: acmeBlogCat.id,
        title: p.title,
        slug: slug(p.title),
        image: img(p.image),
        shortDescription: p.short,
        description: p.body,
        seoDescription: p.short,
        status: true,
      },
    });
  }

  console.log('› Acme custom pages…');
  for (const p of CUSTOM_PAGES) await prisma.customPage.create({ data: { tenantId: acmeId, ...p } });

  console.log('› Mock orders for admin visibility…');
  let orderNo = 1;
  for (const student of acmeStudents.slice(0, 3)) {
    for (const course of acmeCourses.slice(0, 4)) {
      const total = (course.price ?? 0) * (1 - (course.discount ?? 0) / 100);
      await prisma.order.create({
        data: {
          tenantId: acmeId,
          invoiceId: `INV-${String(orderNo).padStart(4, '0')}`,
          buyerId: student.id,
          status: 'approved',
          totalAmount: total,
          paidAmount: total,
          currency: 'usd',
          transactionId: `txn_mock_${orderNo}`,
          paymentMethod: 'card',
          items: {
            create: [{ tenantId: acmeId, courseId: course.id, qty: 1, price: course.price ?? 0 }],
          },
        },
      });
      orderNo++;
    }
  }

  // ───────────────────────────────────────────────────────────
  //  Tenant 2: Nova Learning — a small, separate tenant, specifically to
  //  prove isolation (never shares an id/email/slug with Acme).
  // ───────────────────────────────────────────────────────────
  console.log('› Tenant "Nova Learning"…');
  const { tenant: nova } = await createTenant({
    slug: 'nova',
    name: 'Nova Learning',
    planId: starterPlan.id,
    adminName: 'Nova Admin',
    adminEmail: 'admin@nova.test',
    adminPasswordHash: adminPass,
  });
  const novaId = nova.id;

  const novaInstructor = await prisma.user.create({
    data: { tenantId: novaId, email: 'instructor@nova.test', name: 'Nova Instructor', image: img('author_img_2.jpg'), role: 'instructor', approveStatus: 'approved', password: userPass, wallet: 0 },
  });
  const novaStudent = await prisma.user.create({
    data: { tenantId: novaId, email: 'student@nova.test', name: 'Nova Student', image: img('author_img_5.jpg'), role: 'student', approveStatus: 'approved', password: userPass, wallet: 0 },
  });
  const novaCategory = await prisma.courseCategory.create({
    data: { tenantId: novaId, name: 'Development', slug: slug('Development'), status: true, showAtTrending: true },
  });
  const novaLevel = await prisma.courseLevel.create({ data: { tenantId: novaId, name: 'Beginner', slug: slug('Beginner') } });
  const novaLanguage = await prisma.courseLanguage.create({ data: { tenantId: novaId, name: 'English', slug: slug('English') } });
  const novaCourse = await prisma.course.create({
    data: {
      tenantId: novaId,
      instructorId: novaInstructor.id,
      categoryId: novaCategory.id,
      courseLevelId: novaLevel.id,
      courseLanguageId: novaLanguage.id,
      title: 'Intro to Nova Learning',
      slug: slug('Intro to Nova Learning'),
      thumbnail: img('course_product_img_1.jpg'),
      description: 'A single seeded course for the Nova Learning tenant, kept intentionally separate from Acme Academy.',
      price: 19.99,
      discount: 0,
      duration: '4h',
      certificate: true,
      status: 'active',
      isApproved: 'approved',
    },
  });
  const novaChapter = await prisma.courseChapter.create({
    data: { tenantId: novaId, courseId: novaCourse.id, instructorId: novaInstructor.id, title: 'Getting Started', order: 1, status: true },
  });
  await prisma.courseChapterLession.create({
    data: {
      tenantId: novaId,
      courseId: novaCourse.id,
      chapterId: novaChapter.id,
      instructorId: novaInstructor.id,
      title: 'Lesson 1: Welcome',
      slug: `${slug(novaCourse.title)}-lesson-1`,
      storage: 'youtube',
      filePath: 'dQw4w9WgXcQ',
      fileType: 'video',
      lessonType: 'lesson',
      duration: '5:00',
      isPreview: true,
      downloadable: false,
      status: true,
      order: 1,
    },
  });
  await prisma.hero.create({
    data: { tenantId: novaId, title: 'Nova Learning', subTitle: 'A smaller, separately-branded tenant used to prove multi-tenant isolation.', image: img('banner_img.png') },
  });

  console.log('› Platform: website leads…');
  const leadSeeds: Array<{
    name: string; email: string; company?: string; phone?: string;
    message?: string; source: 'trial' | 'contact' | 'pricing';
    status: 'new' | 'contacted' | 'converted' | 'closed';
    daysAgo: number;
  }> = [
    { name: 'Priya Sharma', email: 'priya.sharma@brightpath.io', company: 'BrightPath Coaching', phone: '+91 98765 43210', message: 'Interested in a white-label LMS for our corporate training programs. Can we schedule a demo?', source: 'pricing', status: 'new', daysAgo: 1 },
    { name: 'Marcus Chen', email: 'marcus@learnnova.co', company: 'LearnNova', phone: '+1 (415) 555-0192', message: 'Looking to migrate 2,000+ courses from Teachable. Need multi-tenant support and custom domains.', source: 'trial', status: 'new', daysAgo: 2 },
    { name: 'Aisha Rahman', email: 'aisha.rahman@eduforge.ae', company: 'EduForge MENA', message: 'We need RTL support and Arabic localization. Is that on the roadmap?', source: 'contact', status: 'contacted', daysAgo: 5 },
    { name: 'Tomás García', email: 'tomas@academiaonline.mx', company: 'Academia Online', phone: '+52 55 1234 5678', message: 'Pricing for the Pro plan with 5,000 seats? Also interested in Razorpay integration.', source: 'pricing', status: 'contacted', daysAgo: 7 },
    { name: 'Hannah Kim', email: 'hannah.kim@skillbridge.kr', company: 'SkillBridge', message: 'Started the free trial yesterday. The course builder looks great — one question about certificates.', source: 'trial', status: 'converted', daysAgo: 12 },
    { name: 'James O\'Neill', email: 'james@devacademy.ie', company: 'Dev Academy Ireland', phone: '+353 87 555 0123', message: 'We\'re an coding bootcamp looking for a full white-label solution with our own branding.', source: 'trial', status: 'converted', daysAgo: 18 },
    { name: 'Fatima Al-Hassan', email: 'fatima@learnhub.sa', company: 'LearnHub KSA', message: 'Interested in reseller partnership for the Gulf region.', source: 'contact', status: 'new', daysAgo: 3 },
    { name: 'Lucas Weber', email: 'lucas.weber@kurswelt.de', company: 'Kurswelt', phone: '+49 170 555 0198', message: 'Need GDPR-compliant hosting in EU. Do you have Frankfurt region?', source: 'pricing', status: 'contacted', daysAgo: 9 },
    { name: 'Sofia Rossi', email: 'sofia@formazione-it.it', company: 'Formazione IT', message: 'Trial user — the instructor dashboard is exactly what we need. Can we get a call with sales?', source: 'trial', status: 'converted', daysAgo: 22 },
    { name: 'David Okafor', email: 'david.okafor@techskills.ng', company: 'TechSkills Africa', message: 'Exploring LMS options for vocational training across Nigeria. Mobile-first is a must.', source: 'contact', status: 'closed', daysAgo: 30 },
    { name: 'Emma Larsson', email: 'emma@nordiclearning.se', company: 'Nordic Learning AB', phone: '+46 70 555 0145', message: 'We went with a competitor for now — pricing was the main factor. Keep us on the list?', source: 'pricing', status: 'closed', daysAgo: 45 },
    { name: 'Raj Patel', email: 'raj.patel@skillup.in', company: 'SkillUp India', message: 'Just signed up for the trial. Looking forward to exploring the coupon features.', source: 'trial', status: 'new', daysAgo: 1 },
  ];
  for (const l of leadSeeds) {
    const createdAt = new Date(Date.now() - l.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.lead.create({
      data: {
        name: l.name,
        email: l.email,
        company: l.company,
        phone: l.phone,
        message: l.message,
        source: l.source,
        status: l.status,
        createdAt,
      },
    });
  }

  console.log('› Platform: resellers…');
  const resellerSeeds = [
    { name: 'EduDistributors GmbH', email: 'partners@edudist.de', phone: '+49 30 555 0100', companyName: 'EduDistributors GmbH', commissionRate: 25, status: 'active' as const, totalEarned: 4250, payouts: [
      { amount: 1500, status: 'paid' as const, note: 'Q3 commission — 12 tenant sales', daysAgo: 40 },
      { amount: 2750, status: 'paid' as const, note: 'Q4 commission — 19 tenant sales', daysAgo: 10 },
      { amount: 800, status: 'pending' as const, note: 'Interim payout for Acme referral', daysAgo: 2 },
    ]},
    { name: 'SaaS Resell Partners', email: 'hello@saasresell.com', phone: '+1 (646) 555 0177', companyName: 'SaaS Resell Partners LLC', commissionRate: 20, status: 'active' as const, totalEarned: 1800, payouts: [
      { amount: 1200, status: 'paid' as const, note: 'Monthly commission batch', daysAgo: 25 },
      { amount: 600, status: 'pending' as const, note: 'November commissions', daysAgo: 5 },
    ]},
    { name: 'LearnTech MENA', email: 'sales@learntechmena.ae', phone: '+971 4 555 0134', companyName: 'LearnTech FZ-LLC', commissionRate: 30, status: 'active' as const, totalEarned: 7200, payouts: [
      { amount: 3200, status: 'paid' as const, note: 'Enterprise deal — Gulf University', daysAgo: 60 },
      { amount: 4000, status: 'paid' as const, note: 'Bulk license sale — 500 seats', daysAgo: 15 },
    ]},
    { name: 'CloudEd Resellers', email: 'team@clouded.au', phone: '+61 2 5550 0198', companyName: 'CloudEd Pty Ltd', commissionRate: 18, status: 'active' as const, totalEarned: 950, payouts: [
      { amount: 950, status: 'paid' as const, note: 'First quarter commission', daysAgo: 30 },
    ]},
    { name: 'Nordic EdTech AB', email: 'contact@nordicedtech.se', phone: '+46 8 555 0122', companyName: 'Nordic EdTech AB', commissionRate: 22, status: 'suspended' as const, totalEarned: 3400, payouts: [
      { amount: 3400, status: 'paid' as const, note: 'Final settlement before suspension', daysAgo: 50 },
    ]},
    { name: 'EduPrime Africa', email: 'info@eduprime.ng', phone: '+234 1 555 0167', companyName: 'EduPrime Nigeria Ltd', commissionRate: 28, status: 'active' as const, totalEarned: 2100, payouts: [
      { amount: 1400, status: 'paid' as const, note: 'West Africa expansion bonus', daysAgo: 20 },
      { amount: 700, status: 'pending' as const, note: 'October referral commissions', daysAgo: 3 },
    ]},
  ];
  for (const r of resellerSeeds) {
    const reseller = await prisma.reseller.create({
      data: {
        name: r.name,
        email: r.email,
        phone: r.phone,
        companyName: r.companyName,
        commissionRate: r.commissionRate,
        status: r.status,
        totalEarned: r.totalEarned,
      },
    });
    for (const p of r.payouts) {
      await prisma.resellerPayout.create({
        data: {
          resellerId: reseller.id,
          amount: p.amount,
          status: p.status,
          note: p.note,
          createdAt: new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log('✓ Seed complete:', {
    superadmin: 'superadmin@gmail.com / password',
    acme: { tenantId: acmeId, admin: 'admin@gmail.com / password', courses: acmeCourses.length },
    nova: { tenantId: novaId, admin: 'admin@nova.test / password', courses: 1 },
    leads: leadSeeds.length,
    resellers: resellerSeeds.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
