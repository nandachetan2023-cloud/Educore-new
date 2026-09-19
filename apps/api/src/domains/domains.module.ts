import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { resolveTxt } from 'dns/promises';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { CurrentUser, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

// Loose hostname check — full DNS validity is out of scope, this just
// rejects obvious junk before it hits the DB's unique constraint.
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const VERIFICATION_SUBDOMAIN = '_educore-verify';

class SetDomainDto {
  @IsString() @Matches(DOMAIN_RE, { message: 'Not a valid domain' }) domain!: string;
}

/**
 * Custom domain for a tenant: set a domain, then prove ownership via a DNS
 * TXT record before `tenant-resolution.middleware.ts` will ever route
 * traffic for it (see there for why only `verified` domains are trusted).
 * Reachable two ways: self-service by the tenant's own Admin (`DomainsController`,
 * `tenantId` from their JWT), or on their behalf by the platform Superadmin
 * (`SuperAdminDomainsController`, `tenantId` from the URL, any tenant).
 */
@Injectable()
export class DomainsService {
  constructor(@Inject(RAW_PRISMA) private raw: PrismaClient) {}

  private async getOwnTenant(tenantId: number | null | undefined) {
    if (tenantId == null) {
      throw new ForbiddenException('No tenant specified');
    }
    const tenant = await this.raw.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new ForbiddenException('No tenant on this account');
    return tenant;
  }

  async get(tenantId: number | null | undefined) {
    const tenant = await this.getOwnTenant(tenantId);
    return {
      customDomain: tenant.customDomain,
      domainStatus: tenant.domainStatus,
      verificationRecord: tenant.customDomain
        ? { name: `${VERIFICATION_SUBDOMAIN}.${tenant.customDomain}`, type: 'TXT', value: tenant.domainVerificationToken }
        : null,
    };
  }

  async setDomain(tenantId: number | null | undefined, domain: string) {
    const tenant = await this.getOwnTenant(tenantId);
    const normalized = domain.toLowerCase();
    const token = `educore-verify=${randomBytes(16).toString('hex')}`;
    await this.raw.tenant.update({
      where: { id: tenant.id },
      data: { customDomain: normalized, domainStatus: 'pending', domainVerificationToken: token },
    });
    return this.get(tenantId);
  }

  async verify(tenantId: number | null | undefined) {
    const tenant = await this.getOwnTenant(tenantId);
    if (!tenant.customDomain || !tenant.domainVerificationToken) {
      throw new BadRequestException('No domain set yet');
    }

    let verified = false;
    try {
      const records = await resolveTxt(`${VERIFICATION_SUBDOMAIN}.${tenant.customDomain}`);
      verified = records.some((chunks) => chunks.join('') === tenant.domainVerificationToken);
    } catch {
      verified = false; // NXDOMAIN / no TXT record yet — not an error, just not verified
    }

    await this.raw.tenant.update({
      where: { id: tenant.id },
      data: { domainStatus: verified ? 'verified' : 'failed' },
    });
    return this.get(tenantId);
  }
}

@ApiTags('domains')
@Controller('admin/domain')
@Roles(Principal.ADMIN)
export class DomainsController {
  constructor(private domains: DomainsService) {}

  @Get()
  get(@CurrentUser('tenantId') tenantId: number | null) {
    return this.domains.get(tenantId);
  }

  @Post()
  set(@CurrentUser('tenantId') tenantId: number | null, @Body() dto: SetDomainDto) {
    return this.domains.setDomain(tenantId, dto.domain);
  }

  @Post('verify')
  verify(@CurrentUser('tenantId') tenantId: number | null) {
    return this.domains.verify(tenantId);
  }
}

/** Lets the platform Superadmin configure any tenant's custom domain on their behalf, from the tenant detail page. */
@ApiTags('domains')
@Controller('admin/tenants/:tenantId/domain')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class SuperAdminDomainsController {
  constructor(private domains: DomainsService) {}

  @Get()
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.domains.get(tenantId);
  }

  @Post()
  set(@Param('tenantId', ParseIntPipe) tenantId: number, @Body() dto: SetDomainDto) {
    return this.domains.setDomain(tenantId, dto.domain);
  }

  @Post('verify')
  verify(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.domains.verify(tenantId);
  }
}

@Module({
  providers: [DomainsService],
  controllers: [DomainsController, SuperAdminDomainsController],
})
export class DomainsModule {}
