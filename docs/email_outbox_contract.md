# Email Outbox Contract (Bloco 3)

SSOT de envios: Outbox + Operation no worker. Nenhum envio direto em rotas UI.

## Outbox record
- id
- templateKey
- recipient (email)
- purchaseId (TEXT pur_<hex>) obrigatório
- entitlementId (opcional)
- dedupeKey (unique): `${purchaseId}:${templateKey}:${recipient}`
- status: PENDING | SENT | FAILED
- timestamps: createdAt, sentAt?, failedAt?, errorCode?
- payload: JSON com campos mínimos do template

## Envio
- Operation type: `SEND_EMAIL`
- Operation dedupeKey: `OUTBOX_EMAIL:{dedupeKey}`
- Worker lê outbox PENDING, envia via provider, atualiza status + sentAt/errorCode.
- Reenfileirar admin: regrava Operation mas dedupeKey impede duplicados.

## Regras
- purchaseId obrigatório em todos os emails de acesso.
- retries são idempotentes via dedupeKey.
- Logs sempre com purchaseId, templateKey, dedupeKey, resultCode.
