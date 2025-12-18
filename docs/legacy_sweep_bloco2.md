# Legacy Sweep Bloco 2 (Payments/Fulfillment)

## DELETE (removido do repo)
- `app/api/internal/refunds/event/route.ts` — batch refund legacy fora do worker; agora refunds só via Operations PROCESS_REFUND_SINGLE/BATCH.
- `app/api/internal/refunds/date-changed/route.ts` — idem acima (DATE_CHANGED).
- `lib/refunds/refundService.ts` (função `refundEventPurchases`) — removido para evitar refunds diretos; mantemos apenas `refundPurchase` idempotente usado pelo worker.
- Flags/fallbacks desativados:
  - Free checkout em `app/api/payments/intent/route.ts` já não cria tickets/ledger inline; apenas PaymentEvent + Operation UPSERT_LEDGER_FROM_PI_FREE.
  - `app/api/admin/payments/dispute/route.ts` removeu fallback direto; só enfileira MARK_DISPUTE.
  - `ENABLE_WORKER_PAYMENTS` deixou de ter efeito no webhook (ingest-only).

## KEEP (core que permanece)
- Webhook ingest-only (`app/api/stripe/webhook/route.ts`) + Operation.enqueue.
- Operation ledger + worker dispatcher (`app/api/internal/worker/operations/route.ts`), cron runner (`app/api/cron/operations/route.ts`), reprocess (`app/api/internal/reprocess/*`), reconcile (`app/api/internal/reconcile/route.ts`).
- Handlers do worker (paid/free/resale/padel/refunds/disputes/promo ops) em `lib/operations/*`.
- Refund core idempotente (`lib/refunds/refundService.ts` → `refundPurchase`).
- SSOT ledger (SaleSummary/SaleLines) e fulfillment idempotente via Operations.

## REFATORADO (antes → agora)
- Free checkout: emissão direta → apenas enfileira `UPSERT_LEDGER_FROM_PI_FREE`.
- Disputes admin: caminho direto `markSaleDisputed` → apenas Operation `MARK_DISPUTE`.
- Refund batch endpoints internos: removidos; updates de evento/admin continuam a enfileirar `PROCESS_REFUND_SINGLE`.
- Webhook: remove flag de bypass (`ENABLE_WORKER_PAYMENTS`), mantendo ingest-only.

## Comandos de prova
Saídas coletadas a  runtime local:

```bash
rg "stripe/webhook" app lib
```
```
app/api/stripe/webhook/route.ts:// app/api/stripe/webhook/route.ts
app/api/internal/worker/operations/route.ts:import { fulfillPayment, handleRefund } from "@/app/api/stripe/webhook/route";
```

```bash
rg "refund" app lib
```
```
lib/refunds/refundService.ts:// Idempotent refund executor (base-only) anchored by dedupeKey = eventId:purchaseId:reason
... (truncated: apenas refs core; nenhuma rota legacy de refund)
```

```bash
rg "emit|issue|fulfill|ticket|entry|promo" app lib
```
```
[1741 linhas — ver comando; apenas handlers/operations/core atuais. Nenhum endpoint legacy de emissão/refund fora do worker.]
```

```bash
rg "Operation|dedupeKey|enqueue" app lib
```
```
lib/refunds/refundService.ts:// Idempotent refund executor (base-only) anchored by dedupeKey = eventId:purchaseId:reason
... (mostra apenas enqueues/operations atuais)
```
