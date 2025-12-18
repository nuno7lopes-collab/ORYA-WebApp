# Bloco 2 — Política de Erros / Dead-letter

Objetivo: evitar retries infinitos e garantir visibilidade de falhas não-retryable.

Classificação de erros
- Retryable: timeouts externos (Stripe/Supabase), lock/contention, dependência temporária. → status FAILED, backoff, nextRetryAt.
- Non-retryable: validação definitiva (metadata inválida, stock insuficiente), violação de constraint, configuração ausente crítica. → DEAD_LETTER com reason.
- Poison message: Operation que falha sempre com mesmo payload → DEAD_LETTER após limite de tentativas.

Política de tentativas
- Tentativas máximas por Operation (ex.: 5) com backoff exponencial/jitter.
- RUNNING com lock expirado pode ser retomado por reconciliação (ver bloco2_reconciliation_policy).
- DEAD_LETTER é terminal até intervenção humana.

Visibilidade e ações
- Admin tool lista DEAD_LETTER com dedupeKey, operationType, lastError, attemptNo, timestamps.
- Ação “mark resolved & requeue” cria nova Operation PENDING com mesmo dedupeKey (quando payload corrigido).
- Métricas: `dead_letter_total`, `operations_backlog_total`, `fulfillment_failed_total`.

Proteções
- Logs estruturados incluem purchaseId/pairingId/paymentIntentId/dedupeKey/attemptNo.
- Nenhum side-effect parcial deve escapar à transação; se falhar, rerun chega ao mesmo estado. 
