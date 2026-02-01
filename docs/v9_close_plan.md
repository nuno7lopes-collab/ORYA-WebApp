# V9 Close Plan (Blocos)

Plano SSOT para fechar o Blueprint v9 e alinhar a repo inteira. Cada bloco fecha tudo o que lhe pertence (código + UI + APIs + invariantes + fail-closed + ops). Sem passar ao bloco seguinte sem DONE.

## Uso do plano
- Cada bloco é **deployavel** e tem Definition of Done objetiva.
- Todas as verificacoes sao auditaveis por paths/rg/tests.
- A normalizacao final e registada no `docs/v9_ssot_registry.md`.

## Status update (2026-01-31)
- Bloco 0: envelope C‑G5 + requestId/correlationId concluído.
- Bloco 2: claim winner‑only + recovery/runbook concluídos.
- Bloco 4: stats migradas para rollups/entitlements (sem legacy summaries).
- Bloco 5: gate de org context aplicado em CI + correções de rota crítica.
- Bloco 9/10: entitlements (tickets/padel/booking/loja) e DSAR/retention concluídos.

---

## Primeira Semana (Top-5 Drifts) — Plano de Execucao

### Drift 1 (Bloco 1) — PaymentIntent fora do fluxo canonico
**Entrypoints que criam PaymentIntent (lista exata)**
- `app/api/payments/intent/route.ts` (canonico esperado)
- `app/api/store/checkout/route.ts`
- `app/api/servicos/[id]/checkout/route.ts`
- `app/api/servicos/[id]/creditos/checkout/route.ts`
- `app/api/organizacao/reservas/[id]/checkout/route.ts`
- `domain/padelSecondCharge.ts`
- `domain/finance/gateway/stripeGateway.ts` (gateway canonicamente permitido)

**Plano**
- Definir SSOT unico: `/api/payments/intent` + `domain/finance/checkout.ts`.
- Bloquear/elimitar criacao direta de PI fora do fluxo canonico (refactor entrypoints acima).
- Garantir idempotencia unificada: `purchaseId` + `idempotencyKey` canonica (checkoutKey).
- Validar que todos os fluxos retornam o mesmo envelope + requestId.

### Drift 2 (Bloco 4) — Admin/Stats legacy 410
**Entrypoints afetados**
- `app/api/admin/organizacoes/list/route.ts` (410)
- `app/api/organizacao/estatisticas/overview/route.ts` (410)
- `app/api/organizacao/estatisticas/time-series/route.ts` (410)
- UI: `app/admin/organizacoes/page.tsx`, `app/organizacao/estatisticas/page.tsx`

**Plano**
- Substituir legacy stats por fontes atuais (EventLog/Ops Feed/Rollups v9).
- UI nao pode falhar se stats estiverem incompletas (fallback resiliente).
- Endpoints admin retornam dados minimos + envelope canonico.

### Drift 3 (Bloco 2) — Outbox sem claim/lock explicito
**Entrypoints afetados**
- `domain/outbox/**`
- `app/api/internal/worker/operations/route.ts`
- `app/api/internal/outbox/replay/route.ts`
- `app/api/internal/outbox/dlq/route.ts`
- `app/api/internal/reprocess/**`
- `app/api/cron/operations/route.ts`

**Plano**
- Definir estrategia de claim: select + lock + winner-only (SKIP LOCKED ou equivalente).
- Definir regra de crash recovery (reconciliation guard).
- Garantir publishedAt apenas em sucesso, sem loop.
- Runbook DLQ/replay obrigatorio.

### Drift 4 (Bloco 3) — Email oficial disperso
**Entrypoints afetados**
- `app/api/organizacao/organizations/settings/official-email/route.ts`
- `app/api/organizacao/organizations/settings/official-email/confirm/route.ts`
- `app/api/admin/organizacoes/verify-platform-email/route.ts`
- UI: `app/organizacao/(dashboard)/settings/page.tsx`, `app/organizacao/OrganizationTopBar.tsx`

**Plano**
- Regra unica de normalizacao: `lib/organizationOfficialEmail.ts` (NFKC + lowercase + trim).
- SSOT de verificado: `officialEmailVerifiedAt` nao null.
- Enforcement em todas as acoes criticas (servicos, payouts, exports).
- Banir fallbacks "fake verified" em UI/admin.

### Drift 5 (Bloco 12) — Secrets internos divergentes
**Entrypoints afetados**
- Todas as rotas em `app/api/internal/**`
- Todas as rotas em `app/api/cron/**`

