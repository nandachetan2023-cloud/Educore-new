import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import slugify from 'slugify';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

class CategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsInt() parentId?: number;
  @IsOptional() @IsBoolean() showAtTrending?: boolean;
  @IsOptional() @IsBoolean() status?: boolean;
}

@Injectable()
class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.courseCategory.findMany({
      where: { status: true },
      orderBy: { name: 'asc' },
      include: { children: true, _count: { select: { courses: true } } },
    });
  }

  async create(dto: CategoryDto) {
    await this.assertUnique(dto.name, dto.parentId);
    return this.prisma.courseCategory.create({
      data: { ...dto, slug: slugify(dto.name, { lower: true, strict: true }) },
    });
  }

  async update(id: number, dto: CategoryDto) {
    await this.assertUnique(dto.name, dto.parentId, id);
    return this.prisma.courseCategory.update({
      where: { id },
      data: { ...dto, slug: slugify(dto.name, { lower: true, strict: true }) },
    });
  }

  /** Names (and the derived slugs) are unique per tenant — say so plainly. */
  private async assertUnique(name: string, parentId?: number, ignoreId?: number) {
    const slug = slugify(name, { lower: true, strict: true });
    const clash = await this.prisma.courseCategory.findFirst({
      where: {
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        OR: [{ name }, { slug }],
      },
      select: { id: true, name: true, parentId: true },
    });
    if (!clash) return;
    if (parentId && clash.parentId === parentId) {
      throw new ConflictException(`"${name}" already exists under this parent`);
    }
    throw new ConflictException(`A category named "${clash.name}" already exists`);
  }

  async remove(id: number) {
    const courses = await this.prisma.course.count({ where: { categoryId: id } });
    if (courses > 0) {
      throw new BadRequestException(
        `This category still has ${courses} course${courses === 1 ? '' : 's'} — move them to another category first`,
      );
    }
    return this.prisma.courseCategory.delete({ where: { id } });
  }
}

@ApiTags('categories')
@Controller('categories')
class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Public()
  @Get()
  list() {
    return this.categories.list();
  }

  @Roles(Principal.ADMIN)
  @Post()
  create(@Body() dto: CategoryDto) {
    return this.categories.create(dto);
  }

  @Roles(Principal.ADMIN)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.categories.update(id, dto);
  }

  @Roles(Principal.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }
}

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
