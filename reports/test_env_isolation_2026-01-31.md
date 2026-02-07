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

## Execução concluída (2026-02-01)
### DNS
- `test.orya.pt` → ALB (mesmo target de `orya.pt`).
- Evidência (curl): `HTTP/2 307` para `https://test.orya.pt` e `https://orya.pt` (proxy OK).

### Seed env=test (idempotente)
- Profile test criado/movido para env=test (user test-orya@orya.pt).
- Organization test criada: **ORYA Demo Studio (TEST)** (env=test).
- Eventos test criados: `test-seed-*` (6 eventos).

### Provas (SQL Editor / Pooler)
- Profile:
  - `test-orya` env=test → id `4efe49a6-92dc-40c7-9d8d-a165128e1874`
- Organization:
  - `ORYA Demo Studio (TEST)` env=test → id `3`
- Eventos (env=test, últimos 5):
  - `Cinema Open Air`, `Yoga & Sound Bath`, `Techno Warehouse`, `ORYA Run Club`, `Sunset Rooftop Porto`
- Contagens:
  - `test_orgs = 1`
  - `prod_orgs = 2`
  - `prod_with_test_slug = 0`

## Notas
- Limitação atual: constraints únicas ainda são globais; usar prefixos em slugs/usernames para dados de teste.
- O acesso direto `psql` nas portas 5432/6543 estava a dar `connection refused`; pooler session (`aws-1-eu-west-1.pooler.supabase.com:5432`) funcionou.
