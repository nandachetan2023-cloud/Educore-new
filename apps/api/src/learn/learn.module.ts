import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class ProgressDto {
  @IsInt() @Min(0) seconds!: number;
}

@Injectable()
export class LearnService {
  constructor(private prisma: PrismaService) {}

  private async requireEnrollment(userId: number, courseId: number) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId, haveAccess: true },
    });
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    return enrollment;
  }

  /**
   * Courses the student has purchased (enrolled in), with progress and the
   * module/lesson breakdown used by the My Learning screen.
   */
  async myCourses(userId: number) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, haveAccess: true },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            price: true,
            instructor: { select: { name: true, image: true } },
            chapters: {
              where: { status: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                lessons: {
                  where: { status: true },
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const courseIds = enrollments.map((e) => e.courseId);
    let history: { courseId: number; lessonId: number }[] = [];
    let activity: { courseId: number; _max: { updatedAt: Date | null } }[] = [];
    if (courseIds.length > 0) {
      [history, activity] = await Promise.all([
        this.prisma.watchHistory.findMany({
          where: { userId, courseId: { in: courseIds }, isCompleted: true },
          select: { courseId: true, lessonId: true },
        }),
        this.prisma.watchHistory.groupBy({
          by: ['courseId'],
          where: { userId, courseId: { in: courseIds } },
          _max: { updatedAt: true },
        }),
      ]);
    }

    const completedByCourse = new Map<number, Set<number>>();
    for (const h of history) {
      if (!completedByCourse.has(h.courseId)) completedByCourse.set(h.courseId, new Set());
      completedByCourse.get(h.courseId)!.add(h.lessonId);
    }
    const lastActivityByCourse = new Map(
      activity.map((a) => [a.courseId, a._max.updatedAt ?? null]),
    );

    return enrollments.map((e) => {
      const done = completedByCourse.get(e.courseId) ?? new Set<number>();
      const modules = e.course.chapters.map((ch) => {
        const lessons = ch.lessons.map((l) => ({ ...l, completed: done.has(l.id) }));
        const completedLessons = lessons.filter((l) => l.completed).length;
        return {
          id: ch.id,
          title: ch.title,
          order: ch.order,
          totalLessons: lessons.length,
          completedLessons,
          completed: lessons.length > 0 && completedLessons === lessons.length,
          lessons,
        };
      });
      const allLessons = modules.flatMap((m) => m.lessons);
      const completedLessons = allLessons.filter((l) => l.completed).length;
      const next = allLessons.find((l) => !l.completed) ?? null;
      const nextModule = next ? modules.find((m) => m.lessons.some((l) => l.id === next.id)) : null;

      return {
        ...e.course,
        instructor: e.course.instructor,
        modules,
        totalModules: modules.length,
        completedModules: modules.filter((m) => m.completed).length,
        progress: allLessons.length ? Math.round((completedLessons / allLessons.length) * 100) : 0,
        completedLessons,
        totalLessons: allLessons.length,
        nextLesson: next
          ? { id: next.id, title: next.title, moduleId: nextModule?.id ?? null, moduleTitle: nextModule?.title ?? null }
          : null,
        lastActivityAt: lastActivityByCourse.get(e.courseId) ?? null,
        enrolledAt: e.createdAt,
      };
    });
  }

  /** Full player payload for an enrolled course. */
  async player(userId: number, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug },
      include: {
        instructor: { select: { id: true, name: true, image: true } },
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
                downloadable: true,
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    await this.requireEnrollment(userId, course.id);

    const history = await this.prisma.watchHistory.findMany({
      where: { userId, courseId: course.id },
      select: { lessonId: true, isCompleted: true },
    });
    const completedMap = new Set(
      history.filter((h) => h.isCompleted).map((h) => h.lessonId),
    );

    const chapters = course.chapters.map((ch) => ({
      ...ch,
      lessons: ch.lessons.map((l) => ({ ...l, completed: completedMap.has(l.id) })),
    }));
    const totalLessons = chapters.reduce((n, c) => n + c.lessons.length, 0) || 1;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      instructor: course.instructor,
      certificate: course.certificate,
      chapters,
      progress: Math.round((completedMap.size / totalLessons) * 100),
    };
  }

  /** Lesson media/content — gated by enrollment unless it's a free preview. */
  async lesson(userId: number, lessonId: number) {
    const lesson = await this.prisma.courseChapterLession.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.isPreview) {
      await this.requireEnrollment(userId, lesson.courseId);
    }
    const history = await this.prisma.watchHistory.findFirst({
      where: { userId, lessonId },
      select: { lastPositionSeconds: true, isCompleted: true },
    });
    return { ...lesson, resumeAt: history?.lastPositionSeconds ?? 0, completed: history?.isCompleted ?? false };
  }

  /** Periodic resume-position checkpoint from the video player (throttled client-side). */
  async saveProgress(userId: number, lessonId: number, seconds: number) {
    const lesson = await this.prisma.courseChapterLession.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, chapterId: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.requireEnrollment(userId, lesson.courseId);

    const existing = await this.prisma.watchHistory.findFirst({ where: { userId, lessonId } });
    if (existing) {
      return this.prisma.watchHistory.update({
        where: { id: existing.id },
        data: { lastPositionSeconds: seconds },
      });
    }
    return this.prisma.watchHistory.create({
      data: {
        userId,
        courseId: lesson.courseId,
        chapterId: lesson.chapterId,
        lessonId,
        lastPositionSeconds: seconds,
      },
    });
  }

  async markWatched(userId: number, lessonId: number, completed: boolean) {
    const lesson = await this.prisma.courseChapterLession.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, chapterId: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.requireEnrollment(userId, lesson.courseId);

    const existing = await this.prisma.watchHistory.findFirst({
      where: { userId, lessonId },
    });
    if (existing) {
      return this.prisma.watchHistory.update({
        where: { id: existing.id },
        data: { isCompleted: completed || existing.isCompleted },
      });
    }
    return this.prisma.watchHistory.create({
      data: {
        userId,
        courseId: lesson.courseId,
        chapterId: lesson.chapterId,
        lessonId,
        isCompleted: completed,
      },
    });
  }
}

@ApiTags('learn')
@Controller('learn')
@Roles(Principal.STUDENT, Principal.INSTRUCTOR)
export class LearnController {
  constructor(private learn: LearnService) {}

  @Get()
  myCourses(@CurrentUser('sub') userId: number) {
    return this.learn.myCourses(userId);
  }

  @Get(':slug')
  player(@CurrentUser('sub') userId: number, @Param('slug') slug: string) {
    return this.learn.player(userId, slug);
  }

  @Get('lesson/:id')
  lesson(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.learn.lesson(userId, id);
  }

  @Post('lesson/:id/watch')
  watch(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.learn.markWatched(userId, id, false);
  }

  @Post('lesson/:id/progress')
  progress(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProgressDto,
  ) {
    return this.learn.saveProgress(userId, id, dto.seconds);
  }

  @Post('lesson/:id/complete')
  complete(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.learn.markWatched(userId, id, true);
  }
}

@Module({
  providers: [LearnService],
  controllers: [LearnController],
})
export class LearnModule {}
