# ORYA SSOT Registry

Atualizado: 2026-02-07

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
Checklist: `docs/runtime_validation_checklist.md`.

---

## C-G5 — Envelope de Resposta + IDs de Correlação
**Fonte:** `docs/blueprint.md` + `docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md`

**Contrato SSOT**
- Todas as rotas críticas devem responder com envelope canónico.
- `requestId` e `correlationId` devem estar no body e nos headers.
- Erros devem ser fail‑closed e com `errorCode` estável.

**Estado:** VERIFIED (static)
**Evidência:** `lib/http/envelope.ts`, `lib/http/withApiEnvelope.ts`, `lib/api/wrapResponse.ts`.
Varredura local encontrou **0** rotas em `app/api/**/route.ts` sem helper de envelope.

---

## Auth + Fail-Closed + Org Context
**Fonte:** `docs/blueprint.md`, `docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md`

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

**Nota:** validação runtime depende de credenciais externas; checklist em `docs/runtime_validation_checklist.md`.
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

**Runtime local:** `docs/runtime_validation_results_local_2026-02-07.md`

**Nota:** em prod há DLQ pendente (3 itens). Ver `docs/runtime_validation_results_prod_2026-02-07.md`.

---

## EventAccessPolicy + Check‑in
**Fonte:** `docs/blueprint.md`

**Contrato SSOT**
- `EventAccessPolicy` é a única fonte de verdade para regras de acesso/check‑in.
- Check‑in sempre valida policy version aplicada.

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

**Nota:** validação runtime em prod **bloqueada** (Apple Maps indisponível). Ver `docs/runtime_validation_results_prod_2026-02-07.md`.

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

## Observações finais
- Este registry deve ser atualizado sempre que houver novas decisões de produto/contratos.
- Qualquer novo endpoint crítico deve usar o envelope canónico e os gates de segurança.
- Cobertura UI↔API: ver `docs/api_ui_coverage.md` (alguns orphans são mobile/admin).

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
