import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.module';

/**
 * Back-office operations available only to admins: moderating the publish
 * pipeline (instructors, courses, reviews) and managing users.
 */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // ── Instructors ──
  instructors(status?: string) {
    return this.prisma.user.findMany({
      where: { role: 'instructor', ...(status ? { approveStatus: status as any } : {}) },
      select: {
        id: true, name: true, email: true, headline: true, image: true, bio: true,
        approveStatus: true, wallet: true, createdAt: true,
        _count: { select: { courses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setInstructorStatus(id: number, status: 'approved' | 'rejected') {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'instructor' } });
    if (!user) throw new NotFoundException('Instructor not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { approveStatus: status } });

    const brand = process.env.BRAND_NAME ?? 'EduCore';
    if (status === 'approved') void this.mail.instructorApproved(user.email, user.name, brand);
    else void this.mail.instructorRejected(user.email, user.name, brand);

    return updated;
  }

  // ── Courses ──
  courses(status?: string) {
    return this.prisma.course.findMany({
      where: status ? { isApproved: status as any } : {},
      select: {
        id: true, title: true, slug: true, thumbnail: true, price: true,
        isApproved: true, status: true, createdAt: true,
        instructor: { select: { name: true } },
        _count: { select: { enrollments: true, chapters: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setCourseApproval(id: number, decision: 'approved' | 'rejected') {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    // Approving a course also flips it live; rejecting sends it back to draft.
    return this.prisma.course.update({
      where: { id },
      data: {
        isApproved: decision,
        status: decision === 'approved' ? 'active' : 'draft',
      },
    });
  }

  // ── Reviews ──
  pendingReviews() {
    return this.prisma.review.findMany({
      where: { status: false },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setReviewStatus(id: number, approved: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (!approved) {
      await this.prisma.review.delete({ where: { id } });
      return { removed: true };
    }
    return this.prisma.review.update({ where: { id }, data: { status: true } });
  }

  // ── Data management ──
  /**
   * Wipes transactional/demo data (orders, cart, enrollments, reviews, watch
   * history, notifications, withdraws) so an install can go live cleanly.
   * Deliberately leaves accounts, courses, and catalog structure intact —
   * a full user/course wipe would lock the acting admin out.
   */
  async clearTransactionalData() {
    const result = await this.prisma.$transaction([
      this.prisma.watchHistory.deleteMany(),
      this.prisma.review.deleteMany(),
      this.prisma.orderItem.deleteMany(),
      this.prisma.order.deleteMany(),
      this.prisma.cart.deleteMany(),
      this.prisma.enrollment.deleteMany(),
      this.prisma.withdraw.deleteMany(),
    ]);
    const [watchHistory, reviews, orderItems, orders, cart, enrollments, withdraws] = result;
    return {
      cleared: {
        watchHistory: watchHistory.count,
        reviews: reviews.count,
        orderItems: orderItems.count,
        orders: orders.count,
        cart: cart.count,
        enrollments: enrollments.count,
        withdraws: withdraws.count,
      },
    };
  }

  // ── Users ──
  students() {
    return this.prisma.user.findMany({
      where: { role: 'student' },
      select: {
        id: true, name: true, email: true, image: true, headline: true, bio: true,
        approveStatus: true, wallet: true, createdAt: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin-invited account (directory "Invite" button). Admin-created users
   * are trusted on creation: approved + email-verified immediately.
   * Returns the record plus a one-time temp password for the admin to pass
   * on — it is never stored or returned again.
   */
  async inviteUser(dto: { name: string; email: string; role: 'student' | 'instructor'; password?: string }) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');
    const tempPassword = dto.password?.trim() || randomBytes(6).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        password: await argon2.hash(tempPassword),
        role: dto.role,
        approveStatus: 'approved',
        emailVerifiedAt: new Date(),
        wallet: 0,
      },
      select: {
        id: true, name: true, email: true, image: true, role: true,
        approveStatus: true, createdAt: true,
      },
    });
    return { ...user, tempPassword: dto.password?.trim() ? undefined : tempPassword };
  }
}
