import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const originalMockPayments = process.env.ENABLE_MOCK_PAYMENTS;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
    if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
    if (originalMockPayments === undefined) delete process.env.ENABLE_MOCK_PAYMENTS;
    else process.env.ENABLE_MOCK_PAYMENTS = originalMockPayments;
  });

  it('requires explicit JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(configuration).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production');
  });

  it('loads explicitly configured JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'configured-access-secret';
    process.env.JWT_REFRESH_SECRET = 'configured-refresh-secret';

    expect(configuration().jwt).toEqual(expect.objectContaining({
      accessSecret: 'configured-access-secret',
      refreshSecret: 'configured-refresh-secret',
    }));
  });

  it('keeps fake payments disabled in production even when explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'configured-access-secret';
    process.env.JWT_REFRESH_SECRET = 'configured-refresh-secret';
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    expect(configuration().mockPaymentsEnabled).toBe(false);
  });

  it('keeps fake payments disabled when NODE_ENV is missing', () => {
    delete process.env.NODE_ENV;
    process.env.ENABLE_MOCK_PAYMENTS = 'true';

    expect(configuration().mockPaymentsEnabled).toBe(false);
  });
});
