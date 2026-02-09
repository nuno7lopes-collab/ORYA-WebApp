# ORYA SSOT Registry

Atualizado: 2026-02-08

**Index**
- Regra de hierarquia
- P0 endpoints (guardrails)
- Contratos SSOT (C‑G5, Auth, Payments, Outbox, Access, Entitlements, Padel, Invoices, Address, Identity, Search)
- Official Email (SSOT)
- Runtime Validation Checklist
- Runtime Validation Results
- API ↔ UI Coverage
- Observações finais

## Regra de hierarquia (obrigatória)
1) `docs/ssot_registry.md` (este documento) é a fonte normativa final dos contratos SSOT.
2) `docs/blueprint.md` define o contexto e detalhes; em caso de conflito, vence o registry.
3) Qualquer outro documento é subordinado a estes dois.

## Legenda de estado
- **VERIFIED (static)**: verificado por varredura estática no repo.
- **PARTIAL**: contrato está implementado, mas há lacunas conhecidas ou validações runtime pendentes.
- **TODO**: decisão pendente ou implementação ausente.

## Escopo da verificação
Esta verificação é **estática** (código e documentação). Para 100% real, é necessário
revalidar em staging/prod com smoke tests e observabilidade ativa.
Checklist: ver secção "Runtime Validation Checklist" neste documento.

## P0 endpoints (guardrails)
Lista canónica de rotas P0 usada pelos gates de envelope/erro. Atualizar apenas quando uma rota P0
for adicionada/removida (manter este bloco como fonte única).

- `app/api/payments/intent/route.ts`
- `app/api/checkout/status/route.ts`
- `app/api/store/checkout/route.ts`
- `app/api/store/checkout/prefill/route.ts`
- `app/api/servicos/[id]/checkout/route.ts`
- `app/api/servicos/[id]/creditos/checkout/route.ts`
- `app/api/organizacao/reservas/[id]/checkout/route.ts`
- `app/api/padel/pairings/[id]/checkout/route.ts`
- `app/api/admin/payments/refund/route.ts`
- `app/api/admin/payments/dispute/route.ts`
- `app/api/admin/payments/reprocess/route.ts`
- `app/api/admin/refunds/list/route.ts`
- `app/api/admin/refunds/retry/route.ts`
- `app/api/organizacao/refunds/list/route.ts`
- `app/api/organizacao/payouts/status/route.ts`
- `app/api/organizacao/payouts/list/route.ts`
- `app/api/organizacao/payouts/summary/route.ts`
- `app/api/organizacao/payouts/settings/route.ts`
- `app/api/organizacao/payouts/connect/route.ts`
- `app/api/organizacao/payouts/webhook/route.ts`
- `app/api/admin/payouts/list/route.ts`
- `app/api/admin/payouts/[id]/route.ts`
- `app/api/admin/payouts/[id]/block/route.ts`
- `app/api/admin/payouts/[id]/unblock/route.ts`
- `app/api/admin/payouts/[id]/cancel/route.ts`
- `app/api/admin/payouts/[id]/force-release/route.ts`
- `app/api/internal/reconcile/route.ts`
- `app/api/internal/outbox/dlq/route.ts`
- `app/api/internal/outbox/replay/route.ts`
- `app/api/internal/worker/operations/route.ts`
- `app/api/internal/reprocess/purchase/route.ts`
- `app/api/internal/reprocess/payment-intent/route.ts`
- `app/api/internal/reprocess/stripe-event/route.ts`
- `app/api/internal/checkout/timeline/route.ts`
- `app/api/internal/checkin/consume/route.ts`
- `app/api/cron/operations/route.ts`
- `app/api/cron/payouts/release/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/webhooks/stripe/route.ts`

---

## C-G5 — Envelope de Resposta + IDs de Correlação
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Todas as rotas críticas devem responder com envelope canónico.
- `requestId` e `correlationId` devem estar no body e nos headers.
- Erros devem ser fail‑closed e com `errorCode` estável.

