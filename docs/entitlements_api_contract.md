# Entitlements API Contract (Bloco 3)

APIs consomem apenas `entitlements` (materializada) + resolver de actions. Sem joins com SaleSummary/tickets.

## GET /api/me/wallet
- Query: `cursor` (opaque), `filter` = upcoming|past|status:STATUS|type:TYPE (multi permitido), `pageSize` opcional (default 20, max 50).
- Auth: user session obrigatória.
- Response:
  - `items`: [{ entitlementId, type, scope {eventId|tournamentId|seasonId}, status, snapshot{title,coverUrl,venueName,startAt,timezone}, actions, updatedAt }]
  - `nextCursor`: string|null.
- Ordenação: `snapshotStartAt DESC, entitlementId DESC` (determinístico).
- Erros: 401 not authenticated; 403 `FORBIDDEN_WALLET_ACCESS`; 400 filtros inválidos.

## GET /api/me/wallet/[entitlementId]
- Auth: user session (owner) ou admin.
- Response: entitlement detail (campos acima + type-specific payload, ex.: padel duoStatus/partnerRef, audit light de check-ins).
- Erros: 404 se não pertence ao owner; 403 se role não permitido.

## GET /api/organizador/events/[id]/attendees
- Query: `search` (nome/email), `status` (ACTIVE|USED|REFUNDED|REVOKED|SUSPENDED), `cursor`, `pageSize`.
- Auth: organizer com permissão para eventId ou admin.
- Response:
  - `items`: [{ entitlementId, status, holderName/email (derivado do owner), actions{canCheckIn}, snapshot{title,startAt,timezone}, checkinSummary{usedAt?, deviceId?, resultCode?} }]
  - `nextCursor`.
- Ordenação: `status, snapshotStartAt DESC, entitlementId DESC` ou filtro por status mantém ordem determinística.
- Erros: 403 `FORBIDDEN_ATTENDEES_ACCESS`; 404 evento não pertence ao organizer.

## Convenções
- Todas as respostas incluem `actions` calculadas no backend.
- Não expor purchaseId em rotas públicas; pode aparecer em admin/support endpoints apenas.
- Cursor é opaco (ver wallet pagination spec); não aceitar offsets.
