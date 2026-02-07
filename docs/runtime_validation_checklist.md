# Runtime Validation Checklist (staging/prod)

Objetivo: transformar **PARTIAL → VERIFIED** no `docs/ssot_registry.md`.

## 1) Ops / Saúde (P0)
- `GET /api/internal/ops/health` com `X-ORYA-CRON-SECRET`
- `GET /api/internal/ops/dashboard` com `X-ORYA-CRON-SECRET`
- `GET /api/internal/ops/slo` com `X-ORYA-CRON-SECRET`
- DLQ: `GET /api/internal/outbox/dlq?limit=50` (sem crescimento)

## 2) Payments + Checkout (P0)
- Criar checkout via `/api/payments/intent` e concluir pagamento real (Stripe test/prod)
- Validar `Payment` + `LedgerEntry` criados corretamente
- Validar `/api/checkout/status` retorna sucesso e estado consistente

## 3) Webhooks + Reconciliação (P0)
- Forçar webhook `payment_intent.succeeded`
- Executar reconciliação (endpoint interno se aplicável)
- Confirmar que `PaymentEvent` e ledger estão consistentes

## 4) Outbox + Worker (P0)
- Confirmar worker ativo (ECS, logs e operações processadas)
- Forçar evento de outbox e validar processamento + dedupe

## 5) Address Service (P1)
- Autocomplete `/api/address/autocomplete` (cache + provider)
- Details `/api/address/details` (normalização + addressId)
- Reverse `/api/address/reverse` (normalização + addressId)

## 6) Auth (P1)
- Login + refresh token
- Revogação/sessão expirada

## 7) Perfil / Localização (P1)
- `POST /api/me/location/consent` grava consent
- `/api/me` devolve perfil básico (sem cidade)

## Done Criteria
- Todos os passos acima **OK** em staging/prod.
- Atualizar `docs/ssot_registry.md` para **VERIFIED** nos blocos correspondentes.
