import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { CourseQueryDto, CreateCourseDto, UpdateCourseDto } from './dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /** Public catalog: only active + approved courses, with filters & paging. */
  async catalog(query: CourseQueryDto) {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 12, 48);

    const where: Prisma.CourseWhereInput = {
      status: 'active',
      isApproved: 'approved',
      ...(query.search && {
        title: { contains: query.search },
      }),
      ...(query.category && { category: { slug: query.category } }),
      ...(query.level && { level: { slug: query.level } }),
      ...(query.language && { language: { slug: query.language } }),
    };

    const orderBy: Prisma.CourseOrderByWithRelationInput =
      query.sort === 'price_low'
        ? { price: 'asc' }
        : query.sort === 'price_high'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnail: true,
          price: true,
          discount: true,
          duration: true,
          instructor: { select: { id: true, name: true, image: true } },
          category: { select: { name: true, slug: true } },
          level: { select: { name: true } },
          _count: { select: { reviews: true, enrollments: true } },
          reviews: { select: { rating: true }, take: 500 },
        },
      }),
    ]);

    const withRating = (data as any[]).map((c) => {
      const ratings = c.reviews.map((r: any) => r.rating).filter((r: number) => r > 0);
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;
      const { reviews: _, ...rest } = c;
      return { ...rest, averageRating: avg ? Math.round(avg * 10) / 10 : null };
    });

    return {
      data: withRating,
      meta: { page, perPage, total, lastPage: Math.ceil(total / perPage) },
    };
  }

  /** Public course detail page by slug, including curriculum & rating. */
  async findBySlug(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'active', isApproved: 'approved' },
      include: {
        instructor: {
          select: { id: true, name: true, image: true, headline: true, bio: true },
        },
        category: { select: { name: true, slug: true } },
        level: { select: { name: true } },
        language: { select: { name: true } },
        chapters: {
          where: { status: true },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where: { status: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                duration: true,
                fileType: true,
                isPreview: true,
              },
            },
          },
        },
        reviews: {
          where: { status: true },
          include: { user: { select: { name: true, image: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { enrollments: true, reviews: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const agg = await this.prisma.review.aggregate({
      where: { courseId: course.id, status: true },
      _avg: { rating: true },
    });

    return { ...course, averageRating: agg._avg.rating ?? 0 };
  }

  // ── Instructor operations ──
  async createByInstructor(instructorId: number, dto: CreateCourseDto) {
    const slug = `${slugify(dto.title, { lower: true, strict: true })}-${nanoid(6)}`;
    return this.prisma.course.create({
      data: {
        instructorId,
        title: dto.title,
        slug,
        categoryId: dto.categoryId,
        courseLevelId: dto.courseLevelId,
        courseLanguageId: dto.courseLanguageId,
        description: dto.description,
        seoDescription: dto.seoDescription,
        thumbnail: dto.thumbnail,
        price: dto.price,
        discount: dto.discount,
        status: 'draft',
        isApproved: 'pending',
      },
    });
  }

  async updateByInstructor(
    instructorId: number,
    id: number,
    dto: UpdateCourseDto,
  ) {
    await this.assertOwnership(instructorId, id);
    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        courseLevelId: dto.courseLevelId,
        courseLanguageId: dto.courseLanguageId,
        description: dto.description,
        seoDescription: dto.seoDescription,
        thumbnail: dto.thumbnail,
        price: dto.price,
        discount: dto.discount,
      },
    });
  }

  async listByInstructor(instructorId: number) {
    return this.prisma.course.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { enrollments: true, chapters: true } } },
    });
  }

  private async assertOwnership(instructorId: number, courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You do not own this course');
    }
  }
}
