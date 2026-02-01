# V9 SSOT & Normalization Registry (Done Log)

Catalogo canonico do que e verdade no sistema. Quando um item passa a DONE aqui, vira regra. O Doc 1 deve apontar para este registro.

---

## Bloco 0 — Contratos de Erro + Envelope + Fail-Closed
**SSOTs canonicos**
- Envelope de erro/resposta global conforme C-G5 (errorCode/message/retryable/correlationId).
- Extensao HTTP obrigatoria: `requestId` + `correlationId` em todas as respostas (headers + body).
- Fail-closed para auth/org context em todas as rotas criticas.

**Contratos finais**
- Resposta canonica: `{ ok, requestId, correlationId, errorCode, message, retryable, nextAction?, data?, details? }`.
- Erros com `errorCode` estavel e `requestId`/`correlationId` obrigatorios.

**Normalizacoes obrigatorias**
- `requestId` gerado por request HTTP (ou respeitar `x-request-id`).
- `correlationId` = header `x-correlation-id` quando fornecido; fallback = `requestId`.
- Headers sempre devolvidos: `x-orya-request-id`, `x-orya-correlation-id` (e espelho `x-request-id`, `x-correlation-id`).
- `correlationId` em operacoes async/outbox (C-G5/C-G7) e logado em erros; `requestId` sempre presente em logs.

**Referencias de codigo**
- `middleware.ts` (geracao requestId)
- `lib/http/headers.ts`
- `lib/http/requestContext.ts`
- `lib/http/envelope.ts`
- `lib/observability/**`
- `app/api/**` (uso do envelope)
- `domain/outbox/**`, `domain/eventLog/**` (correlationId)
- `lib/security.ts` (auth fail-closed)

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — Middleware reintroduzido para requestId/correlationId em todas as respostas; `withApiEnvelope` normaliza códigos instáveis (canonical por status) e headers globais garantidos; gates mantêm shape C-G5.

---

## Bloco 1 — Payments/Checkout/Ledger/Webhooks/Refunds/Reconciliation/Outbox
**SSOTs canonicos**
- Payment + Ledger como SSOT financeiro.
- PaymentEvent/SaleSummary como read-models (nao fonte de verdade).
- Outbox/eventLog para side-effects e replay.

