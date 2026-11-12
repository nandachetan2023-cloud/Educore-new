export const PAGE_BLOCK_TYPES = [
  'hero',
  'richText',
  'features',
  'stats',
  'image',
  'video',
  'cta',
  'faq',
  'testimonials',
  'contact',
  'divider',
] as const;

export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export interface SitePageTemplate {
  slug: string;
  title: string;
  path: string;
}

export const SITE_PAGE_TEMPLATES: SitePageTemplate[] = [
  { slug: 'home', title: 'Home', path: '/' },
  { slug: 'courses', title: 'Course catalog', path: '/courses' },
  { slug: 'course-details', title: 'Course details', path: '/courses/[slug]' },
  { slug: 'blog', title: 'Blog', path: '/blog' },
  { slug: 'blog-article', title: 'Blog article', path: '/blog/[slug]' },
  { slug: 'become-instructor', title: 'Become an instructor', path: '/become-instructor' },
  { slug: 'cart', title: 'Cart', path: '/cart' },
  { slug: 'checkout-success', title: 'Checkout success', path: '/checkout/success' },
  { slug: 'contact', title: 'Contact', path: '/contact' },
  { slug: 'forgot-password', title: 'Forgot password', path: '/forgot-password' },
  { slug: 'login', title: 'Login', path: '/login' },
  { slug: 'register', title: 'Register', path: '/register' },
  { slug: 'reset-password', title: 'Reset password', path: '/reset-password' },
  { slug: 'verify-email', title: 'Verify email', path: '/verify-email' },
];

export function sitePageForSlug(slug: string): SitePageTemplate | undefined {
  return SITE_PAGE_TEMPLATES.find((page) => page.slug === slug);
}

export function sitePageForPath(pathname: string): SitePageTemplate | undefined {
  return SITE_PAGE_TEMPLATES.find((page) => {
    if (!page.path.includes('[slug]')) return page.path === pathname;
    const pattern = new RegExp(`^${page.path.replace('[slug]', '[^/]+')}/?$`);
    return pattern.test(pathname);
  });
}

export interface PageBlock {
  id: string;
  type: PageBlockType;
  data: Record<string, unknown>;
  hidden?: boolean;
}

export interface FieldOption {
  label: string;
  value: string;
}

export type FieldDef =
  | {
      key: string;
      label: string;
      type: 'text' | 'textarea' | 'url' | 'image' | 'number';
      placeholder?: string;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'select' | 'boolean';
      options?: FieldOption[];
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'list';
      itemLabel?: string;
      addLabel?: string;
      fields: FieldDef[];
      help?: string;
    };

export interface BlockDefinition {
  type: PageBlockType;
  label: string;
  description: string;
  icon: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}

const ALIGN: FieldOption[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
];

