# Inventory Holds (Bilhetes + Store Stock TRACKED)

## Objetivo
Garantir consistência de checkout para itens com stock/capacidade limitada através de hold temporário (TTL 5 minutos) com Redis como primário e `app_v3.inventory_holds` como audit/fallback.

## Quando aplica
- Bilhetes com capacidade limitada (`ticket_types.total_quantity IS NOT NULL`).
- Loja com stock rastreado (`store_products.stock_policy = 'TRACKED'`).
- Não aplica a itens ilimitados.

## Pré-requisitos
1. Aplicar migrations:
```bash
npm run db:deploy
```
2. Executar gates:
```bash
npm run db:gates
npm run typecheck
npm run test
```
3. Feature flag:
```bash
FEATURE_INVENTORY_HOLDS=true
```

## Contrato operacional
- Criar hold: `POST /api/holds/inventory/create`
- Renovar hold (keepalive): `POST /api/holds/inventory/ping`
- Libertar/consumir hold: `POST /api/holds/inventory/release`

Notas de privacidade:
- O contrato não expõe `userId`/email.
- Ownership validado por `clientSessionId`.

## Smoke manual (A/B/C)
A) Double-hold
1. Em duas sessões, iniciar checkout do mesmo item limitado (stock/capacidade final = 1).
2. Esperado: primeira sessão cria hold; segunda falha com `OUT_OF_STOCK`/`SLOT_NOT_AVAILABLE`.

B) Leave/return
1. Criar hold e sair da página.
2. Reentrar antes dos 5 min e confirmar countdown/retoma.
3. Após expirar TTL, confirmar mensagem de hold expirado.

C) Replay webhook
1. Processar `payment_intent.succeeded` válido.
2. Reenviar o mesmo `event.id`.
3. Esperado: dedupe ativo; sem efeitos duplicados (entitlements/orders/tickets sem duplicação).

## Reconciliação (SQL)
### 1) Holds ativos por subject
```sql
SELECT
  subject_type,
  subject_fingerprint,
  COUNT(*) AS active_holds,
  COALESCE(SUM(quantity), 0) AS reserved_qty,
  MIN(expires_at) AS first_expiry
FROM app_v3.inventory_holds
WHERE status = 'ACTIVE'
  AND expires_at > now()
GROUP BY subject_type, subject_fingerprint
ORDER BY first_expiry ASC;
```

### 2) Store TRACKED: stock atual vs holds ativos
```sql
SELECT
  p.id AS product_id,
  p.stock_qty,
  COALESCE(SUM(h.quantity), 0) AS reserved_qty,
  (p.stock_qty - COALESCE(SUM(h.quantity), 0)) AS net_available_after_holds
FROM app_v3.store_products p
LEFT JOIN app_v3.inventory_holds h
  ON h.product_id = p.id
 AND h.status = 'ACTIVE'
 AND h.expires_at > now()
WHERE p.stock_policy = 'TRACKED'
GROUP BY p.id, p.stock_qty
ORDER BY p.id;
```

### 3) Ticket capacity: capacidade vs holds ativos
```sql
SELECT
  t.id AS ticket_type_id,
  t.total_quantity,
  t.sold_quantity,
  COALESCE(SUM(h.quantity), 0) AS reserved_qty,
  (t.total_quantity - t.sold_quantity - COALESCE(SUM(h.quantity), 0)) AS net_available_after_holds
FROM app_v3.ticket_types t
LEFT JOIN app_v3.inventory_holds h
  ON h.ticket_type_id = t.id
 AND h.status = 'ACTIVE'
 AND h.expires_at > now()
WHERE t.total_quantity IS NOT NULL
GROUP BY t.id, t.total_quantity, t.sold_quantity
ORDER BY t.id;
```

## Operações manuais
### Libertar holds expirados
```bash
node -e "(async () => { const { cleanupExpiredInventoryHolds } = await import('./lib/holds/inventoryHold.ts'); console.log(await cleanupExpiredInventoryHolds({ limit: 500 })); })().catch((e)=>{ console.error(e); process.exit(1); });"
```

### Libertar um hold específico
```bash
curl -X POST http://localhost:3000/api/holds/inventory/release \
  -H 'Content-Type: application/json' \
  -d '{"holdId":"<uuid>","clientSessionId":"<session-id>"}'
```

## Redis indisponível
- Fallback ativo para lock SQL + audit (`pg_advisory_xact_lock` + `inventory_holds`).
- Em degradação, o sistema mantém consistência e reduz throughput.
- Após recuperação de Redis, executar reconciliação para confirmar `reserved` consistente.

## Compensação (caso extremo)
Se pagamento entrar e falhar commit final por conflito de stock (`SLOT_TAKEN`):
1. Marcar caso como compensação operacional.
2. Disparar política de compensação (reembolso/crédito conforme runbook financeiro).
3. Confirmar estado final em ledger + order/tickets + inventory_holds.

## Rollback
1. Desativar feature flag:
```bash
FEATURE_INVENTORY_HOLDS=false
```
2. Executar cleanup de holds ativos.
3. Reexecutar reconciliação.
4. Reexecutar gates:
```bash
npm run db:gates
npm run typecheck
npm run test
```