**Plano**
- Escolher um helper canonico (ex.: `lib/security/requireInternalSecret.ts`).
- Refactor de todas as rotas internas/cron para usar o mesmo helper.
- Garantir que UI nunca usa secret (usar server actions/proxy).

---

## Bloco 0 — Contratos de Erro + Envelope + Fail-Closed (Baseline)

### Objetivo
- Unificar envelope de resposta/erro com requestId/correlationId.
- Garantir fail-closed em todos os endpoints criticos.
- Establish baseline de observabilidade.

### Scope exato (paths + UI)
- `app/api/**`
- `middleware.ts`
- `lib/observability/**`, `lib/utils/**`, `lib/validation/**`
- UI: `app/components/checkout/**`, `app/organizacao/**`, `app/admin/**`

### SSOT / Invariantes do blueprint
- I1 SSOT, I6 Idempotencia, I7 Async explicito, I9 Fail-closed
- C-G5 Error Envelope Standard, C-G7 Observability

### Entrypoints end-to-end
**UI pages**
- `app/components/checkout/**`
- `app/organizacao/(dashboard)/**`
- `app/admin/**`

**API routes**
- Todas as rotas em `app/api/**` (com foco nos fluxos P0)

**P0 endpoints (Money & Infra) — inventario de auditoria (paths reais)**
- Payments/checkout: `app/api/payments/intent/route.ts`, `app/api/checkout/status/route.ts`, `app/api/store/checkout/route.ts`, `app/api/store/checkout/prefill/route.ts`, `app/api/servicos/[id]/checkout/route.ts`, `app/api/servicos/[id]/creditos/checkout/route.ts`, `app/api/organizacao/reservas/[id]/checkout/route.ts`, `app/api/padel/pairings/[id]/checkout/route.ts`
- Refunds/disputes: `app/api/admin/payments/refund/route.ts`, `app/api/admin/payments/dispute/route.ts`, `app/api/admin/payments/reprocess/route.ts`, `app/api/admin/refunds/list/route.ts`, `app/api/admin/refunds/retry/route.ts`, `app/api/organizacao/refunds/list/route.ts`
- Payouts: `app/api/organizacao/payouts/status/route.ts`, `app/api/organizacao/payouts/list/route.ts`, `app/api/organizacao/payouts/summary/route.ts`, `app/api/organizacao/payouts/settings/route.ts`, `app/api/organizacao/payouts/connect/route.ts`, `app/api/organizacao/payouts/webhook/route.ts`, `app/api/admin/payouts/list/route.ts`, `app/api/admin/payouts/[id]/route.ts`, `app/api/admin/payouts/[id]/block/route.ts`, `app/api/admin/payouts/[id]/unblock/route.ts`, `app/api/admin/payouts/[id]/cancel/route.ts`, `app/api/admin/payouts/[id]/force-release/route.ts`
- Webhooks: `app/api/stripe/webhook/route.ts`, `app/api/webhooks/stripe/route.ts`
- Internal ops/outbox: `app/api/internal/reconcile/route.ts`, `app/api/internal/reprocess/purchase/route.ts`, `app/api/internal/reprocess/payment-intent/route.ts`, `app/api/internal/reprocess/stripe-event/route.ts`, `app/api/internal/outbox/dlq/route.ts`, `app/api/internal/outbox/replay/route.ts`, `app/api/internal/worker/operations/route.ts`, `app/api/internal/checkout/timeline/route.ts`
- Internal allow/reason: `app/api/internal/checkin/consume/route.ts`
- Cron criticos: `app/api/cron/operations/route.ts`, `app/api/cron/payouts/release/route.ts`

**Jobs/cron/internal**
- `app/api/internal/**`
- `app/api/cron/**`

**Webhooks**
- `app/api/stripe/webhook/route.ts`

**Consumers/outbox processors**
- `domain/outbox/**`
- `domain/ops/**`
- `domain/eventLog/**`

### Checklist de fecho
- [ ] **DECISAO**: envelope C-G5 + extensao `requestId` (contrato HTTP) confirmada.
- [ ] **EXISTE** envelope canonico: `{ ok, requestId, correlationId, errorCode, message, retryable, nextAction?, data? }`.
- [ ] **REMOVER** respostas sem `errorCode`/`correlationId`/`requestId` em endpoints criticos.
- [ ] **WEBHOOKS**: erros de signature/secret invalid/missing retornam `text/plain` com headers `x-orya-request-id` e `x-orya-correlation-id`.
- [ ] **ALLOW/REASON**: endpoints com `allow/reasonCode` usam envelope + `data`.
- [ ] **FAIL-CLOSED**: auth/org context invalido retorna 401/403 com envelope canonico.
- [ ] **AJUSTAR** schema/Prisma se resposta exige campos novos.
- [ ] **IDEMPOTENCIA**: respostas de erro incluem `retryable` e `nextAction`.
- [ ] **LOGS**: requestId/correlationId em logs de erro.

