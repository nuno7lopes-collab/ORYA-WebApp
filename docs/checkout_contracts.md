# Contratos de Checkout (FE ↔︎ BE)

Objetivo: um único payload de criação de checkout (CheckoutCreateRequest) e uma resposta estável do intent/status, sem heurísticas no FE.

## Request FE → BE (CheckoutCreateRequest)
Endpoint alvo: `/api/payments/intent` (unificar todos os fluxos pagos/grátis/variant).

Campos:
- `purchaseId` (uuid opcional no pedido; se não vier, backend gera e devolve)
- `paymentScenario`: `SINGLE | GROUP_SPLIT | GROUP_FULL | RESALE | SUBSCRIPTION | FREE_CHECKOUT` (sempre explícito)
- `checkoutUiVariant`: `EVENT_DEFAULT | PADEL_TOURNAMENT | ...` (contexto de UI/validations)
- `items[]`: `{ ticketTypeId, quantity }` (apenas ids+qty; preços nunca vêm do cliente)
- `owner`: `{ userId? | guestEmail? | ownerIdentityId? }` (XOR; email normalizado)
- `promoCode?`
- `context`: `{ eventId?, eventSlug?, pairingId?, inviteToken?, contact?, metadataExtra? }` (sem pricing calculado)
- `idempotencyKey`: deterministic key FE (owner+scenario+items+currency+context)
- `intentFingerprint?`: FE canary para evitar mismatch de payload vs PI cache

Regras:
- FE nunca envia total; BE recalcule via computePricing() (SSOT).
- FREE (totalCents==0) exige conta + username; guest bloqueado.
- GROUP_SPLIT requer sessão (auth) no pedido.
- Claim de guest só após emailVerifiedAt (endpoint retorna `EMAIL_NOT_VERIFIED` se tentar antes; repetir claim é no-op).

## Resposta BE → FE (intent)
Contrato estável (independentemente de grátis/pago):
```
{
  ok: boolean,
  code: string,            // ex: OK, AUTH_REQUIRED, WAVE_SOLD_OUT, INSUFFICIENT_STOCK, PRICE_CHANGED, PROMO_INVALID, INVALID_PRICING_MODEL, INTERNAL_ERROR, etc.
  purchaseId: string,
  status: "PENDING" | "PROCESSING" | "REQUIRES_ACTION" | "PAID" | "FAILED",
  nextAction: "NONE" | "PAY_NOW" | "CONFIRM_GUARANTEE" | "CONTACT_SUPPORT",
  retryable: boolean,
  clientSecret?: string,   // presente se precisa Stripe no cliente
  isFreeCheckout?: boolean,
  paymentIntentId?: string,
  paymentScenario?: string,
  breakdown?: { subtotalCents, discountCents, platformFeeCents, totalCents, currency, feeMode, lines },
  intentFingerprint?: string,
  idempotencyKey?: string
}
```
Gate: FE opera só com status/code/nextAction; nunca adivinha.

## Resposta BE → FE (status/polling)
Endpoint: `/api/checkout/status`
Contrato esperado: igual shape simplificado do intent, sempre com:
- `ok`
- `purchaseId`
- `status` (PAID só com SaleSummary)
- `code` = status canonical
- `nextAction` (RA → PAY_NOW; FAILED → CONTACT_SUPPORT; default NONE)
- `retryable`
- `paymentIntentId?`

## Gaps atuais vs alvo (para implementação futura)
- Step1 (frontend) ainda bloqueia se total<=0; deve deixar avançar com qty>0 e delegar “free vs paid” ao BE.
- `/api/eventos/[slug]/comprar` foi removido; FE usa sempre o modal core (Step1/2/3) para pagos e free.
- Fluxo padel standalone foi desativado; CTAs apontam para o modal core usando `/api/payments/intent` com `paymentScenario` + `checkoutUiVariant=PADEL_TOURNAMENT`.
- `/api/checkout/resale` usa Stripe Checkout Session fora do motor; precisa integrar no contrato único ou ficar marcado como legacy separado.
- Respostas de `/api/payments/intent` não expõem `status/nextAction/retryable` de forma estável; alinhar com tabela acima (incl. códigos estáveis para stock/preço/promo).
- Owner resolver: FE não envia explicitamente `owner` hoje (usa sessão + guestEmail), alinhar para payload claro.
- IdempotencyKey: gerar determinístico (owner+scenario+items+currency+context) e devolver sempre; hoje mistura header/body e fingerprint.
- Intent fingerprint/purchaseId têm versão (`version=v2`) para evitar colisão com intents antigos de carrinhos diferentes.
