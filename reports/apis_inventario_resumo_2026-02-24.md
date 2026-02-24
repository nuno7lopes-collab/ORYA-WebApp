# Inventário de APIs (com resumo simples)

Total de endpoints: 496

## Distribuição por domínio

| Domínio | Nº endpoints |
|---|---:|
| org | 151 |
| padel | 68 |
| admin | 49 |
| me | 35 |
| org-hub | 32 |
| internal | 27 |
| public | 22 |
| cron | 19 |
| messages | 19 |
| social | 15 |
| auth | 10 |
| eventos | 6 |
| servicos | 5 |
| address | 3 |
| events | 3 |
| notifications | 3 |
| checkout | 2 |
| cobrancas | 2 |
| convites | 2 |
| explorar | 2 |
| profiles | 2 |
| tickets | 2 |
| upload | 2 |
| crm | 1 |
| email | 1 |
| inscricoes | 1 |
| location | 1 |
| maps | 1 |
| org-system | 1 |
| organizations | 1 |
| payments | 1 |
| platform | 1 |
| qr | 1 |
| search | 1 |
| stripe | 1 |
| support | 1 |
| username | 1 |
| users | 1 |

## Endpoints

| Endpoint | Métodos | Tipo | Auth | Resumo simples |
|---|---|---|---|---|
| `/api/address/autocomplete` | GET | public | none detected | Autocompletar moradas. |
| `/api/address/details` | GET | public | none detected | Detalhes de morada por identificador. |
| `/api/address/reverse` | GET | public | none detected | Geocodificação inversa (coords para morada). |
| `/api/admin/audit/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/config/platform-email` | GET, POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/data/purge` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/eventos/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/eventos/purge` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/eventos/update-status` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/fees` | GET, POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/infra/alerts/status` | GET | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/cost/summary` | GET | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/deploy` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/hard-pause` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/migrate` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/mode` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/redis/start` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/redis/stop` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/resume` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/rotate-secrets` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/soft-pause` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/start` | POST | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/status` | GET | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/infra/usage/summary` | GET | admin | admin | Administração de infraestrutura (estado, pausas, deploy e operações). |
| `/api/admin/mfa/enroll` | POST | admin | admin | Gestão MFA de administradores (enrolar, validar, reset e estado). |
| `/api/admin/mfa/reset` | POST | admin | admin | Gestão MFA de administradores (enrolar, validar, reset e estado). |
| `/api/admin/mfa/session` | GET | admin | admin | Gestão MFA de administradores (enrolar, validar, reset e estado). |
| `/api/admin/mfa/status` | GET | admin | admin | Gestão MFA de administradores (enrolar, validar, reset e estado). |
| `/api/admin/mfa/verify` | POST | admin | admin | Gestão MFA de administradores (enrolar, validar, reset e estado). |
| `/api/admin/ops/analytics-rollups` | GET, POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/organizacoes/event-log` | GET | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/organizacoes/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/organizacoes/refresh-payments-status` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/organizacoes/update-payments-mode` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/organizacoes/update-status` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/organizacoes/verify-platform-email` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/padel/settings` | GET, POST | admin | admin | Funcionalidades de padel (torneios, jogos, ranking). |
| `/api/admin/payments/dispute` | POST | admin | admin | Operações e estado de pagamentos. |
| `/api/admin/payments/export` | GET | admin | admin | Exportação de dados/relatórios. |
| `/api/admin/payments/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/payments/overview` | GET | admin | admin | Visão geral consolidada. |
| `/api/admin/payments/refund` | POST | admin | admin | Processar pedido de reembolso. |
| `/api/admin/payments/reprocess` | POST | admin | admin | Reprocessar operação previamente falhada. |
| `/api/admin/refunds/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/refunds/retry` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/admin/support/tickets/[id]` | GET | admin | admin | Suporte e gestão de tickets. |
| `/api/admin/support/tickets/[id]/events` | POST | admin | admin | Suporte e gestão de tickets. |
| `/api/admin/support/tickets/[id]/status` | POST | admin | admin | Consultar estado atual do recurso/operação. |
| `/api/admin/support/tickets/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/tickets/export` | GET | admin | admin | Exportação de dados/relatórios. |
| `/api/admin/tickets/list` | GET | admin | admin | Listagem de entidades com filtros. |
| `/api/admin/utilizadores/manage` | POST | admin | admin | Operações administrativas de plataforma. |
| `/api/auth/apple/link` | POST | public | none detected | Operações de autenticação e sessão. |
| `/api/auth/bootstrap` | POST | public | none detected | Bootstrap de sessão/auth inicial. |
| `/api/auth/check-email` | GET, POST | public | none detected | Verificar email/estado de conta. |
| `/api/auth/clear` | POST | public | none detected | Operações de autenticação e sessão. |
| `/api/auth/login` | POST | public | none detected | Autenticação de entrada de utilizador. |
| `/api/auth/logout` | POST | public | none detected | Terminar sessão autenticada. |
| `/api/auth/me` | GET | public | none detected | Operações de autenticação e sessão. |
| `/api/auth/password/reset-request` | POST | public | none detected | Pedir reset de palavra-passe. |
| `/api/auth/refresh` | POST | public | none detected | Renovar sessão/tokens de autenticação. |
| `/api/auth/send-otp` | POST | public | none detected | Enviar código OTP de autenticação. |
| `/api/checkout/resale` | POST | public | none detected | Fluxo de checkout/pagamento. |
| `/api/checkout/status` | GET | public | none detected | Consultar estado atual do recurso/operação. |
| `/api/cobrancas/[token]` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/cobrancas/[token]/checkout` | POST | public | none detected | Fluxo de checkout/pagamento. |
| `/api/convites/[token]` | GET, POST | public | none detected | Operação de API específica deste domínio. |
| `/api/convites/[token]/checkout` | POST | public | none detected | Fluxo de checkout/pagamento. |
| `/api/crm/engagement` | POST | public | user | Operações de CRM (clientes/campanhas/segmentos). |
| `/api/cron/analytics/rollup` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/bookings/cleanup` | GET | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/bookings/split-garantido` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/creditos/expire` | GET | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/crm/campanhas` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/crm/rebuild` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/entitlements/qr-cleanup` | GET | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/loyalty/expire` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/operations` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/arbitration-compensation` | GET, POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/expire` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/matchmaking` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/partnership-grants/revoke` | GET, POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/reminders` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/split-reminders` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/tournament-eve` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/padel/waitlist` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/repair-usernames` | POST | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/cron/reservations/cleanup` | GET | cron | internal | Execução de tarefa agendada de manutenção/processamento. |
| `/api/email/verified` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/eventos/[slug]/invite-token` | POST | public | none detected | Operações relacionadas com eventos. |
| `/api/eventos/[slug]/invites/check` | POST | public | none detected | Operações relacionadas com eventos. |
| `/api/eventos/[slug]/public` | GET | public | none detected | Endpoints públicos consumidos sem backoffice. |
| `/api/eventos/[slug]/resales` | GET | public | none detected | Operações relacionadas com eventos. |
| `/api/eventos/list` | GET | public | none detected | Listagem de entidades com filtros. |
| `/api/eventos/lookup` | GET | public | user | Lookup rápido por chave/identificador. |
| `/api/events/favorites` | GET | public | none detected | Operações relacionadas com eventos. |
| `/api/events/favorites/notify` | POST | public | none detected | Operações relacionadas com eventos. |
| `/api/events/favorites/toggle` | POST | public | none detected | Operações relacionadas com eventos. |
| `/api/explorar/eventos/[slug]` | GET | public | none detected | Operações relacionadas com eventos. |
| `/api/explorar/list` | GET | public | none detected | Listagem de entidades com filtros. |
| `/api/inscricoes/[id]/submit` | POST | public | none detected | Submeter dados/formulário. |
| `/api/internal/audit` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/checkin/consume` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/checkout/timeline` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/crm/ingest` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/crm/rebuild` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/cron/coverage` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/notifications/sweep` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/dashboard` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/feed` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/health` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/outbox/replay` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/outbox/summary` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/padel/backfill` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/padel/cleanup` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/padel/integrity` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/padel/workforce-hygiene` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ops/slo` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/outbox/dlq` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/outbox/replay` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/padel/registrations/backfill` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/ping` | GET | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/public-api/keys` | DELETE, GET, POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/reconcile` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/reprocess/payment-intent` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/reprocess/purchase` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/reprocess/stripe-event` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/internal/worker/operations` | POST | internal | internal | Endpoint interno para operações, observabilidade ou manutenção. |
| `/api/location/ip` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/maps/apple-token` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/me` | GET | me | user (expected) - NOT DETECTED | Operação de API específica deste domínio. |
| `/api/me/agenda` | GET | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/claim-guest` | POST | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/consents` | GET, PUT | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/contact-phone` | PATCH | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/dsar/export` | GET | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/events/signals` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/inscricoes/[id]` | GET | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/location/consent` | POST | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/loyalty/recompensas` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/loyalty/recompensas/[rewardId]/resgatar` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/notifications` | DELETE | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/notifications/feed` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/notifications/mute` | DELETE, POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/purchases` | GET | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/purchases/store` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/purchases/store/[orderId]` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/purchases/store/[orderId]/invoice` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/purchases/store/[orderId]/receipt` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/push-tokens` | POST | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]` | GET | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/cancel` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/cancel/preview` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/invites` | GET, POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/reschedule` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/reschedule/respond` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/review` | POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/reservas/[id]/split` | GET, POST | me | user | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/settings/delete` | POST | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/settings/email` | PATCH | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/settings/save` | PATCH | me | user (expected) - NOT DETECTED | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/wallet` | GET | me | admin | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/wallet/[entitlementId]` | GET | me | admin | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/me/wallet/[entitlementId]/pass` | GET | me | admin | Operações do utilizador autenticado (perfil, reservas, compras, wallet e definições). |
| `/api/messages/attachments/presign` | POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/blocks` | DELETE, POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations` | GET, POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]` | PATCH | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]/leave` | POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]/messages` | GET, POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]/messages/[messageId]` | DELETE | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]/notifications` | PATCH | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/[conversationId]/read` | POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/conversations/resolve` | POST | me | admin, org, user | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/grants` | GET | me | org, user | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/grants/[grantId]/accept` | POST | me | org, user | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/grants/[grantId]/decline` | POST | me | org, user | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/messages` | POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/messages/[messageId]` | DELETE, PATCH | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/messages/[messageId]/pins` | DELETE, POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/messages/[messageId]/reactions` | DELETE, POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/messages/[messageId]/report` | POST | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/messages/search` | GET | me | user (expected) - NOT DETECTED | Mensagens e conversas (envio, leitura, reação, moderação e permissões). |
| `/api/notifications/mark-click` | POST | public | user | Gestão de notificações do utilizador. |
| `/api/notifications/mark-read` | POST | public | user | Gestão de notificações do utilizador. |
| `/api/notifications/prefs` | GET, POST | public | none detected | Gestão de notificações do utilizador. |
| `/api/org-hub` | unknown | public | none detected | Governação e colaboração de organizações/grupos. |
| `/api/org-hub/groups/[groupId]/dashboard/agenda` | GET | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/dashboard/crm` | GET | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/dashboard/finance` | GET | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/dashboard/rankings` | GET | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/dashboard/reservas` | GET | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/governance` | GET, PATCH | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/governance/members` | DELETE, PATCH, POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/owner/transfer/cancel` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/owner/transfer/confirm` | GET, POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/[groupId]/owner/transfer/start` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/exit-requests` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/exit-requests/[id]/email/confirm` | GET, POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/exit-requests/[id]/email/resend` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/exit-requests/[id]/generate-code` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/exit-requests/[id]/verify-codes` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/join-requests` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/join-requests/[id]/email/confirm` | GET, POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/join-requests/[id]/email/resend` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/join-requests/[id]/generate-code` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/groups/join-requests/[id]/verify-codes` | POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/invites` | GET | public | none detected | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations` | GET, POST | public | user | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/[id]` | DELETE | public | org, orgEmail | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/[id]/suspend` | DELETE, GET, POST | public | org, orgEmail | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/leave` | POST | public | org | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/members` | DELETE, GET, PATCH | public | org, orgEmail | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/members/invites` | GET, PATCH, POST | public | org, orgEmail | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/members/permissions` | GET, PATCH | public | org, orgEmail | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/settings/official-email` | DELETE, GET, POST | public | org | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/settings/official-email/confirm` | POST | public | org | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-hub/organizations/switch` | POST | public | none detected | Operações do Org Hub (governação, membros, convites e dashboards). |
| `/api/org-system/payouts/webhook` | POST | public | webhook | Receber eventos webhook de sistemas externos. |
| `/api/org/[orgId]` | unknown | public | none detected | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/agenda` | GET | public | org, user | Consulta de agenda/calendário. |
| `/api/org/[orgId]/agenda/soft-blocks` | DELETE, PATCH, POST | public | org, orgEmail, user | Consulta de agenda/calendário. |
| `/api/org/[orgId]/analytics/buyers` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/cohorts` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/conversion` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/dimensoes` | GET | public | org, user | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/events` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/overview` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/analytics/time-series` | GET | public | org | Métricas e relatórios analíticos da organização. |
| `/api/org/[orgId]/audit` | GET | public | org | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/checkin` | POST | public | admin, org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/checkin/manual` | POST | public | admin, org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/checkin/preview` | POST | public | admin, org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/consentimentos` | GET | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/consentimentos/[userId]` | PUT | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/crm/campanhas` | GET, POST | public | org, orgEmail, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/campanhas/[campaignId]/approve` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/campanhas/[campaignId]/cancel` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/campanhas/[campaignId]/enviar` | POST | public | org, orgEmail, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/campanhas/[campaignId]/reject` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/campanhas/[campaignId]/submit` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/clientes` | GET | public | org, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/clientes/[customerId]` | GET | public | org, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/clientes/[customerId]/notas` | POST | public | org, orgEmail, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/clientes/[customerId]/tags` | PUT | public | org, orgEmail, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/config` | GET, PUT | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/journeys` | GET, POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/journeys/[id]` | GET, PATCH | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/journeys/[id]/pause` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/journeys/[id]/publish` | POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/relatorios` | GET | public | org, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/saved-views` | GET, POST | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/saved-views/[id]` | DELETE, PATCH | public | none detected | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/segmentos` | GET, POST | public | org, orgEmail, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/segmentos/[segmentId]` | GET | public | org, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/crm/segmentos/[segmentId]/preview` | GET | public | org, user | Gestão CRM da organização (clientes, segmentos, campanhas e journeys). |
| `/api/org/[orgId]/dashboard/tools/visibility` | GET, PATCH | public | org | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/events/[id]/attendees` | GET | public | admin, org | Operações relacionadas com eventos. |
| `/api/org/[orgId]/events/[id]/invite-token` | POST | public | org, orgEmail, user | Operações relacionadas com eventos. |
| `/api/org/[orgId]/events/[id]/invites` | DELETE, GET, POST | public | admin, org, orgEmail, user | Operações relacionadas com eventos. |
| `/api/org/[orgId]/events/[id]/refund` | POST | public | org, orgEmail, user | Processar pedido de reembolso. |
| `/api/org/[orgId]/events/create` | POST | public | admin, org, orgEmail, user | Criar novo recurso. |
| `/api/org/[orgId]/events/list` | GET | public | org, user | Listagem de entidades com filtros. |
| `/api/org/[orgId]/events/summary` | GET | public | org, user | Resumo agregado de métricas/estado. |
| `/api/org/[orgId]/events/update` | POST | public | admin, org, orgEmail, user | Atualizar recurso existente. |
| `/api/org/[orgId]/faturacao` | GET | public | org | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/finance/exports/fees` | GET | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/exports/ledger` | GET | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/exports/payouts` | GET | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/invoicing` | GET, POST | public | org, orgEmail | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/overview` | GET | public | org | Visão geral consolidada. |
| `/api/org/[orgId]/finance/payouts/connect` | POST | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/payouts/list` | GET | public | org | Listagem de entidades com filtros. |
| `/api/org/[orgId]/finance/payouts/settings` | POST | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/finance/payouts/status` | GET | public | org | Consultar estado atual do recurso/operação. |
| `/api/org/[orgId]/finance/payouts/summary` | GET | public | org | Resumo agregado de métricas/estado. |
| `/api/org/[orgId]/finance/reconciliation` | GET | public | org | Operações financeiras e relatórios. |
| `/api/org/[orgId]/inscricoes` | GET, POST | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/inscricoes/[id]` | DELETE, GET, PATCH | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/inscricoes/[id]/export` | GET | public | org, user | Exportação de dados/relatórios. |
| `/api/org/[orgId]/inscricoes/[id]/submissions` | GET, PATCH | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/inscricoes/[id]/summary` | GET | public | org, user | Resumo agregado de métricas/estado. |
| `/api/org/[orgId]/loyalty/programa` | GET, PUT | public | org, orgEmail, user | Programa de fidelização e recompensas. |
| `/api/org/[orgId]/loyalty/recompensas` | GET, POST | public | org, orgEmail, user | Programa de fidelização e recompensas. |
| `/api/org/[orgId]/loyalty/regras` | GET, POST | public | org, orgEmail, user | Programa de fidelização e recompensas. |
| `/api/org/[orgId]/marketing/overview` | GET | public | org | Visão geral consolidada. |
| `/api/org/[orgId]/me` | GET, PATCH | public | admin, org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/ops/feed` | GET | public | org, user | Feed cronológico de atividade/notificações. |
| `/api/org/[orgId]/pagamentos/invoices` | GET | public | org | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/policies` | GET, PATCH, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/policies/[id]` | DELETE, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/policies/padel` | GET | public | org, user | Funcionalidades de padel (torneios, jogos, ranking). |
| `/api/org/[orgId]/policies/store` | GET, PATCH | public | org, user | Catálogo, carrinho e encomendas da loja. |
| `/api/org/[orgId]/promo` | DELETE, GET, PATCH, POST | public | org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/promo/[id]` | GET | public | org | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/refunds/list` | GET | public | org | Listagem de entidades com filtros. |
| `/api/org/[orgId]/reservas` | GET, POST | public | org, user | Gestão de reservas e marcações. |
| `/api/org/[orgId]/reservas/[id]/cancel` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/charges` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/checkout` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/invites` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/no-show` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/participants` | GET | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/reschedule` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/[id]/split` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/clientes` | GET | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/config` | GET, PATCH | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/delays` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade/changesets` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]` | GET | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/apply` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/cancel` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/conflicts/[conflictId]/resolve` | POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/profissionais` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/profissionais/[id]` | DELETE, PATCH | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/recursos` | GET, POST | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/recursos/[id]` | DELETE, PATCH | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/reservas/summary` | GET | public | org, user | Gestão de reservas da organização (agenda, disponibilidade, participantes e alterações). |
| `/api/org/[orgId]/servicos` | GET, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]` | DELETE, GET, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/addons` | GET, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/addons/[addonId]` | DELETE, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/class-series` | GET, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/class-series/[seriesId]` | DELETE, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/class-sessions` | GET | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/packages` | GET, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/packages/[packageId]` | DELETE, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/packs` | GET, POST | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/servicos/[id]/packs/[packId]` | DELETE, PATCH | public | org, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/store` | GET, PATCH, POST | public | org, orgEmail, user | Catálogo, carrinho e encomendas da loja. |
| `/api/org/[orgId]/store/bundles` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/bundles/[id]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/bundles/[id]/items` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/bundles/[id]/items/[itemId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/categories` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/categories/[id]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/orders` | GET | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/orders/[orderId]` | GET, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/orders/[orderId]/shipments` | POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/overview` | GET | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/preview` | GET | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/digital-assets` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/digital-assets/[assetId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/images` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/images/[imageId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/options` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/options/[optionId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/options/[optionId]/values` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/options/[optionId]/values/[valueId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/variants` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/products/[id]/variants/[variantId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipments/[shipmentId]` | DELETE, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/methods/[methodId]` | DELETE, GET, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/methods/[methodId]/tiers` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/settings` | GET, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/tiers/[tierId]` | DELETE, GET, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/zones` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/zones/[zoneId]` | DELETE, GET, PATCH | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/store/shipping/zones/[zoneId]/methods` | GET, POST | public | org, user | Gestão de loja da organização (catálogo, encomendas, envio e configurações). |
| `/api/org/[orgId]/tournaments/blocks/bulk` | POST | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/tournaments/blocks/overrides` | GET, POST | public | org, orgEmail, user | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/tournaments/broadcast` | POST | public | org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/tournaments/create` | POST | public | admin, org, orgEmail, user | Criar novo recurso. |
| `/api/org/[orgId]/tournaments/pairings/swap` | POST | public | org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/trainers/profile` | GET, PATCH | public | org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/username` | PATCH | public | org, orgEmail | Operações de organização e contexto empresarial. |
| `/api/org/[orgId]/venues/recent` | GET | public | org, user | Operações de organização e contexto empresarial. |
| `/api/organizations/search` | GET | public | none detected | Pesquisa com filtros e paginação. |
| `/api/padel/calendar` | DELETE, GET, PATCH, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/auto-schedule` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/auto-schedule/runs/[runId]` | GET | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/auto-schedule/undo` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/claims/commit` | PATCH, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/matches/bulk-reschedule` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/calendar/preflight-mismatch` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/categories/my` | DELETE, GET, PATCH, POST | public | org, user | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/clubs` | DELETE, GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/clubs/[id]/courts` | DELETE, GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/clubs/[id]/staff` | DELETE, GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/clubs/[id]/staff/invites` | GET, PATCH, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/discover` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/event-categories` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/formats/plan` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches` | GET, POST | public | admin, org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/dispute` | PATCH, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/result/confirm` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/result/override` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/result/reject` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/result/reset-pending` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/result/submit` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/[id]/walkover` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/assign` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/matches/generate` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/me/history` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/me/matches` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/me/summary` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/onboarding` | GET, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/ops/summary` | GET | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/[id]/accept` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/[id]/actions/cancel` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/[id]/actions/reopen` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/[id]/checkout` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/[id]/decline` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/claim/[token]` | GET, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/invite-status` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/pairings/open` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements` | GET, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements/[id]/approve` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements/[id]/grants` | DELETE, GET, PATCH, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements/[id]/pause` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements/[id]/revoke` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/agreements/[id]/windows` | DELETE, GET, PATCH, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/compensation-cases` | GET, PATCH | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/organizations` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/overrides` | GET, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/overrides/[id]/execute` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/tournament-requests` | GET, POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/tournament-requests/[id]/approve` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/tournament-requests/[id]/reject` | POST | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/partnerships/workspace/[id]/calendar` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/players` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/public/clubs` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/public/live` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/public/open-pairings` | GET | public | none detected | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/rankings` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/rounds/advance` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/rulesets` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/standings` | GET | public | org, user | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/teams` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/teams/[id]/invites` | GET, PATCH, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/teams/entries` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/tournaments/config` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/tournaments/lifecycle` | GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/tournaments/roles` | DELETE, GET, POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/padel/tournaments/seeds` | POST | public | org | Funcionalidade de padel (calendário, jogos, equipas, torneios e rankings). |
| `/api/payments/intent` | POST | public | admin | Operações e estado de pagamentos. |
| `/api/platform/fees` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/profiles/check-username` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/profiles/save-basic` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/public/agenda` | GET | public | none detected | Consulta de agenda/calendário. |
| `/api/public/profile` | GET | public | none detected | Endpoints públicos consumidos sem backoffice. |
| `/api/public/profile/events` | GET | public | none detected | Endpoints públicos consumidos sem backoffice. |
| `/api/public/store/bundles` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/cart` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/cart/bundles` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/cart/bundles/[bundleKey]` | DELETE, PATCH | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/cart/items` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/cart/items/[itemId]` | DELETE, PATCH | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/catalog` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/checkout` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/checkout/prefill` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/digital/download` | GET, POST | public | user | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/digital/grants` | GET | public | user | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/digital/lookup` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/orders/invoice` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/orders/lookup` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/orders/receipt` | POST | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/product` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/recommendations` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/shipping/methods` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/public/store/shipping/quote` | GET | public | none detected | APIs públicas de e-commerce (catálogo, carrinho, checkout e pós-compra). |
| `/api/qr/[token]` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/search` | GET | public | none detected | Pesquisa com filtros e paginação. |
| `/api/servicos/[id]` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/servicos/[id]/calendario` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/servicos/[id]/checkout` | POST | public | none detected | Fluxo de checkout/pagamento. |
| `/api/servicos/[id]/reservar` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/servicos/list` | GET | public | none detected | Listagem de entidades com filtros. |
| `/api/social/feed` | GET | public | none detected | Feed cronológico de atividade/notificações. |
| `/api/social/follow` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/social/follow-organization` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/social/follow-requests` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/follow-requests/accept` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/social/follow-requests/cancel` | POST | public | none detected | Cancelar operação existente. |
| `/api/social/follow-requests/decline` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/social/follow-status` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/followers` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/following` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/organization-follow-status` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/organization-followers` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/suggestions` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/social/unfollow` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/social/unfollow-organization` | POST | public | none detected | Operação de API específica deste domínio. |
| `/api/stripe/webhook` | POST | public | webhook | Receber eventos webhook de sistemas externos. |
| `/api/support/tickets` | POST | public | none detected | Suporte e gestão de tickets. |
| `/api/tickets/resale/cancel` | POST | public | admin | Cancelar operação existente. |
| `/api/tickets/resale/list` | POST | public | admin | Listagem de entidades com filtros. |
| `/api/upload` | POST | public | org, user | Operação de API específica deste domínio. |
| `/api/upload/delete` | POST | public | org, user | Apagar recurso existente. |
| `/api/username/check` | GET | public | none detected | Operação de API específica deste domínio. |
| `/api/users/search` | GET | public | none detected | Pesquisa com filtros e paginação. |
