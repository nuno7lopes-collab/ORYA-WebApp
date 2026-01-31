# v10 Execution Checklist (FINAL) — ORYA

Atualizado: 2026-01-30
Fonte de verdade: `docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md` + `docs/orya_blueprint_v9_final.md` + `docs/v9_ssot_registry.md` + `docs/v9_close_plan.md` + `docs/v9_close_checklist.md` + `docs/envs_required.md`
Legenda estado: DONE | PARTIAL | TODO | N/A

---

## Auditoria (primeiro sweep)
- `app/api/**/route.ts` usa `withApiEnvelope` ou `respondOk/respondError` (script de varredura sem faltas).
- `app/api/internal/**` + `app/api/cron/**` usam `requireInternalSecret` (script de varredura sem faltas).
- Verificações locais (2026-01-30): `npm run typecheck`, `npm run lint`, `npm run test:coverage` **PASS**.
  - Evidência: `reports/p1_closeout_2026-01-29.md` (secção Tests).

---

## Bloco 0 — Contratos de Erro e Observabilidade

### P0
- [x] Envelope de Resposta Unificado (C-G5, requestId/correlationId em body+headers)
  - Estado real: DONE — rotas críticas usam `withApiEnvelope` ou `respondOk/respondError`; envelope válido em payments/internal/cron/admin.
  - Evidência: `app/api/checkout/status/route.ts:1-240`, `app/api/payments/intent/route.ts:1-2060`, `app/api/stripe/webhook/route.ts:200-245`, `app/api/internal/ops/feed/route.ts:1-80`, `app/api/cron/creditos/expire/route.ts:1-60`, `lib/http/envelope.ts:1-180`.
  - Ação exata: manter padrão em novos endpoints.
  - Risco/Impacto: baixo.

- [x] Fail-Closed & Códigos de Erro (auth/org context)
  - Estado real: DONE — todas as rotas `app/api/internal/**` e `app/api/cron/**` exigem `requireInternalSecret`; admin usa `requireAdmin*`; pagamentos/org gates ativos.
  - Evidência: `app/api/internal/worker/operations/route.ts:60-96` (requireInternalSecret), `app/api/cron/loyalty/expire/route.ts:11-34` (requireInternalSecret), `app/api/admin/payments/refund/route.ts:11-21` (requireAdminUser), `app/api/organizacao/payouts/connect/route.ts:15-80` (auth + official email gate).
  - Ação exata: manter fail-closed em novos endpoints.
  - Risco/Impacto: baixo.

- [x] Ids de Correlação em Logs (requestId/correlationId sempre presentes)
  - Estado real: DONE — logger central com fallback automático e logs críticos migrados para `logInfo/logWarn/logError`.
  - Evidência: `lib/observability/logger.ts:19-41` (fallback default), `app/api/stripe/webhook/route.ts:1-230` (logWebhook*), `app/api/payments/intent/route.ts:1-1960`, `app/api/internal/worker/operations/route.ts:1-610`, `lib/operations/enqueue.ts:1-105`, `app/api/admin/**` (sem console.*).
  - Ação exata: manter disciplina em novos módulos; opcionalmente migrar logs de domínios não críticos.
  - Risco/Impacto: baixo (IDs presentes nos logs P0).

- [x] Checklist C-G5 (subitens do close checklist v9)
  - Estado real: DONE — envelope + text/plain para webhooks confirmados em rotas P0.
  - Evidência: `app/api/stripe/webhook/route.ts:200-245` (respondPlainText), `lib/http/envelope.ts:1-180`, `app/api/checkout/status/route.ts:1-240`, `app/api/internal/worker/operations/route.ts:60-140`.
  - Ação exata: manter revisão em novos endpoints.
  - Risco/Impacto: baixo.

### P1
- [x] Runbook de Erros & Replays (trace via requestId + replay)
  - Estado real: DONE — runbooks consolidados com fluxo requestId → logs → replay + endpoints internos.
  - Evidência: `docs/runbooks/request-id-trace.md:1-60`, `docs/runbooks/DLQ_replay.md:1-70`, `docs/runbooks/ops-endpoints.md:1-40`.
  - Ação exata: manter runbooks atualizados quando houver novos endpoints.
  - Risco/Impacto: baixo (documentação operacional completa).

---

## Bloco 1 — Pagamentos, Checkout e Ledger

### P0
- [x] Revisão de Fluxos Legacy de PaymentIntent (tudo converge para /api/payments/intent)
  - Estado real: DONE — apenas `stripeGateway` cria PI; fluxos usam `ensurePaymentIntent` ou `/api/payments/intent` (SSOT).
  - Evidência: `domain/finance/gateway/stripeGateway.ts:28-39`, `domain/finance/paymentIntent.ts:67-140`, `app/api/servicos/[id]/checkout/route.ts:245-276`, `app/api/store/checkout/route.ts:788-842`, `app/api/organizacao/reservas/[id]/checkout/route.ts:242-280`, `app/api/payments/intent/route.ts:1940-2060`.
  - Ação exata: manter gate `stripeGateway` como único criador de PI.
  - Risco/Impacto: baixo.

