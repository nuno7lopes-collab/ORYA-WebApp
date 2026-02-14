# V9 Inventory — Frontend API Usage

Total endpoints referenced: 359

## /api/address/autocomplete
- apps/mobile/features/discover/location.ts
- lib/geo/client.ts

## /api/address/details
- apps/mobile/features/discover/location.ts
- lib/geo/client.ts

## /api/address/reverse
- lib/geo/client.ts

## /api/admin/config/platform-email
- app/admin/(protected)/config/platform-email/page.tsx
- app/admin/(protected)/organizacoes/page.tsx
- app/admin/(protected)/settings/page.tsx

## /api/admin/data/purge
- app/admin/components/AdminDataPurgeTools.tsx

## /api/admin/eventos/list
- app/admin/(protected)/eventos/page.tsx

## /api/admin/eventos/purge
- app/admin/(protected)/eventos/page.tsx

## /api/admin/eventos/update-status
- app/admin/(protected)/eventos/page.tsx

## /api/admin/fees
- app/admin/(protected)/settings/page.tsx

## /api/admin/infra/alerts/status
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/cost/summary
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/deploy
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/hard-pause
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/migrate
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/mode
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/resume
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/rotate-secrets
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/soft-pause
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/start
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/status
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/usage/summary
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/mfa/enroll
- app/admin/mfa/MfaChallengeClient.tsx

## /api/admin/mfa/reset
- app/admin/mfa/MfaChallengeClient.tsx

## /api/admin/mfa/session
- app/admin/components/AdminLayout.tsx
- app/login/page.tsx

## /api/admin/mfa/status
- app/admin/(protected)/settings/page.tsx
- app/admin/mfa/MfaChallengeClient.tsx

## /api/admin/mfa/verify
- app/admin/mfa/MfaChallengeClient.tsx

## /api/admin/ops/analytics-rollups
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/event-log
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/list
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/refresh-payments-status
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/update-payments-mode
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/update-status
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/organizacoes/verify-platform-email
- app/admin/(protected)/organizacoes/page.tsx

## /api/admin/payments/dispute
- app/admin/(protected)/finance/page.tsx

## /api/admin/payments/export
- app/admin/components/AdminTopActions.tsx

## /api/admin/payments/list
- app/admin/(protected)/finance/page.tsx

## /api/admin/payments/overview
- app/admin/(protected)/finance/page.tsx

## /api/admin/payments/refund
- app/admin/(protected)/finance/page.tsx
- app/admin/(protected)/tickets/page.tsx

## /api/admin/payments/reprocess
- app/admin/(protected)/finance/page.tsx
- app/admin/components/PaymentTools.tsx

## /api/admin/refunds/list
- app/admin/(protected)/finance/page.tsx

## /api/admin/refunds/retry
- app/admin/(protected)/finance/page.tsx

## /api/admin/tickets/export
- app/admin/components/AdminTopActions.tsx

## /api/admin/tickets/list
- app/admin/(protected)/tickets/page.tsx

## /api/admin/utilizadores/manage
- app/admin/(protected)/utilizadores/UsersTableClient.tsx

## /api/auth/apple/link
- app/auth/callback/page.tsx

## /api/auth/check-email
- app/components/autenticação/AuthModal.tsx

## /api/auth/clear
- app/components/autenticação/AuthModal.tsx

## /api/auth/login
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/auth/logout
- app/admin/components/AdminLayout.tsx
- app/admin/forbidden/ForbiddenClient.tsx
- app/components/Navbar.tsx
- app/me/settings/page.tsx
- app/organizacao/OrganizationTopBar.tsx

## /api/auth/me
- app/components/autenticação/AuthModal.tsx
- app/hooks/useUser.ts

## /api/auth/password/reset-request
- app/components/autenticação/AuthModal.tsx

## /api/auth/refresh
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/auth/send-otp
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/checkout/resale
- app/resale/[id]/page.tsx

## /api/checkout/status
- app/components/checkout/Step3Sucesso.tsx
- apps/mobile/features/checkout/api.ts

