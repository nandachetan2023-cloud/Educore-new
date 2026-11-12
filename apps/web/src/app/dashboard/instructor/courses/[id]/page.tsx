'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface Lesson {
  id: number;
  title: string;
  duration: string;
  fileType: string;
  storage: string;
  filePath: string;
  description?: string | null;
  isPreview: boolean;
  downloadable: boolean;
  order: number;
  lessonType?: string;
}

interface Chapter {
  id: number;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseMeta {
  id: number;
  title: string;
  slug: string;
  status: string;
  isApproved: string;
  price?: number;
  discount?: number;
  thumbnail?: string | null;
  description?: string | null;
  tags?: Tag[];
}

interface Tag { id: number; name: string; slug: string }

const TYPE_OPTIONS = [
  { key: 'video', icon: '▶', label: 'Video', fileType: 'video', storage: 'youtube', lessonType: 'lesson' as const },
  { key: 'article', icon: '▤', label: 'Article', fileType: 'doc', storage: 'external_link', lessonType: 'lesson' as const },
  { key: 'pdf', icon: '▧', label: 'PDF', fileType: 'pdf', storage: 'upload', lessonType: 'lesson' as const },
  { key: 'audio', icon: '♫', label: 'Audio', fileType: 'audio', storage: 'upload', lessonType: 'lesson' as const },
  { key: 'quiz', icon: '☷', label: 'Quiz', fileType: 'doc', storage: 'external_link', lessonType: 'lesson' as const },
  { key: 'assignment', icon: '▣', label: 'Assignment', fileType: 'doc', storage: 'external_link', lessonType: 'lesson' as const },
  { key: 'live', icon: '◉', label: 'Live Class', fileType: 'video', storage: 'youtube', lessonType: 'live' as const },
  { key: 'scorm', icon: '♧', label: 'SCORM', fileType: 'file', storage: 'upload', lessonType: 'lesson' as const },
  { key: 'embed', icon: '</>', label: 'Embed', fileType: 'doc', storage: 'external_link', lessonType: 'lesson' as const },
];

const CONTENT_TILES = TYPE_OPTIONS.map((t) => ({ ...t }));

const LESSON_ICON: Record<string, string> = {
  video: '▶',
  audio: '♫',
  pdf: '▧',
  doc: '▤',
  file: '♧',
};

const STEPS = ['Course Details', 'Curriculum', 'Content', 'Settings', 'Publish'];
const CSS = `
.lc{--ink:#172033;--muted:#68738a;--line:#e7eaf2;--bg:#f7f8fc;--purple:#6547e8;--purple2:#8067f3;--soft:#f0edff;--green:#20a56b;--blue:#3185e8;--shadow:0 8px 26px rgba(30,40,75,.06);min-height:100vh;background:var(--bg);color:var(--ink);font:14px Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
.lc *{box-sizing:border-box}.lc button,.lc input,.lc select,.lc textarea{font:inherit}.lc button{cursor:pointer}
.lc .topbar{height:66px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 26px;gap:28px;position:sticky;top:0;z-index:30}
.lc .brand{font-size:20px;font-weight:800;letter-spacing:-.6px;display:flex;align-items:center;gap:9px;white-space:nowrap;text-decoration:none;color:var(--ink)}
.lc .brandmark{width:30px;height:30px;border-radius:10px;background:linear-gradient(145deg,#927bff,#5b43e5);display:grid;place-items:center;color:#fff;font-size:15px;font-weight:800}
.lc .topnav{display:flex;gap:8px;align-items:center}.lc .topnav a{color:#4d5870;text-decoration:none;padding:10px 13px;border-radius:10px;font-size:13px}.lc .topnav a.active{background:var(--soft);color:var(--purple);font-weight:700}.lc .topnav a:hover{background:#f2f2f8}
.lc .search{margin-left:auto;width:min(260px,20vw);border:1px solid #dce1ec;border-radius:10px;padding:10px 13px;color:var(--muted);background:#fff;outline:none}.lc .crumb{color:#7c879b;font-size:12px;margin:0 0 18px}.lc .crumb b{color:#29344b}
.lc .layout{display:grid;grid-template-columns:238px minmax(0,1fr);min-height:calc(100vh - 66px)}
.lc aside{background:#fff;border-right:1px solid var(--line);padding:25px 15px;display:flex;flex-direction:column;gap:8px}
.lc .side-label{font-size:12px;font-weight:800;color:#8790a3;text-transform:uppercase;letter-spacing:.08em;padding:8px 12px}
.lc .side-link{padding:11px 12px;border-radius:9px;color:#4c5870;text-decoration:none;display:flex;gap:12px;align-items:center;border:0;background:none;width:100%;text-align:left;font-size:13px}
.lc .side-link.active{background:var(--soft);color:var(--purple);font-weight:700}.lc .side-link:hover{background:#f6f6fb}.lc .side-link .ico{width:20px;text-align:center;font-size:16px}
.lc .side-divider{height:1px;background:var(--line);margin:12px 5px}
.lc .ai-card{margin-top:auto;background:linear-gradient(145deg,#f0edff,#e7e2ff);border:1px solid #e0d9ff;border-radius:15px;padding:17px 14px;text-align:center}
.lc .ai-card strong{display:block;margin:7px 0}.lc .ai-card p{font-size:12px;line-height:1.5;color:#5d5b80;margin:5px 0 13px}
.lc .btn{border:1px solid #d9deea;background:#fff;color:#28334a;border-radius:9px;padding:10px 14px;font-weight:650;display:inline-flex;align-items:center;gap:7px;justify-content:center;font-size:13px}.lc .btn:hover{border-color:#a99aff}.lc .btn.primary{background:linear-gradient(135deg,var(--purple),#5638d8);border-color:transparent;color:#fff;box-shadow:0 4px 10px rgba(101,71,232,.17)}.lc .btn.soft{background:#f7f5ff;color:var(--purple);border-color:#ded7ff}.lc .btn.small{padding:7px 10px;font-size:12px}.lc .btn:disabled{opacity:.5;cursor:default}
.lc .main{padding:22px 24px 34px;min-width:0}
.lc .course-head{display:flex;align-items:center;gap:17px;margin-bottom:23px}.lc .course-thumb{width:130px;height:78px;border-radius:12px;object-fit:cover;background:linear-gradient(135deg,#142c55,#2874b9);display:grid;place-items:center;color:#ffd34f;font-size:36px;flex-shrink:0;border:0}
.lc .course-title{min-width:0;flex:1}.lc .course-title h1{font-size:25px;letter-spacing:-.7px;margin:0 0 6px}.lc .course-title p{margin:0;color:var(--muted);font-size:13px}
.lc .pill{display:inline-block;background:#f0eaff;color:#6949df;border-radius:30px;padding:5px 11px;font-size:12px;font-weight:750;margin-left:10px;vertical-align:middle}.lc .pill.live{background:#e7f7ef;color:#168455}.lc .pill.review{background:#fff4d6;color:#a66a00}
.lc .head-actions{display:flex;gap:8px;align-items:center}.lc .head-actions .btn{padding:9px 13px}
.lc .icon-btn{position:relative;border:1px solid #d9deea;background:#fff;border-radius:9px;padding:10px 11px;font-size:15px}.lc .icon-btn:hover{border-color:#a99aff}
.lc .steps{display:flex;align-items:center;justify-content:space-between;margin:0 4px 22px;padding:0 8px;gap:0}
.lc .step{display:flex;align-items:center;gap:9px;color:#69748a;white-space:nowrap;font-size:13px}.lc .step .num{width:29px;height:29px;border:1.5px solid #cbd2e0;border-radius:50%;display:grid;place-items:center;font-weight:700;background:#fff;font-size:12px}.lc .step.done .num{background:var(--green);color:#fff;border-color:var(--green)}.lc .step.active{color:var(--purple);font-weight:750}.lc .step.active .num{background:var(--purple);color:#fff;border-color:var(--purple)}.lc .step-line{height:1px;background:#d9deea;flex:1;margin:0 12px;max-width:90px}
.lc .workspace{display:grid;grid-template-columns:minmax(285px,.95fr) minmax(390px,1.25fr) minmax(245px,.72fr);gap:13px;align-items:start}
.lc .panel{background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:16px;min-width:0}
.lc .panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.lc .panel h2{font-size:16px;margin:0}.lc .subtle{color:var(--muted);font-size:12px;font-weight:400}
.lc .section{border:1px solid #e5e8f0;border-radius:10px;margin:9px 0;position:relative}.lc .section-head{border-radius:9px 9px 0 0}.lc .section.drop{outline:2px solid var(--purple2)}
.lc .section-head{display:flex;align-items:center;gap:8px;padding:12px;background:#fbfbfe;width:100%;border:0;text-align:left}.lc .section-head:hover{background:#f5f3ff}.lc .grip{color:#a0a8b8;cursor:grab;display:inline-flex}.lc .section-name{font-weight:750;flex:1;min-width:0}.lc .section-name span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lc .section-meta{font-size:11px;color:var(--muted);margin-top:3px;font-weight:400}.lc .chev{color:#7a8498}
.lc .section-foot{display:flex;justify-content:flex-end;gap:4px;padding:6px 8px;border-top:1px solid var(--line);background:#fff}.lc .section-foot button{border:0;background:none;color:var(--muted);font-size:11px;display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:6px}.lc .section-foot button:hover{color:#e34b5d;background:#fdf0f0}
.lc .lesson-list{padding:3px 7px 7px}
.lc .lesson{display:flex;align-items:center;gap:9px;padding:9px 7px;border-radius:8px}.lc .lesson:hover,.lc .lesson.selected{background:#f2efff}.lc .lesson.drop{outline:2px dashed var(--purple2)}.lc .lesson-icon{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;background:#eeeaff;color:var(--purple);font-size:12px;flex-shrink:0}.lc .lesson:nth-child(2) .lesson-icon{background:#e8f3ff;color:var(--blue)}.lc .lesson:nth-child(3) .lesson-icon{background:#fff1e3;color:#ef9a2e}.lc .lesson-name{font-size:12px;flex:1;min-width:0;text-align:left;background:none;border:0;padding:0;color:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lc .lesson.selected .lesson-name{font-weight:700;color:#4a37c8}.lc .duration{font-size:11px;color:var(--muted)}.lc .more{border:0;background:none;color:#8992a4;font-size:14px;padding:2px 6px;border-radius:6px;position:relative}.lc .more:hover{background:#ececf4}
.lc .panel-footer{display:flex;gap:8px;margin-top:13px}.lc .panel-footer .btn{flex:1}
.lc .editor label{font-weight:700;font-size:12px;display:block;margin:13px 0 7px}.lc .field{width:100%;border:1px solid #d8deea;border-radius:8px;padding:10px 11px;outline:none;background:#fff;color:var(--ink)}.lc .field:focus,.lc .notes:focus{border-color:#9a88ff;box-shadow:0 0 0 3px rgba(128,103,243,.1)}
.lc .form-row{display:grid;grid-template-columns:1.2fr .8fr;gap:12px}
.lc .video-preview{height:222px;border-radius:10px;margin-top:8px;position:relative;overflow:hidden;background:radial-gradient(circle at 25% 30%,#5683b9,#1b3765 55%,#102447);display:flex;align-items:center;justify-content:space-around;color:#fff;padding:18px}
.lc .video-person{font-size:56px;opacity:.9}.lc .video-copy{font-size:20px;font-weight:800;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,.34);max-width:45%}.lc .play{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(17,27,54,.78);display:grid;place-items:center;font-size:20px;border:1px solid rgba(255,255,255,.44);color:#fff}.lc .video-controls{position:absolute;bottom:0;left:0;right:0;padding:10px 13px;background:linear-gradient(transparent,rgba(12,20,41,.85));font-size:11px}.lc .progress-line{height:3px;background:rgba(255,255,255,.33);margin-bottom:8px}.lc .progress-line:before{content:"";display:block;width:28%;height:3px;background:#ff5575}
.lc .tabs{display:flex;gap:22px;border-bottom:1px solid var(--line);margin-top:15px}.lc .tab{padding:11px 4px;background:none;border:0;color:#6e7890;font-weight:650;border-bottom:2px solid transparent;margin-bottom:-1px}.lc .tab.active{color:var(--purple);border-color:var(--purple)}
.lc .toolbar{display:flex;gap:13px;padding:8px 10px;border:1px solid #dce1eb;border-bottom:0;border-radius:8px 8px 0 0;color:#4e5870;background:#fbfbfe}.lc .toolbar button{border:0;background:none;color:#4e5870;padding:2px 4px;border-radius:4px}.lc .toolbar button:hover{background:#eceaf6;color:var(--purple)}
.lc .notes{width:100%;min-height:92px;resize:vertical;border:1px solid #dce1eb;border-radius:0 0 8px 8px;padding:11px;line-height:1.5;outline:none}
.lc .content-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.lc .content-tile{border:1px solid #e2e6ef;border-radius:10px;padding:12px 5px;text-align:center;background:#fff;color:#44516a;transition:.15s}.lc .content-tile:hover{border-color:#a99aff;background:#faf9ff;transform:translateY(-1px)}.lc .content-tile .symbol{font-size:22px;display:block;margin-bottom:5px}.lc .content-tile small{font-weight:650;font-size:11px}
.lc .progress{height:8px;border-radius:20px;background:#e9ebf3;overflow:hidden;margin:14px 0 16px}.lc .progress span{display:block;height:100%;background:linear-gradient(90deg,#6547e8,#a17cff);border-radius:20px;transition:width .4s}
.lc .checklist{display:grid;gap:13px}.lc .checkrow{display:flex;align-items:center;gap:9px;font-size:12px}.lc .check{width:19px;height:19px;border:1.5px solid #c8cfdd;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px;flex-shrink:0}.lc .check.complete{background:var(--green);border-color:var(--green)}.lc .checkrow span:nth-child(2){flex:1}.lc .checkrow b{color:var(--green)}
.lc .right-stack{display:grid;gap:13px}
.lc .muted-note{font-size:11px;color:var(--muted);line-height:1.5}
.lc .toast{position:fixed;right:22px;bottom:22px;background:#172033;color:#fff;padding:12px 17px;border-radius:10px;box-shadow:var(--shadow);opacity:0;transform:translateY(8px);transition:.25s;pointer-events:none;z-index:50;max-width:320px;font-size:13px}.lc .toast.show{opacity:1;transform:translateY(0)}
.lc .modal-backdrop{position:fixed;inset:0;background:rgba(17,24,39,.44);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}.lc .modal-backdrop.open{display:flex}.lc .modal{background:#fff;border-radius:15px;padding:22px;width:min(440px,100%);box-shadow:0 20px 60px rgba(16,24,40,.25)}.lc .modal h3{margin:0 0 8px}.lc .modal p{color:var(--muted);font-size:13px;line-height:1.5}.lc .modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.lc .ai-panel{border:1px solid #e0d9ff;background:linear-gradient(135deg,#f3f1ff,#ede9fe);border-radius:13px;padding:12px 14px;margin-bottom:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.lc .ai-panel input{flex:1;min-width:180px}.lc .spin{display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:lc-spin .8s linear infinite;vertical-align:-2px}@keyframes lc-spin{to{transform:rotate(360deg)}}
.lc .menu{position:absolute;right:0;top:100%;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);z-index:40;min-width:170px;padding:4px}.lc .menu button{display:flex;width:100%;align-items:center;gap:8px;border:0;background:none;text-align:left;padding:8px 10px;border-radius:7px;font-size:12px;color:#28334a}.lc .menu button:hover{background:#f4f4f9}.lc .menu .danger{color:#e34b5d}.lc .menu .danger:hover{background:#fdf0f0}
.lc .lesson-menu{position:relative}
@media(max-width:1200px){.lc .workspace{grid-template-columns:minmax(260px,.9fr) minmax(370px,1.2fr)}.lc .right-stack{grid-column:1/-1;grid-template-columns:1fr 1fr}.lc .topnav a{padding:9px 8px}.lc .head-actions .btn{padding:9px 10px}}
@media(max-width:850px){.lc .topbar{padding:0 14px;gap:12px}.lc .topnav{display:none}.lc .search{width:auto;flex:1}.lc .layout{grid-template-columns:60px minmax(0,1fr)}.lc aside{padding:18px 8px}.lc .side-label,.lc .side-link span:last-child,.lc .ai-card,.lc .side-divider{display:none}.lc .side-link{justify-content:center;padding:12px 5px}.lc .main{padding:18px 13px}.lc .course-head{flex-wrap:wrap}.lc .head-actions{width:100%;justify-content:flex-end}.lc .steps{overflow:auto;justify-content:flex-start;gap:12px}.lc .step-line{min-width:25px}.lc .workspace{grid-template-columns:1fr}.lc .right-stack{grid-column:auto;grid-template-columns:1fr 1fr}}
@media(max-width:560px){.lc .course-thumb{width:82px;height:65px}.lc .course-title h1{font-size:20px}.lc .right-stack{grid-template-columns:1fr}.lc .form-row{grid-template-columns:1fr}.lc .video-preview{height:185px}.lc .step-line{display:none}.lc .step{font-size:11px}.lc .step .num{width:25px;height:25px}.lc .panel{padding:13px}}
`;

export default function CourseStudioPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const idValid = Number.isFinite(courseId);
  const { user, loading: authLoading, logout } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [quickAdd, setQuickAdd] = useState('');
  const [quickTarget, setQuickTarget] = useState<number | null>(null);
  const [newChapter, setNewChapter] = useState('');
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [dragItem, setDragItem] = useState<{ type: 'section' | 'lesson'; id: number } | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'resources' | 'settings'>('content');
  const [publishOpen, setPublishOpen] = useState(false);
  const [lessonMenu, setLessonMenu] = useState<number | null>(null);
  const [panel, setPanel] = useState<'curriculum' | 'details' | 'settings' | 'publish'>('curriculum');
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: number; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ id: number; name: string }[]>([]);
  const [details, setDetails] = useState({ title: '', description: '', seoDescription: '', thumbnail: '', tagIds: [] as number[] });
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [settings, setSettings] = useState({ categoryId: '', courseLevelId: '', courseLanguageId: '', price: '', discount: '', capacity: '', certificate: false, qna: false });
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const currency = branding?.currency ?? 'INR';

  const load = useCallback(() => {
    if (!Number.isFinite(courseId)) return;
    setLoading(true);
    Promise.all([
      api<any[]>('/courses/mine').then((mine) => mine.find((m) => m.id === courseId) ?? null),
      api<Chapter[]>(`/courses/${courseId}/content`).catch(() => []),
    ])
      .then(([c, ch]) => {
        setCourse(c);
        setChapters(ch);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!idValid) {
      router.replace('/dashboard/instructor/courses');
      return;
    }
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') {
      router.push('/login?next=/dashboard/instructor/courses/' + courseId);
      return;
    }
    load();
  }, [user, authLoading, router, courseId, load, idValid]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    api<{
      categories: { id: number; name: string }[];
      levels: { id: number; name: string }[];
      languages: { id: number; name: string }[];
      tags?: Tag[];
    }>('/taxonomy')
      .then((t) => {
        setCategories(t.categories ?? []);
        setLevels(t.levels ?? []);
        setLanguages((t.languages ?? []).filter((l) => ['english', 'hindi'].includes(l.name.trim().toLowerCase())));
        setTags(t.tags ?? []);
      })
      .catch(() => {});
  }, []);

  // Keep the details/settings forms in sync with the saved course.
  useEffect(() => {
    if (!course) return;
    setDetails({
      title: course.title ?? '',
      description: course.description ?? '',
      seoDescription: (course as any).seoDescription ?? '',
      thumbnail: course.thumbnail ?? '',
      tagIds: (course.tags ?? []).map((t) => t.id),
    });
    setSettings({
      categoryId: (course as any).categoryId ? String((course as any).categoryId) : '',
      courseLevelId: (course as any).courseLevelId ? String((course as any).courseLevelId) : '',
      courseLanguageId: (course as any).courseLanguageId ? String((course as any).courseLanguageId) : '',
      price: course.price != null ? String(course.price) : '',
      discount: course.discount != null ? String(course.discount) : '',
      capacity: (course as any).capacity != null ? String((course as any).capacity) : '',
      certificate: Boolean((course as any).certificate),
      qna: Boolean((course as any).qna),
    });
  }, [course]);

  // Drop a selection whose lesson no longer exists (deleted, moved, regenerated).
  useEffect(() => {
    if (selectedId === null) return;
    if (!chapters.some((c) => c.lessons.some((l) => l.id === selectedId))) setSelectedId(null);
  }, [chapters, selectedId]);

  const selected = chapters.flatMap((c) => c.lessons).find((l) => l.id === selectedId) ?? null;
  const totalLessons = chapters.reduce((n, c) => n + c.lessons.length, 0);
  const isPublished = course?.isApproved === 'approved' && course?.status === 'active';
  const isReview = !isPublished && course?.isApproved === 'pending';
  const currentStep = isPublished ? 5 : totalLessons > 0 ? 3 : chapters.length > 0 ? 2 : 1;

  const progressItems = [
    { label: 'Course Details', detail: '', done: Boolean(course?.title) },
    { label: 'Curriculum', detail: `${chapters.length} Sections`, done: chapters.length > 0 },
    { label: 'Content', detail: `${totalLessons} Lessons`, done: totalLessons > 0 },
    { label: 'Settings', detail: course?.price != null ? 'Set' : 'Pending', done: course?.price != null },
    { label: 'Publish', detail: isPublished ? 'Live' : 'Pending', done: isPublished },
  ];
  const progressPct = Math.round((progressItems.filter((i) => i.done).length / progressItems.length) * 100);
  const selectedChapter = selectedId ? chapters.find((c) => c.lessons.some((l) => l.id === selectedId)) : null;

  const lessonPayload = (l: Lesson, chapterId: number, order: number) => ({
    title: l.title,
    chapterId,
    order,
    filePath: l.filePath,
    storage: l.storage || 'upload',
    fileType: l.fileType || 'video',
    lessonType: l.lessonType === 'live' ? 'live' : 'lesson',
    duration: l.duration || '0:00',
    description: l.description ?? '',
    isPreview: l.isPreview,
    downloadable: l.downloadable,
    status: true,
  });

  const toggleTag = (tagId: number) => {
    setDetails((d) => ({
      ...d,
      tagIds: d.tagIds.includes(tagId) ? d.tagIds.filter((id) => id !== tagId) : [...d.tagIds, tagId],
    }));
  };

  const createTag = async () => {
    const name = tagInput.trim();
    if (!name) return;
    setTagInput('');
    try {
      const tag = await api<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) });
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      setDetails((d) => ({ ...d, tagIds: d.tagIds.includes(tag.id) ? d.tagIds : [...d.tagIds, tag.id] }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to create tag');
    }
  };

  const saveDetails = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api(`/courses/${courseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: details.title,
          description: details.description,
          seoDescription: details.seoDescription,
          thumbnail: details.thumbnail,
          tagIds: details.tagIds,
        }),
      });
      setToast('Course details saved');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save details');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setErr(null);
    setBusy(true);
    try {
      const payload: any = {
        title: details.title || course?.title || 'Untitled course',
        categoryId: settings.categoryId ? Number(settings.categoryId) : undefined,
        courseLevelId: settings.courseLevelId ? Number(settings.courseLevelId) : undefined,
        courseLanguageId: settings.courseLanguageId ? Number(settings.courseLanguageId) : undefined,
        price: settings.price === '' ? undefined : Number(settings.price),
        discount: settings.discount === '' ? undefined : Number(settings.discount),
        capacity: settings.capacity === '' ? 0 : Number(settings.capacity),
        certificate: settings.certificate,
        qna: settings.qna,
      };
      await api(`/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(payload) });
      setToast('Settings saved');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  const addChapter = async (title?: string) => {
    const name = (title ?? newChapter).trim();
    if (!name) return;
    setErr(null);
    try {
      await api(`/courses/${courseId}/content/chapters`, {
        method: 'POST',
        body: JSON.stringify({ title: name, order: chapters.length + 1 }),
      });
      setNewChapter('');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to add section');
    }
  };

  const removeChapter = async (id: number) => {
    if (!confirm('Delete this section and all its lessons?')) return;
    await api(`/courses/${courseId}/content/chapters/${id}`, { method: 'DELETE' });
    if (selectedChapter?.id === id) setSelectedId(null);
    load();
  };

  const quickAddLesson = async (chapterId: number, preset?: { fileType: string; storage: string; lessonType: string; title: string }, silent = false) => {
    const title = preset?.title ?? quickAdd.trim();
    if (!title) return;
    setErr(null);
    const chapter = chapters.find((c) => c.id === chapterId);
    try {
      const created = await api<Lesson>(`/courses/${courseId}/content/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          chapterId,
          order: (chapter?.lessons.length ?? 0) + 1,
          filePath: '',
          storage: preset?.storage ?? 'upload',
          fileType: preset?.fileType ?? 'video',
          lessonType: preset?.lessonType ?? 'lesson',
          duration: '0:00',
        }),
      });
      setQuickAdd('');
      setQuickTarget(null);
      selectLesson(created.id);
      setDirty(false);
      if (!silent) setToast(`"${title}" added`);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to add lesson');
    }
  };

  const addLessonTo = (chapterId?: number) => {
    const target = chapterId ?? selectedChapter?.id ?? chapters[chapters.length - 1]?.id;
    if (!target) {
      setToast('Add a section first');
      return;
    }
    quickAddLesson(target, { fileType: 'video', storage: 'upload', lessonType: 'lesson', title: 'New Lesson' }, true);
  };

  const addContentTile = (tile: (typeof CONTENT_TILES)[number]) => {
    const target = selectedChapter?.id ?? chapters[chapters.length - 1]?.id;
    if (!target) {
      setErr('Add a section first, then drop content into it.');
      return;
    }
    quickAddLesson(target, { fileType: tile.fileType, storage: tile.storage, lessonType: tile.lessonType, title: `New ${tile.label}` }, true);
  };

  const createQuiz = () => {
    const target = selectedChapter?.id ?? chapters[chapters.length - 1]?.id;
    if (!target) {
      setToast('Add a section first');
      return;
    }
    quickAddLesson(target, { fileType: 'doc', storage: 'external_link', lessonType: 'lesson', title: 'New quiz' }, true);
    setToast('Quiz lesson added');
  };

  const removeLesson = async (id: number) => {
    if (!confirm('Delete this lesson?')) return;
    await api(`/courses/${courseId}/content/lessons/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    setLessonMenu(null);
    setMenuFor(null);
    setToast('Lesson deleted');
    load();
  };

  const saveLesson = async (lesson: Lesson) => {
    const chapter = chapters.find((c) => c.lessons.some((l) => l.id === lesson.id));
    setErr(null);
    setBusy(true);
    try {
      await api(`/courses/${courseId}/content/lessons/${lesson.id}`, {
        method: 'PUT',
        body: JSON.stringify(lessonPayload(lesson, chapter?.id ?? 0, lesson.order)),
      });
      setDirty(false);
      setToast('Course changes saved');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const patchSelected = (patch: Partial<Lesson>) => {
    setChapters((prev) =>
      prev.map((c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
      })),
    );
    setDirty(true);
  };

  const lessonTypeOf = (l: Lesson) => {
    if (l.lessonType === 'live') return 'live';
    if (l.fileType === 'pdf') return 'pdf';
    if (l.fileType === 'audio') return 'audio';
    if (l.fileType === 'file') return 'scorm';
    if (l.fileType === 'doc') return l.storage === 'external_link' ? 'article' : 'assignment';
    return 'video';
  };

  const setLessonType = (key: string) => {
    const preset = TYPE_OPTIONS.find((t) => t.key === key);
    if (!preset) return;
    patchSelected({ fileType: preset.fileType, storage: preset.storage, lessonType: preset.lessonType });
  };

  const insertMarkup = (before: string, after = '') => {
    const el = notesRef.current;
    if (!el || !selected) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = selected.description ?? '';
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    patchSelected({ description: next });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = end + before.length;
    });
  };

  const reorderSections = async (dragId: number, targetId: number) => {
    const ids = chapters.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setChapters((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return ids.map((id, idx) => ({ ...map.get(id)!, order: idx + 1 }));
    });
    try {
      await api(`/courses/${courseId}/content/chapters/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ ids }),
      });
    } catch {
      load();
    }
  };

  const moveLesson = async (dragId: number, targetChapterId: number, beforeId: number | null) => {
    const source = chapters.find((c) => c.lessons.some((l) => l.id === dragId));
    const target = chapters.find((c) => c.id === targetChapterId);
    if (!source || !target) return;
    const dragged = source.lessons.find((l) => l.id === dragId);
    if (!dragged) return;

    const remaining = target.lessons.filter((l) => l.id !== dragId);
    let insertAt = beforeId === null ? remaining.length : remaining.findIndex((l) => l.id === beforeId);
    if (insertAt < 0) insertAt = remaining.length;
    const targetOrder = [...remaining.slice(0, insertAt), dragged, ...remaining.slice(insertAt)];
    const sourceOrder = source.lessons.filter((l) => l.id !== dragId);

    setChapters((prev) =>
      prev.map((c) => {
        if (c.id === source.id && source.id === target.id) return { ...c, lessons: targetOrder.map((l, i) => ({ ...l, order: i + 1 })) };
        if (c.id === source.id) return { ...c, lessons: sourceOrder.map((l, i) => ({ ...l, order: i + 1 })) };
        if (c.id === target.id) return { ...c, lessons: targetOrder.map((l, i) => ({ ...l, order: i + 1 })) };
        return c;
      }),
    );

    try {
      if (source.id !== target.id) {
        await api(`/courses/${courseId}/content/lessons/${dragId}`, {
          method: 'PUT',
          body: JSON.stringify(lessonPayload(dragged, targetChapterId, insertAt + 1)),
        });
        await api(`/courses/${courseId}/content/lessons/reorder/${source.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ids: sourceOrder.map((l) => l.id) }),
        });
      }
      await api(`/courses/${courseId}/content/lessons/reorder/${target.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ids: targetOrder.map((l) => l.id) }),
      });
    } catch {
      setErr('Could not reorder lessons — reloading.');
      load();
    }
  };

  const toggleSection = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Opens a lesson in the editor: selects it, shows its section and switches to the curriculum panel. */
  const selectLesson = (lessonId: number) => {
    setSelectedId(lessonId);
    setPanel('curriculum');
    const owner = chapters.find((c) => c.lessons.some((l) => l.id === lessonId));
    if (owner && collapsed.has(owner.id)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(owner.id);
        return next;
      });
    }
  };

  const generateOutline = async () => {
    const topic = (aiTopic.trim() || course?.title || '').trim();
    if (!topic) { setErr('Tell me what the course is about first.'); return; }
    setErr(null);
    setAiBusy(true);
    try {
      const res = await api<{ sections: number; lessons: number }>(`/courses/${courseId}/generate-outline`, {
        method: 'POST',
        body: JSON.stringify({ topic }),
      });
      setToast(`AI outline added — ${res.sections} sections, ${res.lessons} lessons`);
      setAiOpen(false);
      setAiTopic('');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not generate the outline');
    } finally {
      setAiBusy(false);
    }
  };

  const confirmPublish = async () => {
    setPublishOpen(false);
    setErr(null);
    setBusy(true);
    try {
      await api(`/courses/${courseId}/submit`, { method: 'POST' });
      setToast('Submitted for review');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not submit for review');
    } finally {
      setBusy(false);
    }
  };

  if (!idValid) {
    return (
      <div className="lc"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#68738a' }}>Redirecting…</div></div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="lc"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#68738a' }}>Loading builder…</div></div>
    );
  }

  const thumb = course?.thumbnail || `https://picsum.photos/seed/educore-${courseId}/320/180`;
  const workspace = branding?.name ?? 'EduCore';
  const initials = (user?.name ?? 'IN').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="lc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ══ Top bar ═══════════════════════════════════════ */}
      <header className="topbar">
        <Link className="brand" href="/dashboard/instructor"><span className="brandmark">▶</span> {workspace}</Link>
        <nav className="topnav">
          <Link href="/dashboard/instructor">⌂ Dashboard</Link>
          <Link className="active" href="/dashboard/instructor/courses">▣ Courses</Link>
          <button type="button" onClick={() => setToast('Learners — coming soon')} style={{ border: 0, background: 'none', color: '#4d5870', padding: '10px 13px', borderRadius: 10 }}>♙ Learners</button>
          <button type="button" onClick={() => setToast('Marketing — coming soon')} style={{ border: 0, background: 'none', color: '#4d5870', padding: '10px 13px', borderRadius: 10 }}>⚑ Marketing</button>
          <button type="button" onClick={() => setToast('Reports — coming soon')} style={{ border: 0, background: 'none', color: '#4d5870', padding: '10px 13px', borderRadius: 10 }}>▤ Reports</button>
          <Link href={`/dashboard/instructor/courses/${courseId}/edit`}>⚙ Settings</Link>
        </nav>
        <input className="search" placeholder="⌕  Search courses, learners..." onKeyDown={(e) => { if (e.key === 'Enter') router.push('/dashboard/instructor/courses'); }} />
        <div className="avatar" title={user?.name ?? 'Instructor'}>{initials}</div>
      </header>

      <div className="layout">
        {/* ══ Sidebar ═══════════════════════════════════════ */}
        <aside>
          <div className="side-label">Courses</div>
          <Link className="side-link" href="/dashboard/instructor/courses"><span className="ico">▣</span><span>All Courses</span></Link>
          <Link className="side-link active" href={`/dashboard/instructor/courses/${courseId}`}><span className="ico">✎</span><span>Course Builder</span></Link>
          <Link className="side-link" href="/dashboard/instructor/courses?status=draft"><span className="ico">▤</span><span>Drafts</span></Link>
          <Link className="side-link" href="/dashboard/instructor/courses?status=published"><span className="ico">◈</span><span>Published</span></Link>
          <button className="side-link" onClick={() => { setPanel('settings'); setToast('Pick the category for this course in Settings'); }}><span className="ico">▦</span><span>Categories</span></button>
          <button className="side-link" onClick={() => setToast('Tags — coming soon')}><span className="ico">◇</span><span>Tags</span></button>
          <div className="side-divider" />
          <div className="side-label">AI Tools</div>
          <button className="side-link" onClick={() => setAiOpen(true)}><span className="ico">✧</span><span>Generate Course</span></button>
          <button className="side-link" onClick={() => setAiOpen(true)}><span className="ico">✣</span><span>Generate Content</span></button>
          <button className="side-link" onClick={createQuiz}><span className="ico">☷</span><span>Create Quiz</span></button>
          <button className="side-link" onClick={() => setAiOpen(true)}><span className="ico">☷</span><span>Outline from Topic</span></button>
          <div className="ai-card">
            <div style={{ fontSize: 28 }}>🤖</div>
            <strong>Build with AI ✨</strong>
            <p>Create a complete course from a topic in minutes.</p>
            <button className="btn soft small" onClick={() => setAiOpen(true)}>Try AI Course Builder →</button>
          </div>
        </aside>

        {/* ══ Main ═════════════════════════════════════════ */}
        <main className="main">
          <div className="crumb">Courses　›　<b>Course Builder</b></div>

          <section className="course-head">
            <img className="course-thumb" src={thumb} alt="" />
            <div className="course-title">
              <h1>{course?.title ?? 'Untitled course'}<span className={`pill${isPublished ? ' live' : isReview ? ' review' : ''}`}>{isPublished ? 'Published' : isReview ? 'In Review' : 'Draft'}</span></h1>
              <p>{course?.description || 'No description yet — add one from Settings.'}</p>
            </div>
            <div className="head-actions">
              {course?.slug && (
                <Link className="btn" href={isPublished ? `/courses/${course.slug}` : `/dashboard/instructor/courses/${courseId}/preview`}>◉ Preview</Link>
              )}
              <button
                className="btn"
                disabled={busy || (panel === 'curriculum' && !selected)}
                onClick={() => {
                  if (panel === 'curriculum') selected && saveLesson(selected);
                  else if (panel === 'details') saveDetails();
                  else if (panel === 'settings') saveSettings();
                }}
              >
                Save
              </button>
              <button className="btn primary" onClick={() => (isPublished ? setToast('Already live') : setPublishOpen(true))}>➤ {isPublished ? 'Live' : 'Publish'}</button>
              <div className="lesson-menu">
                <button className="icon-btn" aria-label="More" onClick={() => setMenuFor((m) => (m === -1 ? null : -1))}>⋮</button>
                {menuFor === -1 && (
                  <div className="menu">
                    <Link href={`/dashboard/instructor/courses/${courseId}/edit`} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, textAlign: 'left', padding: '8px 10px', borderRadius: 7, fontSize: 12, color: '#28334a', textDecoration: 'none' }} onClick={() => setMenuFor(null)}>✎ Edit details</Link>
                    <button onClick={() => { setMenuFor(null); logout(); }}>⏻ Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Steps */}
          <div className="steps">
            {STEPS.map((label, i) => {
              const step = i + 1;
              const done = step < currentStep || (step === 5 && isPublished);
              const active = step === currentStep;
              const target = step === 1 ? 'details' : step === 4 ? 'settings' : step === 5 ? 'publish' : 'curriculum';
              const selected = panel === target;
              return (
                <div key={label} className="step" style={{ display: 'contents' }}>
                  {i > 0 && <div className="step-line" />}
                  <button
                    className={`step${done ? ' done' : active || selected ? ' active' : ''}`}
                    style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setPanel(target as 'curriculum' | 'details' | 'settings' | 'publish')}
                  >
                    <span className="num">{done ? '✓' : step}</span> {label}
                  </button>
                </div>
              );
            })}
          </div>

          {err && <div style={{ background: '#fdf0f0', color: '#d43a3a', border: '1px solid #f3c2c2', borderRadius: 10, padding: '10px 13px', marginBottom: 13, fontSize: 13 }}>{err}</div>}

          {/* AI outline generator */}
          {aiOpen && (
            <div className="ai-panel">
              <span style={{ fontSize: 20 }}>✨</span>
              <input className="field" autoFocus placeholder={course?.title ? `Topic — e.g. ${course.title}` : 'Topic — e.g. Python for Data Science'} value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), generateOutline())} style={{ flex: 1 }} />
              <button className="btn primary" onClick={generateOutline} disabled={aiBusy}>{aiBusy ? <span className="spin" /> : 'Generate'}</button>
              <button className="btn" onClick={() => setAiOpen(false)}>✕</button>
            </div>
          )}

          <div className="workspace">
            {/* ════ Curriculum panel ════ */}
            <section className="panel">
              <div className="panel-head">
                <h2>Curriculum <span className="subtle">({chapters.length} Sections · {totalLessons} Lessons)</span></h2>
                <button className="btn soft small" onClick={() => document.getElementById('new-section-input')?.focus()}>＋ Add Section</button>
              </div>

              <div>
                {chapters.length === 0 && (
                  <div style={{ background: 'var(--soft)', borderRadius: 10, padding: 22, textAlign: 'center' }}>
                    <div style={{ fontSize: 34 }}>🗂️</div>
                    <p style={{ margin: '8px 0 4px', fontWeight: 700 }}>No sections yet</p>
                    <p className="subtle">Add your first section below — lessons live inside sections.</p>
                  </div>
                )}
                {chapters.map((ch, i) => {
                  const isCollapsed = collapsed.has(ch.id);
                  const selectedHere = selected?.id != null && ch.lessons.some((l) => l.id === selected.id);
                  return (
                    <div
                      key={ch.id}
                      className={`section${dropHint === `sec-${ch.id}` ? ' drop' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDropHint(`sec-${ch.id}`); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragItem?.type === 'section' && dragItem.id !== ch.id) reorderSections(dragItem.id, ch.id);
                        setDragItem(null); setDropHint(null);
                      }}
                    >
                      <div className="section-head" style={{ background: selectedHere ? '#f5f3ff' : undefined }}>
                        <span
                          className="grip"
                          draggable
                          onDragStart={(e) => { setDragItem({ type: 'section', id: ch.id }); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => { setDragItem(null); setDropHint(null); }}
                          title="Drag to reorder"
                        >⠿</span>
                        <button type="button" className="section-name" onClick={() => toggleSection(ch.id)} style={{ border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                          <span>{i + 1}. {ch.title}</span>
                          <span className="section-meta">{ch.lessons.length} Lessons</span>
                        </button>
                        <button className="chev" onClick={() => toggleSection(ch.id)} style={{ border: 0, background: 'none', fontSize: 16 }} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>{isCollapsed ? '⌄' : '⌃'}</button>
                      </div>

                      {!isCollapsed && (
                        <div className="lesson-list"
                          onDragOver={(e) => { if (dragItem?.type === 'lesson') { e.preventDefault(); e.stopPropagation(); setDropHint(`chap-${ch.id}`); } }}
                          onDrop={(e) => {
                            if (dragItem?.type !== 'lesson') return;
                            e.preventDefault(); e.stopPropagation();
                            moveLesson(dragItem.id, ch.id, null);
                            setDragItem(null); setDropHint(null);
                          }}
                        >
                          {ch.lessons.map((l, j) => (
                            <div
                              key={l.id}
                              className={`lesson${selectedId === l.id ? ' selected' : ''}${dropHint === `les-${l.id}` ? ' drop' : ''}`}
                              onClick={() => selectLesson(l.id)}
                              onDragOver={(e) => { if (dragItem?.type === 'lesson') { e.preventDefault(); e.stopPropagation(); setDropHint(`les-${l.id}`); } }}
                              onDrop={(e) => {
                                if (dragItem?.type !== 'lesson') return;
                                e.preventDefault(); e.stopPropagation();
                                moveLesson(dragItem.id, ch.id, l.id);
                                setDragItem(null); setDropHint(null);
                              }}
                            >
                              <span
                                className="grip"
                                draggable
                                onDragStart={(e) => { setDragItem({ type: 'lesson', id: l.id }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                                onDragEnd={() => { setDragItem(null); setDropHint(null); }}
                                title="Drag to reorder"
                              >⠿</span>
                              <span className="lesson-icon">{LESSON_ICON[l.fileType] ?? '▶'}</span>
                              <button type="button" className="lesson-name" onClick={(e) => { e.stopPropagation(); selectLesson(l.id); }}>{i + 1}.{j + 1} {l.title}</button>
                              <span className="duration">{l.duration}</span>
                              <div className="lesson-menu">
                                <button className="more" onClick={(e) => { e.stopPropagation(); setLessonMenu((m) => (m === l.id ? null : l.id)); }} aria-label="Lesson menu">•••</button>
                                {lessonMenu === l.id && (
                                  <div className="menu">
                                    <button onClick={() => { selectLesson(l.id); setLessonMenu(null); }}>✎ Edit lesson</button>
                                    <button className="danger" onClick={() => removeLesson(l.id)}>🗑 Delete lesson</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {quickTarget === ch.id ? (
                            <div style={{ display: 'flex', gap: 6, padding: '6px 4px' }}>
                              <input
                                autoFocus
                                className="field"
                                style={{ padding: '8px 10px', fontSize: 13 }}
                                placeholder="Lesson title — Enter to add"
                                value={quickAdd}
                                onChange={(e) => setQuickAdd(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); quickAddLesson(ch.id); }
                                  if (e.key === 'Escape') { setQuickTarget(null); setQuickAdd(''); }
                                }}
                                onBlur={() => { if (!quickAdd.trim()) setQuickTarget(null); }}
                              />
                              <button className="btn primary small" onClick={() => quickAddLesson(ch.id)} aria-label="Add lesson">＋</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setQuickTarget(ch.id); setQuickAdd(''); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: 'var(--purple)', fontWeight: 700, fontSize: 12, padding: '8px 6px', width: '100%', borderRadius: 8 }}>＋ Add lesson</button>
                          )}
                        </div>
                      )}
                      <div className="section-foot">
                        <button onClick={() => removeChapter(ch.id)}>🗑 Delete section</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="panel-footer">
                <button className="btn" onClick={() => addLessonTo()}>＋ Add Lesson</button>
                <button className="btn primary" onClick={() => document.getElementById('new-section-input')?.focus()}>＋ Add Section</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input id="new-section-input" className="field" style={{ padding: '9px 11px', fontSize: 13 }} placeholder="New section title…" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChapter())} />
                <button className="btn primary" onClick={() => addChapter()} disabled={!newChapter.trim()} aria-label="Add section">＋</button>
              </div>
            </section>

            {/* ════ Editor / Details / Settings / Publish panel ════ */}
            <section className="panel editor">
              {panel === 'details' ? (
                <>
                  <div className="panel-head"><h2>Course Details</h2><span className="subtle">Title, description and thumbnail</span></div>
                  <label htmlFor="courseTitle">Course Title <span style={{ color: '#e34b5d' }}>*</span></label>
                  <input id="courseTitle" className="field" value={details.title} onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Python for Data Science" />
                  <label htmlFor="courseDescription">Description</label>
                  <textarea id="courseDescription" className="notes" rows={5} value={details.description} onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} placeholder="What will students learn?" />
                  <label htmlFor="courseSeo">SEO description</label>
                  <input id="courseSeo" className="field" value={details.seoDescription} onChange={(e) => setDetails((d) => ({ ...d, seoDescription: e.target.value }))} placeholder="Short summary for search results" />
                  <label>Thumbnail</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 128, height: 76, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--soft)' }}>
                      {details.thumbnail && <img src={details.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </span>
                    <label className="btn soft small" style={{ cursor: 'pointer' }}>
                      {details.thumbnail ? 'Replace image' : 'Upload image'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                        const input = e.target;
                        const file = input.files?.[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const token = tokenStore.access;
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/uploads`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
                          if (!res.ok) throw new Error('Upload failed');
                          const data = await res.json();
                          setDetails((d) => ({ ...d, thumbnail: data.url }));
                          setToast('Thumbnail uploaded — remember to save');
                        } catch {
                          setToast('Upload failed');
                        }
                        input.value = '';
                      }} />
                    </label>
                  </div>
                  <label htmlFor="courseTags">Tags</label>
                  <div id="courseTags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {tags.map((tag) => {
                      const active = details.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className="badge"
                          onClick={() => toggleTag(tag.id)}
                          style={{ cursor: 'pointer', opacity: active ? 1 : 0.55, boxShadow: active ? 'inset 0 0 0 2px currentColor' : undefined }}
                          aria-pressed={active}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                    {tags.length === 0 && <span className="subtle">No tags yet — add the first one below.</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="field"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void createTag();
                        }
                      }}
                      placeholder="Create a tag, e.g. Python"
                    />
                    <button type="button" className="btn soft small" onClick={createTag} disabled={!tagInput.trim()}>Add</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 16 }}>
                    <button className="btn primary" disabled={busy || !details.title.trim()} onClick={saveDetails}>{busy ? 'Saving…' : 'Save details'}</button>
                  </div>
                </>
              ) : panel === 'settings' ? (
                <>
                  <div className="panel-head"><h2>Course Settings</h2><span className="subtle">Categories, pricing and learner access</span></div>
                  <div className="form-row">
                    <div>
                      <label htmlFor="categoryId">Category</label>
                      <select id="categoryId" className="field" value={settings.categoryId} onChange={(e) => setSettings((s) => ({ ...s, categoryId: e.target.value }))}>
                        <option value="">Select…</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="levelId">Level</label>
                      <select id="levelId" className="field" value={settings.courseLevelId} onChange={(e) => setSettings((s) => ({ ...s, courseLevelId: e.target.value }))}>
                        <option value="">Select…</option>
                        {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: 2 }}>
                    <div>
                      <label htmlFor="languageId">Language</label>
                      <select id="languageId" className="field" value={settings.courseLanguageId} onChange={(e) => setSettings((s) => ({ ...s, courseLanguageId: e.target.value }))}>
                        <option value="">Select…</option>
                        {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="price">Price ({currency})</label>
                      <input id="price" type="number" min="0" step="0.01" className="field" value={settings.price} placeholder="0 for free" onChange={(e) => setSettings((s) => ({ ...s, price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: 2 }}>
                    <div>
                      <label htmlFor="discount">Discount (%)</label>
                      <input id="discount" type="number" min="0" step="0.01" className="field" value={settings.discount} placeholder="0" onChange={(e) => setSettings((s) => ({ ...s, discount: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="capacity">Seat limit</label>
                      <input id="capacity" type="number" min="0" step="1" className="field" value={settings.capacity} placeholder="0 = unlimited" onChange={(e) => setSettings((s) => ({ ...s, capacity: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 16, fontSize: 13 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input type="checkbox" checked={settings.certificate} onChange={(e) => setSettings((s) => ({ ...s, certificate: e.target.checked }))} />
                      Issue a certificate on completion
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input type="checkbox" checked={settings.qna} onChange={(e) => setSettings((s) => ({ ...s, qna: e.target.checked }))} />
                      Enable Q&amp;A with the instructor
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 16 }}>
                    <button className="btn primary" disabled={busy} onClick={saveSettings}>{busy ? 'Saving…' : 'Save settings'}</button>
                  </div>
                </>
              ) : panel === 'publish' ? (
                <>
                  <div className="panel-head"><h2>Publish</h2><span className="subtle">{isPublished ? 'This course is live' : isReview ? 'Waiting for admin review' : 'Not submitted yet'}</span></div>
                  <div className="checklist" style={{ marginBottom: 16 }}>
                    {progressItems.map((item) => (
                      <div className="checkrow" key={item.label}>
                        <span className={`check${item.done ? ' complete' : ''}`}>{item.done ? '✓' : ''}</span>
                        <span>{item.label}{item.detail ? ` (${item.detail})` : ''}</span>
                        {item.done && <b>✓</b>}
                      </div>
                    ))}
                  </div>
                  <p className="muted-note" style={{ marginBottom: 14 }}>
                    {isPublished
                      ? 'Learners can find and enroll in this course on the marketplace.'
                      : isReview
                        ? 'Your course is in the admin review queue. You can keep editing while it waits.'
                        : 'Submit the course when the checklist above is complete — an admin approves it before it goes live.'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Link className="btn" href={`/dashboard/instructor/courses/${courseId}/preview`}>◉ Preview</Link>
                    <button className="btn primary" disabled={busy || isPublished} onClick={() => setPublishOpen(true)}>{isPublished ? 'Live' : '➤ Submit for review'}</button>
                  </div>
                </>
              ) : selected ? (
                <>
                  <div className="panel-head"><h2>Edit Lesson</h2><span className="subtle">{dirty ? 'Unsaved changes' : 'Changes saved'}</span></div>
                  <div className="form-row">
                    <div>
                      <label htmlFor="lessonTitle">Lesson Title <span style={{ color: '#e34b5d' }}>*</span></label>
                      <input id="lessonTitle" className="field" value={selected.title} onChange={(e) => patchSelected({ title: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="lessonType">Lesson Type</label>
                      <select id="lessonType" className="field" value={lessonTypeOf(selected)} onChange={(e) => setLessonType(e.target.value)}>
                        {TYPE_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.icon}　{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <label>Lesson Content</label>
                  <div className="video-preview">
                    <div className="video-person">▶</div>
                    <div className="video-copy">{(course?.title ?? 'Course').slice(0, 60)}</div>
                    <div className="play">▶</div>
                    <div className="video-controls"><div className="progress-line" />▶　0:00 / {selected.duration || '0:00'}<span style={{ float: 'right' }}>CC　⚙　⛶</span></div>
                  </div>

                  <div className="tabs">
                    <button className={`tab${activeTab === 'content' ? ' active' : ''}`} onClick={() => setActiveTab('content')}>Content</button>
                    <button className={`tab${activeTab === 'resources' ? ' active' : ''}`} onClick={() => setActiveTab('resources')}>Resources</button>
                    <button className={`tab${activeTab === 'settings' ? ' active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
                  </div>

                  {activeTab === 'content' && (
                    <div>
                      <label htmlFor="description">Description / Notes</label>
                      <div className="toolbar">
                        <button title="Bold" onClick={() => insertMarkup('**', '**')}><b>B</b></button>
                        <button title="Italic" onClick={() => insertMarkup('*', '*')}><i>I</i></button>
                        <button title="Underline" onClick={() => insertMarkup('__', '__')}><u>U</u></button>
                        <button title="Bullet list" onClick={() => insertMarkup('- ')}>≡</button>
                        <button title="Numbered list" onClick={() => insertMarkup('1. ')}>☷</button>
                        <button title="Link" onClick={() => insertMarkup('[', '](https://)')}>🔗</button>
                        <button title="Code" onClick={() => insertMarkup('`', '`')}>&lt;/&gt;</button>
                      </div>
                      <textarea ref={notesRef} className="notes" id="description" rows={4} value={selected.description ?? ''} onChange={(e) => patchSelected({ description: e.target.value })} placeholder="What will learners take away from this lesson?" />
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontWeight: 400 }}><input type="checkbox" checked={selected.isPreview} onChange={(e) => patchSelected({ isPreview: e.target.checked })} /> Free preview</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontWeight: 400 }}><input type="checkbox" checked={selected.downloadable} onChange={(e) => patchSelected({ downloadable: e.target.checked })} /> Downloadable</label>
                      </div>
                    </div>
                  )}

                  {activeTab === 'resources' && (
                    <div>
                      <label>Lesson Resources</label>
                      {selected.filePath ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 13 }}>
                          <span style={{ fontSize: 20 }}>📄</span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.filePath.split('/').pop()}</span>
                          <a href={selected.filePath} target="_blank" rel="noreferrer" className="btn small soft">Open</a>
                        </div>
                      ) : (
                        <p className="muted-note" style={{ padding: '14px 2px' }}>No resources yet — upload a file learners can download alongside this lesson.</p>
                      )}
                      <label className="btn soft small" style={{ cursor: 'pointer' }}>
                        ＋ Upload resource
                        <input type="file" style={{ display: 'none' }} accept={selected.fileType === 'audio' ? 'audio/*' : selected.fileType === 'pdf' ? 'application/pdf' : undefined} onChange={async (e) => {
                          const input = e.target;
                          const file = input.files?.[0];
                          if (!file) return;
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const token = tokenStore.access;
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/uploads`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
                            if (!res.ok) throw new Error('Upload failed');
                            const data = await res.json();
                            patchSelected({ filePath: data.url, storage: 'upload' });
                            setToast('Resource uploaded');
                          } catch {
                            setToast('Upload failed');
                          }
                          input.value = '';
                        }} />
                      </label>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div>
                      <label htmlFor="duration">Duration</label>
                      <input id="duration" className="field" placeholder="e.g. 8:20" value={selected.duration} onChange={(e) => patchSelected({ duration: e.target.value })} />
                      <label htmlFor="storage">Source</label>
                      <select id="storage" className="field" value={selected.storage || 'upload'} onChange={(e) => patchSelected({ storage: e.target.value })}>
                        <option value="youtube">YouTube</option>
                        <option value="vimeo">Vimeo</option>
                        <option value="upload">Uploaded file URL</option>
                        <option value="external_link">External link</option>
                      </select>
                      <label htmlFor="filePath">URL / ID</label>
                      <input id="filePath" className="field" value={selected.filePath} placeholder={selected.storage === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'} onChange={(e) => patchSelected({ filePath: e.target.value })} />
                      <p className="muted-note" style={{ marginTop: 10 }}>Learner access: this lesson is {selected.isPreview ? 'FREE for everyone' : 'only visible to enrolled learners'}. Toggle "Free preview" in the Content tab to change it.</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 16 }}>
                    <button className="btn" disabled={busy} onClick={() => { load(); setDirty(false); setToast('Unsaved changes discarded'); }}>Discard</button>
                    <button className="btn primary" disabled={busy} onClick={() => saveLesson(selected)}>{busy ? 'Saving…' : 'Save lesson'}</button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 18px' }}>
                  <div style={{ fontSize: 52, color: 'var(--purple2)' }}>▶</div>
                  <h3 style={{ margin: '10px 0 4px' }}>Select a lesson to edit</h3>
                  <p className="subtle" style={{ maxWidth: 380, margin: '0 auto' }}>Pick a lesson from the curriculum on the left, or use the Add Content tiles to create one.</p>
                  {chapters.length > 0 && <button className="btn primary" style={{ marginTop: 16 }} onClick={() => addLessonTo()}>＋ Add a lesson</button>}
                </div>
              )}
            </section>

            {/* ════ Right stack ════ */}
            <div className="right-stack">
              <section className="panel">
                <div className="panel-head"><h2>Add Content</h2></div>
                <div className="content-grid">
                  {CONTENT_TILES.map((t) => (
                    <button key={t.key} className="content-tile" onClick={() => addContentTile(t)}>
                      <span className="symbol" style={{ color: t.key === 'pdf' ? '#e45a5a' : t.key === 'audio' ? '#e9a12c' : t.key === 'quiz' ? '#9a58ee' : t.key === 'assignment' ? '#24a875' : t.key === 'live' ? '#d44eaf' : t.key === 'article' ? '#3185e8' : t.key === 'embed' ? '#df4d83' : '#8b4df5' }}>{t.icon}</span>
                      <small>{t.label}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Course Progress</h2></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="subtle">Setup completion</span><b>{progressPct}%</b></div>
                <div className="progress"><span style={{ width: `${progressPct}%` }} /></div>
                <div className="checklist">
                  {progressItems.map((item) => (
                    <div className="checkrow" key={item.label}>
                      <span className={`check${item.done ? ' complete' : ''}`}>{item.done ? '✓' : ''}</span>
                      <span>{item.label}{item.detail ? ` (${item.detail})` : ''}</span>
                      {item.done && <b>✓</b>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Toast */}
      <div className={`toast${toast ? ' show' : ''}`} role="status">{toast}</div>

      {/* Publish confirmation modal */}
      {publishOpen && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-labelledby="publishTitle" onClick={() => setPublishOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="publishTitle">Publish course?</h3>
            <p>Your course will be submitted for admin review. It goes live once approved, and you can keep updating it afterwards.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPublishOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={confirmPublish}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