**Estado:** VERIFIED (static)
**Evidência:** `lib/http/envelope.ts`, `lib/http/withApiEnvelope.ts`, `lib/api/wrapResponse.ts`.
Varredura local encontrou **0** rotas em `app/api/**/route.ts` sem helper de envelope.

---

## Auth + Fail-Closed + Org Context
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Rotas internas e cron exigem segredo interno.
- Rotas organizacionais exigem contexto de organização explícito.

**Estado:** VERIFIED (static)
**Evidência:** `lib/security.ts`, `lib/organizationContext.ts`, `app/api/internal/**`, `app/api/cron/**`.
Varredura local encontrou **0** rotas internas/cron sem segredo.

---

## Pagamentos + Ledger (SSOT financeiro)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- `Payment` + `LedgerEntry` são a fonte de verdade financeira.
- Checkout único e idempotente converge para `/api/payments/intent`.

**Estado:** VERIFIED (static)
**Evidência:** `domain/finance/paymentIntent.ts`, `domain/finance/checkout.ts`,
`app/api/payments/intent/route.ts`, `app/api/checkout/status/route.ts`.

**Nota:** validação runtime depende de credenciais externas; ver secção "Runtime Validation Checklist" neste documento.
**Nota:** Stripe Connect Standard usa destination charges com `application_fee_amount` + `transfer_data.destination`.
Controlo directo de payouts foi desativado; payouts são geridos pelo Stripe (Standard).

---

## Outbox + Workers (execução assíncrona)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Outbox é o mecanismo canónico para side‑effects.
- Dedupe obrigatório; claim winner‑only; DLQ e replay controlados.

**Estado:** VERIFIED (local)
**Evidência:** `domain/outbox/*`, `app/api/internal/worker/operations/route.ts`,
`app/api/internal/outbox/dlq/route.ts`, `app/api/internal/outbox/replay/route.ts`.

**Runtime local:** ver secção "Runtime Validation Results — Local" neste documento.

**Nota:** em prod há DLQ pendente (3 itens). Ver secção "Runtime Validation Results — Prod" neste documento.

---

## EventAccessPolicy + Check‑in
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- `EventAccessPolicy` é a única fonte de verdade para regras de acesso/check‑in.
- Check‑in sempre valida policy version aplicada.
- **Plataforma:** guest checkout é permitido apenas na WebApp e no site quando `guestCheckoutAllowed=true`.  
  Na app mobile, guest checkout é sempre bloqueado (login obrigatório).
- **Restrição:** `inviteTokenAllowed=true` exige `inviteIdentityMatch=EMAIL|BOTH` (USERNAME não suporta tokens).
- **Integridade:** convites por username só para utilizadores existentes; sem conta → convite por email.

**Estado:** VERIFIED (static)
**Evidência:** `lib/checkin/accessPolicy.ts`, `app/api/organizacao/checkin/route.ts`,
`app/api/internal/checkin/consume/route.ts`.
**Nota:** check-in bloqueia entitlements fora de `ACTIVE` (incl. `PENDING`/`EXPIRED`) e result codes foram normalizados sem `REFUNDED`.

---

## Entitlements (SSOT de acesso)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- `Entitlement` é a fonte de verdade de acesso (tickets/registrations são origem, não prova).
- Refunds/chargebacks atualizam Entitlement (REVOKED/SUSPENDED) e Ticket (REFUNDED/DISPUTED) de forma canónica.

**Estado:** VERIFIED (static)
**Evidência:** `domain/finance/fulfillment.ts`, `app/api/stripe/webhook/route.ts`,
`app/api/internal/worker/operations/route.ts`, `app/api/me/wallet/**`, `prisma/schema.prisma`.
**Nota:** consumo é metadata via check-in (`EntitlementCheckin`/`consumedAt`); estados `USED/REFUNDED` removidos. `TicketStatus.USED` e campo legacy `Ticket.usedAt` removidos; `CheckinResultCode` normalizado sem `REFUNDED`.

---

## C6 — Padel Registration vs Tickets
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Padel nunca cria bilhetes; inscrições geram entitlements canónicos.
- Check‑in usa entitlement (sourceType `PADEL_REGISTRATION`).

