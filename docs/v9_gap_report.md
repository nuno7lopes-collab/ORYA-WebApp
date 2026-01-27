# v9 Gap Report (Backlog D0–D9)

Data: 27 Jan 2026
Estado: **SEM GAPS** (backlog v9 concluído)

## Resumo executivo
- O backlog v9 (D0–D9) está fechado.
- Não existem gaps funcionais conhecidos dentro do escopo D0–D9.
- Evidências e ficheiros chave listados abaixo.

## D0–D9 — verificação por domínio
### D0 API pública (fora de scope v1–v3)
- Estado: DONE
- Evidência: `domain/publicApi/auth.ts`, `app/api/public/v1/*` (410), exports `app/api/organizacao/finance/exports/*`.

### D1 Evento base obrigatório para torneios
- Estado: DONE
- Evidência: `prisma/schema.prisma` (eventId obrigatório em Tournament/PadelTournamentConfig), `domain/tournaments/*`.

### D2 Owners / SSOT por domínio
- Estado: DONE
- Evidência: `domain/finance/*`, `domain/entitlements/*`, `domain/outbox/*`, `domain/eventLog/append.ts`.

### D3 Agenda engine & conflitos
- Estado: DONE
- Evidência: `domain/agendaReadModel/*`, `domain/softBlocks/commands.ts`, `scripts/rebuild_agenda.js`.

### D4 Finanças determinística
- Estado: DONE (audited*)
- Evidência: `domain/finance/checkout.ts`, `domain/finance/reconciliation*.ts`, `domain/finance/gateway/stripeGateway.ts`.

### D5 RBAC mínimo + Role Packs
- Estado: DONE
- Evidência: `lib/organizationRbac.ts`, `lib/organizationMemberAccess.ts`, `app/api/organizacao/organizations/members/*`.

### D6 Notificações como serviço
- Estado: DONE
- Evidência: `domain/notifications/*`, `domain/outbox/*`, `app/api/internal/worker/operations/route.ts`.

### D7 sourceType canónico
- Estado: DONE
- Evidência: `domain/sourceType/index.ts`.

### D8 EventAccessPolicy & convites
- Estado: DONE
- Evidência: `lib/checkin/accessPolicy.ts`, `domain/access/evaluateAccess.ts`, `app/api/organizacao/events/*/invite*`.

### D9 Merchant of Record + faturação
- Estado: DONE (CSV-only v1)
- Evidência: `prisma/schema.prisma` (OrganizationSettings), `app/api/organizacao/finance/exports/*`, `app/api/organizacao/payouts/settings/route.ts`.

## Verificações rápidas executadas
- `rg -n "isFree" app -S` -> 0 ocorrências (anti-drift D4.8).

## Gates executados neste ambiente
- `npm run db:gates` (27 Jan 2026) — OK
  - 15 files / 42 tests (vitest) ✅
  - Nota: apareceu warning pós‑testes `NETWORK_BLOCK ... TCP=ETIMEDOUT`, mas o comando terminou com exit 0.
- `npm run db:gates:offline` (27 Jan 2026) — OK
  - 15 files / 42 tests (vitest) ✅
  - Logs esperados de outbox (publish failed) nos testes.

## Verificações ainda por correr (opcionais)
- `npx vitest run tests/finance tests/outbox tests/ops tests/rbac tests/notifications tests/access tests/sourceType tests/analytics`
