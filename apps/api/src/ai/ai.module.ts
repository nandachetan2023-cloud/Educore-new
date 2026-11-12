import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class GenerateOutlineDto {
  @IsString() @IsNotEmpty() @MaxLength(200) topic!: string;
}

interface OutlineModule { title: string; lessons: { title: string }[] }
interface Outline { modules: OutlineModule[] }

const MAX_SECTIONS = 8;
const MAX_LESSONS_PER_SECTION = 6;

@Injectable()
class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private heuristicOutline(topic: string): Outline {
    const t = topic.trim().replace(/\s+/g, ' ');
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const T = cap(t);
    const modules: OutlineModule[] = [
      { title: `Getting started with ${T}`, lessons: [
        { title: `Welcome to the ${T} course` },
        { title: 'Tools you will need and setup' },
        { title: `Your first steps in ${t}` },
        { title: 'How this course is structured' },
      ] },
      { title: `${T} fundamentals`, lessons: [
        { title: `Core ${t} concepts` },
        { title: 'Key terminology explained' },
        { title: 'Guided walkthrough' },
        { title: 'Practice: fundamentals' },
      ] },
      { title: `Working with ${t}`, lessons: [
        { title: 'Everyday workflows' },
        { title: 'Common patterns and pitfalls' },
        { title: 'Real-world examples' },
        { title: 'Checkpoint quiz' },
      ] },
      { title: `Hands-on ${t} project`, lessons: [
        { title: 'Planning your project' },
        { title: 'Step 1: setup and scaffolding' },
        { title: 'Step 2: building the core' },
        { title: 'Step 3: polish and review' },
      ] },
      { title: `${T} in practice`, lessons: [
        { title: 'Best practices and performance' },
        { title: 'Debugging and troubleshooting' },
        { title: 'Going from good to great' },
        { title: 'Checkpoint quiz' },
      ] },
      { title: 'Final project and next steps', lessons: [
        { title: 'Final project brief' },
        { title: 'Build your final project' },
        { title: 'Where to go next' },
        { title: 'Course wrap-up and celebration' },
      ] },
    ];
    return { modules };
  }

  private async openAiOutline(topic: string): Promise<Outline> {
    const apiKey = this.config.get<string>('ai.openAiApiKey');
    const model = this.config.get<string>('ai.openAiModel') ?? 'gpt-4o-mini';
    if (!apiKey) throw new Error('no openai key');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You design concise online-course curricula. Reply with JSON of shape ' +
              '{"modules":[{"title":string,"lessons":[{"title":string}]}]}. ' +
              `Use 4-6 modules and 3-5 lessons per module, ordered for beginners to advanced. Topic: ${topic}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Outline;
    if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) throw new Error('OpenAI returned no modules');
    return parsed;
  }

  private async outlineFor(topic: string): Promise<Outline> {
    try {
      const outline = await this.openAiOutline(topic);
      this.logger.log(`Generated outline for "${topic}" via OpenAI`);
      return outline;
    } catch (e) {
      this.logger.warn(`Falling back to heuristic outline (${(e as Error).message})`);
      return this.heuristicOutline(topic);
    }
  }

  async generateOutline(instructorId: number, courseId: number, topic: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.instructorId !== instructorId) throw new ForbiddenException('You do not own this course');

    const outline = await this.outlineFor(topic);
    const modules = outline.modules
      .filter((m) => m?.title?.trim())
      .slice(0, MAX_SECTIONS)
      .map((m) => ({
        title: m.title.trim(),
        lessons: (Array.isArray(m.lessons) ? m.lessons : [])
          .filter((l) => l?.title?.trim())
          .slice(0, MAX_LESSONS_PER_SECTION)
          .map((l) => ({ title: l.title.trim() })),
      }))
      .filter((m) => m.lessons.length > 0);
    if (modules.length === 0) throw new BadRequestException('Could not build an outline for that topic — try rephrasing it.');

    const existing = await this.prisma.courseChapter.count({ where: { courseId } });
    let sectionCount = 0;
    let lessonCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        const chapter = await tx.courseChapter.create({
          data: { courseId, instructorId, title: mod.title, order: existing + i + 1 },
        });
        sectionCount += 1;
        for (let j = 0; j < mod.lessons.length; j++) {
          const title = mod.lessons[j].title;
          await tx.courseChapterLession.create({
            data: {
              courseId,
              chapterId: chapter.id,
              instructorId,
              title,
              slug: `${slugify(title, { lower: true, strict: true }) || 'lesson'}-${Date.now().toString(36)}${j}`,
              order: j + 1,
              filePath: '',
              storage: 'youtube',
              fileType: 'video',
              lessonType: 'lesson',
              duration: '0:00',
            },
          });
          lessonCount += 1;
        }
      }
    });

    return { ok: true, sections: sectionCount, lessons: lessonCount };
  }
}

@ApiTags('ai')
@Controller()
class AiController {
  constructor(private ai: AiService) {}

  @Roles(Principal.INSTRUCTOR)
  @Post('courses/:id/generate-outline')
  generate(
    @CurrentUser('sub') instructorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateOutlineDto,
  ) {
    return this.ai.generateOutline(instructorId, id, dto.topic);
  }
}

@Module({
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
