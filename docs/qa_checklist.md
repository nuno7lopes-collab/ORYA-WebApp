# QA checklist (estática)

- Auth + roles:
  - Organizer core usa auth + helpers (`organizerPermissions`) — ex.: `app/api/organizador/organizations/members/route.ts`, `.../invites/route.ts`, `.../events/list|create|update`, `.../payouts/*`, `.../finance/overview`.
  - Admin endpoints validam role admin (`app/api/admin/utilizadores/list`, `app/api/admin/eventos/list`, `app/api/admin/payments/list`).
- Validação:
  - Organizador/events create/update com validação manual de campos obrigatórios e fees; outros usam checks equivalentes (sem zod) — indicado para futura melhoria.
  - Payloads críticos (convites, transfer, leave) têm checks de types/roles; bodies parseados com guardas.
- Invariantes:
  - Regra “nunca ficar sem OWNER” centralizada nos endpoints de members (PATCH/DELETE/transfer) e transação de promoção a OWNER despromove restantes.
- Fonte de verdade dinheiro/notifs:
  - Sales/reporting: `sale_summaries`/`sale_lines` (snapshots de promo); event_sales_agg legado.
  - Notificações via `createNotification`; enums finalizados; endpoints list/mark usam `isRead`.
- RLS:
  - organizers via organizer_members; tickets/sale_summaries/sale_lines/notifications/guest_ticket_links com policies ativas; bypass service_role aplicado.
- Perfis apagados:
  - Delete handler liberta username e marca is_deleted/deleted_at.
  - Resolvers ignoram isDeleted; listas follows/following/members/invites sanitizam perfis apagados/privados (`lib/profileVisibility`).
- Observações:
  - Sem QA manual; esta checklist é estática. Melhorias futuras: zod/safeParse em todos os POST/PUT e alinhamento de mensagens de erro.