### Criterios de DONE (producao)
- 100% das rotas criticas devolvem envelope canonico.
- Headers `x-orya-request-id` e `x-orya-correlation-id` presentes em todas as respostas HTTP.
- Runbook explica como localizar requestId e recuperar (replay/rollback).
- Em producao, falhas recuperaveis nao ficam sem nextAction.

### Riscos/Drifts conhecidos + mitigacao
- Drift entre rotas antigas/novas → aplicar helper canonico.
- Erros silenciosos sem requestId → padronizar middleware.

### Guardrails (rg/tests/CI)
- `rg -n "NextResponse.json\(\{ ok: false" app/api -S` (verificar shape)
- `npx vitest run tests/access tests/ops`
- CI gate: falha se erro sem `code`/`requestId` em rotas P0.

### Runbooks/Operabilidade
- Runbook: "Erro 4xx/5xx → encontrar requestId → logs → replay/rollback".

---

## Bloco 1 — Payments/Checkout/Ledger/Webhooks/Refunds/Reconciliation/Outbox

### Objetivo
- Checkout idempotente e unico por SSOT financeiro.
- Ledger append-only e deterministico.
- Webhooks, refunds e reconciliation robustos.

### Scope exato (paths + UI)
- API: `app/api/payments/intent/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/checkout/status/route.ts`
- API: `app/api/store/checkout/**`, `app/api/servicos/[id]/checkout/route.ts`, `app/api/servicos/[id]/creditos/checkout/route.ts`, `app/api/organizacao/reservas/[id]/checkout/route.ts`, `app/api/padel/pairings/[id]/checkout/route.ts`
- Internal: `app/api/internal/reconcile/route.ts`, `app/api/internal/reprocess/**`
- Domain: `domain/finance/**`, `domain/outbox/**`, `domain/ops/**`
- UI: `app/components/checkout/**`, `app/eventos/[slug]/page.tsx`, `app/[username]/loja/**`, `app/resale/[id]/page.tsx`, `app/organizacao/(dashboard)/reservas/page.tsx`, `app/[username]/_components/ReservasBookingClient.tsx`

### SSOT / Invariantes do blueprint
- I2 Ledger append-only, I3 Payments state machine, I6 Idempotencia
- Payment+Ledger SSOT; PaymentEvent/SaleSummary = read-model

### Entrypoints end-to-end
**UI pages**
- `app/components/checkout/**` (Step2Pagamento/Step3Sucesso)
- `app/eventos/[slug]/page.tsx`
- `app/[username]/loja/page.tsx`, `app/[username]/loja/carrinho/page.tsx`, `app/[username]/loja/produto/[slug]/page.tsx`
- `app/resale/[id]/page.tsx`
- `app/organizacao/(dashboard)/reservas/page.tsx`

**API routes**
- `/api/payments/intent`
- `/api/stripe/webhook`
- `/api/checkout/status`
- `/api/store/checkout` + `/api/store/checkout/prefill`
- `/api/servicos/[id]/checkout`
- `/api/servicos/[id]/creditos/checkout`
- `/api/organizacao/reservas/[id]/checkout`
- `/api/padel/pairings/[id]/checkout`

**Jobs/cron/internal**
- `/api/internal/reconcile`
- `/api/internal/reprocess/purchase`
- `/api/internal/reprocess/payment-intent`
- `/api/internal/reprocess/stripe-event`

**Webhooks**
- `/api/stripe/webhook`

**Consumers/outbox processors**
- `domain/finance/outbox.ts`
- `domain/finance/readModelConsumer.ts`
- `domain/ops/*` (fulfillment/ledger upserts)

### Checklist de fecho
- [x] **EXISTE** fluxo canonico de PI: `/api/payments/intent` + `domain/finance/checkout.ts`.
- [x] **REMOVER** criacao direta de PI nos endpoints paralelos (store/servicos/reservas).
- [x] **PR1** entrypoints P0 usam `ensurePaymentIntent` + `createCheckout` e `purchaseId` deterministico (sem `Date.now`).
- [x] **FAIL-CLOSED**: Stripe connect nao pronto → 4xx com code.
- [x] **AJUSTAR** schema/Prisma para alinhar PaymentEvent/Payment/SaleSummary.
- [x] **IDEMPOTENCIA**: dedupeKey baseada em `purchaseId` (checkoutKey).
- [x] **ERROS** com envelope canonico + requestId.
- [x] **LOGS**: correlacao `paymentIntentId` + `purchaseId`.

