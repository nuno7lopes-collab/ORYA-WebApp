# Runtime Validation — Prod (2026-02-07)

Base URL: `https://orya.pt`

## Ops / Saúde (P0)
- `GET /api/internal/ops/health` → **200 OK**
- `GET /api/internal/ops/dashboard` → **200 OK**
- `GET /api/internal/ops/slo` → **200 OK**

**Observação:** outbox DLQ com **3** itens (types: `payment.created`, `payment.free_checkout.requested`, `search.index.upsert.requested`).

## Payments / Checkout (P0)
- `/api/payments/intent` (paid + free) → **500** `Erro ao criar PaymentIntent.`
- Causa confirmada: **Stripe key expirada** (`api_key_expired`).

**Bloqueio:** substituir `STRIPE_SECRET_KEY` em `orya/prod/payments`.

## Address Service (P1)
- `/api/address/autocomplete` → **200**, mas **sem items**
- `/api/address/reverse` → **502** `Apple Maps indisponível neste momento`

**Bloqueio:** Apple Maps indisponível (credenciais/origin). Resolver credenciais Apple Maps.

## DB / Schema
Aplicados ajustes para alinhar schema DB com o Prisma:
- `app_v3.organizations.address_id` (ADD column + index)
- `app_v3.events.location_name` (drop NOT NULL)

## E2E Report
Ver relatório completo: `reports/p1_closeout_2026-02-07.md`

---

Resumo: P0 **bloqueado** por Stripe key expirada. Address Service **bloqueado** por Apple Maps indisponível. Outbox DLQ com 3 itens pendentes. Sem estes fixes não é possível marcar **VERIFIED** em prod.