## /api/cobrancas/[param]
- app/cobrancas/[token]/ChargeClient.tsx

## /api/cobrancas/[param]/checkout
- app/cobrancas/[token]/ChargeClient.tsx

## /api/convites/[param]
- app/convites/[token]/InviteClient.tsx

## /api/convites/[param]/checkout
- app/convites/[token]/InviteClient.tsx

## /api/crm/engagement
- app/components/crm/CrmEngagementTracker.tsx
- apps/mobile/lib/crm.ts

## /api/cron/analytics/rollup
- lib/cron/jobs.ts

## /api/cron/bookings/cleanup
- lib/cron/jobs.ts

## /api/cron/creditos/expire
- lib/cron/jobs.ts

## /api/cron/crm/campanhas
- lib/cron/jobs.ts

## /api/cron/crm/rebuild
- lib/cron/jobs.ts

## /api/cron/entitlements/qr-cleanup
- lib/cron/jobs.ts

## /api/cron/loyalty/expire
- lib/cron/jobs.ts

## /api/cron/operations
- lib/cron/jobs.ts

## /api/cron/padel/expire
- lib/cron/jobs.ts

## /api/cron/padel/matchmaking
- lib/cron/jobs.ts

## /api/cron/padel/partnership-grants/revoke
- lib/cron/jobs.ts

## /api/cron/padel/reminders
- lib/cron/jobs.ts

## /api/cron/padel/split-reminders
- lib/cron/jobs.ts

## /api/cron/padel/tournament-eve
- lib/cron/jobs.ts

## /api/cron/padel/waitlist
- lib/cron/jobs.ts

## /api/cron/repair-usernames
- lib/cron/jobs.ts

## /api/cron/reservations/cleanup
- lib/cron/jobs.ts

## /api/email/verified
- app/components/autenticação/AuthModal.tsx

## /api/eventos/[param]/invite-token
- app/eventos/[slug]/InviteGateClient.tsx
- apps/mobile/app/event/[slug].tsx

## /api/eventos/[param]/invites/check
- app/eventos/[slug]/InviteGateClient.tsx
- apps/mobile/app/event/[slug].tsx

## /api/eventos/[param]/public
- apps/mobile/features/events/api.ts

## /api/eventos/list
- apps/mobile/features/agora/api.ts

## /api/eventos/lookup
- apps/mobile/features/profile/api.ts

## /api/events/favorites
- apps/mobile/features/favorites/api.ts

## /api/events/favorites/notify
- apps/mobile/features/favorites/api.ts

## /api/events/favorites/toggle
- apps/mobile/features/favorites/api.ts

## /api/explorar/eventos/[param]
- apps/mobile/features/profile/api.ts

## /api/explorar/list
- app/components/Navbar.tsx
- app/descobrir/_explorar/ExplorarContent.tsx
- apps/mobile/features/discover/api.ts

## /api/inscricoes/[param]/submit
- app/inscricoes/[id]/FormSubmissionClient.tsx

## /api/live/events/[param]
- app/eventos/[slug]/EventLiveClient.tsx

## /api/live/events/[param]/stream
- app/eventos/[slug]/PadelPublicTablesClient.tsx
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/eventos/[slug]/score/PadelScoreboardClient.tsx
- app/widgets/padel/bracket/BracketWidgetClient.tsx
- app/widgets/padel/calendar/CalendarWidgetClient.tsx
- app/widgets/padel/next/NextMatchesWidgetClient.tsx
- app/widgets/padel/standings/StandingsWidgetClient.tsx

## /api/location/ip
- apps/mobile/features/onboarding/api.ts

## /api/maps/apple-token
- app/components/maps/AppleMapsLoader.tsx

## /api/me
- apps/mobile/features/profile/api.ts

## /api/me/agenda
- app/agora/page.tsx
- app/components/home/HomePersonalized.tsx
- app/me/carteira/WalletHubClient.tsx
- app/me/page.tsx
- apps/mobile/features/profile/api.ts