- [x] Idempotência e Determinismo (idempotencyKey por purchaseId)
  - Estado real: DONE — `checkoutKey(purchaseId)` aplicado nos fluxos P0; `createCheckout` valida snapshot e evita drift.
  - Evidência: `lib/stripe/idempotency.ts:8-18`, `domain/finance/paymentIntent.ts:70-140`, `app/api/payments/intent/route.ts:1460-1525`, `lib/operations/fulfillPaid.ts:85-110`.
  - Ação exata: manter `checkoutKey` como chave canônica.
  - Risco/Impacto: baixo.

- [x] Webhooks Stripe e Reconciliação
  - Estado real: DONE — webhook + reconciliação + sweep ativos; E2E validado.
  - Evidência: `app/api/stripe/webhook/route.ts:200-980`, `domain/finance/reconciliation.ts:39-140`, `domain/finance/reconciliationSweep.ts:1-80`, `reports/e2e_p0_2026-01-29.md`.
  - Ação exata: monitorar falhas via ops/health.
  - Risco/Impacto: baixo.

- [x] E2E Checkout → Payment → Entitlement → Check-in (happy + falha com retry)
  - Estado real: DONE — fluxo P0 executado com intent/webhook/status/free_checkout/reconcile/worker/entitlements/check-in e retry observado.
  - Evidência: `reports/e2e_p0_2026-01-29.md` (requestIds/correlationIds + queries DB + retry/backoff), `app/api/payments/intent/route.ts:1401-2006`, `app/api/stripe/webhook/route.ts:186-230`, `app/api/checkout/status/route.ts:1-140`, `app/api/internal/reconcile/route.ts:1-115`, `app/api/internal/worker/operations/route.ts:320-610`, `app/api/internal/checkin/consume/route.ts:1-210`.
  - Ação exata: re-executar o report em staging/prod antes do go-live final.
  - Risco/Impacto: baixo (evidência real capturada).

- [x] Ledger Append-Only (sem update/delete de entradas)
  - Estado real: DONE — apenas `create/createMany` para entradas e reconciliações; ajustes são novas entradas.
  - Evidência: `domain/finance/checkout.ts:449-492`, `domain/finance/reconciliation.ts:56-130`, `domain/finance/reconciliationTrigger.ts:1-120`.
  - Ação exata: manter guardrails (sem update/delete).
  - Risco/Impacto: baixo.

### P1
- [x] Refunds/Chargebacks Workflow (fim-a-fim)
  - Estado real: DONE — refunds/chargebacks atualizam Payment/Entitlements + ledger append-only; dispute.closed processa WON/LOST.
  - Evidência: `domain/finance/ledgerAdjustments.ts:1-180`, `lib/refunds/refundService.ts:90-150`, `app/api/stripe/webhook/route.ts:2285-2350`, `domain/finance/outbox.ts:630-690`, `app/api/internal/worker/operations/route.ts:626-720`, `tests/finance/refundService.test.ts:1-140`.
  - Ação exata: revalidar em staging com Stripe real antes de go-live.
  - Risco/Impacto: baixo (coberto por ledger + tests).

- [x] Compras Gratuitas (Free Checkout)
  - Estado real: DONE — payment_event free termina em OK após UPSERT_LEDGER_FROM_PI_FREE; sem estado pendente.
  - Evidência: `app/api/internal/worker/operations/route.ts:1040-1090`, `domain/finance/outbox.ts:700-780`.
  - Ação exata: monitorar métricas de retry/outbox.
  - Risco/Impacto: baixo.

---

## Bloco 2 — Outbox, Workers e Execução Assíncrona

### P0
- [x] Lock Otimista no Outbox (winner-only/claim)
  - Estado real: DONE — claim winner-only + stale recovery implementado e testado; migração incluída.
  - Evidência: `domain/outbox/publisher.ts:21-120` (claimed_at + stale), `tests/outbox/publisher.test.ts:7-140`, `prisma/migrations/20260129160535_outbox_dedupe_claim/migration.sql:1-17`.
  - Ação exata: aplicar migração em deploy.
  - Risco/Impacto: baixo após migração.

- [x] PublishedAt só em Sucesso
  - Estado real: DONE — `publishedAt` apenas após sucesso no worker; publisher nunca marca.
  - Evidência: `app/api/internal/worker/operations/route.ts:445-585`, `domain/outbox/publisher.ts:83-176`, `tests/outbox/publisher.test.ts:31-90`.
  - Ação exata: manter monitorização de falhas e DLQ.
  - Risco/Impacto: baixo (publishedAt só após sucesso).

- [x] Dedupe e Idempotência (dedupeKey obrigatório em eventos)
  - Estado real: DONE — dedupeKey obrigatório no producer + helper canônico; unique index em migração.
  - Evidência: `domain/outbox/dedupe.ts:1-16`, `domain/outbox/producer.ts:8-32`, `app/api/stripe/webhook/route.ts:186-2180`, `domain/finance/checkout.ts:690-726`, `prisma/migrations/20260129160535_outbox_dedupe_claim/migration.sql:8-17`.
  - Ação exata: monitorar colisões em produção.
  - Risco/Impacto: baixo.

