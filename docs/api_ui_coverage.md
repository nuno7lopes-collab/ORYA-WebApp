# API ↔ UI Coverage (snapshot)

Fonte: `reports/api_ui_coverage.csv`

## Resumo
- Total rotas: 438
- Covered: 263
- Orphan: 137
- Exempt: 38

## Orphans por categoria (prefixo /api/*)
- organizacao: 54 (ex: /api/organizacao/agenda; /api/organizacao/agenda/soft-blocks; /api/organizacao/analytics/dimensoes; /api/organizacao/analytics/overview; /api/organizacao/become)
- me: 36 (ex: /api/me; /api/me/creditos; /api/me/inscricoes; /api/me/inscricoes/[id])
- padel: 18 (ex: /api/padel/discover; /api/padel/matches/[id]/walkover; /api/padel/pairings/[id]/accept; /api/padel/pairings/[id]/assume; /api/padel/pairings/[id]/cancel)
- tournaments: 5 (ex: /api/tournaments/[id]; /api/tournaments/[id]/live; /api/tournaments/[id]/monitor; /api/tournaments/[id]/structure; /api/tournaments/list)
- admin: 4 (ex: /api/admin/eventos/update-status; /api/admin/organizacoes/update-payments-mode; /api/admin/users/purge-pending; /api/admin/utilizadores/list)
- servicos: 4 (ex: /api/servicos/[id]; /api/servicos/[id]/creditos; /api/servicos/[id]/creditos/checkout; /api/servicos/[id]/disponibilidade)
- widgets: 3 (ex: /api/widgets/padel/bracket; /api/widgets/padel/next; /api/widgets/padel/standings)
- auth: 2 (ex: /api/auth/check-email; /api/auth/clear)
- chat: 2 (ex: /api/chat/conversations/[conversationId]/threads/[messageId]; /api/chat/messages/[messageId]/report)
- store: 2 (ex: /api/store/bundles; /api/store/shipping/quote)
- tickets: 2 (ex: /api/tickets/resale/cancel; /api/tickets/resale/list)
- email: 1 (ex: /api/email/verified)
- eventos: 1 (ex: /api/eventos/[slug]/resales)
- location: 1 (ex: /api/location/ip)
- platform: 1 (ex: /api/platform/fees)
- profiles: 1 (ex: /api/profiles/check-username)

## Orphans usados pelo mobile
- /api/auth/check-email
- /api/location/ip
- /api/me
- /api/me/location/consent
- /api/me/push-tokens
- /api/profiles/check-username

## Nota
- Este report é **web‑first**; endpoints usados apenas no mobile aparecem como `orphan`.
