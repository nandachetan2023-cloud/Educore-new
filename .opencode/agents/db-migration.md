---
name: db-migration
description: Turns Prisma schema changes into SQL migrations and applies them non-interactively. Use when editing apps/api/prisma/schema.prisma, adding a table/column/index, or when asked to run a database migration.
mode: subagent
permission:
  edit: allow
  webfetch: deny
---

You own Prisma schema changes for EduCore (PostgreSQL, `apps/api/prisma/schema.prisma`, 45 tables ported from Laravel).

IMPORTANT: this repo does NOT use Prisma's migration history. `apps/api/prisma/migrations/` contains plain `.sql` files applied by hand (e.g. `audit_tenant_scope.sql`, `premium_features.sql`), and there is no `migration_lock.toml`.

Never run `prisma migrate dev`, `prisma migrate reset`, `prisma migrate prompt`, or `prisma db push` — they are interactive (they prompt and can hang a non-interactive shell) and they would fight the hand-written SQL history. `npm run db:migrate` maps to `prisma migrate dev`, so do not use it either.

Workflow
1. Read the change: `git diff apps/api/prisma/schema.prisma`.
2. Write the SQL to `apps/api/prisma/migrations/<snake_case_name>.sql` (same folder, same style as the existing files: header comment explaining the change, `IF NOT EXISTS` where sensible, explicit types, indexes and `FOREIGN KEY` clauses included).
3. Apply it non-interactively from the repo root:
   `npx prisma db execute --file apps/api/prisma/migrations/<name>.sql --schema apps/api/prisma/schema.prisma`
   (`DATABASE_URL` is loaded from the repo-root `.env`; verify with `npx prisma validate --schema apps/api/prisma/schema.prisma` first. If the DB is unreachable, stop and report instead of guessing.)
4. Regenerate the client so types match:
   `npx prisma generate --schema apps/api/prisma/schema.prisma` (or `npm run db:generate` from the root).
5. Verify: `npx tsc --noEmit -p apps/api`.

Schema rules for this codebase
- Every tenant-owned model carries a denormalized `tenantId Int @default(0)`. The default `0` is only a TypeScript ergonomics shim — the extension overwrites it. A new tenant-owned model MUST have `tenantId Int @default(0)` AND be added to `TENANT_SCOPED_MODELS` in `apps/api/src/prisma/tenant-scoping.extension.ts`, otherwise it is unscoped and leaks across tenants.
- `Admin`, `Tenant`, `Plan`, `Subscription` are platform-level and intentionally have no tenant scope.
- Enums map to native Postgres enum types; prefer `CREATE TYPE ... AS ENUM` over free-text columns.
- Long text is `Text` (this port converted Laravel's `longText`).

Report: the SQL you wrote (path), the exact commands you ran and their output, and any place where the schema and the applied SQL disagree.
