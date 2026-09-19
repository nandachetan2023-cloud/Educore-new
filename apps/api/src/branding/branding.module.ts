import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsHexColor, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

export interface Branding {
  name: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  commissionRate: number;
}

class BrandingDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() favicon?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() commissionRate?: string;
}

const SETTING_PREFIX = 'brand.';

/**
 * Runtime white-label branding. Env values are the install defaults; the
 * super-admin overrides any of them from the panel, stored in the `settings`
 * table. `GET /branding` returns the merged result — the frontend themes the
 * entire app (name, logo, favicon, colors, currency) from this one response.
 */
@Injectable()
export class BrandingService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async get(): Promise<Branding> {
    const defaults = this.config.get<Branding>('brand')!;
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: SETTING_PREFIX } },
    });

    const overrides: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') {
        overrides[r.key.slice(SETTING_PREFIX.length)] = r.value;
      }
    }

    const primaryColor = overrides.primaryColor || defaults.primaryColor || '#4f46e5';
    const secondaryColor = overrides.secondaryColor || defaults.secondaryColor || '#0ea5e9';

    return {
      name: overrides.name || defaults.name || 'EduCore',
      logo: overrides.logo || defaults.logo || '/brand/logo.svg',
      favicon: overrides.favicon || defaults.favicon || '/brand/favicon.ico',
      primaryColor,
      secondaryColor,
      currency: overrides.currency || defaults.currency || 'USD',
      commissionRate:
        overrides.commissionRate != null && overrides.commissionRate !== ''
          ? parseFloat(overrides.commissionRate)
          : defaults.commissionRate || 20,
    };
  }

  async update(dto: BrandingDto): Promise<Branding> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined && v !== '');
    for (const [key, value] of entries) {
      const settingKey = `${SETTING_PREFIX}${key}`;
      const existing = await this.prisma.setting.findFirst({ where: { key: settingKey } });
      if (existing) {
        await this.prisma.setting.update({ where: { id: existing.id }, data: { value: String(value) } });
      } else {
        await this.prisma.setting.create({ data: { key: settingKey, value: String(value) } });
      }
    }
    return this.get();
  }

  /** Restores a single field (or all) to the env default by removing overrides. */
  async reset(field?: string): Promise<Branding> {
    await this.prisma.setting.deleteMany({
      where: field ? { key: `${SETTING_PREFIX}${field}` } : { key: { startsWith: SETTING_PREFIX } },
    });
    return this.get();
  }
}

@ApiTags('branding')
@Controller()
export class BrandingController {
  constructor(private branding: BrandingService) {}

  @Public()
  @Get('branding')
  get() {
    return this.branding.get();
  }

  @Roles(Principal.ADMIN)
  @SuperAdmin()
  @Put('admin/branding')
  update(@Body() dto: BrandingDto) {
    return this.branding.update(dto);
  }

  @Roles(Principal.ADMIN)
  @SuperAdmin()
  @Put('admin/branding/reset')
  reset() {
    return this.branding.reset();
  }
}

@Module({
  providers: [BrandingService],
  controllers: [BrandingController],
})
export class BrandingModule {}
