import { CertToken } from './certificate-builder.service';

export interface CertTemplateItem {
  elementId: CertToken;
  xPosition: string;
  yPosition: string;
  fontSize: number;
  color: string;
  bold: boolean;
  text?: string;
}

export interface CertTemplate {
  name: string;
  builder: { title?: string; subTitle?: string; description?: string };
  items: CertTemplateItem[];
}

/** Ten ready-made, Udemy-style layouts admins can apply with one click. */
export const CERTIFICATE_TEMPLATES: CertTemplate[] = [
  {
    name: 'Classic',
    builder: { title: 'Certificate of Completion', subTitle: 'This is to certify that', description: 'Successfully completed the course and demonstrated mastery.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '35', fontSize: 28, color: '#1a1a2e', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '45', fontSize: 20, color: '#4f46e5', bold: true },
      { elementId: 'date', xPosition: '50', yPosition: '65', fontSize: 12, color: '#6b7280', bold: false },
      { elementId: 'brandName', xPosition: '50', yPosition: '80', fontSize: 14, color: '#111827', bold: true },
    ],
  },
  {
    name: 'Modern',
    builder: { title: 'Udemy Certificate', subTitle: 'Awarded to', description: 'In recognition of successful course completion.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '38', fontSize: 30, color: '#0f172a', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '48', fontSize: 16, color: '#334155', bold: false },
      { elementId: 'date', xPosition: '50', yPosition: '58', fontSize: 12, color: '#475569', bold: false },
      { elementId: 'custom', xPosition: '50', yPosition: '68', fontSize: 10, color: '#64748b', bold: false, text: 'Verified by EduCore' },
    ],
  },
  {
    name: 'Minimal',
    builder: { title: 'Achievement Award', subTitle: 'Presented to', description: 'In recognition of exceptional performance and commitment.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '40', fontSize: 32, color: '#b45309', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '50', fontSize: 18, color: '#92400e', bold: true },
      { elementId: 'instructorName', xPosition: '50', yPosition: '60', fontSize: 16, color: '#78350f', bold: false },
      { elementId: 'date', xPosition: '50', yPosition: '72', fontSize: 11, color: '#9a3412', bold: false },
    ],
  },
  {
    name: 'Elegant',
    builder: { title: 'Mastery Certificate', subTitle: 'This certifies', description: 'Advanced skills and knowledge acquired.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '36', fontSize: 26, color: '#1e293b', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '46', fontSize: 18, color: '#334155', bold: true },
      { elementId: 'instructorName', xPosition: '50', yPosition: '58', fontSize: 14, color: '#475569', bold: false },
      { elementId: 'brandName', xPosition: '50', yPosition: '70', fontSize: 12, color: '#64748b', bold: true },
    ],
  },
  {
    name: 'Bold',
    builder: { title: 'Professional Certificate', subTitle: 'Awarded to', description: 'Completion of professional training requirements.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '34', fontSize: 28, color: '#0f172a', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '46', fontSize: 18, color: '#4f46e5', bold: true },
      { elementId: 'date', xPosition: '50', yPosition: '62', fontSize: 12, color: '#64748b', bold: false },
      { elementId: 'custom', xPosition: '50', yPosition: '74', fontSize: 10, color: '#94a3b8', bold: false, text: 'EduCore Verified' },
    ],
  },
  {
    name: 'Gradient',
    builder: { title: 'Course Completion', subTitle: 'Certificate of Achievement', description: 'Successfully finished all modules.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '40', fontSize: 24, color: '#1e293b', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '50', fontSize: 16, color: '#475569', bold: false },
      { elementId: 'date', xPosition: '50', yPosition: '64', fontSize: 12, color: '#64748b', bold: false },
      { elementId: 'brandName', xPosition: '50', yPosition: '78', fontSize: 14, color: '#0f172a', bold: true },
    ],
  },
  {
    name: 'Vintage',
    builder: { title: 'Certified Professional', subTitle: 'This is to certify', description: 'Meets all competency requirements.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '35', fontSize: 30, color: '#0f172a', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '48', fontSize: 20, color: '#4f46e5', bold: true },
      { elementId: 'date', xPosition: '50', yPosition: '60', fontSize: 12, color: '#6b7280', bold: false },
      { elementId: 'instructorName', xPosition: '50', yPosition: '72', fontSize: 14, color: '#334155', bold: false },
    ],
  },
  {
    name: 'Neon',
    builder: { title: 'Excellence Certificate', subTitle: 'Presented by EduCore', description: 'Outstanding performance and dedication.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '38', fontSize: 28, color: '#b45309', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '50', fontSize: 18, color: '#92400e', bold: true },
      { elementId: 'date', xPosition: '50', yPosition: '66', fontSize: 12, color: '#9a3412', bold: false },
      { elementId: 'brandName', xPosition: '50', yPosition: '80', fontSize: 12, color: '#78350f', bold: true },
    ],
  },
  {
    name: 'Artisan',
    builder: { title: 'Completion Certificate', subTitle: 'Awarded to', description: 'For completing the course with distinction.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '36', fontSize: 26, color: '#111827', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '48', fontSize: 16, color: '#4f46e5', bold: true },
      { elementId: 'date', xPosition: '50', yPosition: '62', fontSize: 11, color: '#6b7280', bold: false },
      { elementId: 'custom', xPosition: '50', yPosition: '72', fontSize: 10, color: '#9ca3af', bold: false, text: 'Certified' },
    ],
  },
  {
    name: 'Corporate',
    builder: { title: 'Skill Certification', subTitle: 'This certifies that', description: 'Completed required training and assessments.' },
    items: [
      { elementId: 'studentName', xPosition: '50', yPosition: '34', fontSize: 28, color: '#1e293b', bold: true },
      { elementId: 'courseTitle', xPosition: '50', yPosition: '46', fontSize: 18, color: '#334155', bold: true },
      { elementId: 'instructorName', xPosition: '50', yPosition: '58', fontSize: 14, color: '#475569', bold: false },
      { elementId: 'date', xPosition: '50', yPosition: '70', fontSize: 12, color: '#64748b', bold: false },
    ],
  },
];