**Contratos finais**
- `/api/payments/intent` input canonico: `items[]`, `paymentScenario`, `inviteToken?`, `idempotencyKey?`, `intentFingerprint?`, `guest?`.
- `/api/payments/intent` output canonico: `clientSecret`, `paymentIntentId`, `purchaseId`, `amount`, `currency`, `breakdown`, `requestId`.
- Error codes: `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, `PAYMENT_INTENT_TERMINAL`, `AUTH_REQUIRED`, `USERNAME_REQUIRED`, etc.

**Normalizacoes obrigatorias**
- `/api/payments/intent`: `purchaseId` no formato `pur_<hex32>` (via `lib/checkoutSchemas.ts`) quando o cliente nao envia.
- Entrypoints legados: `purchaseId` deterministico (sem `Date.now`) derivado do `sourceId` com sufixo versionado (`_vN`) ou chave canonica (ex.: `store_order_{id}`, `booking_{id}_vN`, `service_credit_{...}_vN`, `auto_charge:{pairingId}:{attempt}`).
- `currency` em uppercase.
- `idempotencyKey` baseada em `checkoutKey(purchaseId)`.
- `paymentId` = `purchaseId` (SSOT), com `PaymentEvent.purchaseId` alinhado.
- Refunds/Disputes atualizam `Payment.status` + emitem `FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED`.

**Referencias de codigo**
- `app/api/payments/intent/route.ts`
- `app/api/store/checkout/route.ts`
- `app/api/servicos/[id]/checkout/route.ts`
- `app/api/servicos/[id]/creditos/checkout/route.ts`
- `app/api/organizacao/reservas/[id]/checkout/route.ts`
- `domain/finance/paymentIntent.ts`
- `domain/finance/checkout.ts`
- `domain/finance/outbox.ts`
- `domain/padelSecondCharge.ts`
- `app/api/internal/worker/operations/route.ts`
- `app/api/stripe/webhook/route.ts`
- `lib/checkoutSchemas.ts`
- `lib/stripe/idempotency.ts`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-27 — Block 1: canonical PI + idempotency + refunds/disputes status sync + guardrails/tests.
**DONE (data/commit/nota)**: 2026-01-29 — Runbook de reconcile/rollback de pagamentos; legacy intent gate removido de `/api/payments/intent`.

---

## Bloco 2 — Outbox/Workers/Operations
**SSOTs canonicos**
- Outbox append-only com publishedAt apenas em sucesso.
- Worker idempotente e replay seguro.

**Contratos finais**
- Claim/winner rule (TBD): select + lock (SKIP LOCKED ou equivalente).
- DLQ payload minimo + motivo.

**Normalizacoes obrigatorias**
- `dedupeKey` obrigatoria em todos os eventos.
- `correlationId` propagado em ops/consumers.

**Referencias de codigo**
- `domain/outbox/**`
- `app/api/internal/worker/operations/route.ts`
- `app/api/internal/outbox/replay/route.ts`
- `app/api/internal/outbox/dlq/route.ts`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — Claim winner-only com `FOR UPDATE SKIP LOCKED` + `locked_at` no worker; recovery via `/api/internal/reconcile`; runbook de operations publicado.

---

## Bloco 3 — Email Oficial da Organizacao
**SSOTs canonicos**
- `Organization.officialEmail` (`official_email`) + `Organization.officialEmailVerifiedAt` (`official_email_verified_at`) sao a verdade para verificacao.
- `OrganizationOfficialEmailRequest` (`organization_official_email_requests`) e a SSOT de pedidos/token/estado de verificacao.
- `PlatformSetting` key `platform.officialEmail` guarda o email oficial da plataforma (fallback env `PLATFORM_OFFICIAL_EMAIL`).

**Contratos finais**
- Verificado = `officialEmail` normalizado existe **e** `officialEmailVerifiedAt` != null.
- Alterar `officialEmail` limpa `officialEmailVerifiedAt`.
- Update/confirm retornam `status:"VERIFIED"` quando ja verificado (sem erro legacy).
- Erros canonicos de gate: `OFFICIAL_EMAIL_REQUIRED` | `OFFICIAL_EMAIL_NOT_VERIFIED` com `requestId`, `correlationId`, `verifyUrl`, `nextStepUrl`.
- `requestId`/`correlationId` sempre presentes em payload+headers nos endpoints de verificacao.
- Acoes criticas bloqueadas sem email verificado (fail-closed).
- Allowlist minima sem gate (SSOT de excecoes):
  - `app/api/organizacao/organizations/route.ts` — criacao de org (pre-email).
  - `app/api/organizacao/organizations/switch/route.ts` — troca de contexto (no-op de email).
  - `app/api/organizacao/become/route.ts` — onboarding (pre-email).
  - `app/api/organizacao/organizations/settings/official-email/route.ts` — setup do email oficial.
  - `app/api/organizacao/organizations/settings/official-email/confirm/route.ts` — confirmacao do email oficial.
  - `app/api/organizacao/payouts/webhook/route.ts` — webhook com secret gate.
  - `app/api/organizacao/mensagens/broadcast/route.ts` — stub 501 (no-op).

**Normalizacoes obrigatorias**
- `normalizeOfficialEmail` = trim + NFKC + lowercase (ver `lib/organizationOfficialEmail.ts`).
- Guardar **sempre** normalizado (nao existe `officialEmailNormalized`).
- Email valido via regex basico (ver `isValidOfficialEmail`).
- Comparacoes de email oficial devem usar `normalizeOfficialEmail` (sem `toLowerCase`/`trim` ad-hoc).
- `getPlatformOfficialEmail()` le da DB, fallback env, fallback final `admin@orya.pt` (com warning).

**Referencias de codigo**
- `prisma/schema.prisma`
- `lib/organizationOfficialEmail.ts`
- `lib/organizationWriteAccess.ts`
- `lib/platformSettings.ts`
- `lib/http/requestContext.ts`
- `app/api/organizacao/organizations/settings/official-email/route.ts`
- `app/api/organizacao/organizations/settings/official-email/confirm/route.ts`
- `app/api/admin/organizacoes/verify-platform-email/route.ts`
- `app/api/admin/config/platform-email/route.ts`
- `tests/access/officialEmailOrgWriteGuardrails.test.ts`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-27 — Bloco 3 (PR2/PR3)

---

## Bloco 4 — Admin Org Control Center + Ops Feed
**SSOTs canonicos**
- Ops Feed como fonte unica de operacoes (EventLog).
- Admin actions auditaveis com requestId.
- UI admin de platform email: `app/admin/config/platform-email/page.tsx` (consome `/api/admin/config/platform-email`).

**Endpoints admin (platform email)**
- `app/api/admin/config/platform-email/route.ts` (GET/POST).

**Contratos finais**
- Respostas admin com envelope canonico.
- Remocao de legacy stats (sem 410 em producao).

**Normalizacoes obrigatorias**
- Logs sem payload sensivel.
- requestId/correlationId em acoes admin.

**Referencias de codigo**
- `app/api/admin/**`
- `app/admin/**`
- `domain/opsFeed/**`
- `domain/eventLog/**`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — Estatísticas migradas para rollups v9 (org overview + time-series); admin org list expõe contagens/revenue; UI resiliente sem legacy summaries.

---

## Bloco 5 — RBAC / Org Context / Members / Owners
**SSOTs canonicos**
- Org context explicito obrigatorio.
- Helpers canonicos de RBAC.

**Contratos finais**
- rg bypass = 0.

**Normalizacoes obrigatorias**
- orgId sempre propagado pelo contexto.

**Referencias de codigo**
- `lib/organizationRbac.ts`
- `lib/organizationContext.ts`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — Gate `scripts/v9_org_context_gate.mjs` (bypass=0) + org context helpers auditados nas rotas.

---

## Bloco 6 — Eventos
**SSOTs canonicos**
- EventAccessPolicy (policy versionada) = SSOT de acesso.
- Entitlement = prova de acesso (check-in/entrada).
- deriveIsFreeEvent(pricingMode + ticket prices) = SSOT de "gratuito".
- Covers: resolver + library (lib/eventCover.ts + covers manifest).

**InviteToken resolution (SSOT)**
- Entrada: inviteToken (+ opcional email/ticketTypeId).
- Validacao: policy.inviteTokenAllowed + TTL; fail-closed.
- Saida: accessGrant canonico com eventInviteId (scope PUBLIC) + ticketTypeId (se token scoped).
- Endpoints: `app/api/eventos/[slug]/invite-token/route.ts`, `app/api/eventos/[slug]/invites/check/route.ts`.

**Legacy -> Policy mapping (read-only)**
- inviteOnly/publicAccessMode/publicTicketTypeIds => EventAccessPolicy.mode:
  - inviteOnly=true OR publicAccessMode=INVITE OR tickets restritos => INVITE_ONLY.
  - publicAccessMode=OPEN/TICKET sem restricoes => PUBLIC.
  - default fail-closed => UNLISTED.
- Legacy fields sao **read-only**; UI/API nao decide acesso com legacy.

**Invariantes**
- Create cria sempre policy (event nunca sem EventAccessPolicy).
- policyVersionApplied estavel para check-in/tickets.
- Event.isFree nunca usado como fonte de decisao (apenas read-model legacy).
- InviteToken resolution cria/retorna eventInviteId antes de checkout.

**Backfill (obrigatorio antes de deploy)**
- Script: `scripts/backfill_event_access_policy.ts`
- Dry-run: `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts --dry-run --limit=100`
- Execucao: `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts`
- Esperado: contagens por mode/source + warnings (default/restricoes).

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-29 — Deleted test events (slug test-*/qa-*, dry-run validated, backup at `backups/pre_delete_events_2026-01-29.dump`). Deleted IDs list at `reports/deleted_events_2026-01-29.json`.

