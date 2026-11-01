import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';
import { CertificatesModule, CertificatesService } from './certificates.module';

/** The 10 preset certificate styles an Admin can issue with. */
export const CERTIFICATE_STYLES = [
  'Classic',
  'Modern',
  'Minimal',
  'Elegant',
  'Bold',
  'Gradient',
  'Vintage',
  'Neon',
  'Artisan',
  'Corporate',
] as const;

class CreateCertificateDto {
  @IsInt() studentId!: number;
  @IsInt() courseId!: number;
  @IsString() style!: string;
}

class UpdateCertificateDto {
  @IsOptional() @IsString() style?: string;
  @IsOptional() @IsString() pdfUrl?: string;
}

@Injectable()
export class AdminCertificatesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.certificate.findMany({
      orderBy: { issuedAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async create(dto: CreateCertificateDto, issuedBy: string) {
    if (!dto.studentId || !dto.courseId || !dto.style) {
      throw new BadRequestException('studentId, courseId and style are required');
    }
    if (!CERTIFICATE_STYLES.includes(dto.style as (typeof CERTIFICATE_STYLES)[number])) {
      throw new BadRequestException(`style must be one of: ${CERTIFICATE_STYLES.join(', ')}`);
    }
    const cert = await this.prisma.certificate.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        style: dto.style,
        issuedBy,
      },
    });
    return this.prisma.certificate.update({
      where: { id: cert.id },
      data: { pdfUrl: `/api/admin/certificates/${cert.id}/pdf` },
    });
  }

  update(id: number, dto: UpdateCertificateDto) {
    if (dto.style && !CERTIFICATE_STYLES.includes(dto.style as (typeof CERTIFICATE_STYLES)[number])) {
      throw new BadRequestException(`style must be one of: ${CERTIFICATE_STYLES.join(', ')}`);
    }
    return this.prisma.certificate.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.certificate.delete({ where: { id } });
  }

  /** Loads one tenant-scoped certificate with student/course names for PDF rendering. */
  async one(id: number) {
    const cert = await this.prisma.certificate.findFirst({
      where: { id },
      include: {
        student: { select: { name: true } },
        course: { select: { title: true, instructor: { select: { name: true } } } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }
}

@ApiTags('admin certificates')
@Controller('admin/certificates')
@Roles(Principal.ADMIN)
export class AdminCertificatesController {
  constructor(private svc: AdminCertificatesService, private certificates: CertificatesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateCertificateDto, @CurrentUser('email') email: string) {
    return this.svc.create(dto, email);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCertificateDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  /** Renders the fully-designed certificate PDF — date/name/course/signature are auto-filled. */
  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const cert = await this.svc.one(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${id}.pdf"`);
    await this.certificates.render(
      res,
      {
        studentName: cert.student.name,
        courseTitle: cert.course.title,
        instructorName: cert.course.instructor.name,
      },
      process.env.BRAND_NAME ?? 'EduCore',
      cert.style,
    );
  }
}

@Module({
  imports: [CertificatesModule],
  providers: [AdminCertificatesService],
  controllers: [AdminCertificatesController],
})
export class AdminCertificatesModule {}
