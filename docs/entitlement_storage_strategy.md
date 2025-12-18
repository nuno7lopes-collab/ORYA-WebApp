# Entitlement Storage Strategy (Bloco 3)

Decisão fechada: tabela materializada `entitlements` como SSOT de acesso. Escrita exclusiva do worker (Bloco 2) a partir do ledger/operations; Bloco 3 apenas lê para UI/APIs/Emails.

## Constraints e índices
- Unique idempotente recomendado: `unique(purchaseId, saleLineId, ownerKey, type)`.
- Índices:
  - `ownerKey, snapshotStartAt DESC` (wallet/paginação).
  - `scope` (eventId/tournamentId/seasonId) para organizer/attendees.
  - `status` para filtros (ACTIVE/USED/REFUNDED/REVOKED/SUSPENDED).

## Escrita/refresh
- Worker popula/atualiza entitlements em resposta a Operations (issue/refund/revoke/suspend/claim).
- Reruns do worker usam a unique para evitar duplicados.
- Mutação de ownership (claim) atualiza ownerKey preservando purchaseId/saleLineId/source.
- Snapshots são armazenados junto do record para leitura rápida e estável.

## Consumo (Bloco 3)
- APIs de wallet/attendees/QR leem apenas desta tabela (sem joins com SaleSummary/tickets).
- Ações derivadas (actions) são computadas no resolver em memória/serviço, não gravadas como truth.