## /api/me/claim-guest
- app/auth/callback/page.tsx
- app/hooks/useUser.ts

## /api/me/consents
- app/me/settings/page.tsx
- apps/mobile/features/settings/api.ts

## /api/me/contact-phone
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/service/[id]/booking.tsx
- apps/mobile/features/settings/api.ts

## /api/me/events/signals
- app/descobrir/_explorar/eventSignals.ts
- apps/mobile/features/events/signals.ts

## /api/me/location/consent
- apps/mobile/features/onboarding/api.ts

## /api/me/loyalty/recompensas
- app/me/carteira/WalletHubClient.tsx

## /api/me/loyalty/recompensas/[param]/resgatar
- app/me/carteira/WalletHubClient.tsx

## /api/me/notifications
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/me/notifications/feed
- app/components/Navbar.tsx
- app/components/mobile/MobileTopBar.tsx
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/me/notifications/mute
- apps/mobile/features/notifications/api.ts

## /api/me/purchases
- app/me/compras/page.tsx

## /api/me/purchases/store
- app/me/carteira/WalletHubClient.tsx
- app/me/compras/loja/page.tsx
- apps/mobile/features/store/api.ts

## /api/me/purchases/store/[param]
- app/me/compras/loja/[orderId]/page.tsx
- apps/mobile/features/store/api.ts

## /api/me/purchases/store/[param]/invoice
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx

## /api/me/purchases/store/[param]/receipt
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx
- apps/mobile/features/store/api.ts

## /api/me/push-tokens
- apps/mobile/app/settings/index.tsx

## /api/me/reservas
- app/me/reservas/page.tsx

## /api/me/reservas/[param]
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/checkout/index.tsx

## /api/me/reservas/[param]/cancel
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/cancel/preview
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/invites
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/reschedule
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/reschedule/respond
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/review
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/split
- app/me/reservas/page.tsx

## /api/me/settings/delete
- app/me/settings/page.tsx
- apps/mobile/app/settings/index.tsx

## /api/me/settings/email
- app/me/settings/page.tsx
- apps/mobile/features/settings/api.ts

## /api/me/settings/save
- app/me/settings/page.tsx
- apps/mobile/features/settings/api.ts

## /api/me/wallet
- app/components/checkout/Step3Sucesso.tsx
- app/components/wallet/useWallet.ts
- apps/mobile/features/wallet/api.ts

## /api/me/wallet/[param]
- app/me/bilhetes/[id]/TicketDetailClient.tsx
- apps/mobile/features/wallet/api.ts

## /api/messages/blocks
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[param]
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations/[param]/leave
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations/[param]/messages
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[param]/messages/[param]
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[param]/notifications
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[param]/read
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/resolve
- apps/mobile/features/messages/api.ts

## /api/messages/grants
- app/organizacao/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/grants/[param]/accept
- app/organizacao/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/grants/[param]/decline
- app/organizacao/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/messages
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/messages/messages/[param]
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/messages/[param]/pins
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/messages/[param]/reactions
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/search
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx

## /api/notifications/mark-click
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx

## /api/notifications/mark-read
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/notifications/prefs
- app/me/settings/page.tsx
- apps/mobile/app/settings/index.tsx
- apps/mobile/features/settings/api.ts

## /api/org-hub/become
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org-hub/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- apps/mobile/features/notifications/api.ts

## /api/org-hub/organizations
- app/me/page.tsx
- app/organizacao/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/org-hub/organizations/[param]
- app/organizacao/(dashboard)/settings/page.tsx

## /api/org-hub/organizations/leave
- app/organizacao/(dashboard)/staff/page.tsx

## /api/org-hub/organizations/members
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx
- app/organizacao/(dashboard)/staff/page.tsx
- app/organizacao/DashboardClient.tsx
- app/organizacao/promo/PromoCodesClient.tsx

## /api/org-hub/organizations/members/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/staff/page.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/org-hub/organizations/members/permissions
- app/organizacao/(dashboard)/staff/page.tsx