### P1
- [x] DLQ e Replay (endpoints + erros canônicos)
  - Estado real: DONE — endpoints + runbook + testes de DLQ/replay.
  - Evidência: `app/api/internal/outbox/dlq/route.ts:1-72`, `app/api/internal/outbox/replay/route.ts:1-63`, `docs/runbooks/outbox-dlq.md:1-34`, `tests/outbox/dlqEndpoints.test.ts:1-90` (OK 2026-01-29).
  - Ação exata: manter runbook e automatizar verificação em CI.
  - Risco/Impacto: baixo (replay validado).

### P2
- [x] Batching e Performance
  - Estado real: DONE — batch configurável + fairness por eventType + logs por batch; sem tight loop em vazio.
  - Evidência: `domain/outbox/publisher.ts:1-220` (batch claim + fairness), `domain/outbox/publisher.ts:221-360` (batch stats/logs), `tests/outbox/publisher.test.ts:1-230` (batching/fairness/stale), `tests/outbox/loyaltyOutbox.test.ts:1-200` (retry/dead-letter), `prisma/migrations/20260130192015_outbox_created_at_idx/migration.sql:1-1`, `reports/block2_p2_outbox_perf_closeout_2026-01-30.md`, commits `96b577f` + `45cfbe5`, tests `npx vitest run tests/outbox` (OK 2026-01-30).
  - Ação exata: ajustar `OUTBOX_PUBLISH_BATCH_SIZE`/`OUTBOX_PUBLISH_LOOKAHEAD_MULTIPLIER` conforme carga.
  - Risco/Impacto: baixo (throughput consistente).

---

## Bloco 3 — Email Oficial da Organização

### P0
- [x] Enforcement em Todas Ações Críticas
  - Estado real: DONE — gates de email oficial aplicados em ações críticas (eventos, payouts, exports, torneios).
  - Evidência: `lib/organizationWriteAccess.ts:33-126`, `app/api/organizacao/events/create/route.ts:10-90`, `app/api/organizacao/payouts/connect/route.ts:14-70`, `app/api/organizacao/finance/exports/ledger/route.ts:12-80`, `app/api/organizacao/tournaments/[id]/route.ts:10-70`.
  - Ação exata: manter gate em novas rotas de escrita.
  - Risco/Impacto: baixo.

- [x] Normalização e Comparação (NFKC + lowercase)
  - Estado real: DONE — util de normalização centralizado.
  - Evidência: `lib/organizationOfficialEmail.ts:5-27`.
  - Ação exata: manter uso do helper.
  - Risco/Impacto: baixo.

### P1
- [x] Feedback de UI (UX do email oficial)
  - Estado real: DONE — estado e instruções de verificação reforçados na UI de definições.
  - Evidência: `app/organizacao/(dashboard)/settings/page.tsx:300-360`, `app/organizacao/(dashboard)/settings/verify/page.tsx:1-60`.
  - Ação exata: manter textos e CTA alinhados às políticas de email oficial.
  - Risco/Impacto: baixo (UX claro para verificação).

### P2
- [x] Email da Plataforma (Admin)
  - Estado real: DONE — endpoints + UI admin para leitura/atualizacao do email oficial.
  - Evidência: `app/api/admin/config/platform-email/route.ts:1-70`, `app/admin/settings/page.tsx:1-240`, `lib/platformSettings.ts:60-140`.
  - Ação exata: validar email em prod e confirmar envio de comunicacoes.
  - Risco/Impacto: baixo (controle centralizado no admin).

---

## Bloco 4 — Admin Control Center e Estatísticas

### P0
- [x] Substituir Legacy Stats por Dados Reais
  - Estado real: DONE — endpoints de estatísticas ativos e UI aponta para dashboard analítico.
  - Evidência: `app/api/organizacao/estatisticas/overview/route.ts:35-115`, `app/api/organizacao/estatisticas/time-series/route.ts:1-140`, `app/organizacao/estatisticas/page.tsx:1-30`.
  - Ação exata: monitorar estados vazios no dashboard.
  - Risco/Impacto: baixo.

- [x] Lista de Organizações (Admin)
  - Estado real: DONE — rota ativa + UI admin consome dados.
  - Evidência: `app/api/admin/organizacoes/list/route.ts:1-108`, `app/admin/organizacoes/page.tsx:1-120`.
  - Ação exata: adicionar paginação/filters se necessário.
  - Risco/Impacto: baixo.

### P1
- [x] Ops Feed (Admin Dashboard)
  - Estado real: DONE — UI admin mostra feed recente com correlationId e timestamps.
  - Evidência: `app/admin/page.tsx:140-260`, `app/api/internal/ops/feed/route.ts:1-78`.
  - Ação exata: expandir filtros/paginação se necessário.
  - Risco/Impacto: baixo (visibilidade operacional disponível).

### P2
- [x] Melhorias Futuras (Admin)
  - Estado real: DONE — paginação/filtros básicos + UI resiliente (loading/empty/error) no admin de organizações.
  - Evidência: `app/api/admin/organizacoes/list/route.ts:1-190`, `app/api/admin/organizacoes/event-log/route.ts:1-150`, `app/admin/organizacoes/page.tsx:330-1520`, `tests/admin/organizationsListRoute.test.ts:1-120`, `tests/admin/organizationsEventLogRoute.test.ts:1-120`, `reports/block4_admin_p2_closeout_2026-01-30.md`, commit `fd46f46`, tests `npx vitest run tests/admin` (OK 2026-01-30).
  - Ação exata: manter cursor pagination e filtros no admin (org list + event log).
  - Risco/Impacto: baixo (admin mais resiliente e escalável).

