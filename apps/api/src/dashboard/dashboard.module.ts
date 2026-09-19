import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

/** Zero-filled array of ISO day strings, oldest first, ending today. */
function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function bucketByDay<T>(rows: T[], getDate: (r: T) => Date, days: string[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>(days.map((d) => [d, []]));
  for (const row of rows) {
    const key = getDate(row).toISOString().slice(0, 10);
    buckets.get(key)?.push(row);
  }
  return buckets;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async student(userId: number) {
    const [enrolled, completedLessons, reviews] = await this.prisma.$transaction([
      this.prisma.enrollment.count({ where: { userId } }),
      this.prisma.watchHistory.count({ where: { userId, isCompleted: true } }),
      this.prisma.review.count({ where: { userId } }),
    ]);
    return { enrolledCourses: enrolled, completedLessons, reviews };
  }

  async instructor(instructorId: number) {
    const [courses, published, students, wallet] = await Promise.all([
      this.prisma.course.count({ where: { instructorId } }),
      this.prisma.course.count({
        where: { instructorId, status: 'active', isApproved: 'approved' },
      }),
      this.prisma.enrollment.count({ where: { instructorId } }),
      this.prisma.user.findUnique({
        where: { id: instructorId },
        select: { wallet: true },
      }),
    ]);
    return {
      totalCourses: courses,
      publishedCourses: published,
      totalStudents: students,
      walletBalance: wallet?.wallet ?? 0,
    };
  }

  /** Enrollment/revenue trend + top courses, for the admin analytics charts. */
  async adminAnalytics(days = 30) {
    const range = lastNDays(days);
    const since = new Date(range[0]);

    const [enrollments, orders, topCourses] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { status: 'approved', createdAt: { gte: since } },
        select: { createdAt: true, paidAmount: true },
      }),
      this.prisma.course.findMany({
        select: { title: true, _count: { select: { enrollments: true } } },
        orderBy: { enrollments: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    const enrollBuckets = bucketByDay(enrollments, (e) => e.createdAt, range);
    const orderBuckets = bucketByDay(orders, (o) => o.createdAt, range);

    return {
      enrollmentsByDay: range.map((date) => ({ date, count: enrollBuckets.get(date)?.length ?? 0 })),
      revenueByDay: range.map((date) => ({
        date,
        amount: (orderBuckets.get(date) ?? []).reduce((sum, o) => sum + o.paidAmount, 0),
      })),
      topCourses: topCourses.map((c) => ({ title: c.title, enrollments: c._count.enrollments })),
    };
  }

  /** Same shape as adminAnalytics, scoped to one instructor's own courses. */
  async instructorAnalytics(instructorId: number, days = 30) {
    const range = lastNDays(days);
    const since = new Date(range[0]);

    const [enrollments, courses] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { instructorId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.course.findMany({
        where: { instructorId },
        select: { title: true, _count: { select: { enrollments: true } } },
        orderBy: { enrollments: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    const enrollBuckets = bucketByDay(enrollments, (e) => e.createdAt, range);

    return {
      enrollmentsByDay: range.map((date) => ({ date, count: enrollBuckets.get(date)?.length ?? 0 })),
      topCourses: courses.map((c) => ({ title: c.title, enrollments: c._count.enrollments })),
    };
  }

  async admin() {
    const [users, instructors, courses, orders, revenue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'student' } }),
      this.prisma.user.count({ where: { role: 'instructor' } }),
      this.prisma.course.count(),
      this.prisma.order.count({ where: { status: 'approved' } }),
      this.prisma.order.aggregate({
        where: { status: 'approved' },
        _sum: { paidAmount: true },
      }),
    ]);
    return {
      students: users,
      instructors,
      courses,
      orders,
      revenue: revenue._sum.paidAmount ?? 0,
    };
  }
}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Roles(Principal.STUDENT)
  @Get('student')
  student(@CurrentUser('sub') userId: number) {
    return this.dashboard.student(userId);
  }

  @Roles(Principal.INSTRUCTOR)
  @Get('instructor')
  instructor(@CurrentUser('sub') instructorId: number) {
    return this.dashboard.instructor(instructorId);
  }

  @Roles(Principal.ADMIN)
  @Get('admin')
  admin() {
    return this.dashboard.admin();
  }

  @Roles(Principal.ADMIN)
  @Get('admin/analytics')
  adminAnalytics(@Query('days') days?: string) {
    return this.dashboard.adminAnalytics(days ? parseInt(days, 10) : 30);
  }

  @Roles(Principal.INSTRUCTOR)
  @Get('instructor/analytics')
  instructorAnalytics(@CurrentUser('sub') instructorId: number, @Query('days') days?: string) {
    return this.dashboard.instructorAnalytics(instructorId, days ? parseInt(days, 10) : 30);
  }
}

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