## /api/org-hub/organizations/owner/transfer
- app/organizacao/(dashboard)/staff/page.tsx

## /api/org-hub/organizations/settings/official-email
- app/organizacao/(dashboard)/settings/page.tsx

## /api/org-hub/organizations/settings/official-email/confirm
- app/organizacao/(dashboard)/settings/verify/page.tsx

## /api/org-hub/organizations/switch
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/organizacao/OrganizationDashboardShell.tsx
- app/organizacao/OrganizationTopBar.tsx
- app/organizacao/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/org/[param]
- app/components/checkin/CheckinScanner.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/DashboardClient.tsx

## /api/org/[param]/agenda
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[param]/agenda/soft-blocks
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[param]/audit
- app/organizacao/(dashboard)/staff/page.tsx

## /api/org/[param]/avaliacoes
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/club/finance/overview
- app/organizacao/(dashboard)/clube/caixa/page.tsx

## /api/org/[param]/consentimentos
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[param]/consentimentos/[param]
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[param]/crm/campanhas
- app/organizacao/(dashboard)/crm/campanhas/page.tsx

## /api/org/[param]/crm/campanhas/[param]/[param]
- app/organizacao/(dashboard)/crm/campanhas/page.tsx

## /api/org/[param]/crm/campanhas/[param]/enviar
- app/organizacao/(dashboard)/crm/campanhas/page.tsx

## /api/org/[param]/crm/clientes
- app/organizacao/(dashboard)/crm/clientes/page.tsx

## /api/org/[param]/crm/clientes/[param]
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[param]/crm/clientes/[param]/notas
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[param]/crm/clientes/[param]/tags
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[param]/crm/config
- app/organizacao/(dashboard)/crm/journeys/page.tsx

## /api/org/[param]/crm/journeys
- app/organizacao/(dashboard)/crm/journeys/page.tsx

## /api/org/[param]/crm/journeys/[param]
- app/organizacao/(dashboard)/crm/journeys/page.tsx

## /api/org/[param]/crm/journeys/[param]/[param]
- app/organizacao/(dashboard)/crm/journeys/page.tsx

## /api/org/[param]/crm/relatorios
- app/organizacao/(dashboard)/crm/relatorios/page.tsx

## /api/org/[param]/crm/saved-views
- app/organizacao/(dashboard)/crm/clientes/page.tsx
- app/organizacao/(dashboard)/crm/segmentos/page.tsx

## /api/org/[param]/crm/saved-views/[param]
- app/organizacao/(dashboard)/crm/clientes/page.tsx
- app/organizacao/(dashboard)/crm/segmentos/page.tsx

## /api/org/[param]/crm/segmentos
- app/organizacao/(dashboard)/crm/campanhas/page.tsx
- app/organizacao/(dashboard)/crm/segmentos/page.tsx

## /api/org/[param]/crm/segmentos/[param]
- app/organizacao/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/org/[param]/crm/segmentos/[param]/preview
- app/organizacao/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/org/[param]/events/[param]/attendees
- app/org/[orgId]/check-in/OrgCheckInOperationsClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/org/[param]/events/[param]/invite-token
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[param]/events/[param]/invites
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx

## /api/org/[param]/events/[param]/refund
- app/organizacao/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/org/[param]/events/create
- app/organizacao/(dashboard)/eventos/novo/page.tsx

## /api/org/[param]/events/list
- app/org/[orgId]/check-in/OrgCheckInOperationsClient.tsx
- app/organizacao/(dashboard)/categorias/page.tsx

## /api/org/[param]/events/update
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx

## /api/org/[param]/faturacao
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[param]/finance/reconciliation
- app/organizacao/pagamentos/ReconciliationPanel.tsx

## /api/org/[param]/inscricoes
- app/organizacao/(dashboard)/inscricoes/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/inscricoes/[param]
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx
- app/organizacao/(dashboard)/inscricoes/page.tsx

