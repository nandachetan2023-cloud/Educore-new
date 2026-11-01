import {
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';
import { CertificateBuilderModule, CertificateBuilderService } from './certificate-builder.service';
import { STYLE_DESIGNS, StyleDesign, renderDesign } from './certificate-design';

@Injectable()
export class CertificatesService {
  constructor(
    private prisma: PrismaService,
    private builder: CertificateBuilderService,
  ) {}

  /** Verifies the learner finished the course and returns the data to print. */
  async eligibility(userId: number, courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, certificate: true, instructor: { select: { name: true } } },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (!course.certificate) throw new ForbiddenException('This course does not offer a certificate');

    const enrolled = await this.prisma.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrolled) throw new ForbiddenException('You are not enrolled in this course');

    const totalLessons = await this.prisma.courseChapterLession.count({
      where: { courseId, status: true },
    });
    const completed = await this.prisma.watchHistory.count({
      where: { userId, courseId, isCompleted: true },
    });
    if (totalLessons === 0 || completed < totalLessons) {
      throw new ForbiddenException('Complete all lessons to unlock your certificate');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const issued = await this.prisma.certificate.findFirst({
      where: { studentId: userId, courseId },
      orderBy: { issuedAt: 'desc' },
      select: { style: true },
    });
    return {
      studentName: user?.name ?? 'Student',
      courseTitle: course.title,
      instructorName: course.instructor.name,
      style: issued?.style,
    };
  }

  /**
   * Renders a certificate. An issued certificate's preset style (fully
   * designed template with its own background art) always wins; otherwise the
   * admin's drag-and-drop canvas, else the Classic default.
   */
  async render(
    res: Response,
    data: { studentName: string; courseTitle: string; instructorName: string; style?: string },
    brandName: string,
    styleOverride?: string,
  ) {
    const style = styleOverride ?? data.style;
    if (style && STYLE_DESIGNS[style]) {
      const signaturePath = await this.builder.getSignature();
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      doc.pipe(res);
      renderDesign(doc, STYLE_DESIGNS[style], data, brandName, signaturePath);
      doc.end();
      return;
    }
    const usedBuilder = await this.builder.render(res, { ...data, brandName });
    if (!usedBuilder) {
      const signaturePath = await this.builder.getSignature();
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      doc.pipe(res);
      renderDesign(
        doc,
        {
          bg: '#ffffff', primary: '#4f46e5', accent: '#0ea5e9', ink: '#111827', muted: '#6b7280',
          line: 'double', titleSize: 38, preview: '',
        } satisfies StyleDesign,
        data,
        brandName,
        signaturePath,
      );
      doc.end();
    }
  }
}

@ApiTags('certificates')
@Controller('certificates')
@Roles(Principal.STUDENT, Principal.INSTRUCTOR)
export class CertificatesController {
  constructor(private certificates: CertificatesService) {}

  @Get(':courseId/download')
  async download(
    @CurrentUser('sub') userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Res() res: Response,
  ) {
    const data = await this.certificates.eligibility(userId, courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificate-${courseId}.pdf"`,
    );
    await this.certificates.render(res, data, process.env.BRAND_NAME ?? 'EduCore');
  }
}

@Module({
  imports: [CertificateBuilderModule],
  providers: [CertificatesService],
  controllers: [CertificatesController],
  exports: [CertificatesService],
})
export class CertificatesModule {}
