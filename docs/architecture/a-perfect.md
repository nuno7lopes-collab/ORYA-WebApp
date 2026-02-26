# A-Perfeito (Next.js Host) - Blueprint

Estado: proposta PR1  
SSOT normativo: `docs/ssot_registry_v1.md` (secção `00.11`)

## Objetivo
- Manter arquitetura A: `Next.js` serve Web + API.
- Tornar pagamentos/reservas/calendário determinísticos, idempotentes e auditáveis.
- Manter rotas `app/api/**` finas (adapter) e mover lógica para domínio/use-cases.

## Camadas internas
1. `domain/`
- Regras puras, invariantes e máquinas de estado (sem IO).
- Ex.: `domain/payments/*`, `domain/schedule/*`, `domain/bookings/*`.

2. `usecases/`
- Orquestração transacional + idempotência + políticas cross-domain.
- Ex.: `CreatePaymentIntentForSubjectUseCase`, `HandleStripeWebhookUseCase`, `ConfirmBookingAfterPaymentUseCase`.

3. `adapters/infra/`
- Implementações de portas: Prisma, Stripe, Redis, Outbox, Email.
- Ex.: `adapters/prisma/paymentAttemptRepo.ts`, `adapters/redis/holdStore.ts`.

4. `app/api/`
- Rotas finas: validar input -> chamar use-case -> mapear resposta.
- Sem lógica de negócio e sem decisões de estado fora de use-case.

## Bounded contexts
- `identity`
- `orgs`
- `bookings`
- `payments`
- `padel`

## Contratos canónicos

### Result e erro normalizado
```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};
```

### Envelope HTTP
```ts
// ok
{ ok: true, code: "OK", data: ... }

// erro
{ ok: false, errorCode: "SLOT_NOT_AVAILABLE", message: "...", retryable: false, details?: ... }
```

### PaymentSubject
```ts
enum PaymentSubject {
  BOOKING = "BOOKING",
  EVENT_TICKET = "EVENT_TICKET",
  STORE_ORDER = "STORE_ORDER",
}
```

### Idempotência
- `create-intent`: chave estável por subject (`orgId + subjectType + subjectId + amount + currency + pricingVersion`).
- `webhook`: dedupe por `stripeEventId` persistido.
- `confirm`: chave transacional por (`paymentIntentId` + `subject` + `holdId`).

## Payment Kernel
- Entidades nucleares:
  - `Payment` (estado financeiro SSOT já existente)
  - `PaymentAttempt` (tentativa operacional de cobrança por subject)
  - `PaymentEvent` (auditoria de eventos/execução)
- Estados mínimos `PaymentAttempt`:
  - `CREATED | REQUIRES_ACTION | PROCESSING | PAID | FAILED | EXPIRED | REFUNDED`

## ScheduleItem model
- Representa ocupação canónica no calendário.
- Lifecycle normativo:
  - `DRAFT | PENDING_PAYMENT | HELD | CONFIRMED | CANCELLED | MOVED | EXPIRED`

## Hold mechanism (plataforma)
- Primário: Redis
  - key: `hold:org:{orgId}:subject:{subjectType}:{subjectId}`
  - TTL: `300s`
  - value: `holdId`, `clientSessionId`, `createdAt`, `expiresAt`
- Fallback/auditoria: tabela `reservation_holds` (ou equivalente)
  - usada para rastreio, replay e reconciliação operacional.

## Workflow atómico no webhook (pagamento confirmado)
1. Validar assinatura Stripe.
2. Dedupe por `stripeEventId` (idempotente).
3. Resolver `subject` e `paymentAttempt`.
4. Verificar hold ativo e ownership (`clientSessionId`).
5. Transação única:
- criar/confirmar `ScheduleItem`;
- confirmar `Booking`;
- marcar `PaymentAttempt`/`Payment` como `PAID`;
- gravar evento outbox.
6. Libertar hold.
7. Reprocessamento do mesmo webhook => no-op seguro.

## Política de dedupe/reconciliação
- `processed_webhook_events` (ou `payment_events.stripeEventId` com unicidade) evita duplicação.
- Runbook de reconciliação compara Stripe ledger vs `Payment + LedgerEntry`.

## PRs pequenos (ordem)
1. PR1: SSOT + blueprint (este documento).
2. PR2: skeleton Payment Kernel + helpers de idempotência (sem mudança de comportamento).
3. PR3: hold de plataforma (`/api/holds/*`) + validação server-side antes de pagamento.
4. PR4: UI countdown + CTA retomar checkout.
5. PR5: confirmação atómica no webhook/confirm booking.
6. PR6: dedupe persistente de webhooks + reconciliação.
7. PR7: aplicar kernel aos flows booking/event/store.
8. PR8: preview->commit no motor de torneios.
9. PR9: limpeza legada + runbook de rollback.

## Evidência de baseline (repo atual)
- Hold/pending já existe (hoje `10m`) em:
  - `app/api/servicos/[id]/reservar/route.ts`
  - `app/api/servicos/[id]/checkout/route.ts`
- Confirmação com lock transacional:
  - `lib/reservas/confirmBooking.ts`
- Idempotência de intent:
  - `domain/finance/paymentIntent.ts`
- Dedupe de webhook:
  - `app/api/stripe/webhook/route.ts`
- Calendário canónico:
  - `prisma/schema.prisma` (`model AgendaItem`)