## /api/org/[param]/inscricoes/[param]/export
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[param]/inscricoes/[param]/submissions
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[param]/inscricoes/[param]/summary
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[param]/loyalty/programa
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/org/[param]/loyalty/recompensas
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/org/[param]/loyalty/regras
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/org/[param]/me
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/settings/page.tsx
- app/organizacao/(dashboard)/staff/page.tsx
- app/organizacao/DashboardClient.tsx
- app/organizacao/ObjectiveSubnav.tsx
- app/organizacao/OrganizationDashboardShell.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx
- app/organizacao/OrganizationTopBar.tsx
- app/organizacao/pagamentos/FinanceAlertsPanel.tsx

## /api/org/[param]/pagamentos/invoices
- app/organizacao/pagamentos/invoices/invoices-client.tsx

## /api/org/[param]/payouts/list
- app/organizacao/pagamentos/PayoutsPanel.tsx

## /api/org/[param]/policies
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/politicas/page.tsx

## /api/org/[param]/policies/[param]
- app/organizacao/(dashboard)/reservas/politicas/page.tsx

## /api/org/[param]/promo
- app/organizacao/promo/PromoCodesClient.tsx

## /api/org/[param]/promo/[param]
- app/organizacao/promo/PromoCodesClient.tsx

## /api/org/[param]/refunds/list
- app/organizacao/pagamentos/RefundsPanel.tsx

## /api/org/[param]/reservas
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/cancel
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/charges
- app/organizacao/(dashboard)/reservas/_components/BookingChargesPanel.tsx

## /api/org/[param]/reservas/[param]/checkout
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/invites
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/no-show
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/participants
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/reschedule
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/[param]/split
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/clientes
- app/organizacao/(dashboard)/reservas/clientes/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/delays
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/org/[param]/reservas/disponibilidade
- app/organizacao/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/org/[param]/reservas/disponibilidade/[param]
- app/organizacao/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/org/[param]/reservas/profissionais
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/profissionais/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/reservas/profissionais/[param]
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx

## /api/org/[param]/reservas/recursos
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/recursos/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/recursos/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/reservas/recursos/[param]
- app/organizacao/(dashboard)/reservas/recursos/page.tsx

## /api/org/[param]/servicos
- app/organizacao/(dashboard)/reservas/novo/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/servicos/page.tsx

## /api/org/[param]/servicos/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/addons
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/addons/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/class-series
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/class-series/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/class-sessions
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/packages
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/packages/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/packs
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/servicos/[param]/packs/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/org/[param]/store
- app/org/[orgId]/store/OrgStoreToolClient.tsx

## /api/org/[param]/store/preview
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/tournaments/[param]
- app/eventos/[slug]/EventLiveClient.tsx

## /api/org/[param]/trainers
- app/organizacao/(dashboard)/staff/page.tsx

## /api/org/[param]/trainers/profile
- app/organizacao/(dashboard)/treinadores/page.tsx

## /api/org/[param]/username
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/org/[param]/venues/recent
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/organizacao/events/create
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/organizacao/events/update
- app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx

## /api/organizacao/tournaments/[param]/generate
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/[param]/live
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/[param]/participants
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/create
- app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx

## /api/organizations/search
- app/components/Navbar.tsx
- app/social/page.tsx
- apps/mobile/features/search/api.ts

## /api/padel/calendar
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/auto-schedule
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/claims/commit
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/categories/my
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/clubs
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubSection.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/padel/clubs/[param]/courts
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/padel/clubs/[param]/staff
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/community/posts
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/discover
- apps/mobile/features/tournaments/api.ts

## /api/padel/event-categories
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches
- app/eventos/[slug]/EventLiveClient.tsx
- app/eventos/[slug]/PadelPublicTablesClient.tsx
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/widgets/padel/bracket/BracketWidgetClient.tsx
- app/widgets/padel/calendar/CalendarWidgetClient.tsx
- app/widgets/padel/next/NextMatchesWidgetClient.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/matches/[param]/delay
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[param]/dispute
- app/[username]/padel/PadelDisputeButton.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/[param]/undo
- app/eventos/[slug]/EventLiveClient.tsx

