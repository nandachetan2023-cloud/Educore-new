import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import slugify from 'slugify';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class ChapterDto {
  @IsString() title!: string;
  @IsInt() order!: number;
  @IsOptional() @IsBoolean() status?: boolean;
}

enum StorageKind { upload = 'upload', youtube = 'youtube', vimeo = 'vimeo', external_link = 'external_link' }
enum FileKind { video = 'video', audio = 'audio', doc = 'doc', file = 'file', pdf = 'pdf' }
enum LessonKind { lesson = 'lesson', live = 'live' }

class ReorderDto {
  @IsArray() @ArrayNotEmpty() @IsInt({ each: true }) ids!: number[];
}

class LessonDto {
  @IsString() title!: string;
  @IsInt() chapterId!: number;
  @IsInt() order!: number;
  @IsString() filePath!: string;
  @IsEnum(StorageKind) storage!: StorageKind;
  @IsEnum(FileKind) fileType!: FileKind;
  @IsEnum(LessonKind) lessonType!: LessonKind;
  @IsString() duration!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() downloadable?: boolean;
  @IsOptional() @IsBoolean() isPreview?: boolean;
  @IsOptional() @IsBoolean() status?: boolean;
}

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  private async ownCourse(instructorId: number, courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  curriculum(instructorId: number, courseId: number) {
    return this.prisma.courseChapter.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
  }

  async addChapter(instructorId: number, courseId: number, dto: ChapterDto) {
    await this.ownCourse(instructorId, courseId);
    return this.prisma.courseChapter.create({
      data: { ...dto, courseId, instructorId },
    });
  }

  async updateChapter(instructorId: number, id: number, dto: ChapterDto) {
    const ch = await this.prisma.courseChapter.findUnique({ where: { id } });
    if (!ch) throw new NotFoundException('Chapter not found');
    await this.ownCourse(instructorId, ch.courseId);
    return this.prisma.courseChapter.update({ where: { id }, data: dto });
  }

  async removeChapter(instructorId: number, id: number) {
    const ch = await this.prisma.courseChapter.findUnique({ where: { id } });
    if (!ch) throw new NotFoundException('Chapter not found');
    await this.ownCourse(instructorId, ch.courseId);
    await this.prisma.courseChapter.delete({ where: { id } });
    return { removed: true };
  }

  /** Persists a new drag-and-drop chapter order for a course (1-based, by array position). */
  async reorderChapters(instructorId: number, courseId: number, ids: number[]) {
    await this.ownCourse(instructorId, courseId);
    const chapters = await this.prisma.courseChapter.findMany({
      where: { courseId },
      select: { id: true },
    });
    const validIds = new Set(chapters.map((c) => c.id));
    if (ids.length !== chapters.length || !ids.every((id) => validIds.has(id))) {
      throw new NotFoundException('Chapter list does not match this course');
    }
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.courseChapter.update({ where: { id }, data: { order: i + 1 } })),
    );
    return { reordered: true };
  }

  /** Persists a new drag-and-drop lesson order within a chapter. */
  async reorderLessons(instructorId: number, chapterId: number, ids: number[]) {
    const chapter = await this.prisma.courseChapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    await this.ownCourse(instructorId, chapter.courseId);
    const lessons = await this.prisma.courseChapterLession.findMany({
      where: { chapterId },
      select: { id: true },
    });
    const validIds = new Set(lessons.map((l) => l.id));
    if (ids.length !== lessons.length || !ids.every((id) => validIds.has(id))) {
      throw new NotFoundException('Lesson list does not match this chapter');
    }
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.courseChapterLession.update({ where: { id }, data: { order: i + 1 } })),
    );
    return { reordered: true };
  }

  async addLesson(instructorId: number, courseId: number, dto: LessonDto) {
    await this.ownCourse(instructorId, courseId);
    const chapter = await this.prisma.courseChapter.findUnique({
      where: { id: dto.chapterId },
      select: { courseId: true },
    });
    if (!chapter || chapter.courseId !== courseId) {
      throw new NotFoundException('Chapter not found for this course');
    }
    return this.prisma.courseChapterLession.create({
      data: {
        title: dto.title,
        slug: slugify(dto.title, { lower: true, strict: true }),
        description: dto.description,
        courseId,
        chapterId: dto.chapterId,
        instructorId,
        filePath: dto.filePath,
        storage: dto.storage,
        fileType: dto.fileType,
        lessonType: dto.lessonType,
        duration: dto.duration,
        downloadable: dto.downloadable ?? false,
        isPreview: dto.isPreview ?? false,
        status: dto.status ?? true,
        order: dto.order,
      },
    });
  }

  async updateLesson(instructorId: number, id: number, dto: LessonDto) {
    const lesson = await this.prisma.courseChapterLession.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.ownCourse(instructorId, lesson.courseId);
    return this.prisma.courseChapterLession.update({
      where: { id },
      data: {
        title: dto.title,
        slug: slugify(dto.title, { lower: true, strict: true }),
        description: dto.description,
        chapterId: dto.chapterId,
        filePath: dto.filePath,
        storage: dto.storage,
        fileType: dto.fileType,
        lessonType: dto.lessonType,
        duration: dto.duration,
        downloadable: dto.downloadable ?? false,
        isPreview: dto.isPreview ?? false,
        status: dto.status ?? true,
        order: dto.order,
      },
    });
  }

  async removeLesson(instructorId: number, id: number) {
    const lesson = await this.prisma.courseChapterLession.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.ownCourse(instructorId, lesson.courseId);
    await this.prisma.courseChapterLession.delete({ where: { id } });
    return { removed: true };
  }
}

@ApiTags('course-content')
@Controller('courses/:courseId/content')
@Roles(Principal.INSTRUCTOR)
export class ContentController {
  constructor(private content: ContentService) {}

  @Get()
  curriculum(
    @CurrentUser('sub') instructorId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.content.curriculum(instructorId, courseId);
  }

  @Post('chapters')
  addChapter(
    @CurrentUser('sub') instructorId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: ChapterDto,
  ) {
    return this.content.addChapter(instructorId, courseId, dto);
  }

  @Put('chapters/reorder')
  reorderChapters(
    @CurrentUser('sub') instructorId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.content.reorderChapters(instructorId, courseId, dto.ids);
  }

  @Put('chapters/:id')
  updateChapter(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChapterDto,
  ) {
    return this.content.updateChapter(instructorId, id, dto);
  }

  @Delete('chapters/:id')
  removeChapter(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.content.removeChapter(instructorId, id);
  }

  @Post('lessons')
  addLesson(
    @CurrentUser('sub') instructorId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: LessonDto,
  ) {
    return this.content.addLesson(instructorId, courseId, dto);
  }

  @Put('lessons/reorder/:chapterId')
  reorderLessons(
    @CurrentUser('sub') instructorId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.content.reorderLessons(instructorId, chapterId, dto.ids);
  }

  @Put('lessons/:id')
  updateLesson(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LessonDto,
  ) {
    return this.content.updateLesson(instructorId, id, dto);
  }

  @Delete('lessons/:id')
  removeLesson(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.content.removeLesson(instructorId, id);
  }
}

@Module({
  providers: [ContentService],
  controllers: [ContentController],
})
export class ContentModule {}
