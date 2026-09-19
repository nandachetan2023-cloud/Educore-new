import { Module } from '@nestjs/common';
import {
  Body,
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

  create(dto: CategoryDto) {
    return this.prisma.courseCategory.create({
      data: { ...dto, slug: slugify(dto.name, { lower: true, strict: true }) },
    });
  }

  update(id: number, dto: CategoryDto) {
    return this.prisma.courseCategory.update({
      where: { id },
      data: { ...dto, slug: slugify(dto.name, { lower: true, strict: true }) },
    });
  }

  remove(id: number) {
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