---

## Bloco 5 — RBAC e Contexto de Organização

### P0
- [x] Helper Único de RBAC
  - Estado real: DONE — RBAC centralizado em helpers e aplicado nas rotas críticas de organização.
  - Evidência: `lib/organizationMemberAccess.ts:24-140`, `lib/organizationRbac.ts:1-220`, `app/api/organizacao/payouts/summary/route.ts:13-70`, `app/api/organizacao/organizations/members/route.ts:150-210`.
  - Ação exata: manter uso dos helpers (sem checks ad-hoc).
  - Risco/Impacto: baixo.

- [x] Propagação de orgId no Contexto
  - Estado real: DONE — orgId resolvido via helpers e validado com `getActiveOrganizationForUser`.
  - Evidência: `lib/organizationId.ts:83-145`, `lib/organizationContext.ts:128-175`, `app/api/organizacao/loja/overview/route.ts:10-70`.
  - Ação exata: manter fail-closed quando orgId faltar.
  - Risco/Impacto: baixo.

### P1
- [x] Remover Bypass/Hacks
  - Estado real: DONE — guardrails impedem tokens ad-hoc; rotas usam helpers RBAC centrais.
  - Evidência: `tests/ops/rbacGuardrails.test.ts:1-30`, `lib/organizationMemberAccess.ts:1-140`.
  - Ação exata: manter guardrail `rg` em CI e evitar checks ad-hoc.
  - Risco/Impacto: baixo (drift bloqueado por teste).

- [x] Role Packs & Granularidade
  - Estado real: DONE — matriz validada via testes de acesso e role packs.
  - Evidência: `lib/organizationRbac.ts:1-220`, `tests/rbac/rolePacks.test.ts:1-140`, `tests/rbac/accessMatrix.test.ts:1-80`.
  - Ação exata: manter testes ao alterar role packs.
  - Risco/Impacto: baixo (permissoes cobertas por testes).

### P2
- [x] UI de Permissões
  - Estado real: DONE — UI de staff com overrides por modulo + auditoria.
  - Evidência: `app/organizacao/(dashboard)/staff/page.tsx:880-1120`, `app/api/organizacao/organizations/members/permissions/route.ts:1-140`.
  - Ação exata: manter guardrails RBAC e auditoria.
  - Risco/Impacto: baixo (gestao de permissoes operacional).

---

## Bloco 6 — Eventos e Políticas de Acesso

### P0
- [x] Invite Token Flow (end-to-end)
  - Estado real: DONE — geração + validação + consumo de token integrados ao checkout.
  - Evidência: `lib/invites/inviteTokens.ts:1-190`, `app/api/organizacao/events/[id]/invite-token/route.ts:1-190`, `app/api/eventos/[slug]/invite-token/route.ts:1-140`, `domain/finance/checkout.ts:600-690`.
  - Ação exata: manter envelopes e validação.
  - Risco/Impacto: baixo.

- [x] Policy Enforcement em Check-in
  - Estado real: DONE — consumo interno verifica policy + janela de check-in.
  - Evidência: `app/api/internal/checkin/consume/route.ts:90-210`, `lib/checkin/accessPolicy.ts:210-320`.
  - Ação exata: manter reasonCodes canônicos.
  - Risco/Impacto: baixo.

### P1
- [x] UI e Legacy Flags
  - Estado real: DONE — UI usa `accessPolicy` (legacy flags isoladas no resolver).
  - Evidência: `app/organizacao/(dashboard)/eventos/EventEditClient.tsx:230-260`, `lib/events/accessPolicy.ts:90-210`.
  - Ação exata: manter legacy parsing apenas no resolver.
  - Risco/Impacto: baixo (UI alinhada ao policy SSOT).

- [x] Conferir Versões de Policy
  - Estado real: DONE — `policyVersionApplied` aplicado em entitlements + check-in exige versão.
  - Evidência: `domain/finance/outbox.ts:930-1000`, `lib/operations/fulfillPaid.ts:115-140`, `app/api/internal/checkin/consume/route.ts:102-170`.
  - Ação exata: monitorar alterações de policy via event log.
  - Risco/Impacto: baixo (policy version propagada).

### P2
- [x] Itens futuros (maps/legacy/access extras)
  - Estado real: N/A — backlog pós go-live (não afeta fluxo core).
  - Evidência: `docs/v10_blocks_7_11_tracking.md:3-26`.
  - Ação exata: reavaliar após estabilização do go-live.
  - Risco/Impacto: baixo (funcionalidades acessórias fora do MVP).

---

## Bloco 7 — Reservas, Agenda e Serviços

### P0
- [x] Cancelamento/No-show via Snapshot (fail-closed se snapshot faltar)
  - Estado real: DONE — cancelamento (org + user) e no-show falham sem snapshot; cálculo deriva de snapshot.
  - Evidência: `app/api/organizacao/reservas/[id]/cancel/route.ts:156-200`, `app/api/organizacao/reservas/[id]/no-show/route.ts:148-172`, `app/api/me/reservas/[id]/cancel/route.ts:107-156`.
  - Ação exata: manter snapshot como requisito.
  - Risco/Impacto: baixo.

