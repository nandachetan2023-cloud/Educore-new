import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import slugify from 'slugify';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Public, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

/** Block types the page renderer understands. Keep in sync with the web app. */
const PAGE_BLOCK_TYPES = [
  'hero',
  'richText',
  'features',
  'stats',
  'image',
  'video',
  'cta',
  'faq',
  'testimonials',
  'contact',
  'divider',
] as const;

const MAX_BLOCKS_BYTES = 250_000;

class PageBlockDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsIn(PAGE_BLOCK_TYPES)
  type!: (typeof PAGE_BLOCK_TYPES)[number];

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

class PageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  /** Optional explicit slug; falls back to a slugified title. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug may only contain lowercase letters, numbers and hyphens',
  })
  slug?: string;

  /** Legacy HTML content. Ignored by the renderer when blocks exist. */
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PageBlockDto)
  blocks?: PageBlockDto[];

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  tenantId?: number;
}

function toJson(blocks: PageBlockDto[] | undefined): Prisma.InputJsonValue | undefined {
  return blocks === undefined ? undefined : (blocks as unknown as Prisma.InputJsonValue);
}

/**
 * Generic CMS pages (About, Terms, Privacy, or anything else a super-admin
 * wants to add). Pages can be authored with the block builder, with an HTML
 * fallback for older content. Rendered at /page/:slug.
 */
@Injectable()
export class PagesService {
  constructor(
    private prisma: PrismaService,
    @Inject(RAW_PRISMA) private rawPrisma: PrismaClient,
  ) {}

  listPublished() {
    return this.prisma.customPage.findMany({
      where: { status: true },
      select: { id: true, title: true, slug: true },
      orderBy: { title: 'asc' },
    });
  }

  async listAll() {
    const pages = await this.rawPrisma.customPage.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        title: true,
        slug: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        blocks: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return pages.map(({ blocks, ...page }) => ({
      ...page,
      blockCount: Array.isArray(blocks) ? blocks.length : 0,
    }));
  }

  listTenants() {
    return this.rawPrisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBySlug(slug: string) {
    const page = await this.prisma.customPage.findFirst({ where: { slug, status: true } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async get(id: number) {
    const page = await this.rawPrisma.customPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(dto: PageDto) {
    this.assertBlocksSize(dto.blocks);
    const tenantId = await this.requireTenant(dto.tenantId);
    const slug = await this.uniqueSlug(this.normalizeSlug(dto.slug ?? dto.title), tenantId);
    return this.rawPrisma.customPage.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        slug,
        content: dto.content,
        blocks: toJson(dto.blocks),
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
        status: dto.status ?? true,
      },
    });
  }

  async update(id: number, dto: PageDto) {
    const page = await this.get(id);
    this.assertBlocksSize(dto.blocks);
    const tenantId = dto.tenantId === undefined ? page.tenantId : await this.requireTenant(dto.tenantId);
    const requestedSlug =
      dto.slug !== undefined ? this.normalizeSlug(dto.slug) : page.slug;
    const slug =
      requestedSlug === page.slug && tenantId === page.tenantId
        ? page.slug
        : await this.uniqueSlug(requestedSlug, tenantId, id);

    return this.rawPrisma.customPage.update({
      where: { id },
      data: {
        tenantId,
        title: dto.title.trim(),
        slug,
        content: dto.content,
        blocks: toJson(dto.blocks),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle.trim() || null } : {}),
        ...(dto.seoDescription !== undefined
          ? { seoDescription: dto.seoDescription.trim() || null }
          : {}),
        status: dto.status,
      },
    });
  }

  async duplicate(id: number) {
    const source = await this.get(id);
    const slug = await this.uniqueSlug(`${source.slug}-copy`, source.tenantId);
    const title = `${source.title} (copy)`.slice(0, 160);
    return this.rawPrisma.customPage.create({
      data: {
        tenantId: source.tenantId,
        title,
        slug,
        content: source.content,
        blocks:
          source.blocks === null
            ? undefined
            : (source.blocks as unknown as Prisma.InputJsonValue),
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        status: false,
      },
    });
  }

  async remove(id: number) {
    await this.get(id);
    await this.rawPrisma.customPage.delete({ where: { id } });
    return { removed: true };
  }

  private normalizeSlug(value: string) {
    const slug = slugify(value, { lower: true, strict: true });
    if (!slug) throw new BadRequestException('Enter a valid page title or slug');
    return slug;
  }

  private async requireTenant(tenantId?: number) {
    if (tenantId === undefined) {
      throw new BadRequestException('Select a workspace for this page');
    }
    const tenant = await this.rawPrisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new BadRequestException('Selected workspace does not exist');
    return tenant.id;
  }

  private async uniqueSlug(base: string, tenantId: number, ignoreId?: number) {
    let slug = base;
    let counter = 2;
    for (;;) {
      const existing = await this.rawPrisma.customPage.findFirst({
        where: { tenantId, slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${counter++}`;
    }
  }

  private assertBlocksSize(blocks?: PageBlockDto[]) {
    if (blocks === undefined) return;
    if (JSON.stringify(blocks).length > MAX_BLOCKS_BYTES) {
      throw new BadRequestException('Page content is too large');
    }
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

  @SuperAdmin() @Roles(Principal.ADMIN) @Get('admin/pages') listAll() {
    return this.pages.listAll();
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Get('admin/pages/tenants') listTenants() {
    return this.pages.listTenants();
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Get('admin/pages/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.pages.get(id);
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Post('admin/pages') create(@Body() dto: PageDto) {
    return this.pages.create(dto);
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Post('admin/pages/:id/duplicate') duplicate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pages.duplicate(id);
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Put('admin/pages/:id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PageDto,
  ) {
    return this.pages.update(id, dto);
  }
  @SuperAdmin() @Roles(Principal.ADMIN) @Delete('admin/pages/:id') remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pages.remove(id);
  }
}

@Module({
  providers: [PagesService],
  controllers: [PagesController],
})
export class PagesModule {}