### Criterios de DONE (producao)
- Todos os entrypoints criam PI via fluxo canonico.
- Se falhar em producao: runbook permite reprocess/replay sem duplos charges.
- Reconcile/rollback documentado com comandos internos.

### Riscos/Drifts conhecidos + mitigacao
- Drift de idempotencia entre fluxos → consolidar em helper unico.
- Read-models usados como SSOT → bloquear writes fora do consumer.

### Guardrails (rg/tests/CI)
- `rg -n "stripe\.paymentIntents\.create" app lib domain -S -g '!domain/finance/gateway/**'`
- `rg -n "ledgerEntry\.(update|delete)" app lib domain -S`
- `rg -n "purchaseId\s*=.*Date\.now\(" app/api/servicos/[id]/checkout/route.ts app/api/servicos/[id]/creditos/checkout/route.ts app/api/organizacao/reservas/[id]/checkout/route.ts app/api/store/checkout/route.ts domain/padelSecondCharge.ts -S`
- `npx vitest run tests/finance tests/outbox tests/ops tests/entitlements`
- CI gate: falha se PI criado fora do gateway.

### Runbooks/Operabilidade
- Runbook: "Checkout 409/500", "Reprocess PI", "Reconcile Stripe Event".

---

## Bloco 2 — Outbox/Workers/Operations

### Objetivo
- Outbox winner-only, sem double-publish.
- Workers idempotentes, com replay seguro.
- Crash recovery fechado.

### Scope exato (paths + UI)
- `domain/outbox/**`, `domain/ops/**`, `domain/eventLog/**`
- `app/api/internal/worker/operations/route.ts`
- `app/api/internal/outbox/replay/route.ts`, `app/api/internal/outbox/dlq/route.ts`
- `app/api/internal/reprocess/**`
- `app/api/cron/operations/route.ts`

### SSOT / Invariantes do blueprint
- I7 Async explicito, I6 Idempotencia
- Outbox append-only; publishedAt apenas em sucesso

### Entrypoints end-to-end
**UI pages**
- N/A (operacional)

**API routes**
- `/api/internal/worker/operations`
- `/api/internal/outbox/replay`
- `/api/internal/outbox/dlq`
- `/api/internal/reprocess/*`

**Jobs/cron/internal**
- `/api/cron/operations`

**Webhooks**
- N/A

**Consumers/outbox processors**
- `domain/outbox/producer.ts`
- `domain/outbox/publisher.ts`
- `domain/opsFeed/consumer.ts`

### Checklist de fecho
- [ ] **EXISTE** claim/lock explicito (winner-only) com reconciliacao.
- [ ] **REMOVER** processamento concorrente sem dedupe.
- [ ] **FAIL-CLOSED**: worker sem secret nao executa.
- [ ] **AJUSTAR** schema se precisar de deadLetteredAt/backoff.
- [ ] **IDEMPOTENCIA**: dedupeKey obrigatoria em todos os eventos.
- [ ] **ERROS** canonicos em replay/dlq.
- [ ] **LOGS** com correlationId.

### Criterios de DONE (producao)
- Double-publish = 0 (provado por testes + logs).
- Runbook permite replay seguro apos crash.

### Riscos/Drifts conhecidos + mitigacao
- Concurrency sem lock → adotar SKIP LOCKED/claim seguro.

### Guardrails (rg/tests/CI)
- `rg -n "outbox.*create" app/api -S -g '!domain/outbox/**'`
- `npx vitest run tests/outbox tests/ops`
- CI gate: falha se eventos forem processados fora do consumer.

### Runbooks/Operabilidade
- Runbook: "DLQ triage", "Replay seguro", "Worker crash recovery".

---

## Bloco 3 — Email Oficial da Organizacao (Normalizacao + Verificacao + Enforcement)

### Objetivo
- Email oficial unico, normalizado e verificado em toda a app.
- Enforcement consistente em acoes criticas.
- UX sem drift (refetch imediato).