## /api/padel/matches/[param]/walkover
- app/eventos/[slug]/EventLiveClient.tsx
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/assign
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/generate
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/me/history
- apps/mobile/features/tournaments/api.ts

## /api/padel/me/matches
- apps/mobile/features/tournaments/api.ts

## /api/padel/me/summary
- apps/mobile/features/tournaments/api.ts

## /api/padel/onboarding
- app/me/page.tsx
- app/onboarding/padel/page.tsx
- apps/mobile/features/onboarding/api.ts

## /api/padel/ops/summary
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/pairings
- app/components/checkout/Step1Bilhete.tsx
- app/eventos/[slug]/EventPageClient.tsx
- app/eventos/[slug]/PadelSignupInline.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/[param]/accept
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/[param]/checkout
- apps/mobile/features/checkout/api.ts

## /api/padel/pairings/[param]/decline
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/claim/[param]
- app/eventos/[slug]/EventPageClient.tsx

## /api/padel/pairings/invite-status
- app/components/notifications/PairingInviteCard.tsx
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/padel/pairings/open
- app/descobrir/_explorar/ExplorarContent.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/partnerships/agreements
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/agreements/[param]/[param]
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[param]/grants
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[param]/windows
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/compensation-cases
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/overrides
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/overrides/[param]/execute
- app/organizacao/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/players
- app/organizacao/(dashboard)/padel/PadelHubSection.tsx

## /api/padel/public/calendar
- app/eventos/[slug]/calendario/page.tsx

## /api/padel/public/clubs
- app/organizacao/(dashboard)/eventos/novo/page.tsx

## /api/padel/public/open-pairings
- app/padel/duplas/PadelOpenPairingsClient.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/rankings
- app/padel/rankings/PadelRankingsClient.tsx

## /api/padel/rulesets
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/standings
- app/eventos/[slug]/PadelPublicTablesClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/widgets/padel/standings/StandingsWidgetClient.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/teams
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/teams/entries
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/tournaments/config
- app/eventos/[slug]/EventLiveClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/tournaments/lifecycle
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentLifecyclePanel.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/tournaments/roles
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx

## /api/padel/tournaments/seeds
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/payments/intent
- app/components/checkout/Step2Pagamento.tsx
- apps/mobile/features/checkout/api.ts

## /api/platform/fees
- app/admin/(protected)/finance/page.tsx

## /api/profiles/check-username
- apps/mobile/features/onboarding/api.ts

## /api/profiles/save-basic
- app/components/autenticação/AuthModal.tsx
- app/components/profile/ProfileHeader.tsx
- app/onboarding/perfil/page.tsx
- apps/mobile/features/onboarding/api.ts
- apps/mobile/features/profile/api.ts

## /api/public/agenda
- apps/mobile/features/profile/api.ts

## /api/public/profile
- apps/mobile/features/profile/api.ts

## /api/public/profile/events
- apps/mobile/features/profile/api.ts

## /api/public/store/bundles
- apps/mobile/features/store/api.ts

## /api/public/store/cart
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx
- components/storefront/StorefrontCheckoutClient.tsx

## /api/public/store/cart/bundles
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontBundleCard.tsx

## /api/public/store/cart/bundles/[param]
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/public/store/cart/items
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartOverlay.tsx
- components/storefront/StorefrontProductClient.tsx

## /api/public/store/cart/items/[param]
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/public/store/catalog
- apps/mobile/features/store/api.ts

## /api/public/store/checkout
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCheckoutClient.tsx

## /api/public/store/checkout/prefill
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCheckoutClient.tsx

## /api/public/store/digital/download
- app/me/compras/loja/page.tsx
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontDownloadsClient.tsx

## /api/public/store/digital/grants
- app/me/compras/loja/page.tsx
- components/storefront/StorefrontDownloadsClient.tsx

