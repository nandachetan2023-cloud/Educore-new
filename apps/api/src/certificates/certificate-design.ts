import PDFKit from 'pdfkit';

export interface StyleDesign {
  bg: string;
  primary: string;
  accent: string;
  ink: string;
  muted: string;
  line: 'double' | 'thick' | 'thin' | 'gilt' | 'vintage' | 'neon' | 'offset' | 'side' | 'band' | 'bandSolid';
  titleSize: number;
  preview: string; // CSS gradient for web pickers
}

const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];
const rgbHex = (rgb: number[]): string =>
  '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/** The ten preset styles — each a fully designed template with its own background art. */
export const STYLE_DESIGNS: Record<string, StyleDesign> = {
  Classic: { bg: '#ffffff', primary: '#4f46e5', accent: '#0ea5e9', ink: '#111827', muted: '#6b7280', line: 'double', titleSize: 38, preview: 'linear-gradient(135deg,#ffffff 55%,#e0e7ff 100%)' },
  Modern: { bg: '#0f172a', primary: '#f8fafc', accent: '#22d3ee', ink: '#f8fafc', muted: '#94a3b8', line: 'side', titleSize: 36, preview: 'linear-gradient(100deg,#22d3ee 0 8%,#0f172a 16%)' },
  Minimal: { bg: '#ffffff', primary: '#111827', accent: '#9ca3af', ink: '#111827', muted: '#6b7280', line: 'thin', titleSize: 34, preview: 'linear-gradient(135deg,#ffffff,#f3f4f6)' },
  Elegant: { bg: '#fffdf7', primary: '#b45309', accent: '#d97706', ink: '#1c1917', muted: '#78716c', line: 'gilt', titleSize: 38, preview: 'linear-gradient(135deg,#fffdf7,#fde68a 120%)' },
  Bold: { bg: '#ffffff', primary: '#4f46e5', accent: '#f59e0b', ink: '#111827', muted: '#6b7280', line: 'thick', titleSize: 40, preview: 'linear-gradient(135deg,#eef2ff,#f59e0b33)' },
  Gradient: { bg: '#ffffff', primary: '#4f46e5', accent: '#0ea5e9', ink: '#111827', muted: '#6b7280', line: 'band', titleSize: 38, preview: 'linear-gradient(135deg,#4f46e5,#0ea5e9)' },
  Vintage: { bg: '#f5efe0', primary: '#78350f', accent: '#a16207', ink: '#292524', muted: '#7c6f5a', line: 'vintage', titleSize: 38, preview: 'linear-gradient(135deg,#f5efe0,#e7d8b1)' },
  Neon: { bg: '#0b0b12', primary: '#ec4899', accent: '#22d3ee', ink: '#f9fafb', muted: '#8b8b9e', line: 'neon', titleSize: 36, preview: 'linear-gradient(135deg,#ec4899,#0b0b12 60%,#22d3ee)' },
  Artisan: { bg: '#faf6f1', primary: '#7c3aed', accent: '#f97316', ink: '#292524', muted: '#7c7062', line: 'offset', titleSize: 36, preview: 'linear-gradient(135deg,#faf6f1,#f9731633)' },
  Corporate: { bg: '#ffffff', primary: '#1e3a8a', accent: '#3b82f6', ink: '#111827', muted: '#6b7280', line: 'bandSolid', titleSize: 38, preview: 'linear-gradient(180deg,#1e3a8a 0 30%,#3b82f6 32%,#ffffff 40%)' },
};

