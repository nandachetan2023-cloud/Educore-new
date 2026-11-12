-- Per-tenant SAML 2.0 single sign-on configuration.
--
-- The metadata URL is the primary input: the API fetches it and derives the
-- SSO entry point and signing certificate (cached, never trusted from the
-- client). entry_point and cert are stored as a fallback for IdPs without a
-- metadata endpoint. issuer is an optional SP entity-ID override.

CREATE TABLE IF NOT EXISTS "sso_configs" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "label" TEXT,
    "metadata_url" TEXT,
    "entry_point" TEXT,
    "issuer" TEXT,
    "cert" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sso_configs_tenant_id_key" UNIQUE ("tenant_id"),
    CONSTRAINT "sso_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
