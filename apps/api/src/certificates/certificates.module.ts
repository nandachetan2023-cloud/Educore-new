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
    return {
      studentName: user?.name ?? 'Student',
      courseTitle: course.title,
      instructorName: course.instructor.name,
    };
  }

  /** Uses the admin-configured drag-and-drop layout if one exists, else the fixed default template. */
  async render(
    res: Response,
    data: { studentName: string; courseTitle: string; instructorName: string },
    brandName: string,
  ) {
    const usedBuilder = await this.builder.render(res, { ...data, brandName });
    if (!usedBuilder) this.renderDefault(res, data, brandName);
  }

  private renderDefault(
    res: Response,
    data: { studentName: string; courseTitle: string; instructorName: string },
    brandName: string,
  ) {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const { width, height } = doc.page;

    doc.pipe(res);

    // Backdrop + decorative border
    doc.rect(0, 0, width, height).fill('#ffffff');
    doc.lineWidth(6).strokeColor('#4f46e5').rect(24, 24, width - 48, height - 48).stroke();
    doc.lineWidth(1).strokeColor('#0ea5e9').rect(36, 36, width - 72, height - 72).stroke();

    doc.fillColor('#4f46e5').fontSize(14).font('Helvetica-Bold')
      .text(brandName.toUpperCase(), 0, 70, { align: 'center', characterSpacing: 3 });

    doc.fillColor('#111827').fontSize(38).font('Helvetica-Bold')
      .text('Certificate of Completion', 0, 120, { align: 'center' });

    doc.fillColor('#6b7280').fontSize(14).font('Helvetica')
      .text('This is proudly presented to', 0, 190, { align: 'center' });

    doc.fillColor('#111827').fontSize(32).font('Helvetica-Bold')
      .text(data.studentName, 0, 220, { align: 'center' });

    doc.fillColor('#6b7280').fontSize(14).font('Helvetica')
      .text('for successfully completing the course', 0, 285, { align: 'center' });

    doc.fillColor('#4f46e5').fontSize(22).font('Helvetica-Bold')
      .text(data.courseTitle, 80, 315, { align: 'center', width: width - 160 });

    const y = height - 130;
    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
      .text(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), 120, y);
    doc.strokeColor('#111827').lineWidth(1).moveTo(120, y - 6).lineTo(300, y - 6).stroke();
    doc.fillColor('#6b7280').fontSize(10).font('Helvetica').text('Date', 120, y + 16);

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
      .text(data.instructorName, width - 300, y, { width: 180, align: 'right' });
    doc.strokeColor('#111827').lineWidth(1).moveTo(width - 300, y - 6).lineTo(width - 120, y - 6).stroke();
    doc.fillColor('#6b7280').fontSize(10).font('Helvetica')
      .text('Instructor', width - 300, y + 16, { width: 180, align: 'right' });

    doc.end();
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
})
export class CertificatesModule {}