**Estado:** VERIFIED (static)
**Evidência:** `app/api/payments/intent/route.ts`, `lib/operations/fulfillPadelRegistration.ts`,
`app/api/stripe/webhook/route.ts`, `app/api/padel/pairings/route.ts`.
**Nota:** linkage legacy a Ticket removida (slots/pareamentos sem `ticketId`); Padel usa inscrições + Entitlements.

---

## Invoices + Payouts (artefactos financeiros)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- `Invoice` e `Payout` registam documentos e saídas financeiras (read‑model canónico).
- Não existe `PendingPayout`/`Transaction`; payout control interno está desligado.
- Faturação do consumidor **não é obrigatória** na ORYA (D9.1).

**Estado:** VERIFIED (static)
**Evidência:** `prisma/schema.prisma`, `lib/store/invoice.ts`,
`app/api/me/store/purchases/[orderId]/invoice/route.ts`, `app/api/store/orders/invoice/route.ts`,
`lib/payments/releaseWorker.ts`.
**Nota:** faturação do consumidor é opcional (D9.1); ledger + exports continuam SSOT para restantes fontes.

---

## Address Service (SSOT de moradas)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Client **pode** usar reverse geocode no device **apenas como hint de UX** (não é SSOT).
- A normalização e persistência **sempre** passam pelo Address Service.
- O hint local nunca substitui `addressId` nem o `canonical` gerado no backend.

**Estado:** VERIFIED (static)
**Evidência:** `lib/address/service.ts`, `app/api/address/*`, `lib/geo/client.ts`, `lib/geo/provider.ts`.

**Nota:** validação runtime em prod **pendente** — configurar `APPLE_MAPS_*` em Secrets Manager e revalidar. Ver secção "Runtime Validation Results — Prod" neste documento.

---

## Localização do Utilizador (coarse, profile)
**Fonte:** `docs/blueprint.md` (addendum)

**Contrato SSOT**
- Consentimento e granularidade são gravados em `profiles.location_*`.
- Não persistimos cidade/região coarse (hints de IP ficam no cliente).
- Endpoint canónico:
  - `POST /api/me/location/consent`

**Estado:** VERIFIED (static)
**Evidência:** `app/api/me/location/consent/route.ts`, `prisma/schema.prisma`.

---

## Identidade + Supabase (SSOT de auth)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Identidade é centralizada (hoje Supabase). `customerIdentityId` é canónico em finanças.

**Estado:** VERIFIED (static)
**Evidência:** `lib/security.ts`, `domain/finance/*`, `apps/mobile/lib/supabase.js`.

**Nota:** fluxos E2E devem ser verificados em staging quando credenciais estiverem disponíveis.

---

## Search/Discover (read‑only na fase inicial)
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- Discover é read‑only na fase inicial (sem mutações críticas fora do backend).

**Estado:** VERIFIED (static)
**Evidência:** uso de endpoints públicos em `apps/mobile/features/discover/api.ts`.

---

---

## Official Email — Política Canónica (SSOT, NORMATIVE)
Data: 27 Jan 2026

### Normalização (canónica)
- `trim()` + `NFKC` + `lowercase`.
- Guardado em `Organization.officialEmail` **já normalizado** (não existe `officialEmailNormalized`).
- Não aplicamos punycode/IDN nesta iteração; se surgirem domínios unicode reais, adicionar conversão para ASCII antes de guardar.

### Verificação
- Email está verificado se **`officialEmail` normalizado** existe **e** `officialEmailVerifiedAt` != null.
- Alterar `officialEmail` limpa automaticamente `officialEmailVerifiedAt`.
- Método atual: **EMAIL_TOKEN** (link com token).
- Audit log guarda apenas **email mascarado** e `verifiedDomain` (sem payload sensível).
- Se já verificado, endpoints devem responder `200 ok` com `status:"VERIFIED"` (sem erro legacy).