/** Full-page background layer (the template's background art). */
export function paintBackground(doc: PDFKit.PDFDocument, cfg: StyleDesign, width: number, height: number) {
  // Base fill
  doc.rect(0, 0, width, height).fill(cfg.bg);

  switch (cfg.line) {
    case 'double': // Classic
      doc.lineWidth(6).strokeColor(cfg.primary).rect(24, 24, width - 48, height - 48).stroke();
      doc.lineWidth(1).strokeColor(cfg.accent).rect(36, 36, width - 72, height - 72).stroke();
      break;
    case 'thick': // Bold
      doc.lineWidth(16).strokeColor(cfg.primary).rect(20, 20, width - 40, height - 40).stroke();
      doc.lineWidth(2).strokeColor(cfg.accent).rect(44, 44, width - 88, height - 88).stroke();
      break;
    case 'thin': // Minimal
      doc.lineWidth(1).strokeColor(cfg.accent).rect(30, 30, width - 60, height - 60).stroke();
      break;
    case 'gilt': // Elegant — double gold frame + corner diamonds
      doc.lineWidth(3).strokeColor(cfg.primary).rect(28, 28, width - 56, height - 56).stroke();
      doc.lineWidth(1).strokeColor(cfg.accent).rect(40, 40, width - 80, height - 80).stroke();
      for (const [cx, cy] of [[28, 28], [width - 28, 28], [28, height - 28], [width - 28, height - 28]]) {
        const s = 12;
        doc.fillColor(cfg.accent)
          .moveTo(cx, cy - s).lineTo(cx + s, cy).lineTo(cx, cy + s).lineTo(cx - s, cy).closePath().fill();
      }
      break;
    case 'vintage': // Vintage — parchment sepia double frame + corner dots
      doc.lineWidth(2).strokeColor(cfg.primary).rect(26, 26, width - 52, height - 52).stroke();
      doc.lineWidth(1).strokeColor(cfg.accent).rect(38, 38, width - 76, height - 76).stroke();
      for (const [cx, cy] of [[32, 32], [width - 32, 32], [32, height - 32], [width - 32, height - 32]]) {
        doc.fillColor(cfg.accent).circle(cx, cy, 5).fill();
      }
      break;
    case 'neon': // Neon — black bg, glowing magenta/cyan frame
      for (const [c, lw] of [[cfg.accent, 3] as const, [cfg.primary, 1] as const, [cfg.accent, 6] as const]) {
        doc.lineWidth(lw).opacity(0.5).strokeColor(c).rect(26, 26, width - 52, height - 52).stroke();
      }
      doc.opacity(1).lineWidth(2).strokeColor(cfg.accent).rect(40, 40, width - 80, height - 80).stroke();
      break;
    case 'offset': // Artisan — rotated offset wooden frame
      doc.save().rotate(0.4, { origin: [width / 2, height / 2] });
      doc.lineWidth(4).strokeColor(cfg.accent).rect(40, 34, width - 84, height - 64).stroke();
      doc.restore();
      doc.lineWidth(2).strokeColor(cfg.primary).rect(30, 30, width - 60, height - 60).stroke();
      doc.lineWidth(1).strokeColor(cfg.accent).rect(38, 38, width - 76, height - 76).stroke();
      break;
    case 'side': // Modern — dark bg, accent side band
      doc.fillColor(cfg.accent).rect(0, 0, 46, height).fill();
      doc.fillColor(cfg.primary).rect(46, 0, 6, height).fill();
      break;
    case 'band': // Gradient — interpolated top/bottom bands
      for (let i = 0; i < 40; i++) {
        const t = i / 39;
        const from = hexRgb(cfg.primary);
        const to = hexRgb(cfg.accent);
        const mix = from.map((v, j) => Math.round(v + (to[j] - v) * t));
        doc.fillColor(rgbHex(mix), 1).rect(0, i * (height / 40), width, height / 40 + 1).fill();
      }
      break;
    case 'bandSolid': // Corporate — navy header band
      doc.fillColor(cfg.primary).rect(0, 0, width, 92).fill();
      doc.fillColor(cfg.accent).rect(0, 92, width, 4).fill();
      doc.lineWidth(1).strokeColor(cfg.muted).rect(30, 120, width - 60, height - 150).stroke();
      break;
  }
}

/** Fixed template content — date/name/course/signature are the dynamic bits. */
export function paintContent(
  doc: PDFKit.PDFDocument,
  cfg: StyleDesign,
  width: number,
  height: number,
  data: { studentName: string; courseTitle: string; instructorName: string },
  brandName: string,
  signaturePath?: string | null,
) {
  const top = cfg.line === 'bandSolid' ? 140 : cfg.line === 'band' ? 120 : cfg.line === 'side' ? 100 : 70;
  doc.fillColor(cfg.primary).fontSize(14).font('Helvetica-Bold')
    .text(brandName.toUpperCase(), 0, top, { align: 'center', characterSpacing: 3 });

  const titleY = top + 50;
  doc.fillColor(cfg.primary).fontSize(cfg.titleSize).font('Helvetica-Bold')
    .text('Certificate of Completion', 0, titleY, { align: 'center' });

  const baseY = titleY + cfg.titleSize + 30;
  doc.fillColor(cfg.muted).fontSize(14).font('Helvetica')
    .text('This is proudly presented to', 0, baseY, { align: 'center' });

  doc.fillColor(cfg.ink).fontSize(32).font('Helvetica-Bold')
    .text(data.studentName, 0, baseY + 30, { align: 'center' });

  doc.fillColor(cfg.muted).fontSize(14).font('Helvetica')
    .text('for successfully completing the course', 0, baseY + 95, { align: 'center' });

  doc.fillColor(cfg.primary).fontSize(22).font('Helvetica-Bold')
    .text(data.courseTitle, 80, baseY + 125, { align: 'center', width: width - 160 });

  const y = height - 130;
  doc.fillColor(cfg.ink).fontSize(12).font('Helvetica-Bold')
    .text(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), 120, y);
  doc.strokeColor(cfg.muted).lineWidth(1).moveTo(120, y - 6).lineTo(300, y - 6).stroke();
  doc.fillColor(cfg.muted).fontSize(10).font('Helvetica').text('Date', 120, y + 16);

  if (signaturePath) {
    try {
      doc.image(signaturePath, width - 340, y - 78, { width: 110 });
    } catch {
      // signature file not reachable — skip
    }
    doc.fillColor(cfg.muted).fontSize(10).font('Helvetica').text('Digital signature', width - 340, y - 14, { width: 110, align: 'center' });
  }

  doc.fillColor(cfg.ink).fontSize(12).font('Helvetica-Bold')
    .text(data.instructorName, width - 300, y, { width: 180, align: 'right' });
  doc.strokeColor(cfg.muted).lineWidth(1).moveTo(width - 300, y - 6).lineTo(width - 120, y - 6).stroke();
  doc.fillColor(cfg.muted).fontSize(10).font('Helvetica')
    .text('Instructor', width - 300, y + 16, { width: 180, align: 'right' });
}

/** Renders one fully-designed certificate page onto an attached PDFDocument. */
export function renderDesign(
  doc: PDFKit.PDFDocument,
  cfg: StyleDesign,
  data: { studentName: string; courseTitle: string; instructorName: string },
  brandName: string,
  signaturePath?: string | null,
) {
  const { width, height } = doc.page;
  paintBackground(doc, cfg, width, height);
  paintContent(doc, cfg, width, height, data, brandName, signaturePath);
}