---

## Bloco 7 — Reservas / Agenda / Servicos / Softblocks
**SSOTs canonicos**
- AgendaItem read-model unico.
- BookingConfirmationSnapshot imutavel como SSOT de policy+pricing no confirm:
  - Builder/parser/refund rules: `lib/reservas/confirmationSnapshot.ts`
  - Persistencia no confirm: `lib/reservas/confirmBooking.ts`, `lib/operations/fulfillServiceBooking.ts`
- Cancel/refund/no-show usam sempre snapshot (fail closed se faltar):
  - `app/api/me/reservas/[id]/cancel/route.ts`
  - `app/api/organizacao/reservas/[id]/cancel/route.ts`
  - `app/api/organizacao/reservas/[id]/no-show/route.ts`
- Backfill obrigatorio antes de deploy para bookings confirmados legacy:
  - Script: `scripts/backfill_booking_confirmation_snapshot.ts`
  - Helper idempotente: `lib/reservas/backfillConfirmationSnapshot.ts`
- Snapshot timezone preservado e exposto para representacao:
  - `app/api/me/reservas/route.ts`

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — Backfill executado (dry-run + exec) sem pendências; logs em `reports/backfill_booking_confirmation_snapshot_2026-02-01.log` e `reports/backfill_booking_confirmation_snapshot_2026-02-01_exec.log`. Script atualizado para respeitar flags de SSL em conexões.

