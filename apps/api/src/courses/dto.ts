import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';

export class CourseQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string; // category slug

  @IsOptional()
  @IsString()
  level?: string; // level slug

  @IsOptional()
  @IsString()
  language?: string; // language slug

  @IsOptional()
  @IsString()
  sort?: 'newest' | 'price_low' | 'price_high';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number = 12;
}

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  courseLevelId?: number;

  @IsOptional()
  @IsInt()
  courseLanguageId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;
}

export class UpdateCourseDto extends CreateCourseDto {}