- [x] Backfill de Snapshots — tooling/script pronto
  - Estado real: DONE — script e lib prontos para execução controlada.
  - Evidência: `scripts/backfill_booking_confirmation_snapshot.ts:1-140` (dry-run/limit/batches/checkpoint/verify), `lib/reservas/backfillConfirmationSnapshot.ts:1-200` (idempotente).
  - Ação exata: manter script idempotente com `--dry-run`, `--limit`, `--batch-size`, `--batches`, `--after-id`, `--verify`.
  - Risco/Impacto: baixo (tooling pronto).

- [ ] Backfill de Snapshots — execução em DB real
  - Estado real: BLOCKED — requer `DATABASE_URL`/`DIRECT_URL` (sem envs neste contexto).
  - Evidência: `scripts/backfill_booking_confirmation_snapshot.ts:1-63`, `reports/block7_closeout_2026-01-30.md`.
  - Bloqueio: ausência de DB env local (sem secrets) impede dry-run/execução controlada.
  - Ação exata: executar dry-run `--limit=200` e depois batches controlados quando DB env estiver disponível.
  - Risco/Impacto: alto se não executado antes do go-live (cancel/no-show fail-closed).

### P1
- [x] Preservação de Timezone
  - Estado real: DONE — snapshotTimezone gravado nas reservas e usado em confirm/reschedule.
  - Evidência: `app/api/servicos/[id]/reservar/route.ts:430-460`, `app/api/organizacao/reservas/route.ts:620-640`, `lib/reservas/confirmBooking.ts:160-175`.
  - Ação exata: manter timezone default em org settings.
  - Risco/Impacto: baixo (timezone persistido).

- [x] Agenda Unificada
  - Estado real: DONE — endpoint agenda ativo + UI reservas mantém vista agenda.
  - Evidência: `app/api/organizacao/agenda/route.ts:1-70`, `domain/agendaReadModel/query.ts:1-140`, `app/organizacao/(dashboard)/reservas/page.tsx:1260-1315`.
  - Ação exata: iterar UX dia/semana conforme feedback.
  - Risco/Impacto: baixo (agenda unificada disponível).

### P2
- [x] Melhorias Futuras (Reservas/Serviços)
  - Estado real: N/A — backlog explícito pós go-live (sem impacto no fluxo core).
  - Evidência: `docs/v10_blocks_7_11_tracking.md:3-26`.
  - Ação exata: reavaliar após execução do backfill e feedback de uso.
  - Risco/Impacto: baixo (funcionalidades avançadas fora do MVP).

---

## Bloco 8 — Padel e Torneios

### P0
- [x] Inscrição e Pagamento de Torneio via Event
  - Estado real: DONE — inscrição padel usa Event + checkout SSOT.
  - Evidência: `app/api/padel/pairings/[id]/checkout/route.ts:23-200`, `domain/padelRegistration.ts:1-140`, `domain/finance/fulfillment.ts:188-268` (entitlements PADEL_ENTRY), `app/organizacao/(dashboard)/torneios/[id]/page.tsx:1-40`.
  - Ação exata: manter fluxo integrado a `/api/payments/intent`.
  - Risco/Impacto: baixo.

- [x] Estados de PadelRegistration (UI + API)
  - Estado real: DONE — estados canônicos no domínio + uso em endpoints.
  - Evidência: `domain/padelRegistration.ts:1-220`, `app/api/organizacao/padel/imports/inscritos/route.ts:600-720`.
  - Ação exata: manter mapa de estados único.
  - Risco/Impacto: baixo.

### P1
- [x] Geração de Chaves e Agendamento
  - Estado real: DONE — geração de brackets + auto-scheduling com gates e validações.
  - Evidência: `app/api/organizacao/tournaments/[id]/generate/route.ts:1-210`, `app/api/padel/calendar/auto-schedule/route.ts:1-120`.
  - Ação exata: manter validações de bracketSize e permissões.
  - Risco/Impacto: baixo (fluxo de geração ativo).

- [x] UI Padel Wizard
  - Estado real: DONE — wizard padel disponível no fluxo de criação de eventos.
  - Evidência: `app/organizacao/(dashboard)/eventos/novo/page.tsx:1-160`.
  - Ação exata: recolher feedback pós go-live.
  - Risco/Impacto: baixo (fluxo já em produção lógica).

### P2
- [x] Resultados e Rankings
  - Estado real: DONE — standings/rankings com endpoints + widgets + UI publica.
  - Evidência: `app/api/padel/standings/route.ts:1-140` (withApiEnvelope + logError + gating), `app/api/padel/rankings/route.ts:1-120` (respondOk/respondError + requestId), `app/eventos/[slug]/PadelPublicTablesClient.tsx:90-230`, `app/widgets/padel/standings/StandingsWidgetClient.tsx:1-140`.
  - Ação exata: monitorar consistencia de dados em eventos grandes.
  - Risco/Impacto: baixo (UI e API ativos).

---

## Bloco 9 — Loja, Bilhetes e Check-in

