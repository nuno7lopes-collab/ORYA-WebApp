# Checkout Contract V1 (Canonical)

## Scope
- Applies to all checkout sources: `TICKET_ORDER`, `BOOKING`, `PADEL_REGISTRATION`, `STORE_ORDER`.
- Mobile app is login-only for checkout. Guest checkout is not supported on mobile.

## Canonical Endpoints
- `POST /api/payments/intent`: canonical checkout orchestration entrypoint.
- `GET /api/checkout/status`: canonical checkout status endpoint.

## Compatibility Endpoints (Adapters)
- `POST /api/servicos/[id]/checkout`
- `POST /api/organizacao/reservas/[id]/checkout`
- `POST /api/store/checkout`
- `POST /api/padel/pairings/[id]/checkout`

Compatibility endpoints must:
- Keep existing path/contracts for clients.
- Delegate payment orchestration to canonical finance rules.
- Return canonical fields when possible (`purchaseId`, `paymentIntentId`, `status`, `final`, `freeCheckout`).

## Request Contract (Start)
- `sourceType`: canonical source type.
- `sourceId`: source identifier.
- `organizationId`: owning organization.
- `userId`: required on mobile.
- `amountCents`: non-negative integer.
- `currency`: ISO-4217 uppercase (`EUR` for current implementation paths).
- `idempotencyKey`: client idempotency key (optional but recommended).
- `metadata`: source-specific metadata.

## Response Contract (Session)
- `checkoutId` (alias of `purchaseId` when present)
- `purchaseId`
- `paymentIntentId`
- `clientSecret` (null for free checkout)
- `status`
- `statusV1` (normalized canonical status)
- `final`
- `freeCheckout`

## Status Model
- Backward-compatible status field:
  - `PENDING`, `PROCESSING`, `REQUIRES_ACTION`, `PAID`, `FAILED`, `REFUNDED`, `DISPUTED`, `CANCELED`
- Canonical normalized status (`statusV1`):
  - `PENDING`, `PROCESSING`, `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELED`, `EXPIRED`
- `checkoutId` query param is supported in `/api/checkout/status` as alias for `purchaseId`.

## Free Checkout Rules
- Free checkout (`amountCents=0`) must not create Stripe intents.
- Service/store free checkout must finalize the domain object and return:
  - `freeCheckout: true`
  - `status: "PAID"`
  - `final: true`
  - deterministic `purchaseId` + synthetic `paymentIntentId`.

## Mobile UX Rules
- `REQUIRES_ACTION` must auto-poll for up to 20 seconds after payment sheet return.
- Poll cadence:
  - 2 seconds for `REQUIRES_ACTION`
  - 6 seconds for `PENDING`/`PROCESSING`
- If status does not converge within timeout, show fallback actions:
  - `Tentar novamente`
  - `Atualizar estado`
- Missing Stripe publishable key for paid checkout must show explicit error:
  - `CONFIG_STRIPE_KEY_MISSING`.

## Observability Minimum
- Emit structured events for:
  - `checkout_started`
  - `checkout_payment_sheet_opened`
  - `checkout_payment_succeeded`
  - `checkout_payment_failed`
  - `checkout_stuck_timeout`
- Logs include:
  - `purchaseId`, `paymentIntentId`, `sourceType`, `sourceId`, `organizationId`, `userId` when available.

## Non-breaking Policy
- Existing endpoints remain available.
- Existing `status=PAID` remains valid for clients.
- New fields (`checkoutId`, `statusV1`, `freeCheckout`, `final`) are additive.