const ICONS: FieldOption[] = [
  'Award', 'BookOpen', 'Briefcase', 'Clock', 'Globe', 'GraduationCap', 'HeartPulse',
  'Lock', 'Megaphone', 'Music', 'Palette', 'Play', 'ShieldCheck', 'Sprout', 'Star',
  'TrendingUp', 'Users', 'Zap',
].map((value) => ({ label: value, value }));

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    type: 'hero',
    label: 'Hero',
    description: 'Large headline with a background image and calls to action.',
    icon: 'LayoutTemplate',
    defaults: {
      eyebrow: 'Welcome',
      title: 'A headline that earns attention',
      subtitle: 'Explain what this page is about in one or two clear sentences.',
      image: '',
      align: 'left',
      primaryLabel: '',
      primaryHref: '',
      secondaryLabel: '',
      secondaryHref: '',
    },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text', placeholder: 'About us' },
      { key: 'title', label: 'Headline', type: 'text' },
      { key: 'subtitle', label: 'Subheadline', type: 'textarea' },
      { key: 'image', label: 'Background image', type: 'image' },
      { key: 'align', label: 'Text alignment', type: 'select', options: ALIGN },
      { key: 'primaryLabel', label: 'Primary button label', type: 'text' },
      { key: 'primaryHref', label: 'Primary button link', type: 'url', placeholder: '/courses' },
      { key: 'secondaryLabel', label: 'Secondary button label', type: 'text' },
      { key: 'secondaryHref', label: 'Secondary button link', type: 'url' },
    ],
  },
  {
    type: 'richText',
    label: 'Text',
    description: 'Headings, paragraphs and optional bullet points.',
    icon: 'Text',
    defaults: {
      heading: 'Section heading',
      body: 'Write the main copy for this section here.\n\nLeave a blank line to start a new paragraph.',
      bullets: '',
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea', help: 'Blank lines separate paragraphs.' },
      { key: 'bullets', label: 'Bullet points', type: 'textarea', help: 'One per line.' },
    ],
  },
  {
    type: 'features',
    label: 'Feature grid',
    description: 'A grid of icon, title and description cards.',
    icon: 'LayoutGrid',
    defaults: {
      heading: 'Why choose us',
      intro: '',
      items: [
        { icon: 'Star', title: 'Expert-led lessons', description: 'Learn from practitioners with real-world experience.' },
        { icon: 'Clock', title: 'Learn at your pace', description: 'Lifetime access to every lesson you unlock.' },
        { icon: 'Award', title: 'Recognised certificates', description: 'Share proof of completion with your network.' },
      ],
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro', type: 'textarea' },
      {
        key: 'items',
        label: 'Features',
        type: 'list',
        itemLabel: 'Feature',
        addLabel: 'Add feature',
        fields: [
          { key: 'icon', label: 'Icon', type: 'select', options: ICONS },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ],
      },
    ],
  },
  {
    type: 'stats',
    label: 'Stats',
    description: 'A row of headline numbers and labels.',
    icon: 'BarChart3',
    defaults: {
      heading: '',
      items: [
        { value: '25k+', label: 'Learners' },
        { value: '180+', label: 'Courses' },
        { value: '4.8/5', label: 'Average rating' },
      ],
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      {
        key: 'items',
        label: 'Stats',
        type: 'list',
        itemLabel: 'Stat',
        addLabel: 'Add stat',
        fields: [
          { key: 'value', label: 'Value', type: 'text' },
          { key: 'label', label: 'Label', type: 'text' },
        ],
      },
    ],
  },
  {
    type: 'image',
    label: 'Image',
    description: 'A single image with an optional caption.',
    icon: 'Image',
    defaults: { src: '', alt: '', caption: '', size: 'wide' },
    fields: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'alt', label: 'Alt text', type: 'text', help: 'Describe the image for screen readers.' },
      { key: 'caption', label: 'Caption', type: 'text' },
      {
        key: 'size',
        label: 'Width',
        type: 'select',
        options: [
          { label: 'Wide', value: 'wide' },
          { label: 'Contained', value: 'contained' },
        ],
      },
    ],
  },
  {
    type: 'video',
    label: 'Video',
    description: 'Embed a YouTube video or a direct video file.',
    icon: 'Play',
    defaults: { title: '', url: '', caption: '' },
    fields: [
      { key: 'title', label: 'Heading', type: 'text' },
      { key: 'url', label: 'Video URL', type: 'url', placeholder: 'https://youtube.com/watch?v=...' },
      { key: 'caption', label: 'Caption', type: 'text' },
    ],
  },
  {
    type: 'cta',
    label: 'Call to action',
    description: 'A coloured panel with a headline and button.',
    icon: 'Megaphone',
    defaults: {
      title: 'Ready to get started?',
      text: 'Join thousands of learners building practical skills.',
      buttonLabel: 'Browse courses',
      buttonHref: '/courses',
      tone: 'brand',
    },
    fields: [
      { key: 'title', label: 'Headline', type: 'text' },
      { key: 'text', label: 'Text', type: 'textarea' },
      { key: 'buttonLabel', label: 'Button label', type: 'text' },
      { key: 'buttonHref', label: 'Button link', type: 'url' },
      {
        key: 'tone',
        label: 'Style',
        type: 'select',
        options: [
          { label: 'Brand', value: 'brand' },
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
        ],
      },
    ],
  },
  {
    type: 'faq',
    label: 'FAQ',
    description: 'Expandable questions and answers.',
    icon: 'HelpCircle',
    defaults: {
      heading: 'Frequently asked questions',
      items: [
        { question: 'How long do I have access?', answer: 'You keep lifetime access to any course you purchase.' },
        { question: 'Do I get a certificate?', answer: 'Yes — eligible courses include a completion certificate.' },
      ],
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      {
        key: 'items',
        label: 'Questions',
        type: 'list',
        itemLabel: 'Question',
        addLabel: 'Add question',
        fields: [
          { key: 'question', label: 'Question', type: 'text' },
          { key: 'answer', label: 'Answer', type: 'textarea' },
        ],
      },
    ],
  },
  {
    type: 'testimonials',
    label: 'Testimonials',
    description: 'Learner quotes in a card grid.',
    icon: 'Quote',
    defaults: {
      heading: 'What learners say',
      items: [
        { quote: 'The lessons were practical and immediately useful.', name: 'Alex Morgan', role: 'Product designer' },
        { quote: 'I finally understand the fundamentals. Highly recommended.', name: 'Priya Shah', role: 'Developer' },
      ],
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      {
        key: 'items',
        label: 'Testimonials',
        type: 'list',
        itemLabel: 'Testimonial',
        addLabel: 'Add testimonial',
        fields: [
          { key: 'quote', label: 'Quote', type: 'textarea' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'role', label: 'Role', type: 'text' },
        ],
      },
    ],
  },
  {
    type: 'contact',
    label: 'Contact details',
    description: 'Email, phone, address and opening hours.',
    icon: 'Mail',
    defaults: {
      heading: 'Get in touch',
      intro: 'We usually reply within one business day.',
      email: '',
      phone: '',
      address: '',
      hours: '',
    },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro', type: 'textarea' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'hours', label: 'Opening hours', type: 'text' },
    ],
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Add breathing room between sections.',
    icon: 'Minus',
    defaults: { size: 'md', label: '' },
    fields: [
      {
        key: 'size',
        label: 'Spacing',
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      { key: 'label', label: 'Label (optional)', type: 'text' },
    ],
  },
];

export function blockDefinition(type: PageBlockType): BlockDefinition {
  return BLOCK_DEFINITIONS.find((def) => def.type === type) ?? BLOCK_DEFINITIONS[0];
}

export function createBlock(type: PageBlockType): PageBlock {
  const definition = blockDefinition(type);
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    type,
    data: JSON.parse(JSON.stringify(definition.defaults)) as Record<string, unknown>,
  };
}

const VALID_TYPES = new Set<string>(PAGE_BLOCK_TYPES);

/** Coerces untrusted API/JSON data into safe blocks, backfilling new fields. */
export function coerceBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const candidate = raw as Partial<PageBlock>;
    if (!candidate.type || !VALID_TYPES.has(candidate.type)) return [];
    const definition = blockDefinition(candidate.type);
    return [
      {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `block-${index}`,
        type: candidate.type,
        data: {
          ...(JSON.parse(JSON.stringify(definition.defaults)) as Record<string, unknown>),
          ...(candidate.data && typeof candidate.data === 'object' ? candidate.data : {}),
        },
        hidden: candidate.hidden === true,
      },
    ];
  });
}

export function slugifyTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