### Scope exato (paths + UI)
- DB: `prisma/schema.prisma` (Organization.official_email, Organization.official_email_verified_at, organization_official_email_requests)
- API: `app/api/organizacao/organizations/settings/official-email/route.ts`
- API: `app/api/organizacao/organizations/settings/official-email/confirm/route.ts`
- API: `app/api/admin/organizacoes/verify-platform-email/route.ts`
- API: `app/api/admin/config/platform-email/route.ts`
- API (enforcement): `app/api/organizacao/me/route.ts`, `app/api/organizacao/servicos/route.ts`, `app/api/organizacao/promo/route.ts`, `app/api/organizacao/loja/route.ts`, `app/api/organizacao/policies/route.ts`, `app/api/organizacao/checkin/route.ts`, `app/api/organizacao/finance/exports/fees/route.ts`, `app/api/organizacao/finance/exports/ledger/route.ts`, `app/api/organizacao/finance/exports/payouts/route.ts`, `app/api/organizacao/payouts/connect/route.ts`, `app/api/organizacao/payouts/settings/route.ts`, `app/api/organizacao/organizations/members/route.ts`, `app/api/organizacao/organizations/members/invites/route.ts`, `app/api/organizacao/events/update/route.ts`, `app/api/organizacao/events/[id]/invites/route.ts`, `app/api/organizacao/events/[id]/invite-token/route.ts`, `app/api/organizacao/tournaments/**`
- Libs: `lib/organizationOfficialEmail.ts`, `lib/organizationWriteAccess.ts`, `lib/organizationContext.ts`, `lib/organizationPayments.ts`, `lib/loja/access.ts`, `lib/reservas/access.ts`, `lib/crm/campaignSend.ts`, `lib/payments/releaseWorker.ts`, `lib/platformSettings.ts`, `lib/http/requestContext.ts`
- UI: `app/organizacao/(dashboard)/settings/page.tsx`, `app/organizacao/(dashboard)/settings/verify/page.tsx`, `app/organizacao/OrganizationTopBar.tsx`, `app/organizacao/OrganizationDashboardShell.tsx`, `app/organizacao/DashboardClient.tsx`, `app/organizacao/(dashboard)/eventos/novo/page.tsx`, `app/admin/organizacoes/page.tsx`, `app/[username]/page.tsx`

### SSOT / Invariantes do blueprint
- I1 SSOT, I9 Fail-closed
- `officialEmail` + `officialEmailVerifiedAt` canonicamente verificado

### Entrypoints end-to-end
**UI pages**
- `app/organizacao/(dashboard)/settings/page.tsx`
- `app/organizacao/(dashboard)/settings/verify/page.tsx`
- `app/organizacao/OrganizationTopBar.tsx`
- `app/organizacao/OrganizationDashboardShell.tsx`
- `app/organizacao/DashboardClient.tsx`
- `app/organizacao/(dashboard)/eventos/novo/page.tsx`
- `app/admin/organizacoes/page.tsx`
- `app/[username]/page.tsx`

**API routes**
- `/api/organizacao/organizations/settings/official-email`
- `/api/organizacao/organizations/settings/official-email/confirm`
- `/api/admin/organizacoes/verify-platform-email`
- `/api/organizacao/me`
- `/api/organizacao/servicos`
- `/api/organizacao/promo`
- `/api/organizacao/loja`
- `/api/organizacao/policies`
- `/api/organizacao/checkin`
- `/api/organizacao/finance/exports/fees`
- `/api/organizacao/finance/exports/ledger`
- `/api/organizacao/finance/exports/payouts`
- `/api/organizacao/payouts/connect`
- `/api/organizacao/payouts/settings`
- `/api/organizacao/organizations/members`
- `/api/organizacao/organizations/members/invites`
- `/api/organizacao/events/update`
- `/api/organizacao/events/[id]/invites`
- `/api/organizacao/events/[id]/invite-token`
- `/api/organizacao/tournaments/*`

**Jobs/cron/internal**
- N/A

**Webhooks**
- N/A

**Consumers/outbox processors**
- N/A

### Checklist de fecho
- [x] **NORMALIZACAO** unica (NFKC + lowercase + trim) via `lib/organizationOfficialEmail.ts`.
- [x] **REMOVER** fallbacks/hacks em UI/admin (ex: `app/organizacao/(dashboard)/settings/page.tsx`, `app/admin/organizacoes/page.tsx`, `app/[username]/page.tsx`).
- [x] **FAIL-CLOSED**: acoes criticas bloqueadas sem `officialEmailVerifiedAt` (via `ensureOrganizationEmailVerified`/`requireOfficialEmailVerified`).
- [x] **ALLOWLIST** minima sem gate (org create/switch/become, webhooks, setup email oficial).
- [x] **PLATFORM EMAIL** SSOT em `platform_settings` + helper `getPlatformOfficialEmail()` + endpoints admin config.
- [x] **REQUEST/CONFIRM**: resposta 200 ok com `status:"VERIFIED"` quando já verificado; requestId/correlationId em payload+headers.
- [x] **LOGS** sem PII (usar `maskEmailForLog`).
- [x] **TESTES/GATES**: `npx vitest run tests/access tests/rbac tests/ops` + rg guardrails.