### P0
- [x] Emissão de Tickets & Entitlements (fim-a-fim)
  - Estado real: DONE — emissão via worker + entitlements ativos; E2E validado.
  - Evidência: `app/api/internal/worker/operations/route.ts:860-1045`, `app/api/stripe/webhook/route.ts:760-980`, `reports/e2e_p0_2026-01-29.md`.
  - Ação exata: manter monitorização de fulfillment.
  - Risco/Impacto: baixo.

- [x] Consistência Tickets/Entitlements
  - Estado real: DONE — entitlements vinculados a saleLine/purchaseId; check-in usa entitlement.
  - Evidência: `app/api/internal/worker/operations/route.ts:920-1015`, `app/api/internal/checkin/consume/route.ts:90-210`, `app/api/me/wallet/route.ts:120-220`.
  - Ação exata: manter invariantes.
  - Risco/Impacto: baixo.

### P1
- [x] Ativar/Desativar Módulo Loja
  - Estado real: DONE — gating via `STORE_ENABLED` aplicado em UI + API.
  - Evidência: `lib/storeAccess.ts:1-26`, `app/[username]/loja/page.tsx:90-110`, `app/api/store/checkout/route.ts:80-110`.
  - Ação exata: manter env alinhada ao deploy.
  - Risco/Impacto: baixo (gating centralizado).

- [x] Integridade no Check-in (entitlements)
  - Estado real: DONE — consumo usa status efetivo + policyVersionApplied + QR tokens.
  - Evidência: `app/api/internal/checkin/consume/route.ts:60-200`, `lib/entitlements/status.ts:1-120`.
  - Ação exata: manter map de entitlement types em `resolveCheckinMethodForEntitlement`.
  - Risco/Impacto: baixo (check-in fail-closed).

### P2
- [x] Extras (Revenda/Carteira)
  - Estado real: DONE — revenda + carteira com UI/rotas e estados vazios.
  - Evidência: `app/api/eventos/[slug]/resales/route.ts:1-150` (withApiEnvelope + logError), `app/api/tickets/resale/list/route.ts:1-190` (auth + logError/logWarn), `app/api/tickets/resale/cancel/route.ts:1-130` (auth + logError/logWarn), `app/api/me/wallet/route.ts:1-230` (withApiEnvelope + auth), `app/eventos/[slug]/page.tsx:630-1365`, `app/me/carteira/WalletHubClient.tsx:150-470`, `reports/block9_closeout_2026-01-30.md`.
  - Ação exata: monitorar taxa de conversão e abuso de revenda.
  - Risco/Impacto: baixo (funcionalidades secundárias operacionais).

---

## Bloco 10 — Utilizadores, Sessão e Notificações

### P0
- [x] Consentimentos e Termos
  - Estado real: DONE — gestão de consentimentos via endpoints user/org.
  - Evidência: `app/api/me/consents/route.ts:1-140`, `app/api/organizacao/consentimentos/[userId]/route.ts:180-240`.
  - Ação exata: manter audit trail de consentimentos.
  - Risco/Impacto: baixo.

- [x] Deleção de Conta
  - Estado real: DONE — fluxo de delete + cancelamento disponíveis.
  - Evidência: `app/api/me/settings/delete/route.ts:20-120`, `app/api/me/settings/delete/cancel/route.ts:1-80`.
  - Ação exata: manter limpeza periódica conforme política.
  - Risco/Impacto: baixo.

### P1
- [x] Notificações por Email
  - Estado real: DONE — envio via email outbox/worker com template refund e receipts.
  - Evidência: `app/api/internal/worker/operations/route.ts:200-340`, `lib/emailSender.ts:120-210`, `tests/finance/refundService.test.ts:1-140`.
  - Ação exata: validar deliverability em staging (Resend logs).
  - Risco/Impacto: baixo (outbox + retries).

- [x] Notificações Push
  - Estado real: DONE — integração APNS + outbox consumer testado em vitest.
  - Evidência: `lib/push/apns.ts:1-70`, `domain/notifications/consumer.ts:410-520`, `tests/push/apns.test.ts:1-80`.
  - Ação exata: executar teste com tokens APNS em staging.
  - Risco/Impacto: baixo (cobertura em testes).

### P2
- [x] Melhorias de Perfil
  - Estado real: DONE — settings com visibilidade, notificações e interesses; persistência via API.
  - Evidência: `app/me/settings/page.tsx:40-520`, `app/api/me/settings/save/route.ts:1-150` (withApiEnvelope + auth), `app/api/me/contact-phone/route.ts:1-80`, `reports/block10_closeout_2026-01-30.md`.
  - Ação exata: adicionar métricas de uso de settings.
  - Risco/Impacto: baixo (UX de perfil coberta).

---

## Bloco 11 — Pesquisa, Descoberta e Analytics

### P2
- [x] Busca Global Simples
  - Estado real: DONE — search global via Navbar + explorar com estados vazios/erro.
  - Evidência: `app/components/Navbar.tsx:780-1260`, `app/api/users/search/route.ts:1-140` (limit default + withApiEnvelope + logError), `app/api/organizations/search/route.ts:1-140` (limit default + withApiEnvelope + logError), `app/explorar/_components/ExplorarContent.tsx:880-1320`.
  - Ação exata: monitorar performance de queries em prod.
  - Risco/Impacto: baixo (descoberta funcional).

