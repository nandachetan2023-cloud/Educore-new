import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CourseQueryDto, CreateCourseDto, UpdateCourseDto } from './dto';
import { Public, Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  @Public()
  @Get()
  catalog(@Query() query: CourseQueryDto) {
    return this.courses.catalog(query);
  }

  @Roles(Principal.INSTRUCTOR)
  @Get('mine')
  mine(@CurrentUser('sub') instructorId: number) {
    return this.courses.listByInstructor(instructorId);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.courses.findBySlug(slug);
  }

  @Roles(Principal.INSTRUCTOR)
  @Post()
  create(
    @CurrentUser('sub') instructorId: number,
    @Body() dto: CreateCourseDto,
  ) {
    return this.courses.createByInstructor(instructorId, dto);
  }

  @Roles(Principal.INSTRUCTOR)
  @Put(':id')
  update(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.updateByInstructor(instructorId, id, dto);
  }
}