### Criterios de DONE (producao)
- Nenhuma pagina mostra "nao verificado" quando esta verificado.
- Se falhar, runbook de reenvio/confirmacao recupera em minutos.

### Riscos/Drifts conhecidos + mitigacao
- Divergencia UI/API → alinhar org context e refetch.

### Guardrails (rg/tests/CI)
- `rg -n "contactEmailFromAccount|new Date\\(\\)\\.toISOString\\(\\)" app -S`
- `rg -n "\\.toLowerCase\\(\\)|\\.trim\\(\\)" app lib domain -S` (apenas onde nao e email oficial)
- `rg -n "officialEmailVerifiedAt" app lib domain -S`
- `npx vitest run tests/access tests/rbac tests/ops`
- CI gate: falha se endpoint critico nao valida email verificado.

### Runbooks/Operabilidade
- Runbook: "Enviar verificacao", "Confirmar/Revogar", "Revalidar".

---

## Bloco 4 — Admin Org Control Center + Ops Feed

### Objetivo
- Admin console operavel sem legacy stats.
- Acoes admin auditaveis e resilientes.
- Ops Feed como fonte unica de operacoes.

### Scope exato (paths + UI)
- UI: `app/admin/**`, `app/admin/organizacoes/page.tsx`
- API: `app/api/admin/**`
- API ops: `app/api/internal/ops/**`
- Domain: `domain/opsFeed/**`, `domain/eventLog/**`

### SSOT / Invariantes do blueprint
- I1 SSOT, I7 Observability, I9 Fail-closed
- EventLog como fonte unica para Ops Feed

### Entrypoints end-to-end
**UI pages**
- `app/admin/organizacoes/page.tsx`
- `app/admin/page.tsx`

**API routes**
- `/api/admin/organizacoes/list`
- `/api/admin/organizacoes/update-status`
- `/api/admin/organizacoes/update-payments-mode`
- `/api/admin/organizacoes/verify-platform-email`
- `/api/admin/payments/*`, `/api/admin/payouts/*`, `/api/admin/refunds/*`

**Jobs/cron/internal**
- `/api/internal/ops/*`

**Webhooks**
- N/A

**Consumers/outbox processors**
- `domain/opsFeed/consumer.ts`

### Checklist de fecho
- [ ] **EXISTE** lista de orgs funcional (sem 410/LEGACY_STATS_DISABLED).
- [ ] **REMOVER** dependencia de legacy stats.
- [ ] **FAIL-CLOSED**: admin sem role retorna 403 com envelope canonico.
- [ ] **AJUSTAR** schema/queries para usar read-models v9.
- [ ] **IDEMPOTENCIA**: acoes admin com requestId/correlationId.
- [ ] **ERROS** canonicos + requestId no UI.
- [ ] **LOGS** sem payload sensivel.
- [x] **UI** admin para configurar platform email (consome `/api/admin/config/platform-email`).

### Criterios de DONE (producao)
- Admin console operavel end-to-end.
- Se falhar em producao: runbook para regressar a dados minimos e recuperar.

### Riscos/Drifts conhecidos + mitigacao
- UI depende de stats legacy → substituir por ops feed/rollups.

### Guardrails (rg/tests/CI)
- `rg -n "LEGACY_STATS_DISABLED" app/api -S`
- `npx vitest run tests/ops tests/audit`
- CI gate: bloqueia se admin retorna 410.

### Runbooks/Operabilidade
- Runbook: "Admin actions + rollback", "Ops Feed triage".

---

## Bloco 5 — RBAC / Org Context / Members / Owners

### Objetivo
- Zero bypass de RBAC e org context.
- Helpers canonicos usados em todas as rotas sensiveis.

### Scope exato (paths + UI)
- `lib/organizationRbac.ts`, `lib/organizationContext.ts`, `lib/organizationMemberAccess.ts`
- `app/api/organizacao/organizations/**`
- `app/api/organizacao/me/route.ts`
- UI: `app/organizacao/**`

### SSOT / Invariantes do blueprint
- I5 Org Context explicito, I9 Fail-closed

### Entrypoints end-to-end
**UI pages**
- `app/organizacao/(dashboard)/**`

**API routes**
- `/api/organizacao/organizations/members`
- `/api/organizacao/organizations/members/invites`
- `/api/organizacao/organizations/owner/*`
- `/api/organizacao/me`

**Jobs/cron/internal**
- N/A

**Webhooks**
- N/A