- [x] Analytics Organizacional
  - Estado real: DONE — dashboard consome overview/time-series + buyers; analytics visiveis na org.
  - Evidência: `app/organizacao/DashboardClient.tsx:840-1040`, `app/api/organizacao/estatisticas/overview/route.ts:1-140`, `app/api/organizacao/estatisticas/time-series/route.ts:1-160`.
  - Ação exata: ajustar metricas conforme feedback.
  - Risco/Impacto: baixo (analytics ativo).

---

## Bloco 12 — Rotas Internas, Cron e Segredos

### P0
- [x] Helper Unificado de Secret
  - Estado real: DONE — helper existe e é usado em rotas internal/cron.
  - Evidência: `lib/security/requireInternalSecret.ts:1-10`, `app/api/internal/worker/operations/route.ts:60-96`, `app/api/cron/operations/route.ts:1-20`.
  - Ação exata: manter uso exclusivo do helper; remover qualquer auth interna divergente.
  - Risco/Impacto: acesso indevido a rotas internas.

- [x] Refatorar Rotas Existentes (internal/cron)
  - Estado real: DONE — todas as rotas internal/cron usam `requireInternalSecret`.
  - Evidência: `scripts/v9_internal_secret_gate.mjs` (OK em 2026-01-29), `rg "requireInternalSecret" app/api/internal app/api/cron` (sem faltas).
  - Ação exata: adicionar guardrail CI para impedir regressão.
  - Risco/Impacto: bypass de secret.

- [x] Segredo não exposto na UI
  - Estado real: DONE — nenhum uso em client code.
  - Evidência: `rg "ORYA_CRON_SECRET|X-ORYA-CRON-SECRET" app lib` (somente server).
  - Ação exata: manter separação server/client.
  - Risco/Impacto: vazamento de segredo.

### P1
- [x] Acesso Cron Externo (documentação)
  - Estado real: DONE — cobertura + instruções para scheduler externo.
  - Evidência: `docs/runbooks/cron-coverage.md:1-40` e `docs/runbooks/cron-coverage.md:36-60`.
  - Ação exata: manter tabela sincronizada com novos jobs.
  - Risco/Impacto: baixo (documentação consolidada).

### P2
- [x] Monitoramento de Cron (health check)
  - Estado real: DONE — heartbeat por job + endpoint interno de coverage.
  - Evidência: `app/api/internal/cron/coverage/route.ts:11-66` (endpoint fail-closed), `lib/cron/heartbeat.ts:23-55` (writer), `app/api/cron/operations/route.ts:22-39` + `app/api/cron/bookings/cleanup/route.ts:110-135` + `app/api/cron/padel/reminders/route.ts:190-205` (success/error por job), `lib/cron/jobs.ts:9-94` (inventário jobs), `prisma/schema.prisma:2079-2094` + `prisma/migrations/20260130155341_cron_heartbeat/migration.sql:1-16` (schema/migração), `docs/runbooks/cron-coverage.md:1-53` (runbook), `reports/p2_closeout_2026-01-30.md`.
  - Ação exata: configurar scheduler externo e monitorar `stale=true`.
  - Risco/Impacto: baixo (detecção de cron parado disponível).

---

## Bloco 13 — Observabilidade, Runbooks e SLOs

### P0
- [x] Configuração de Logs e Erros (Sentry ou equivalente)
  - Estado real: DONE — captura server/client via Sentry SDKs + logger central.
  - Evidência: `lib/observability/logger.ts:6-64`, `app/components/ClientSentryInit.tsx:1-24`, `docs/envs_required.md:6-36`.
  - Ação exata: configurar `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` nos ambientes.
  - Risco/Impacto: baixo.

### P1
- [x] Runbooks por Domínio
  - Estado real: DONE — runbooks por domínio consolidados (payments, check-in, reservas, notificações) + incident/rollback.
  - Evidência: `docs/runbooks/payments-refunds.md:1-60`, `docs/runbooks/checkin.md:1-40`, `docs/runbooks/reservas.md:1-40`, `docs/runbooks/notifications.md:1-40`, `docs/runbooks/payments-incident.md:1-40`, `docs/runbooks/deploy-rollback.md:1-40`, `docs/runbooks/db-migrations.md:1-40`.
  - Ação exata: manter índice atualizado.
  - Risco/Impacto: baixo (runbooks completos).

- [x] Métricas e Alertas
  - Estado real: DONE — health inclui contagens críticas + runbook de métricas/alertas + queries CloudWatch.
  - Evidência: `domain/ops/health.ts:1-50`, `docs/runbooks/metrics-alerts.md:1-60`, `docs/observability/sentry-integration.md:1-40`.
  - Ação exata: criar alarms no provider (CloudWatch/Sentry).
  - Risco/Impacto: baixo (instrumentação mínima).

### P2
- [x] SLO/SLI Definição
  - Estado real: DONE — SLOs documentados com SLIs e fontes de dados.
  - Evidência: `docs/observability/slo_sli.md:1-120`, `domain/ops/slo.ts:1-70`, `docs/runbooks/metrics-alerts.md:13-26`.
  - Ação exata: rever thresholds apos baseline de prod.
  - Risco/Impacto: baixo (objetivos definidos).

---

## Bloco 14 — Preparação de Go-Live: Deploy, Ambientes e Mobile

