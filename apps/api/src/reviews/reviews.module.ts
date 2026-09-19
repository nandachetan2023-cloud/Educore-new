import {
  Body,
  Controller,
  ForbiddenException,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class ReviewDto {
  @IsInt() courseId!: number;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(3) review!: string;
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /** Only enrolled learners may review, and only once per course. */
  async submit(userId: number, dto: ReviewDto) {
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: dto.courseId },
    });
    if (!enrolled) {
      throw new ForbiddenException('Only enrolled students can review this course');
    }
    const existing = await this.prisma.review.findFirst({
      where: { userId, courseId: dto.courseId },
    });
    if (existing) {
      return this.prisma.review.update({
        where: { id: existing.id },
        data: { rating: dto.rating, review: dto.review, status: false },
      });
    }
    return this.prisma.review.create({
      data: {
        userId,
        courseId: dto.courseId,
        rating: dto.rating,
        review: dto.review,
        status: false, // awaits admin moderation
      },
    });
  }
}

@ApiTags('reviews')
@Controller('reviews')
@Roles(Principal.STUDENT, Principal.INSTRUCTOR)
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Post()
  submit(@CurrentUser('sub') userId: number, @Body() dto: ReviewDto) {
    return this.reviews.submit(userId, dto);
  }
}

@Module({
  providers: [ReviewsService],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
