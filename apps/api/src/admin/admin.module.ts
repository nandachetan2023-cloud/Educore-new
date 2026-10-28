import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

class InviteUserDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsIn(['student', 'instructor']) role!: 'student' | 'instructor';
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['student', 'instructor']) role?: 'student' | 'instructor';
  @IsOptional() @IsIn(['pending', 'approved', 'rejected']) approveStatus?: 'pending' | 'approved' | 'rejected';
  @IsOptional() @IsString() headline?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

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

  @Post('users')
  inviteUser(@Body() dto: InviteUserDto) {
    return this.admin.inviteUser(dto);
  }

  // ── User CRUD (Read / Update / Delete; Create is inviteUser above) ──

  @Get('users')
  listUsers(@Query('role') role?: string) {
    return this.admin.listUsers(role);
  }

  @Put('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteUser(id);
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