---

## Bloco 8 — Padel + Torneios
**SSOTs canonicos**
- Torneios com eventId obrigatorio.
- CalendarBlock/Availability + EventMatchSlot como agenda única de padel (sem calendário paralelo).
- RuleSetVersion (snapshot) por torneio para congelar regras.
- Address Service como SSOT de moradas para clubes (addressId).
- Lifecycle oficial (Draft/Published/Locked/Live/Completed) + transições auditadas.
- Roles por torneio (árbitro/diretor) e streaming/monitor rico.
- Páginas públicas por jogo + i18n/SEO por match.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — Padel v2 completo: calendário SSOT (CalendarBlock/EventMatchSlot), matchmaking/cron T‑48/T‑24 + waitlist, ruleset versionado, lifecycle/roles, streaming/monitor e páginas públicas por match com i18n.

---

## Bloco 9 — Loja / Tickets / Check-in / Entitlements
**SSOTs canonicos**
- Entitlement como prova de acesso.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — Entitlements emitidos para tickets/padel/booking + loja (STORE_ITEM); revenda rebinda owner/purchaseId; check-in mantém mapping por tipo.

---

## Bloco 10 — Users / Sessao / Perfil / Privacidade / Consentimentos / Notifs
**SSOTs canonicos**
- Consentimentos explicitos.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-01-31 — DSAR ativo (export + tracking + delete/purge), legal hold mínimo registado em purge e runbook com retenção/responsabilidades.

---

## Bloco 11 — Search / Discover / SearchIndex / Analytics / CRM
**SSOTs canonicos**
- Search/discover read-only.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — SearchIndex + discover read-only com CRM/analytics integrados; UI de exploração + search API estável.

---

## Bloco 12 — Cron / Jobs / Internal Routes + Secrets
**SSOTs canonicos**
- Secret unico para rotas internas/cron.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — `requireInternalSecret` aplicado em todas as rotas internal/cron; heartbeat e coverage de cron ativos com runbook.

---

## Bloco 13 — Observabilidade + Runbooks + DLQ/Replay + SLOs
**SSOTs canonicos**
- Runbooks minimos por dominio.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — Runbooks + SLO/SLI publicados, DLQ/replay operacional e métricas/alertas documentados.

---

## Bloco 14 — Go-Live (CI Gates + Env + AWS/Supabase + App Store)
**SSOTs canonicos**
- Release checklist executavel.

**Status**: DONE
**DONE (data/commit/nota)**: 2026-02-01 — Checklist de release + env gates + infra AWS/SES concluídos; A11y/Performance/Mobile audits executados (reports/lighthouse + reports/axe).
