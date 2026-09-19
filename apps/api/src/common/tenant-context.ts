/** CLS store keys used to carry the current request's tenant/principal context. */
export const TENANT_CLS_KEY = 'tenantId';
export const PRINCIPAL_CLS_KEY = 'principal';

/** Dev-only header used to simulate a tenant before Host-based resolution (custom domains) lands. */
export const DEV_TENANT_HEADER = 'x-tenant-id';