## /api/public/store/digital/lookup
- components/storefront/StorefrontDownloadsClient.tsx

## /api/public/store/orders/invoice
- app/loja/seguimento/page.tsx

## /api/public/store/orders/lookup
- app/loja/seguimento/page.tsx

## /api/public/store/orders/receipt
- app/loja/seguimento/page.tsx

## /api/public/store/product
- apps/mobile/features/store/api.ts

## /api/public/store/recommendations
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/public/store/shipping/methods
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCheckoutClient.tsx

## /api/public/store/shipping/quote
- apps/mobile/features/store/api.ts

## /api/qr/[param]
- app/components/tickets/TicketCard.tsx
- app/components/tickets/TicketLiveQr.tsx
- app/components/tickets/TicketQrBox.tsx

## /api/search
- lib/globalSearch.ts

## /api/servicos/[param]
- apps/mobile/features/services/api.ts

## /api/servicos/[param]/calendario
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/service/[id]/booking.tsx

## /api/servicos/[param]/checkout
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/checkout/index.tsx

## /api/servicos/[param]/reservar
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/service/[id]/booking.tsx

## /api/servicos/[param]/slots
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx
- apps/mobile/app/service/[id]/booking.tsx

## /api/servicos/list
- app/descobrir/_explorar/ExplorarContent.tsx
- app/servicos/page.tsx
- apps/mobile/features/discover/api.ts

## /api/social/[param]
- app/components/mobile/MobileProfileOverview.tsx
- app/components/profile/ProfileHeader.tsx

## /api/social/feed
- apps/mobile/features/social/api.ts

## /api/social/follow
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/rede/page.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-organization
- app/components/Navbar.tsx
- app/components/profile/OrganizationFollowClient.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-requests
- app/org/[orgId]/profile/OrgProfileRequestsClient.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-requests/[param]
- app/org/[orgId]/profile/OrgProfileRequestsClient.tsx
- app/social/page.tsx

## /api/social/follow-requests/accept
- apps/mobile/features/network/api.ts

## /api/social/follow-requests/cancel
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/social/page.tsx

## /api/social/follow-requests/decline
- apps/mobile/features/network/api.ts

## /api/social/follow-status
- app/[username]/FollowClient.tsx

## /api/social/followers
- apps/mobile/features/network/followLists.ts

## /api/social/following
- app/components/home/HomePersonalized.tsx
- apps/mobile/features/network/followLists.ts

## /api/social/organization-follow-status
- app/components/profile/OrganizationFollowClient.tsx

## /api/social/organization-followers
- app/components/profile/OrganizationProfileHeader.tsx
- app/org/[orgId]/profile/OrgProfileFollowersClient.tsx
- apps/mobile/features/network/followLists.ts

## /api/social/suggestions
- app/rede/page.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/unfollow
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/rede/page.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/unfollow-organization
- app/components/Navbar.tsx
- app/components/profile/OrganizationFollowClient.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/tickets/resale/cancel
- apps/mobile/app/wallet/[entitlementId].tsx

## /api/tickets/resale/list
- apps/mobile/app/wallet/[entitlementId].tsx

## /api/tournaments/[param]
- apps/mobile/features/tournaments/api.ts

## /api/tournaments/[param]/live
- apps/mobile/features/tournaments/api.ts

## /api/tournaments/[param]/structure
- apps/mobile/features/tournaments/api.ts

## /api/tournaments/list
- apps/mobile/features/tournaments/api.ts

## /api/upload
- app/components/profile/ProfileHeader.tsx
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx
- app/organizacao/(dashboard)/treinadores/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx
- components/store/StoreProductImagesPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/username/check
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx
- app/onboarding/perfil/page.tsx
- app/organizacao/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/users/search
- app/components/Navbar.tsx
- app/components/checkout/Step1Bilhete.tsx
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx
- app/social/page.tsx
- apps/mobile/features/search/api.ts

## /api/widgets/padel/calendar
- app/widgets/padel/calendar/page.tsx