### Gates (regra única)
- Se ação exige email verificado:
  - Sem `officialEmail` → `OFFICIAL_EMAIL_REQUIRED`.
  - Com `officialEmail` mas sem `officialEmailVerifiedAt` → `OFFICIAL_EMAIL_NOT_VERIFIED`.

#### Payload canónico (erro)
```json
{
  "ok": false,
  "requestId": "<uuid>",
  "correlationId": "<uuid>",
  "error": "OFFICIAL_EMAIL_NOT_VERIFIED",
  "message": "Email oficial por verificar para esta ação.",
  "email": "foo@bar.com",
  "verifyUrl": "/organizacao/settings?tab=official-email",
  "nextStepUrl": "/organizacao/settings?tab=official-email",
  "reasonCode": "CREATE_SERVICE"
}
```

### Observabilidade
- `requestId` e `correlationId` obrigatorios em payload + headers (`x-orya-request-id`, `x-orya-correlation-id`).
- `correlationId` presente em mutações com side-effects (request/confirm/verify).

### Notas de cache/UI
- Após pedir verificação ou confirmar email, UI deve `mutate()`/`router.refresh()`.
- Shell do dashboard usa `/api/organizacao/me` para revalidar estado.

---

## Runtime Validation Checklist (staging/prod, OPERACIONAL)
Objetivo: transformar **PARTIAL → VERIFIED** no `docs/ssot_registry.md`.

### 1) Ops / Saúde (P0)
- `GET /api/internal/ops/health` com `X-ORYA-CRON-SECRET`
- `GET /api/internal/ops/dashboard` com `X-ORYA-CRON-SECRET`
- `GET /api/internal/ops/slo` com `X-ORYA-CRON-SECRET`
- DLQ: `GET /api/internal/outbox/dlq?limit=50` (sem crescimento)

### 2) Payments + Checkout (P0)
- Criar checkout via `/api/payments/intent` e concluir pagamento real (Stripe test/prod)
- Validar `Payment` + `LedgerEntry` criados corretamente
- Validar `/api/checkout/status` retorna sucesso e estado consistente

### 3) Webhooks + Reconciliação (P0)
- Forçar webhook `payment_intent.succeeded`
- Executar reconciliação (endpoint interno se aplicável)
- Confirmar que `PaymentEvent` e ledger estão consistentes

### 4) Outbox + Worker (P0)
- Confirmar worker ativo (ECS, logs e operações processadas)
- Forçar evento de outbox e validar processamento + dedupe

### 5) Address Service (P1)
- Autocomplete `/api/address/autocomplete` (cache + provider)
- Details `/api/address/details` (normalização + addressId)
- Reverse `/api/address/reverse` (normalização + addressId)

### 6) Auth (P1)
- Login + refresh token
- Revogação/sessão expirada

### 7) Perfil / Localização (P1)
- `POST /api/me/location/consent` grava consent
- `/api/me` devolve perfil básico (sem cidade)

### Done Criteria
- Todos os passos acima **OK** em staging/prod.
- Atualizar `docs/ssot_registry.md` para **VERIFIED** nos blocos correspondentes.

---

## Runtime Validation Results (snapshots, NON‑NORMATIVE)
### Local — 2026-02-07
Base URL: `http://localhost:3000`

### Ops / Saúde (P0)
- `GET /api/internal/ops/health` → **200 OK**
- `GET /api/internal/ops/dashboard` → **200 OK**
- `GET /api/internal/ops/slo` → **200 OK**
- `GET /api/internal/outbox/dlq?limit=5` → **200 OK** (vazio)

