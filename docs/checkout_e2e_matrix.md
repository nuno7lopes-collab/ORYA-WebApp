# Checkout E2E Matrix

Estado: EXECUTAR em staging (preencher purchaseId/resultados abaixo).

## Cenários mínimos (preencher purchaseId + ✅/❌)
- FREE (qty>0, total 0): purchaseId _______ resultado ___
- Paid normal: purchaseId _______ resultado ___
- Multi-tab/double-click (idempotencyKey): purchaseId _______ resultado ___
- Webhook duplicado/out-of-order: purchaseId _______ resultado ___ (log/print)
- Promo corrida (limites): purchaseId _______ resultado ___
- Refund cancel: eventId _______ purchaseId _______ resultado ___
- Refund delete: eventId _______ purchaseId _______ resultado ___
- Split rounding ímpar (+1 cent capitão): purchaseId _______ resultado ___
- Claim emailVerifiedAt: purchaseId _______ (sem verify → erro), (com verify → ok), repetir claim → no-op; resultado ___
- INVALID_PRICING_MODEL padel (payload incoerente) → code esperado: INVALID_PRICING_MODEL; resultado ___

Notas: preencher com logs/evidências após execução manual.
