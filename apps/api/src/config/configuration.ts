export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  apiUrl: process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? '4000'}`,
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  brand: {
    name: process.env.BRAND_NAME ?? 'EduCore',
    logo: process.env.BRAND_LOGO ?? '/brand/logo.svg',
    favicon: process.env.BRAND_FAVICON ?? '/brand/favicon.ico',
    primaryColor: process.env.BRAND_PRIMARY_COLOR ?? '#4f46e5',
    secondaryColor: process.env.BRAND_SECONDARY_COLOR ?? '#0ea5e9',
    currency: process.env.DEFAULT_CURRENCY ?? 'USD',
    commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '20'),
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKey: process.env.S3_ACCESS_KEY ?? '',
      secretKey: process.env.S3_SECRET_KEY ?? '',
    },
  },
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'EduCore <no-reply@example.com>',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    mode: process.env.PAYPAL_MODE ?? 'sandbox',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  },
});
