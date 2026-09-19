import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.module';
import { MailModule } from '../mail/mail.module';
import { Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

class ContactFormDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() message!: string;
}

class HeroDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() subTitle?: string;
  @IsOptional() @IsString() image?: string;
}
class FeatureDto {
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}
class TestimonialDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() headline?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() comment?: string;
}
class CounterDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() number?: string;
}

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  /** Everything the marketing homepage needs, in one call. */
  async home() {
    const [hero, features, testimonials, counters, brands, about] = await Promise.all([
      this.prisma.hero.findFirst({ orderBy: { id: 'asc' } }),
      this.prisma.feature.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.testimonial.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.counter.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.brand.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.aboutUsSection.findFirst({ orderBy: { id: 'asc' } }),
    ]);
    return { hero, features, testimonials, counters, brands, about };
  }

  // Hero is a singleton — upsert the first row.
  async saveHero(dto: HeroDto) {
    const existing = await this.prisma.hero.findFirst();
    return existing
      ? this.prisma.hero.update({ where: { id: existing.id }, data: dto })
      : this.prisma.hero.create({ data: dto });
  }

  createFeature(dto: FeatureDto) { return this.prisma.feature.create({ data: dto }); }
  updateFeature(id: number, dto: FeatureDto) { return this.prisma.feature.update({ where: { id }, data: dto }); }
  deleteFeature(id: number) { return this.prisma.feature.delete({ where: { id } }); }

  createTestimonial(dto: TestimonialDto) { return this.prisma.testimonial.create({ data: dto }); }
  updateTestimonial(id: number, dto: TestimonialDto) { return this.prisma.testimonial.update({ where: { id }, data: dto }); }
  deleteTestimonial(id: number) { return this.prisma.testimonial.delete({ where: { id } }); }

  createCounter(dto: CounterDto) { return this.prisma.counter.create({ data: dto }); }
  updateCounter(id: number, dto: CounterDto) { return this.prisma.counter.update({ where: { id }, data: dto }); }
  deleteCounter(id: number) { return this.prisma.counter.delete({ where: { id } }); }

  // Key/value settings (brand overrides, etc.). Publicly readable, so
  // credential-bearing prefixes (mail.*, stripe.*) are redacted here — they
  // have their own admin-only settings endpoints.
  private static readonly PRIVATE_PREFIXES = ['mail.', 'stripe.', 'paypal.', 'razorpay.'];
  async settings() {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(
      rows
        .filter((r) => r.key && !CmsService.PRIVATE_PREFIXES.some((p) => r.key!.startsWith(p)))
        .map((r) => [r.key as string, r.value]),
    );
  }
  async setSetting(key: string, value: string) {
    const existing = await this.prisma.setting.findFirst({ where: { key } });
    return existing
      ? this.prisma.setting.update({ where: { id: existing.id }, data: { value } })
      : this.prisma.setting.create({ data: { key, value } });
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findFirst({ where: { key } });
    return row?.value ?? null;
  }
}

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private cms: CmsService) {}

  @Public() @Get('home') home() { return this.cms.home(); }
  @Public() @Get('settings') settings() { return this.cms.settings(); }

  @Roles(Principal.ADMIN) @Put('hero') saveHero(@Body() dto: HeroDto) { return this.cms.saveHero(dto); }

  @Roles(Principal.ADMIN) @Post('features') addFeature(@Body() dto: FeatureDto) { return this.cms.createFeature(dto); }
  @Roles(Principal.ADMIN) @Put('features/:id') editFeature(@Param('id', ParseIntPipe) id: number, @Body() dto: FeatureDto) { return this.cms.updateFeature(id, dto); }
  @Roles(Principal.ADMIN) @Delete('features/:id') delFeature(@Param('id', ParseIntPipe) id: number) { return this.cms.deleteFeature(id); }

  @Roles(Principal.ADMIN) @Post('testimonials') addTestimonial(@Body() dto: TestimonialDto) { return this.cms.createTestimonial(dto); }
  @Roles(Principal.ADMIN) @Put('testimonials/:id') editTestimonial(@Param('id', ParseIntPipe) id: number, @Body() dto: TestimonialDto) { return this.cms.updateTestimonial(id, dto); }
  @Roles(Principal.ADMIN) @Delete('testimonials/:id') delTestimonial(@Param('id', ParseIntPipe) id: number) { return this.cms.deleteTestimonial(id); }

  @Roles(Principal.ADMIN) @Post('counters') addCounter(@Body() dto: CounterDto) { return this.cms.createCounter(dto); }
  @Roles(Principal.ADMIN) @Put('counters/:id') editCounter(@Param('id', ParseIntPipe) id: number, @Body() dto: CounterDto) { return this.cms.updateCounter(id, dto); }
  @Roles(Principal.ADMIN) @Delete('counters/:id') delCounter(@Param('id', ParseIntPipe) id: number) { return this.cms.deleteCounter(id); }

  @Roles(Principal.ADMIN) @Put('settings/:key') setSetting(@Param('key') key: string, @Body('value') value: string) { return this.cms.setSetting(key, value); }
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private cms: CmsService, private mail: MailService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async submit(@Body() dto: ContactFormDto) {
    const toEmail = (await this.cms.getSetting('contact.email')) ?? process.env.ADMIN_EMAIL ?? 'admin@educore.app';
    const subject = dto.subject ? `Contact form: ${dto.subject}` : `New message from ${dto.name}`;
    const html = `<p><strong>From:</strong> ${dto.name} &lt;${dto.email}&gt;</p><p><strong>Message:</strong></p><p>${dto.message.replace(/\n/g, '<br>')}</p>`;
    await this.mail.sendNow(toEmail, subject, html);
    return { ok: true };
  }
}

@Module({
  imports: [MailModule],
  providers: [CmsService],
  controllers: [CmsController, ContactController],
})
export class CmsModule {}