**Consumers/outbox processors**
- N/A

### Checklist de fecho
- [ ] **EXISTE** helper unico para RBAC.
- [ ] **REMOVER** checks manuais (ownerId direto, findFirst ad-hoc).
- [ ] **FAIL-CLOSED**: org context invalido → 403.
- [ ] **IDEMPOTENCIA**: owner transfer sem duplicar estado.
- [ ] **ERROS** canonicos + requestId.

### Criterios de DONE (producao)
- `rg` bypass = 0 e testes RBAC verdes.

### Guardrails (rg/tests/CI)
- `rg -n "organizationMember\.findFirst|ownerId\s*=" app lib domain tests -S`
- `npx vitest run tests/rbac tests/access`

### Runbooks/Operabilidade
- Runbook: "RBAC fail-closed + debug".

---

## Bloco 6 — Eventos (Create/Edit/Publish/Invites/Covers/Maps)

### Objetivo
- Eventos completos, sem drift entre UI/API.
- Convites e acesso consistentes com policy v9.
- "Gratuito" derivado por pricingMode + ticket prices (Event.isFree = legacy read-model).

### Scope exato (paths + UI)
- `app/api/organizacao/events/**`
- `app/eventos/**`
- `app/organizacao/(dashboard)/eventos/**`
- `app/descobrir/_lib/discoverData.ts`
- `domain/events/**`, `lib/events.ts`, `lib/eventCover.ts`, `lib/maps/**`
- `scripts/backfill_event_access_policy.ts`

### Entrypoints end-to-end
**UI pages**
- `app/eventos/[slug]/page.tsx`
- `app/organizacao/(dashboard)/eventos/**`

**API routes**
- `/api/organizacao/events/create`
- `/api/organizacao/events/update`
- `/api/organizacao/events/list`
- `/api/organizacao/events/[id]/invites`
- `/api/organizacao/events/[id]/invite-token`
- `/api/organizacao/events/[id]/attendees`

**Consumers/outbox processors**
- `domain/events/**` consumers (quando existirem)

### Checklist de fecho
- [ ] **EXISTE** EventAccessPolicy canonica (create/update) + policyVersionApplied estavel.
- [ ] **INVITES**: inviteToken resolve para eventInviteId (public endpoints) sem tocar payments core.
- [ ] **LEGACY**: flags de acesso legacy removidas de UI/API reads (RG guardrail).
- [ ] **GRATUITO**: deriveIsFreeEvent usado em discover/cards/search; Event.isFree = read-only.
- [ ] **FAIL-CLOSED**: mapas sem creds em PROD → erro explicito.

### DONE criteria (Bloco 6)
- Create/Edit/Publish OK (UI + API).
- Invites (token/check) OK com accessGrant/eventInviteId.
- Discover listing OK com deriveIsFreeEvent.
- Check-in resolve policy por policyVersionApplied.
- Covers picker OK.
- Apple Maps token fail-closed OK.

### Guardrails (rg/tests/CI)
- `npm run db:gates:offline`
- `npx vitest run tests/invites tests/access tests/checkin tests/search tests/ops`
- `rg -n "inviteOnly|publicAccessMode|participantAccessMode|publicTicketTypeIds|Event\\.isFree" app -S`
- `rg -n "\\.isFree\\b" app domain -S`
- (Se tocar em searchIndex) `npx vitest run tests/searchIndex`

### Runbooks/Operabilidade
- Runbook: "Event publish/rollback".
- Backfill policy (obrigatorio antes de deploy):
  - Dry-run: `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts --dry-run --limit=100`
  - Execucao: `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts`
  - Esperado: output com contagem por mode/source + warnings de default/restricoes.

---

## Bloco 7 — Reservas / Agenda / Servicos / Softblocks

### Objetivo
- Agenda deterministica com prioridades.
- Reservas e servicos consistentes.

### Scope exato (paths + UI)
- `domain/agenda/**`, `domain/softBlocks/**`
- `app/api/organizacao/reservas/**`, `app/api/servicos/**`, `app/api/me/reservas/**`
- UI: `app/[username]/_components/ReservasBookingClient.tsx`

### Entrypoints end-to-end
**API routes**
- `/api/organizacao/reservas/*`
- `/api/servicos/*`

**Consumers/outbox processors**
- `domain/agendaReadModel/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/agenda tests/outbox tests/ops`

### PR1 — BookingConfirmationSnapshot v9 (DONE)
- Snapshot imutavel e versionado persistido no momento de confirmar.
- SSOT: `lib/reservas/confirmationSnapshot.ts`
- Pontos de confirmacao: `lib/reservas/confirmBooking.ts`, `lib/operations/fulfillServiceBooking.ts`

