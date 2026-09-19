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
  Query,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import slugify from 'slugify';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

class BlogDto {
  @IsString() title!: string;
  @IsOptional() @IsInt() categoryId?: number;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() status?: boolean;
}
class BlogCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsBoolean() status?: boolean;
}
class CommentDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(2) comment!: string;
}

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async list(page = 1, category?: string) {
    const perPage = 9;
    const where = {
      status: true,
      ...(category ? { category: { slug: category } } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.blog.count({ where }),
      this.prisma.blog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { category: { select: { name: true, slug: true } } },
      }),
    ]);
    return { data, meta: { page, perPage, total, lastPage: Math.ceil(total / perPage) } };
  }

  categories() {
    return this.prisma.blogCategory.findMany({ where: { status: true }, orderBy: { name: 'asc' } });
  }

  async bySlug(slug: string) {
    const post = await this.prisma.blog.findFirst({
      where: { slug, status: true },
      include: {
        category: { select: { name: true, slug: true } },
        comments: { where: { status: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async comment(blogId: number, dto: CommentDto) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Post not found');
    return this.prisma.blogComment.create({
      data: { blogId, ...dto, status: false }, // awaits moderation
    });
  }

  // ── Admin ──
  createPost(dto: BlogDto) {
    return this.prisma.blog.create({
      data: { ...dto, slug: `${slugify(dto.title, { lower: true, strict: true })}` },
    });
  }
  updatePost(id: number, dto: BlogDto) {
    return this.prisma.blog.update({
      where: { id },
      data: { ...dto, slug: slugify(dto.title, { lower: true, strict: true }) },
    });
  }
  deletePost(id: number) { return this.prisma.blog.delete({ where: { id } }); }

  createCategory(dto: BlogCategoryDto) {
    return this.prisma.blogCategory.create({
      data: { name: dto.name, slug: slugify(dto.name, { lower: true, strict: true }), status: dto.status ?? true },
    });
  }

  pendingComments() {
    return this.prisma.blogComment.findMany({
      where: { status: false },
      include: { blog: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async decideComment(id: number, approved: boolean) {
    if (!approved) {
      await this.prisma.blogComment.delete({ where: { id } });
      return { removed: true };
    }
    return this.prisma.blogComment.update({ where: { id }, data: { status: true } });
  }
}

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private blog: BlogService) {}

  @Public() @Get() list(@Query('page') page?: string, @Query('category') category?: string) {
    return this.blog.list(page ? Number(page) : 1, category);
  }
  @Public() @Get('categories') categories() { return this.blog.categories(); }
  @Public() @Get(':slug') bySlug(@Param('slug') slug: string) { return this.blog.bySlug(slug); }
  @Public() @Post(':id/comments') comment(@Param('id', ParseIntPipe) id: number, @Body() dto: CommentDto) {
    return this.blog.comment(id, dto);
  }

  @Roles(Principal.ADMIN) @Post() create(@Body() dto: BlogDto) { return this.blog.createPost(dto); }
  @Roles(Principal.ADMIN) @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: BlogDto) { return this.blog.updatePost(id, dto); }
  @Roles(Principal.ADMIN) @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.blog.deletePost(id); }
  @Roles(Principal.ADMIN) @Post('admin/categories') addCategory(@Body() dto: BlogCategoryDto) { return this.blog.createCategory(dto); }
  @Roles(Principal.ADMIN) @Get('admin/comments') comments() { return this.blog.pendingComments(); }
  @Roles(Principal.ADMIN) @Post('admin/comments/:id/approve') approve(@Param('id', ParseIntPipe) id: number) { return this.blog.decideComment(id, true); }
  @Roles(Principal.ADMIN) @Post('admin/comments/:id/reject') reject(@Param('id', ParseIntPipe) id: number) { return this.blog.decideComment(id, false); }
}

@Module({
  providers: [BlogService],
  controllers: [BlogController],
})
export class BlogModule {}
