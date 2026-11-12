import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthPrincipal, CurrentUser, Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';
import { SsoConfigDto } from './dto';
import { SamlService } from './saml.service';

/**
 * SAML 2.0 single sign-on.
 *
 * - Browser entry: `GET /api/auth/saml/login?tenant=<slug>`
 * - IdP POST-back: `POST /api/auth/saml/callback`
 * - SP metadata:   `GET /api/auth/saml/metadata?tenant=<slug>`
 * - Admin config:  `GET/PUT /api/auth/saml/config`
 */
@ApiTags('auth')
@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);

  constructor(
    private saml: SamlService,
    private config: ConfigService,
  ) {}

  private webUrl() {
    return (this.config.get<string>('webUrl') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  @Public()
  @Get('login')
  async login(@Query('tenant') tenant: string | undefined, @Res() res: Response) {
    try {
      return res.redirect(await this.saml.startLogin(tenant));
    } catch (err) {
      this.logger.warn(`SAML login failed to start: ${String(err)}`);
      return res.redirect(`${this.webUrl()}/login?error=saml_unavailable`);
    }
  }

  @Public()
  @Post('callback')
  async callback(@Body() body: Record<string, string>, @Res() res: Response) {
    try {
      const tokens = await this.saml.handleAcs(body);
      const params = new URLSearchParams({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return res.redirect(`${this.webUrl()}/auth/callback?${params.toString()}`);
    } catch (err) {
      this.logger.warn(`SAML assertion rejected: ${String(err)}`);
      return res.redirect(`${this.webUrl()}/login?error=saml_failed`);
    }
  }

  @Public()
  @Get('metadata')
  async metadata(@Query('tenant') tenant: string | undefined, @Res() res: Response) {
    try {
      const xml = await this.saml.serviceProviderMetadata(tenant);
      return res.type('application/xml').send(xml);
    } catch (err) {
      this.logger.warn(`SAML metadata request failed: ${String(err)}`);
      return res.status(404).type('text/plain').send('SAML SSO is not configured');
    }
  }

  /** Whether the login page should show a "Sign in with SSO" button. */
  @Public()
  @Get('providers')
  providers(@Query('tenant') tenant: string | undefined) {
    return this.saml.publicInfo(tenant);
  }

  @Roles(Principal.ADMIN)
  @Get('config')
  getConfig(@CurrentUser() user: AuthPrincipal) {
    if (!user.tenantId) throw new BadRequestException('Admins need a workspace');
    return this.saml.getConfig(user.tenantId);
  }

  @Roles(Principal.ADMIN)
  @Put('config')
  saveConfig(@CurrentUser() user: AuthPrincipal, @Body() dto: SsoConfigDto) {
    if (!user.tenantId) throw new BadRequestException('Admins need a workspace');
    return this.saml.saveConfig(user.tenantId, dto);
  }
}
