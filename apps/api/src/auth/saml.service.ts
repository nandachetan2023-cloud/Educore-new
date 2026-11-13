import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { SAML } from '@node-saml/node-saml';
import { XMLParser } from 'fast-xml-parser';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { SsoConfigDto } from './dto';

interface IdpMetadata {
  entityId?: string;
  entryPoint: string;
  cert: string;
}

interface CachedMetadata {
  value: IdpMetadata;
  expiresAt: number;
}

/** Parsed representation of the bits of IdP metadata we need. */
type XmlNode = Record<string, unknown>;

const METADATA_TTL_MS = 10 * 60 * 1000;

/**
 * Generic SAML 2.0 SP implementation driven by a tenant's IdP metadata URL.
 *
 * Flow:
 *   GET  /api/auth/saml/login?tenant=<slug>  → 302 to the IdP
 *   POST /api/auth/saml/callback             → validate assertion, issue JWTs,
 *                                              302 to the web app
 *   GET  /api/auth/saml/metadata?tenant=...  → SP metadata XML for the IdP
 *
 * Only the SP side lives here. Each tenant configures its own IdP by pasting
 * the metadata URL in the admin panel; the entry point and signing cert are
 * fetched from it and cached for ten minutes.
 */
@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly cache = new Map<string, CachedMetadata>();
  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    trimValues: true,
  });

  constructor(
    private config: ConfigService,
    private auth: AuthService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
  ) {}

  private callbackBase() {
    return (
      this.config.get<string>('oauth.callbackBase') ??
      this.config.get<string>('apiUrl') ??
      'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  private callbackUrl() {
    return `${this.callbackBase()}/api/auth/saml/callback`;
  }

  private spEntityId(slug: string) {
    return `${this.callbackBase()}/api/auth/saml/metadata?tenant=${encodeURIComponent(slug)}`;
  }

  /** Resolves a tenant by slug (or the only tenant with SSO when omitted). */
  private async resolveTenant(slug?: string) {
    if (slug) {
      const tenant = await this.raw.tenant.findUnique({
        where: { slug },
        select: { id: true, slug: true, status: true },
      });
      if (!tenant) throw new NotFoundException('Unknown workspace');
      if (tenant.status === 'suspended') throw new BadRequestException('Workspace is suspended');
      return tenant;
    }
    const config = await this.raw.ssoConfig.findFirst({
      where: { enabled: true, tenant: { status: 'active' } },
      orderBy: { id: 'asc' },
      select: { tenant: { select: { id: true, slug: true, status: true } } },
    });
    if (!config) throw new NotFoundException('SAML SSO is not configured');
    return config.tenant;
  }

  private async loadConfig(tenantId: number) {
    return this.raw.ssoConfig.findUnique({ where: { tenantId } });
  }

  private normalizeCert(value: unknown): string {
    if (typeof value === 'string') return value.replace(/\s+/g, '');
    if (Array.isArray(value)) return this.normalizeCert(value[0]);
    return '';
  }

  /** Extracts entityID, SSO URL and signing cert from IdP metadata XML. */
  private parseMetadata(xml: string): IdpMetadata {
    const parsed = this.xml.parse(xml) as XmlNode;
    const root = parsed.EntitiesDescriptor
      ? ((parsed.EntitiesDescriptor as XmlNode).EntityDescriptor as XmlNode | XmlNode[])
      : (parsed.EntityDescriptor as XmlNode | XmlNode[]);
    const descriptors = Array.isArray(root) ? root : root ? [root] : [];
    const descriptor = descriptors.find((d) => (d as XmlNode).IDPSSODescriptor) as
      | XmlNode
      | undefined;
    if (!descriptor) throw new BadRequestException('The metadata has no IDPSSODescriptor');

    const idp = descriptor.IDPSSODescriptor as XmlNode;
    const services = idp.SingleSignOnService;
    const list = (Array.isArray(services) ? services : [services]).filter(Boolean) as XmlNode[];
    const preferred =
      list.find((s) => s['@_Binding'] === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect') ??
      list[0];
    const entryPoint = preferred?.['@_Location'];
    if (typeof entryPoint !== 'string') {
      throw new BadRequestException('The metadata has no SingleSignOnService location');
    }

    const keyDescriptors = idp.KeyDescriptor;
    const keys = (Array.isArray(keyDescriptors) ? keyDescriptors : [keyDescriptors]).filter(
      Boolean,
    ) as XmlNode[];
    const signing = keys.find((k) => k['@_use'] === 'signing') ?? keys[0];
    const keyInfo = signing?.KeyInfo as XmlNode | undefined;
    const x509 = keyInfo?.X509Data as XmlNode | undefined;
    const cert = this.normalizeCert(x509?.X509Certificate);
    if (!cert) throw new BadRequestException('The metadata has no signing certificate');

    return {
      entityId: typeof descriptor['@_entityID'] === 'string' ? descriptor['@_entityID'] : undefined,
      entryPoint,
      cert,
    };
  }

  private async fetchMetadata(url: string): Promise<IdpMetadata> {
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Metadata URL is not a valid URL');
    }
    const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocal) {
      throw new BadRequestException('Metadata URL must use HTTPS');
    }

    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/samlmetadata+xml, application/xml, text/xml' },
      });
    } catch (err) {
      this.logger.warn(`Could not fetch SAML metadata from ${url}: ${String(err)}`);
      throw new BadRequestException('Could not fetch the metadata URL');
    }
    if (!res.ok) throw new BadRequestException(`Metadata URL returned HTTP ${res.status}`);

    const value = this.parseMetadata(await res.text());
    this.cache.set(url, { value, expiresAt: Date.now() + METADATA_TTL_MS });
    return value;
  }

  private buildSaml(cfg: { entryPoint: string | null; cert: string | null; issuer: string | null }, idp: IdpMetadata, slug: string) {
    return new SAML({
      callbackUrl: this.callbackUrl(),
      entryPoint: cfg.entryPoint ?? idp.entryPoint,
      issuer: cfg.issuer ?? this.spEntityId(slug),
      idpCert: cfg.cert ?? idp.cert,
      audience: this.spEntityId(slug),
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      acceptedClockSkewMs: 5_000,
      disableRequestedAuthnContext: true,
    });
  }

  /** Returns the URL to redirect the browser to for IdP-initiated login. */
  async startLogin(slug?: string) {
    const tenant = await this.resolveTenant(slug);
    const cfg = await this.loadConfig(tenant.id);
    if (!cfg?.enabled) throw new NotFoundException('SAML SSO is not enabled');

    const idp = await this.requireIdpMetadata(cfg);
    const saml = this.buildSaml(cfg, idp, tenant.slug);
    return saml.getAuthorizeUrlAsync(tenant.slug, undefined);
  }

  private async requireIdpMetadata(cfg: {
    metadataUrl: string | null;
    entryPoint: string | null;
    cert: string | null;
    issuer: string | null;
  }): Promise<IdpMetadata> {
    if (cfg.metadataUrl) return this.fetchMetadata(cfg.metadataUrl);
    if (cfg.entryPoint && cfg.cert) {
      return { entryPoint: cfg.entryPoint, cert: cfg.cert, entityId: cfg.issuer ?? undefined };
    }
    throw new BadRequestException('Configure a metadata URL (or entry point + certificate) first');
  }

  /** Validates the IdP's POST response and returns fresh JWTs. */
  async handleAcs(body: Record<string, string>) {
    const slug = body.RelayState || body.relayState || undefined;
    const tenant = await this.resolveTenant(slug);
    const cfg = await this.loadConfig(tenant.id);
    if (!cfg?.enabled) throw new NotFoundException('SAML SSO is not enabled');

    const idp = await this.requireIdpMetadata(cfg);
    const saml = this.buildSaml(cfg, idp, tenant.slug);
    const { profile } = await saml.validatePostResponseAsync(body);
    if (!profile) throw new BadRequestException('The identity provider returned no profile');

    const p = profile as unknown as Record<string, unknown> & { nameID?: string | null };
    const email =
      (typeof p.email === 'string' && p.email) ||
      (typeof p.mail === 'string' && p.mail) ||
      (typeof p.nameID === 'string' && p.nameID) ||
      '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('The identity provider did not assert a valid email address');
    }
    const first = typeof p.firstName === 'string' ? p.firstName : '';
    const last = typeof p.lastName === 'string' ? p.lastName : '';
    const display = typeof p.displayName === 'string' ? p.displayName : '';
    const name = display || [first, last].filter(Boolean).join(' ') || email.split('@')[0];

    return this.auth.loginSaml({ email, name }, tenant.id);
  }

  /** SP metadata XML the tenant hands to their IdP. */
  async serviceProviderMetadata(slug?: string) {
    const tenant = await this.resolveTenant(slug);
    const cfg = await this.loadConfig(tenant.id);
    if (!cfg) throw new NotFoundException('SAML SSO is not configured');

    const saml = new SAML({
      callbackUrl: this.callbackUrl(),
      entryPoint: cfg.entryPoint ?? 'https://idp.invalid/sso',
      issuer: cfg.issuer ?? this.spEntityId(tenant.slug),
      idpCert: cfg.cert ?? 'invalid',
      audience: this.spEntityId(tenant.slug),
    });
    return saml.generateServiceProviderMetadata(null);
  }

  /** Public login-button info: does this tenant offer SSO, and what label? */
  async publicInfo(slug?: string) {
    try {
      const tenant = await this.resolveTenant(slug);
      const cfg = await this.loadConfig(tenant.id);
      return { enabled: !!cfg?.enabled, label: cfg?.enabled ? (cfg.label ?? 'Single sign-on') : null };
    } catch {
      return { enabled: false, label: null };
    }
  }

  async getConfig(tenantId: number) {
    const cfg = await this.loadConfig(tenantId);
    const tenant = await this.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    return {
      ...(cfg ?? {
        tenantId,
        enabled: false,
        label: null,
        metadataUrl: null,
        entryPoint: null,
        issuer: null,
        cert: null,
      }),
      spMetadataUrl: tenant ? this.spEntityId(tenant.slug) : null,
      acsUrl: this.callbackUrl(),
      loginUrl: tenant ? `${this.callbackBase()}/api/auth/saml/login?tenant=${tenant.slug}` : null,
    };
  }

  async getTenantConfig(tenantId: number) {
    const tenant = await this.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    return this.getConfig(tenantId);
  }

  async saveTenantConfig(tenantId: number, dto: SsoConfigDto) {
    const tenant = await this.raw.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    await this.saveConfig(tenantId, dto);
    return this.getConfig(tenantId);
  }

  /**
   * Creates/updates the tenant config. When a metadata URL is supplied we fetch
   * it first so a typo fails immediately instead of at first login.
   */
  async saveConfig(tenantId: number, dto: SsoConfigDto) {
    let derived: IdpMetadata | null = null;
    if (dto.metadataUrl) derived = await this.fetchMetadata(dto.metadataUrl);
    if (!dto.metadataUrl && dto.enabled && (!dto.entryPoint || !dto.cert)) {
      const current = await this.loadConfig(tenantId);
      if (!current?.entryPoint || !current?.cert) {
        throw new BadRequestException(
          'Set a metadata URL, or provide both an entry point and signing certificate',
        );
      }
    }

    const data = {
      enabled: dto.enabled ?? false,
      label: dto.label ?? null,
      metadataUrl: dto.metadataUrl ?? null,
      entryPoint: dto.entryPoint ?? derived?.entryPoint ?? null,
      issuer: dto.issuer ?? null,
      cert: dto.cert ? dto.cert.replace(/\s+/g, '') : (derived?.cert ?? null),
    };

    return this.raw.ssoConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }
}
