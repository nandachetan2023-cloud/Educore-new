import { Body, Controller, Get, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

@ApiTags('admin')
@Controller('admin')
@Roles(Principal.ADMIN)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('instructors')
  instructors(@Query('status') status?: string) {
    return this.admin.instructors(status);
  }

  @Post('instructors/:id/approve')
  approveInstructor(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setInstructorStatus(id, 'approved');
  }

  @Post('instructors/:id/reject')
  rejectInstructor(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setInstructorStatus(id, 'rejected');
  }

  @Get('courses')
  courses(@Query('status') status?: string) {
    return this.admin.courses(status);
  }

  @Post('courses/:id/approve')
  approveCourse(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setCourseApproval(id, 'approved');
  }

  @Post('courses/:id/reject')
  rejectCourse(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setCourseApproval(id, 'rejected');
  }

  @Get('reviews')
  reviews() {
    return this.admin.pendingReviews();
  }

  @Post('reviews/:id/approve')
  approveReview(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setReviewStatus(id, true);
  }

  @Post('reviews/:id/reject')
  rejectReview(@Param('id', ParseIntPipe) id: number) {
    return this.admin.setReviewStatus(id, false);
  }

  @Get('students')
  students() {
    return this.admin.students();
  }

  // Destructive — only the top admin tier may wipe transactional data.
  @Post('data/clear')
  @SuperAdmin()
  clearData() {
    return this.admin.clearTransactionalData();
  }
}

@Module({
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
