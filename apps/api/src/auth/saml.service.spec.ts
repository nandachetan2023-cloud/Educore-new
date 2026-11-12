import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { SamlService } from './saml.service';

const IDP_METADATA = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  entityID="https://idp.example.com/metadata">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>
            MIIC  TEST  CERT
          </ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://idp.example.com/sso/post" />
    <md:SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="https://idp.example.com/sso/redirect" />
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;

describe('SamlService', () => {
  let service: SamlService;
  let raw: {
    tenant: Record<string, jest.Mock>;
    ssoConfig: Record<string, jest.Mock>;
  };
  let auth: { loginSaml: jest.Mock };

  const activeTenant = { id: 1, slug: 'acme', status: 'active' };

  beforeEach(async () => {
    raw = {
      tenant: { findUnique: jest.fn().mockResolvedValue(activeTenant) },
      ssoConfig: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn((args) => Promise.resolve(args.create)),
      },
    };
    auth = { loginSaml: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlService,
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'oauth.callbackBase' || key === 'webUrl'
                ? 'https://learn.example.com'
                : undefined,
            ),
          },
        },
        { provide: RAW_PRISMA, useValue: raw },
      ],
    }).compile();

    service = module.get(SamlService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a disabled SSO button when the tenant has no config', async () => {
    raw.ssoConfig.findUnique.mockResolvedValue(null);
    await expect(service.publicInfo('acme')).resolves.toEqual({ enabled: false, label: null });
  });

  it('reports the configured button label when SSO is enabled', async () => {
    raw.ssoConfig.findUnique.mockResolvedValue({ enabled: true, label: 'Sign in with Okta' });
    await expect(service.publicInfo('acme')).resolves.toEqual({
      enabled: true,
      label: 'Sign in with Okta',
    });
  });

  it('derives entry point and certificate from the metadata URL on save', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => IDP_METADATA,
    }) as unknown as typeof fetch;

    await service.saveConfig(1, {
      enabled: true,
      label: 'Okta',
      metadataUrl: 'https://idp.example.com/metadata',
    });

    expect(raw.ssoConfig.upsert).toHaveBeenCalledWith({
      where: { tenantId: 1 },
      create: expect.objectContaining({
        tenantId: 1,
        enabled: true,
        label: 'Okta',
        entryPoint: 'https://idp.example.com/sso/redirect',
        cert: 'MIICTESTCERT',
      }),
      update: expect.objectContaining({
        entryPoint: 'https://idp.example.com/sso/redirect',
        cert: 'MIICTESTCERT',
      }),
    });
  });

  it('returns SP metadata pointing back at this tenant', async () => {
    raw.ssoConfig.findUnique.mockResolvedValue({
      enabled: true,
      entryPoint: 'https://idp.example.com/sso/redirect',
      issuer: null,
      cert: 'MIICTESTCERT',
    });

    const xml = await service.serviceProviderMetadata('acme');

    expect(xml).toContain('entityID="https://learn.example.com/api/auth/saml/metadata?tenant=acme"');
    expect(xml).toContain('https://learn.example.com/api/auth/saml/callback');
  });

  it('builds a redirect to the IdP with the tenant as RelayState', async () => {
    raw.ssoConfig.findUnique.mockResolvedValue({
      enabled: true,
      entryPoint: 'https://idp.example.com/sso/redirect',
      issuer: null,
      cert: 'MIICTESTCERT',
    });

    const url = await service.startLogin('acme');

    expect(url).toContain('https://idp.example.com/sso/redirect?');
    expect(url).toContain('SAMLRequest=');
    expect(url).toContain('RelayState=acme');
  });

  it('refuses to start login when SSO is disabled', async () => {
    raw.ssoConfig.findUnique.mockResolvedValue({ enabled: false });
    await expect(service.startLogin('acme')).rejects.toThrow('not enabled');
  });
});
