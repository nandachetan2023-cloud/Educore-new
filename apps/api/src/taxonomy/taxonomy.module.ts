import { Body, Controller, Get, Injectable, Module, Post } from '@nestjs/common';
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
  levels() { return this.prisma.courseLevel.findMany({ orderBy: { id: 'asc' } }); }
  languages() { return this.prisma.courseLanguage.findMany({ orderBy: { id: 'asc' } }); }
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
  @Roles(Principal.ADMIN) @Post('levels') addLevel(@Body() dto: NameDto) { return this.tax.createLevel(dto.name); }
  @Roles(Principal.ADMIN) @Post('languages') addLanguage(@Body() dto: NameDto) { return this.tax.createLanguage(dto.name); }
}

@Module({ providers: [TaxonomyService], controllers: [TaxonomyController] })
export class TaxonomyModule {}