### Outbox / Worker (P0)
- Smoke automático (script: `scripts/runtime_outbox_smoke.js`)
  - Evento criado: `diagnostic.runtime_smoke` (`eventId=3500b85f-8f33-43df-862e-2e74dc837abd`)
  - `POST /api/internal/worker/operations` (1) → **200 OK** (processed=0, backlog=0)
  - `POST /api/internal/worker/operations` (2) → **200 OK** (processed=0, backlog=0)
  - Estado após publish: `claimedAt` preenchido, **sem** `operation` criada, `publishedAt=null`
  - Fallback: inserção manual de `operationType=OUTBOX_EVENT` + novo worker
  - `POST /api/internal/worker/operations` (fallback) → **500**; `operation` ficou **RUNNING**, `publishedAt` continua `null`
  - `GET /api/internal/ops/outbox/summary` → pendingCountCapped=12, oldestPendingCreatedAt=2026-02-01
  - Re-run (após aumentar timeout de transação do outbox publisher para 60s)
    - Evento criado: `diagnostic.runtime_smoke` (`eventId=27d6130f-4da1-4e79-975f-cb69e64c8d2b`)
    - `POST /api/internal/worker/operations` (1) → **200 OK** (duration ~60s, processed=0)
    - `POST /api/internal/worker/operations` (2) → **200 OK** (processed=0)
    - Fallback → **500**, `operation` ficou **RUNNING**, `publishedAt` continua `null`
  - Diagnóstico direto (TS runner): `publishOutboxBatch()` falha com
    - `Transaction API error: ... commit cannot be executed on an expired transaction` (timeout 60s)
  - Ações locais executadas:
    - Stop temporário de `scripts/operations-loop.js` + `scripts/cron-loop.js`
    - Reset de `claimed_at/processing_token` em `app_v3.outbox_events` (pending=15)
    - Reconcile `RUNNING` → `FAILED` via `POST /api/internal/reconcile`
    - Loops **não** reiniciados: `operations-loop`/`cron-loop` apontavam para `https://orya.pt` via env (evitado em local).

#### Outbox end‑to‑end (local, final)
- Ajuste de runtime:
  - Fallback sem transação para claim (pooler `:6543`) + guardas de erro por evento.
  - Flags suportadas: `OUTBOX_PUBLISH_SKIP_TX`, `OPERATIONS_SKIP_TX`,
    `OUTBOX_PUBLISH_TX_TIMEOUT_MS`, `OPERATIONS_TX_TIMEOUT_MS`.
  - Worker passou a processar em local sem timeout de transação.
- Execução (runner local com `OPERATIONS_SKIP_TX=1`, `OUTBOX_PUBLISH_SKIP_TX=1`):
  - Outbox total: **15**
  - Published: **12**
  - Dead‑lettered: **3** (`LOCAL_MISSING_DEP`)
  - Pending: **0**
- Operações:
  - SUCCEEDED: **12**
  - DEAD_LETTER: **5** (3 outbox + 2 legacy com `LOCAL_MISSING_DEP`)

**Motivos de DLQ local**
- `payment.created` / `payment.free_checkout.requested`: falta de dependências Stripe + FK `payment_snapshots_payment_fk`.
- `search.index.upsert.requested`: DB local sem coluna esperada (schema desatualizado).

**Conclusão:** pipeline outbox/worker **funciona end‑to‑end em local**, com DLQ controlado para eventos que dependem de Stripe/DB íntegros.

### Location (coarse + ip)
- `GET /api/location/ip` → **200 OK** (`UNAVAILABLE` em local, esperado sem headers edge)

### Address Service
- `GET /api/address/reverse` → **PENDING** (aguarda Apple Maps)
- `GET /api/address/autocomplete` → **PENDING** (aguarda Apple Maps)

**Nota:** o resolver atual é **Apple‑only** por decisão de produto; sem credenciais locais do Apple Maps, falha.
Para validar localmente: configurar Apple Maps no `.env.local`.

### Itens não validados (faltam credenciais/fluxo)
- Pagamentos/Stripe (`/api/payments/intent`, `/api/checkout/status`)
- Webhooks e reconciliação
- `POST /api/me/location/consent` (requer auth)

**Nota:** o pipeline outbox/worker foi validado em local com fallback sem transação, mas o sucesso total
depende de Stripe e de um schema DB atualizado (casos que geraram DLQ acima).

---

Resumo: Infra local responde, DLQ ok; Address Service pendente de credenciais Apple Maps.

### Prod — 2026-02-07
Base URL: `https://orya.pt`

### Ops / Saúde (P0)
- `GET /api/internal/ops/health` → **200 OK**
- `GET /api/internal/ops/dashboard` → **200 OK**
- `GET /api/internal/ops/slo` → **200 OK**

