# Test env isolation — 2026-01-31

## Implementado (code)
- APP_ENV por host (`test.`/`staging.`) e fallback por `APP_ENV` override.
  - `lib/appEnvShared.ts`, `lib/appEnv.ts`, `lib/appEnvClient.ts`
- Base URL dinâmica por host no server e no client.
  - `lib/appBaseUrl.ts`, `lib/publicBaseUrl.ts`
- Isolamento por env no Prisma (filtro automático + env em writes) e ligação RLS via `app.env`.
  - `lib/prisma.ts`, `lib/envModels.ts`
  - Migração SQL: `prisma/migrations/20260131_env_isolation/migration.sql`
- Env column adicionada aos modelos faltantes (exceto `auth.users`).
  - `prisma/schema.prisma`
- Stripe fail-closed por ambiente (live/test), sem mistura de chaves.
  - `lib/stripeKeys.ts`, `lib/stripeClient.ts`, `lib/stripePublic.ts`
  - Webhooks por request env: `app/api/stripe/webhook/route.ts`, `app/api/organizacao/payouts/webhook/route.ts`
- Admin infra: selector TEST/PROD + confirmação PROD.
  - `app/admin/infra/InfraClient.tsx`
  - `app/api/admin/infra/*/route.ts`
- Seed test-ready: `SEED_ENV=test` adiciona env e prefixos (slug/org).
  - `scripts/seed_events.js`
- Envs docs atualizados para chaves Stripe live/test.
  - `docs/envs_required.md`

## Pendente / bloqueado
- DNS Route53: criação de alias `test.orya.pt` → **BLOCKED** (AWS creds ausentes no runner).
- Aplicar migrações em DB (incl. RLS) → **PENDING** (schema local inválido; aplicar em ambiente com schema válido).
- Seed test no DB → **PENDING** (executar após migração: `SEED_ENV=test node scripts/seed_events.js`).

## Execução recomendada (quando tiver creds)
1) Aplicar migração SQL:
   - `npm run db:deploy` (ou executar `prisma/migrations/20260131_env_isolation/migration.sql`).
2) Seed test:
   - `SEED_ENV=test SEED_USER_ID=<uuid> node scripts/seed_events.js`
3) DNS:
   - Route53 ALIAS `test.orya.pt` → mesmo ALB de `app.orya.pt`.

## Notas
- Limitação atual: constraints únicas ainda são globais; usar prefixos em slugs/usernames para dados de teste.
