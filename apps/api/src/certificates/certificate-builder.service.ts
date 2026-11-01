import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Put, Query, Res, HttpStatus } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';
import { Principal } from '../common/enums';
import { CERTIFICATE_TEMPLATES } from './certificate-templates';
import { STYLE_DESIGNS, renderDesign } from './certificate-design';

/** Known placeholder tokens the builder canvas can drop onto the certificate. */
export const CERT_TOKENS = ['studentName', 'courseTitle', 'instructorName', 'date', 'brandName', 'custom'] as const;
export type CertToken = (typeof CERT_TOKENS)[number];

export interface CertData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  brandName: string;
}

class BuilderDto {
  @IsOptional() @IsString() background?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() subTitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() signature?: string;
}

class ItemDto {
  @IsIn(CERT_TOKENS) elementId!: CertToken;
  @IsString() xPosition!: string; // percentage of page width, e.g. "50"
  @IsString() yPosition!: string; // percentage of page height, e.g. "40"
  @IsOptional() @IsString() text?: string; // only used when elementId === 'custom'
  @IsInt() @Min(6) @Max(56) fontSize!: number;
  @Matches(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, { message: 'color must be a hex value like #1a2b3c' }) color!: string;
  @IsBoolean() bold!: boolean;
}
class ItemsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
}

/**
 * Drag-and-drop certificate builder: an admin positions text placeholders
 * (student name, course title, date, …) and an optional background/signature
 * image on a canvas; those coordinates drive PDF layout at generation time.
 * Falls back to the fixed default template (see CertificatesService.render)
 * when nothing has been configured yet.
 */
@Injectable()
export class CertificateBuilderService {
  constructor(private prisma: PrismaService) {}

  async get() {
    let builder = await this.prisma.certificateBuilder.findFirst();
    if (!builder) builder = await this.prisma.certificateBuilder.create({ data: {} });
    const items = await this.prisma.certificateBuilderItem.findMany({ orderBy: { id: 'asc' } });
    return { builder, items };
  }

  async save(dto: BuilderDto) {
    const builder = await this.prisma.certificateBuilder.findFirst();
    return builder
      ? this.prisma.certificateBuilder.update({ where: { id: builder.id }, data: dto })
      : this.prisma.certificateBuilder.create({ data: dto });
  }

  async saveItems(items: ItemDto[]) {
    const clamp = (v: string) => String(Math.min(100, Math.max(0, parseFloat(v) || 0)));
    await this.prisma.$transaction([
      this.prisma.certificateBuilderItem.deleteMany(),
      this.prisma.certificateBuilderItem.createMany({
        data: items.map((it) => ({ ...it, xPosition: clamp(it.xPosition), yPosition: clamp(it.yPosition) })),
      }),
    ]);
    return this.prisma.certificateBuilderItem.findMany({ orderBy: { id: 'asc' } });
  }

  async countItems(): Promise<number> {
    return this.prisma.certificateBuilderItem.count();
  }

  /**
   * The tenant's uploaded digital-signature image (local disk path), used by
   * every preset-style certificate. Returns null when not configured.
   */
  async getSignature(): Promise<string | null> {
    const builder = await this.prisma.certificateBuilder.findFirst();
    if (!builder?.signature) return null;
    try {
      return this.localPath(builder.signature);
    } catch {
      return null;
    }
  }

  /** The ten built-in sample templates (name + layout), for the wizard step 1. */
  listTemplates() {
    return CERTIFICATE_TEMPLATES.map((t, index) => ({
      index,
      name: t.name,
      builder: t.builder,
      items: t.items,
      preview: STYLE_DESIGNS[t.name]?.preview ?? '',
    }));
  }

  /** Wizard step 2: replaces the current layout with the chosen template. */
  async applyTemplate(index: number) {
    const tpl = CERTIFICATE_TEMPLATES[index];
    if (!tpl) throw new BadRequestException('Unknown template');
    await this.save({ ...tpl.builder });
    const itemsRes = await this.saveItems(tpl.items.map((it) => ({ ...it })));
    return { builder: tpl.builder, items: itemsRes };
  }

  private resolveToken(token: CertToken, custom: string | null | undefined, data: CertData): string {
    switch (token) {
      case 'studentName': return data.studentName;
      case 'courseTitle': return data.courseTitle;
      case 'instructorName': return data.instructorName;
      case 'brandName': return data.brandName;
      case 'date': return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      case 'custom': return custom ?? '';
    }
  }