**Observação:** outbox DLQ com **3** itens (types: `payment.created`, `payment.free_checkout.requested`, `search.index.upsert.requested`).

### Payments / Checkout (P0)
- `/api/payments/intent` (paid + free) → **500** `Erro ao criar PaymentIntent.`
- Causa confirmada: **Stripe key expirada** (`api_key_expired`).

**Bloqueio:** substituir `STRIPE_SECRET_KEY` em `orya/prod/payments`.

### Address Service (P1)
- `/api/address/autocomplete` → **PENDING** (aguarda credenciais Apple Maps)
- `/api/address/reverse` → **PENDING** (aguarda credenciais Apple Maps)

**Ação:** configurar `APPLE_MAPS_*` em Secrets Manager, validar endpoints e atualizar este registo.

### DB / Schema
Aplicados ajustes para alinhar schema DB com o Prisma:
- `app_v3.organizations.address_id` (ADD column + index)
- `app_v3.events.location_name` (drop NOT NULL)

### E2E Report
Relatório completo removido (histórico).

---

Resumo: P0 **bloqueado** por Stripe key expirada. Address Service **pendente** (Apple Maps). Outbox DLQ com 3 itens pendentes. Sem estes fixes não é possível marcar **VERIFIED** em prod.

---

## Analytics / Tracking (Mobile)
**Fonte:** `docs/blueprint.md`, `docs/blueprint.md` (UX/UI & Mobile)

**Contrato SSOT**
- Mobile **não** usa provider externo de tracking neste momento.
- A integração atual é **stub** (`trackEvent` apenas loga).
- Decisão: tracking será **nativo ORYA** no futuro (ingestão própria + storage/relatórios), não agora.
- Até existir implementação nativa, eventos **não** devem ser enviados para terceiros.

**Estado:** TODO
**Evidência:** `apps/mobile/lib/analytics.ts`, `docs/blueprint.md` (UX/UI & Mobile).

---

## API ↔ UI Coverage (snapshot, NON‑NORMATIVE)
Fonte: `reports/api_ui_coverage.csv`

### Resumo
- Total rotas: 513
- Covered: 326
- Orphan: 143
- Exempt: 44
- UI endpoints missing API: 0

### Detalhe
- Lista completa de orphans e endpoints missing API: `reports/api_orphans.md`
- CSV completo: `reports/api_ui_coverage.csv`

### Nota
- Este report inclui varredura **web + mobile** (app + apps/mobile).


## Observações finais
- Este registry deve ser atualizado sempre que houver novas decisões de produto/contratos.
- Qualquer novo endpoint crítico deve usar o envelope canónico e os gates de segurança.
- Cobertura UI↔API: ver secção "API ↔ UI Coverage" neste documento (alguns orphans são mobile/admin).

---

## Registro de alterações (2026-02-07)
- Normalização de consumo/check-in: `Ticket.usedAt` removido; consumo passa a ser metadata via `EntitlementCheckin`.
- Estados normalizados: `TicketStatus.USED` removido (mapeado para `ACTIVE`); `CheckinResultCode.REFUNDED` removido (mapeado para `REVOKED`).
- Gate de acesso: check‑in bloqueia entitlements fora de `ACTIVE` (incl. `PENDING`/`EXPIRED`).
- Padel: removido linkage legacy a tickets (pairings/slots/tournament entries). Padel opera via inscrições + entitlements.
- Dados/migrações: migrações aplicadas para remover legado e alinhar enums/colunas.
- Finanças: gateway Stripe passa a destination charges (`application_fee_amount` + `transfer_data.destination`).
- Payouts: controlo directo desativado (cron/admin).
- Read‑models: `stripeFeeCents` só é preenchido quando fee real está disponível (sem estimativas).
- Padel: split D12 corrigido (48h vs T‑24) e `requiresEntitlementForEntry` forçado para eventos Padel.
- Padel: alias `padel-hub` removido do UI e purge total dedicado (`scripts/purge_padel_total.js`).
