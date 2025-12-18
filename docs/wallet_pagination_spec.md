# Wallet Pagination Spec (Bloco 3)

Paginação determinística baseada em cursor opaco.

## Ordenação
- Primário: `snapshotStartAt DESC`
- Secundário (tie-break): `entitlementId DESC`

## Cursor
- Conteúdo: { snapshotStartAt, entitlementId } serializado/base64.
- Filtro aplicado antes do cursor (upcoming/past/status/type) para consistência.
- `nextCursor` é nulo quando não há mais resultados.

## Regras
- pageSize default 20, máximo 50.
- Cursor sempre calculado após aplicar filtros e ordenação.
- Mudanças de relógio/timezone não afetam ordem (usar timestamptz).
- Evitar offsets; repetir chamada com cursor mantém ordem estável mesmo com novos entitlements (insert-order resistente).
