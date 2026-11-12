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
} from '@nestjs/common';
import { IsString } from 'class-validator';
import slugify from 'slugify';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

class NameDto { @IsString() name!: string; }

@Injectable()
class TaxonomyService {
  constructor(private prisma: PrismaService) {}
  levels() { return this.dedupeByName(this.prisma.courseLevel.findMany({ orderBy: { id: 'asc' } })); }
  languages() { return this.dedupeByName(this.prisma.courseLanguage.findMany({ orderBy: { id: 'asc' } })); }

  /**
   * Taxonomy for the signed-in workspace. The public /categories, /levels and
   * /languages routes are @Public(), so no principal is resolved for them and
   * the tenant can only come from the request host ? on a shared host that
   * means every tenant's rows. This endpoint is authenticated, so the caller's
   * own tenant scopes the result.
   */
  taxonomy() {
    return Promise.all([
      this.prisma.courseCategory.findMany({
        where: { status: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, icon: true, image: true },
      }),
      this.prisma.courseLevel.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } }),
      this.prisma.courseLanguage.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } }),
      this.tags(),
    ]).then(([categories, levels, languages, tags]) => ({ categories, levels, languages, tags }));
  }
  tags() {
    return this.prisma.tag.findMany({
      where: { status: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }
  async createTag(name: string) {
    const trimmed = name.trim();
    const slug = slugify(trimmed, { lower: true, strict: true });
    if (!slug) throw new NotFoundException('Enter a valid tag name');
    const existing = await this.prisma.tag.findFirst({ where: { slug } });
    if (existing) return existing;
    return this.prisma.tag.create({ data: { name: trimmed, slug, status: true } });
  }
  async removeTag(id: number) {
    const tag = await this.prisma.tag.findFirst({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    return { ok: true };
  }
  private async dedupeByName<T extends { name: string }>(rows: Promise<T[]>): Promise<T[]> {
    const seen = new Set<string>();
    return (await rows).filter((r) => {
      const key = r.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  createLevel(name: string) {
    return this.prisma.courseLevel.create({ data: { name, slug: slugify(name, { lower: true, strict: true }) } });
  }
  createLanguage(name: string) {
    return this.prisma.courseLanguage.create({ data: { name, slug: slugify(name, { lower: true, strict: true }) } });
  }
}

@ApiTags('taxonomy')
@Controller()
class TaxonomyController {
  constructor(private tax: TaxonomyService) {}
  @Public() @Get('levels') levels() { return this.tax.levels(); }
  @Public() @Get('languages') languages() { return this.tax.languages(); }

  /** Workspace-scoped taxonomy (categories, levels, languages, tags) for the signed-in user. */
  @Roles(Principal.STUDENT, Principal.INSTRUCTOR, Principal.ADMIN)
  @Get('taxonomy')
  taxonomy() { return this.tax.taxonomy(); }

  /** Course tags available in the current workspace (course builder autocomplete). */
  @Roles(Principal.INSTRUCTOR, Principal.ADMIN)
  @Get('tags')
  tags() { return this.tax.tags(); }

  @Roles(Principal.INSTRUCTOR, Principal.ADMIN)
  @Post('tags')
  addTag(@Body() dto: NameDto) { return this.tax.createTag(dto.name); }

  @Roles(Principal.ADMIN)
  @Delete('tags/:id')
  removeTag(@Param('id', ParseIntPipe) id: number) { return this.tax.removeTag(id); }

  @Roles(Principal.ADMIN) @Post('levels') addLevel(@Body() dto: NameDto) { return this.tax.createLevel(dto.name); }
  @Roles(Principal.ADMIN) @Post('languages') addLanguage(@Body() dto: NameDto) { return this.tax.createLanguage(dto.name); }
}

@Module({ providers: [TaxonomyService], controllers: [TaxonomyController] })
export class TaxonomyModule {}
