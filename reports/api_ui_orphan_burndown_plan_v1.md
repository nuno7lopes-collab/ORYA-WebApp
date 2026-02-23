# API/UI Orphan Burn-down Plan

Generated: 2026-02-23T13:37:33.250Z
Source: scripts/manifests/api_ui_orphan_baseline_v1.json

Total baseline órfãos: 51

## wave-1

- Entradas: 0
- Janela alvo (expiresAt): - -> -

### Domínios
- none

### Owners
- none

### Endpoints
- none

## wave-2

- Entradas: 35
- Janela alvo (expiresAt): 2026-05-30 -> 2026-05-30

### Domínios
- padel.public: 22
- org.padel: 13

### Owners
- padel-core: 35

### Endpoints
- /api/org/[orgId]/padel/analytics
- /api/org/[orgId]/padel/audit
- /api/org/[orgId]/padel/broadcast
- /api/org/[orgId]/padel/courts
- /api/org/[orgId]/padel/exports/analytics
- /api/org/[orgId]/padel/exports/bracket
- /api/org/[orgId]/padel/exports/calendario
- /api/org/[orgId]/padel/exports/inscritos
- /api/org/[orgId]/padel/exports/resultados
- /api/org/[orgId]/padel/imports/inscritos
- /api/org/[orgId]/padel/pairings/swap
- /api/org/[orgId]/padel/waitlist
- /api/org/[orgId]/padel/waitlist/promote
- /api/padel/community/posts
- /api/padel/community/posts/[id]/comments
- /api/padel/community/posts/[id]/reactions
- /api/padel/live
- /api/padel/live/raw
- /api/padel/matches/[id]/delay
- /api/padel/matches/[id]/undo
- /api/padel/pairings/[id]/assume
- /api/padel/pairings/[id]/cancel
- /api/padel/pairings/[id]/invite
- /api/padel/pairings/[id]/public
- /api/padel/pairings/[id]/regularize
- /api/padel/pairings/[id]/reopen
- /api/padel/pairings/[id]/swap
- /api/padel/pairings/my
- /api/padel/public/calendar
- /api/padel/rankings/rebuild
- /api/padel/rankings/sanctions
- /api/padel/teams/[id]/members
- /api/padel/tournaments/tier-approvals/[id]/approve
- /api/padel/tournaments/tier-approvals/[id]/reject
- /api/padel/tournaments/tier-approvals/request

## wave-3

- Entradas: 16
- Janela alvo (expiresAt): 2026-04-15 -> 2026-05-30

### Domínios
- me: 7
- org.other: 5
- messages: 2
- public: 1
- servicos: 1

### Owners
- identity-core: 7
- org-platform: 6
- messaging-core: 2
- reservas-core: 1

### Endpoints
- /api/me/dsar/export
- /api/me/inscricoes
- /api/me/loyalty/carteira
- /api/me/notifications/[id]/read
- /api/me/reservas/[id]/calendar.ics
- /api/me/settings/delete/cancel
- /api/me/wallet/[entitlementId]/pass
- /api/messages/conversations/[conversationId]/threads/[messageId]
- /api/messages/grants/[grantId]/cancel
- /api/org/[orgId]/avaliacoes
- /api/org/[orgId]/crm/campanhas/[campaignId]
- /api/org/[orgId]/reservas/disponibilidade/[overrideId]
- /api/org/[orgId]/servicos/[id]/duration-prices
- /api/org/[orgId]/trainers
- /api/servicos/[id]/booking-status
- /api/upload/delete

## Regra operacional
- Cada endpoint deve terminar com decisão `adopt`, `merge` ou `remove` antes da data de `expiresAt`.
- Novos órfãos só podem entrar na baseline com owner, wave e data de saída.

