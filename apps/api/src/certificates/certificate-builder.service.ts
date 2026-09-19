import { Body, Controller, Get, Injectable, Module, Put, Res } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

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
  @IsInt() @Min(6) fontSize!: number;
  @IsString() color!: string;
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
    await this.prisma.$transaction([
      this.prisma.certificateBuilderItem.deleteMany(),
      this.prisma.certificateBuilderItem.createMany({ data: items }),
    ]);
    return this.prisma.certificateBuilderItem.findMany({ orderBy: { id: 'asc' } });
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

  /** Uploaded images are served from /uploads/<rel>; map the public URL back to its local disk path. */
  private localPath(publicUrl: string): string {
    const rel = publicUrl.split(/\/uploads\//).pop();
    return rel ? join(process.cwd(), 'storage', 'uploads', rel) : publicUrl;
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
@SuperAdmin()
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

  @Get('preview')
  async preview(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="certificate-preview.pdf"');
    const sample: CertData = {
      studentName: 'Jordan Sample',
      courseTitle: 'Sample Course Title',
      instructorName: 'Instructor Name',
      brandName: process.env.BRAND_NAME ?? 'EduCore',
    };
    const rendered = await this.builder.render(res, sample);
    if (!rendered) res.end();
  }
}

@Module({
  providers: [CertificateBuilderService],
  controllers: [CertificateBuilderController],
  exports: [CertificateBuilderService],
})
export class CertificateBuilderModule {}
