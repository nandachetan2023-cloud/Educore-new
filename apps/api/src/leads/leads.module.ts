import {
  Body, Controller, Get, Injectable, Module, NotFoundException,
  Param, ParseIntPipe, Post, Put, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Public, SuperAdmin } from '../common/decorators';
import { AuditService } from '../audit/audit.service';

class LeadDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsIn(['trial', 'contact', 'pricing']) source?: string;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  create(dto: LeadDto) {
    return this.prisma.lead.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        company: dto.company,
        phone: dto.phone,
        message: dto.message,
        source: dto.source ?? 'trial',
      },
    });
  }

  list(status?: string) {
    return this.prisma.lead.findMany({
      where: status && status !== 'all' ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateStatus(id: number, status: 'new' | 'contacted' | 'converted' | 'closed') {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const updated = await this.prisma.lead.update({ where: { id }, data: { status } });
    await this.audit.log({ action: 'lead.status', entity: 'lead', entityId: id, meta: { status } });
    return updated;
  }
}

@ApiTags('leads')
@Controller('leads')
export class LeadsPublicController {
  constructor(private leads: LeadsService) {}

  /** Public "Start Free Trial" / contact form capture from the marketing site. */
  @Public()
  @Post()
  create(@Body() dto: LeadDto) {
    return this.leads.create(dto);
  }
}

@ApiTags('admin leads')
@Controller('admin/leads')
@SuperAdmin()
export class AdminLeadsController {
  constructor(private leads: LeadsService) {}

  @Get() list(@Query('status') status?: string) { return this.leads.list(status); }

  @Put(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: 'new' | 'contacted' | 'converted' | 'closed') {
    return this.leads.updateStatus(id, status);
  }
}

@Module({
  providers: [LeadsService],
  controllers: [LeadsPublicController, AdminLeadsController],
})
export class LeadsModule {}