### PR2 — Cancel/Refund/No-Show por snapshot + backfill (DONE)
- Cancelamento e no-show leem sempre `booking.confirmationSnapshot` (fail closed se faltar).
- Refund calcula por snapshot (policy + pricing), nunca por policy live.
- Entrypoints fechados:
  - `app/api/me/reservas/[id]/cancel/route.ts`
  - `app/api/organizacao/reservas/[id]/cancel/route.ts`
  - `app/api/organizacao/reservas/[id]/no-show/route.ts`
- Snapshot timezone exposto para representacao:
  - `app/api/me/reservas/route.ts`
- Backfill dedicado:
  - `scripts/backfill_booking_confirmation_snapshot.ts`
  - SSOT helper: `lib/reservas/backfillConfirmationSnapshot.ts`

### Backfill obrigatorio antes de deploy (PR2)
- Dry-run (recomendado primeiro):
  - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --dry-run --limit=200`
- Execucao limitada (iterar por lotes):
  - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_booking_confirmation_snapshot.ts --limit=200`
- Esperado:
  - Contagens por status, `updated`, `skipped`, e warnings para snapshots nao resolvidos.

---

## Bloco 8 — Padel + Torneios

### Scope exato (paths + UI)
- `app/api/padel/**`, `app/api/organizacao/tournaments/**`
- `domain/padel/**`, `domain/tournaments/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/padel tests/tournaments tests/outbox`

---

## Bloco 9 — Loja / Tickets / Check-in / Entitlements

### Scope exato (paths + UI)
- `app/api/store/**`, `app/api/tickets/**`, `app/api/checkin/**`, `app/api/organizacao/checkin/**`
- `domain/entitlements/**`
- UI: `app/[username]/loja/**`, `app/me/loja/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/entitlements tests/checkin tests/finance`

---

## Bloco 10 — Users / Sessao / Perfil / Privacidade / Consentimentos / Notifs

### Scope exato (paths + UI)
- `app/api/me/**`, `domain/location/**`, `domain/notifications/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/location tests/notifications tests/access`

---

## Bloco 11 — Search / Discover / SearchIndex / Analytics / CRM

### Scope exato (paths + UI)
- `app/api/explorar/list/route.ts`
- `domain/search/**`, `domain/searchIndex/**`, `domain/analytics/**`
- `app/api/internal/analytics/rollup/route.ts`
- `app/api/internal/crm/**`, `app/api/cron/crm/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/search tests/searchIndex tests/analytics`

---

## Bloco 12 — Cron / Jobs / Internal Routes + Secrets

### Scope exato (paths + UI)
- `app/api/cron/**`
- `app/api/internal/**`

### Guardrails (rg/tests/CI)
- `rg -n "X-ORYA-CRON-SECRET" app/api/internal app/api/cron -S`
- `npx vitest run tests/ops`

---

## Bloco 13 — Observabilidade + Runbooks + DLQ/Replay + SLOs

### Scope exato (paths + UI)
- `lib/observability/**`, `domain/opsFeed/**`
- `app/api/internal/ops/**`, `app/api/internal/outbox/*`
- `docs/runbooks/**`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/ops tests/audit`

---

## Bloco 14 — Go-Live (CI Gates + Env + AWS/Supabase + App Store)

### Scope exato (paths + UI)
- `docs/v9_ssot_registry.md`, `docs/v10_execution_checklist.md`, `docs/orya_blueprint_v9_final.md`, `docs/runbooks/**`
- `lib/env.ts`, `next.config.ts`, `fly.worker.toml`, `Dockerfile.worker`

### Guardrails (rg/tests/CI)
- `npx vitest run tests/apple tests/maps tests/push`

---

## Repo-wide audit checklist
- [ ] Checkout/Payments (entrypoints + webhooks + idempotencia)
- [ ] Org settings/email (normalizacao + verificado)
- [ ] Admin control center (sem legacy stats)
- [ ] Members/RBAC/Owners (rg bypass = 0)
- [ ] Outbox/Workers (winner-only + replay)
- [ ] Eventos (create/edit/publish/invites/covers/maps)
- [ ] Reservas/Agenda/Servicos/Softblocks
- [ ] Padel/Torneios
- [ ] Loja/Tickets/Check-in/Entitlements
- [ ] Users/Sessao/Privacidade/Consentimentos
- [ ] Search/Discover/Analytics/CRM
- [ ] Cron/Internal routes + secrets
- [ ] Observabilidade/Runbooks
- [ ] Go-live (env sanity + App Store)
