import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

class PageDto {
  @IsString() title!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsBoolean() status?: boolean;
}

/**
 * Generic CMS pages (About, Terms, Privacy, or anything else an admin wants
 * to add) — the "dynamic page builder". Rendered at /page/:slug.
 */
@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  listPublished() {
    return this.prisma.customPage.findMany({
      where: { status: true },
      select: { id: true, title: true, slug: true },
      orderBy: { title: 'asc' },
    });
  }

  listAll() {
    return this.prisma.customPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async getBySlug(slug: string) {
    const page = await this.prisma.customPage.findFirst({ where: { slug, status: true } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async get(id: number) {
    const page = await this.prisma.customPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  create(dto: PageDto) {
    return this.prisma.customPage.create({
      data: {
        title: dto.title,
        slug: slugify(dto.title, { lower: true, strict: true }),
        content: dto.content,
        status: dto.status ?? true,
      },
    });
  }

  async update(id: number, dto: PageDto) {
    await this.get(id);
    return this.prisma.customPage.update({
      where: { id },
      data: {
        title: dto.title,
        slug: slugify(dto.title, { lower: true, strict: true }),
        content: dto.content,
        status: dto.status,
      },
    });
  }

  async remove(id: number) {
    await this.get(id);
    await this.prisma.customPage.delete({ where: { id } });
    return { removed: true };
  }
}

@ApiTags('pages')
@Controller()
export class PagesController {
  constructor(private pages: PagesService) {}

  @Public() @Get('pages') listPublished() {
    return this.pages.listPublished();
  }
  @Public() @Get('pages/:slug') bySlug(@Param('slug') slug: string) {
    return this.pages.getBySlug(slug);
  }

  @Roles(Principal.ADMIN) @Get('admin/pages') listAll() {
    return this.pages.listAll();
  }
  @Roles(Principal.ADMIN) @Get('admin/pages/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.pages.get(id);
  }
  @Roles(Principal.ADMIN) @Post('admin/pages') create(@Body() dto: PageDto) {
    return this.pages.create(dto);
  }
  @Roles(Principal.ADMIN) @Put('admin/pages/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: PageDto) {
    return this.pages.update(id, dto);
  }
  @Roles(Principal.ADMIN) @Delete('admin/pages/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.pages.remove(id);
  }
}

@Module({
  providers: [PagesService],
  controllers: [PagesController],
})
export class PagesModule {}