### P0
- [x] Checklist de Variáveis de Ambiente
  - Estado real: DONE — envs requeridas documentadas + gates de DB.
  - Evidência: `docs/envs_required.md:1-90`, `scripts/db/preflight.js:1-80`, `scripts/check-db-env.js:1-80`.
  - Ação exata: manter inventário atualizado.
  - Risco/Impacto: baixo.

- [x] Configuração de Deploy AWS
  - Estado real: DONE — runbook AWS definido + infra skeleton + workflow CI/CD.
  - Evidência: `docs/release/aws_runbook.md:1-80`, `infra/ecs/orya-ecs-stack.yaml:1-260`, `infra/ecs/route53-acm.yaml:1-40`, `.github/workflows/deploy-ecs.yml:1-90`, `docs/deploy/ci_cd.md:1-60`, `docs/deploy/cost-optimization.md:1-40`, `Dockerfile.worker`.
  - Ação exata: manter runbook alinhado ao infra atual.
  - Risco/Impacto: baixo.

- [x] Execução de Infra (Route53/ACM/Well-known/ECR)
  - Estado real: DONE — hosted zone + ACM + CloudFront/S3 well-known, CodeBuild ECR images, CFN stack e healthcheck OK; SES domínio + inbound/outbound admin@orya.pt configurados.
  - Evidência: `reports/p_infra_2026-01-30.md` (requestIds, ARNs, URLs, outputs), `reports/p_email_2026-01-31.md` (SES inbound + Lambda forwarder + DMARC + Gmail inbound S3 proof).
  - Ação exata: manter pipeline e repetir em cada release.
  - Risco/Impacto: baixo (envio externo bloqueado até SES Production).

- [x] Design System e Consistência
  - Estado real: DONE — design system documentado + componentes UI reutilizáveis.
  - Evidência: `docs/UX (ORYA WebApp).md:1-120`, `components/ui/*`, `app/components/*`.
  - Ação exata: manter padrões globais.
  - Risco/Impacto: baixo.

- [x] Estados de Carregamento e Erro
  - Estado real: DONE — error boundary global + loading/erro nos fluxos core; Stripe lazy-load.
  - Evidência: `app/error.tsx:1-40`, `app/eventos/[slug]/loading.tsx:1-40`, `app/components/checkout/Step2Pagamento.tsx:1290-1435`, `app/components/checkout/StripePaymentSection.tsx:120-180`.
  - Ação exata: manter estados consistentes em novas páginas.
  - Risco/Impacto: baixo.

### P1
- [ ] Testes Finais em Mobile
  - Estado real: BLOCKED — requer device farm/credenciais; scripts prontos.
  - Evidência: `scripts/run-devicefarm.sh:1-40`.
  - Bloqueio adicional: secrets existem mas ainda com placeholders REPLACE_ME para chaves Apple/Stripe/Resend/Sentry e credenciais de device farm.
  - Ação exata: preencher secrets reais e executar suite mobile (checkout, eventos, reservas, wallet).
  - Risco/Impacto: regressões em dispositivos móveis.

- [ ] Acessibilidade (A11y)
  - Estado real: BLOCKED — auditoria WCAG/Lighthouse pendente; scripts prontos.
  - Evidência: `scripts/run-axe.sh:1-20`, `scripts/run-lighthouse.sh:1-20`.
  - Ação exata: executar auditoria (Lighthouse/axe) e corrigir issues.
  - Risco/Impacto: UX e compliance comprometidas.

- [ ] Performance Percebida
  - Estado real: BLOCKED — sem baseline Lighthouse/rum medido; scripts prontos.
  - Evidência: `scripts/run-lighthouse.sh:1-20`.
  - Ação exata: medir LCP/CLS/TTI e aplicar otimizações direcionadas.
  - Risco/Impacto: abandono de checkout.

- [ ] Responsividade e Mobile UX
  - Estado real: BLOCKED — revisão cross-device pendente; scripts prontos.
  - Evidência: `scripts/run-devicefarm.sh:1-40`.
  - Ação exata: validar breakpoints principais e corrigir layout.
  - Risco/Impacto: experiência ruim em mobile.

### P2
- [x] PWA e App Store
  - Estado real: DONE — manifest + meta + ícones base.
  - Evidência: `public/manifest.json:1-30`, `app/layout.tsx:14-30` (manifest/meta/icons), `public/brand/orya-logo-192.png`, `public/brand/orya-logo-512.png`, `public/brand/orya-logo-180.png`, `reports/p2_closeout_2026-01-30.md`.
  - Ação exata: validar comportamento “Add to Home Screen” em iOS/Android.
  - Risco/Impacto: baixo (PWA básico pronto).

- [x] Release Final (checklist)
  - Estado real: DONE — checklist final detalhado e pronto para execucao.
  - Evidência: `docs/runbooks/release-checklist.md:1-90`.
  - Ação exata: executar no go-live e registar evidencias.
  - Risco/Impacto: medio se nao executado.

- [ ] Padrões UX Avançados / Teste de Usabilidade
  - Estado real: N/A — backlog pós go-live (melhoria incremental).
  - Evidência: `docs/v10_blocks_7_11_tracking.md:3-26`.
  - Ação exata: reavaliar com feedback de uso.
  - Risco/Impacto: baixo (UX avançada adiada).
