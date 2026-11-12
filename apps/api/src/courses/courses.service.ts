import {
  BadRequestException,
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
      ...(query.tag && { tags: { some: { tag: { slug: query.tag } } } }),
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
          tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { reviews: true, enrollments: true } },
          reviews: { select: { rating: true }, take: 500 },
        },
      }),
    ]);

    const withRating = (data as any[]).map((c) => {
      const ratings = c.reviews.map((r: any) => r.rating).filter((r: number) => r > 0);
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;
      const { reviews: _, tags, ...rest } = c;
      return {
        ...rest,
        tags: (tags ?? []).map((t: any) => t.tag),
        averageRating: avg ? Math.round(avg * 10) / 10 : null,
      };
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
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
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

    return {
      ...course,
      tags: course.tags.map((t) => t.tag),
      averageRating: agg._avg.rating ?? 0,
    };
  }

  // ── Instructor operations ──
  async createByInstructor(instructorId: number, dto: CreateCourseDto) {
    const slug = `${slugify(dto.title, { lower: true, strict: true })}-${nanoid(6)}`;
    const tagIds = await this.resolveTagIds(dto.tagIds);
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
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
          certificate: dto.certificate,
          qna: dto.qna,
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          status: 'draft',
          isApproved: 'pending',
        },
      });
      await this.replaceCourseTags(tx, course.id, tagIds);
      return course;
    });
  }

  async updateByInstructor(
    instructorId: number,
    id: number,
    dto: UpdateCourseDto,
  ) {
    await this.assertOwnership(instructorId, id);
    const tagIds = dto.tagIds !== undefined ? await this.resolveTagIds(dto.tagIds) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.update({
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
          certificate: dto.certificate,
          qna: dto.qna,
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        },
      });
      if (tagIds !== undefined) await this.replaceCourseTags(tx, id, tagIds);
      return course;
    });
  }

  async submitByInstructor(instructorId: number, id: number) {
    await this.assertOwnership(instructorId, id);
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { status: true, isApproved: true },
    });
    if (course?.status === 'active' && course?.isApproved === 'approved') {
      throw new BadRequestException('This course is already live');
    }
    const lessons = await this.prisma.courseChapterLession.count({ where: { courseId: id } });
    if (lessons === 0) {
      throw new BadRequestException('Add at least one lesson before submitting for review');
    }
    return this.prisma.course.update({
      where: { id },
      data: { isApproved: 'pending', status: 'draft' },
      select: { id: true, isApproved: true, status: true },
    });
  }

  async listByInstructor(instructorId: number) {
    const courses = await this.prisma.course.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { enrollments: true, chapters: true } },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });
    return courses.map((c) => ({ ...c, tags: c.tags.map((t) => t.tag) }));
  }

  /** Owner-only view of the course as a learner would see it (works for drafts too). */
  async previewByInstructor(instructorId: number, id: number) {
    await this.assertOwnership(instructorId, id);
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true, image: true, headline: true } },
        category: { select: { name: true, slug: true } },
        level: { select: { name: true } },
        language: { select: { name: true } },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        chapters: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return { ...course, tags: course.tags.map((t) => t.tag) };
  }

  async removeByInstructor(instructorId: number, id: number) {
    await this.assertOwnership(instructorId, id);
    const [enrollments, orderItems] = await Promise.all([
      this.prisma.enrollment.count({ where: { courseId: id } }),
      this.prisma.orderItem.count({ where: { courseId: id } }),
    ]);
    if (enrollments > 0 || orderItems > 0) {
      throw new BadRequestException(
        'This course has enrollments or sales and cannot be deleted. Set it back to draft instead.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.courseChapterLession.deleteMany({ where: { courseId: id } }),
      this.prisma.courseChapter.deleteMany({ where: { courseId: id } }),
      this.prisma.courseTag.deleteMany({ where: { courseId: id } }),
      this.prisma.cart.deleteMany({ where: { courseId: id } }),
      this.prisma.course.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** Deduplicate and keep only ids that belong to the current workspace. */
  private async resolveTagIds(ids?: number[]): Promise<number[]> {
    const unique = [...new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (unique.length === 0) return [];
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    return tags.map((t) => t.id);
  }

  private async replaceCourseTags(
    tx: Prisma.TransactionClient,
    courseId: number,
    tagIds: number[],
  ) {
    await tx.courseTag.deleteMany({ where: { courseId } });
    if (tagIds.length > 0) {
      await tx.courseTag.createMany({
        data: tagIds.map((tagId) => ({ courseId, tagId })),
        skipDuplicates: true,
      });
    }
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