  /**
   * Uploaded images are served from /uploads/<rel>; map the public URL back to
   * its local disk path. Only same-install `/uploads/` URLs are trusted —
   * anything else (including traversal like `/uploads/../x`) is rejected.
   */
  private localPath(publicUrl: string): string {
    const m = /^\/uploads\/([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)$/.exec(publicUrl);
    if (!m || m[1].includes('..')) throw new Error(`Untrusted image path: ${publicUrl}`);
    return join(process.cwd(), 'storage', 'uploads', m[1]);
  }

  /**
   * Draws a certificate PDF from the saved layout. Returns false (drawing
   * nothing) if no items have been placed yet — caller should fall back to
   * the fixed default template in that case.
   */
  async render(res: Response, data: CertData): Promise<boolean> {
    const items = await this.prisma.certificateBuilderItem.findMany();
    if (items.length === 0) return false;

    const builder = await this.prisma.certificateBuilder.findFirst();
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const { width, height } = doc.page;
    doc.pipe(res);

    doc.rect(0, 0, width, height).fill('#ffffff');
    if (builder?.background) {
      try {
        doc.image(this.localPath(builder.background), 0, 0, { width, height });
      } catch {
        // Background not reachable on disk — keep the plain white backdrop.
      }
    } else {
      doc.lineWidth(6).strokeColor('#4f46e5').rect(24, 24, width - 48, height - 48).stroke();
      doc.lineWidth(1).strokeColor('#0ea5e9').rect(36, 36, width - 72, height - 72).stroke();
    }

    if (builder?.title) {
      doc.fillColor('#111827').fontSize(30).font('Helvetica-Bold').text(builder.title, 0, 50, { align: 'center' });
    }
    if (builder?.subTitle) {
      doc.fillColor('#6b7280').fontSize(14).font('Helvetica').text(builder.subTitle, 0, 90, { align: 'center' });
    }
    if (builder?.description) {
      doc.fillColor('#6b7280').fontSize(11).font('Helvetica')
        .text(builder.description, 80, height - 90, { align: 'center', width: width - 160 });
    }
    if (builder?.signature) {
      try {
        doc.image(this.localPath(builder.signature), width - 220, height - 150, { width: 120 });
      } catch {
        // Signature not reachable — skip.
      }
    }

    // Each placeholder is centered on its own dropped (x%, y%) anchor point.
    for (const item of items) {
      const text = this.resolveToken(item.elementId as CertToken, item.text, data);
      if (!text) continue;
      doc.font(item.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(item.fontSize);
      const textWidth = doc.widthOfString(text);
      const x = (parseFloat(item.xPosition || '0') / 100) * width;
      const y = (parseFloat(item.yPosition || '0') / 100) * height;
      doc.fillColor(item.color || '#111827').text(text, x - textWidth / 2, y);
    }

    doc.end();
    return true;
  }
}

@ApiTags('certificate-builder')
@Controller('admin/certificate-builder')
@Roles(Principal.ADMIN)
export class CertificateBuilderController {
  constructor(private builder: CertificateBuilderService) {}

  @Get()
  get() {
    return this.builder.get();
  }

  @Put()
  save(@Body() dto: BuilderDto) {
    return this.builder.save(dto);
  }

  @Put('items')
  saveItems(@Body() dto: ItemsDto) {
    return this.builder.saveItems(dto.items);
  }

  @Get('templates')
  templates() {
    return this.builder.listTemplates();
  }

  @Put('templates/:index/apply')
  applyTemplate(@Param('index', ParseIntPipe) index: number) {
    return this.builder.applyTemplate(index);
  }

  @Get('preview')
  async preview(@Res() res: Response, @Query('style') style?: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="certificate-preview.pdf"');

    // With ?style=<Preset> render that fully designed template (background art included).
    if (style && STYLE_DESIGNS[style]) {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      doc.pipe(res);
      renderDesign(
        doc,
        STYLE_DESIGNS[style],
        { studentName: 'Jordan Sample', courseTitle: 'Sample Course Title', instructorName: 'Instructor Name' },
        process.env.BRAND_NAME ?? 'EduCore',
        await this.builder.getSignature(),
      );
      doc.end();
      return;
    }

    const empty = await this.builder.countItems();
    if (empty === 0) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Add at least one element to the canvas before previewing or pass ?style=' });
      return;
    }
    const sample: CertData = {
      studentName: 'Jordan Sample',
      courseTitle: 'Sample Course Title',
      instructorName: 'Instructor Name',
      brandName: process.env.BRAND_NAME ?? 'EduCore',
    };
    await this.builder.render(res, sample);
  }
}

@Module({
  providers: [CertificateBuilderService],
  controllers: [CertificateBuilderController],
  exports: [CertificateBuilderService],
})
export class CertificateBuilderModule {}
