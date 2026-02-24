# V9 Inventory — Frontend API Usage

Total endpoints referenced: 461

## /api/address/autocomplete
- apps/mobile/features/discover/location.ts
- lib/geo/client.ts

## /api/address/details
- apps/mobile/features/discover/location.ts
- lib/geo/client.ts

## /api/address/reverse
- lib/geo/client.ts

## /api/admin/audit/list
- app/admin/(protected)/audit/page.tsx

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

## /api/admin/infra/redis/start
- app/admin/(protected)/infra/InfraClient.tsx

## /api/admin/infra/redis/stop
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

## /api/admin/padel/settings
- app/admin/(protected)/settings/page.tsx

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

## /api/admin/support/tickets/[id]
- app/admin/(protected)/suporte/[id]/page.tsx

## /api/admin/support/tickets/[id]/events
- app/admin/(protected)/suporte/[id]/page.tsx

## /api/admin/support/tickets/[id]/status
- app/admin/(protected)/suporte/[id]/page.tsx

## /api/admin/support/tickets/list
- app/admin/(protected)/suporte/page.tsx

## /api/admin/tickets/export
- app/admin/components/AdminTopActions.tsx

## /api/admin/tickets/list
- app/admin/(protected)/tickets/page.tsx

## /api/admin/utilizadores/manage
- app/admin/(protected)/utilizadores/UsersTableClient.tsx

## /api/auth/apple/link
- app/auth/callback/page.tsx

## /api/auth/bootstrap
- app/components/autenticação/AuthModal.tsx
- app/hooks/useUser.ts

## /api/auth/check-email
- app/components/autenticação/AuthModal.tsx

## /api/auth/login
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx
- apps/mobile/app/auth/email.tsx

## /api/auth/logout
- app/admin/components/AdminLayout.tsx
- app/admin/forbidden/ForbiddenClient.tsx
- app/components/Navbar.tsx
- app/components/autenticação/AuthModal.tsx
- app/me/settings/page.tsx
- app/org/_internal/core/OrganizationTopBar.tsx

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

## /api/cobrancas/[token]
- app/cobrancas/[token]/ChargeClient.tsx

## /api/cobrancas/[token]/checkout
- app/cobrancas/[token]/ChargeClient.tsx

## /api/convites/[token]
- app/convites/[token]/InviteClient.tsx

## /api/convites/[token]/checkout
- app/convites/[token]/InviteClient.tsx

## /api/crm/engagement
- app/components/crm/CrmEngagementTracker.tsx
- apps/mobile/lib/crm.ts

## /api/cron/analytics/rollup
- lib/cron/jobs.ts

## /api/cron/bookings/cleanup
- lib/cron/jobs.ts

## /api/cron/bookings/split-garantido
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

## /api/cron/padel/arbitration-compensation
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

## /api/eventos/[slug]/invite-token
- app/eventos/[slug]/InviteGateClient.tsx
- apps/mobile/app/event/[slug].tsx

## /api/eventos/[slug]/invites/check
- app/eventos/[slug]/InviteGateClient.tsx
- apps/mobile/app/event/[slug].tsx

## /api/eventos/[slug]/public
- apps/mobile/features/events/api.ts

## /api/eventos/[slug]/resales
- app/eventos/[slug]/page.tsx

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

## /api/explorar/eventos/[slug]
- apps/mobile/features/profile/api.ts

## /api/explorar/list
- app/components/Navbar.tsx
- app/descobrir/_explorar/ExplorarContent.tsx
- apps/mobile/__tests__/discover-pagination.contract.test.ts
- apps/mobile/features/discover/api.ts

## /api/inscricoes/[id]/submit
- app/inscricoes/[id]/FormSubmissionClient.tsx

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

## /api/me/inscricoes/[id]
- apps/mobile/features/tournaments/api.ts

## /api/me/location/consent
- apps/mobile/features/onboarding/api.ts

## /api/me/loyalty/recompensas
- app/me/carteira/WalletHubClient.tsx

## /api/me/loyalty/recompensas/[rewardId]/resgatar
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

## /api/me/purchases/store/[orderId]
- app/me/compras/loja/[orderId]/page.tsx
- apps/mobile/features/store/api.ts

## /api/me/purchases/store/[orderId]/invoice
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx

## /api/me/purchases/store/[orderId]/receipt
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx
- apps/mobile/features/store/api.ts

## /api/me/push-tokens
- apps/mobile/__tests__/push-sync.test.ts
- apps/mobile/lib/push.ts

## /api/me/reservas
- app/me/reservas/page.tsx
- apps/mobile/features/bookings/api.ts

## /api/me/reservas/[id]
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/checkout/index.tsx

## /api/me/reservas/[id]/cancel
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx
- apps/mobile/features/bookings/api.ts

## /api/me/reservas/[id]/cancel/preview
- app/me/reservas/page.tsx
- apps/mobile/features/bookings/api.ts

## /api/me/reservas/[id]/invites
- app/me/reservas/page.tsx

## /api/me/reservas/[id]/reschedule
- app/me/reservas/page.tsx

## /api/me/reservas/[id]/reschedule/respond
- app/me/reservas/page.tsx
- apps/mobile/features/bookings/api.ts

## /api/me/reservas/[id]/review
- app/me/reservas/page.tsx

## /api/me/reservas/[id]/split
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

## /api/me/wallet/[entitlementId]
- app/me/bilhetes/[id]/TicketDetailClient.tsx
- apps/mobile/features/wallet/api.ts

## /api/messages/blocks
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[conversationId]
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations/[conversationId]/leave
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/conversations/[conversationId]/messages
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[conversationId]/messages/[messageId]
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[conversationId]/notifications
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/[conversationId]/read
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- apps/mobile/features/messages/api.ts

## /api/messages/conversations/resolve
- apps/mobile/features/messages/api.ts

## /api/messages/grants
- app/org/_internal/core/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/grants/[grantId]/accept
- app/org/_internal/core/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/grants/[grantId]/decline
- app/org/_internal/core/(dashboard)/chat/ChannelRequestsPanel.tsx
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- apps/mobile/features/messages/api.ts

## /api/messages/messages
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/messages/messages/[messageId]
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/messages/[messageId]/pins
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/messages/[messageId]/reactions
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/messages/search
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx

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

## /api/org-hub
- lib/canonicalOrgApiPath.ts

## /api/org-hub/groups/[groupId]/dashboard/agenda
- app/org/_internal/core/organizations/GroupDashboardClient.tsx

## /api/org-hub/groups/[groupId]/dashboard/crm
- app/org/_internal/core/organizations/GroupDashboardClient.tsx

## /api/org-hub/groups/[groupId]/dashboard/finance
- app/org/_internal/core/organizations/GroupDashboardClient.tsx

## /api/org-hub/groups/[groupId]/dashboard/rankings
- app/org/_internal/core/organizations/GroupDashboardClient.tsx

## /api/org-hub/groups/[groupId]/dashboard/reservas
- app/org/_internal/core/organizations/GroupDashboardClient.tsx

## /api/org-hub/groups/[groupId]/governance
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/[groupId]/governance/members
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/[groupId]/owner/transfer/cancel
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/[groupId]/owner/transfer/confirm
- app/org/_internal/core/organizations/GroupsHubClient.tsx
- app/org/_internal/core/organizations/OwnerTransferConfirmClient.tsx

## /api/org-hub/groups/[groupId]/owner/transfer/start
- app/org/_internal/core/(dashboard)/staff/page.tsx
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/exit-requests
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/exit-requests/[id]/email/confirm
- app/org/_internal/core/organizations/GroupsHubClient.tsx
- app/org/_internal/core/organizations/RequestEmailConfirmClient.tsx

## /api/org-hub/groups/exit-requests/[id]/email/resend
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/exit-requests/[id]/generate-code
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/exit-requests/[id]/verify-codes
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/join-requests
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/join-requests/[id]/email/confirm
- app/org/_internal/core/organizations/GroupsHubClient.tsx
- app/org/_internal/core/organizations/RequestEmailConfirmClient.tsx

## /api/org-hub/groups/join-requests/[id]/email/resend
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/join-requests/[id]/generate-code
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/groups/join-requests/[id]/verify-codes
- app/org/_internal/core/organizations/GroupsHubClient.tsx

## /api/org-hub/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- apps/mobile/features/notifications/api.ts

## /api/org-hub/organizations
- app/me/page.tsx
- components/organization/BecomeOrganizationForm.tsx
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org-hub/organizations/[id]
- app/org/_internal/core/(dashboard)/settings/page.tsx

## /api/org-hub/organizations/[id]/suspend
- app/org/_internal/core/(dashboard)/settings/page.tsx
- app/org/_internal/core/DashboardClient.tsx
- app/org/_internal/core/OrganizationDashboardShell.tsx

## /api/org-hub/organizations/leave
- app/org/_internal/core/(dashboard)/staff/page.tsx

## /api/org-hub/organizations/members
- app/org/_components/subnav/TeamSubnav.tsx
- app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx
- app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/reservas/profissionais/page.tsx
- app/org/_internal/core/(dashboard)/staff/page.tsx
- app/org/_internal/core/DashboardClient.tsx
- app/org/_internal/core/promo/PromoCodesClient.tsx

## /api/org-hub/organizations/members/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/org/_internal/core/(dashboard)/staff/page.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/org-hub/organizations/members/permissions
- app/org/_internal/core/(dashboard)/staff/page.tsx

## /api/org-hub/organizations/settings/official-email
- app/org/_internal/core/(dashboard)/settings/page.tsx

## /api/org-hub/organizations/settings/official-email/confirm
- app/org/_internal/core/(dashboard)/settings/verify/page.tsx

## /api/org-hub/organizations/switch
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/org/_internal/core/OrganizationDashboardShell.tsx
- app/org/_internal/core/OrganizationTopBar.tsx
- app/org/_internal/core/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/org/[orgId]
- app/components/checkin/CheckinScanner.tsx
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx
- app/org/[orgId]/finance/FinanceToolClient.tsx
- app/org/[orgId]/policies/PoliciesToolClient.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/agenda
- app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/agenda/soft-blocks
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/analytics/buyers
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/analytics/cohorts
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx

## /api/org/[orgId]/analytics/conversion
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx

## /api/org/[orgId]/analytics/dimensoes
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/analytics/events
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx

## /api/org/[orgId]/analytics/overview
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/analytics/time-series
- app/org/[orgId]/analytics/AnalyticsToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/audit
- app/org/_internal/core/(dashboard)/staff/page.tsx

## /api/org/[orgId]/checkin
- app/components/checkin/CheckinScanner.tsx

## /api/org/[orgId]/checkin/manual
- app/org/[orgId]/check-in/OrgCheckInOperationsClient.tsx

## /api/org/[orgId]/checkin/preview
- app/components/checkin/CheckinScanner.tsx

## /api/org/[orgId]/consentimentos
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/consentimentos/[userId]
- app/org/_internal/core/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[orgId]/crm/campanhas
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/campanhas/[campaignId]/approve
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/campanhas/[campaignId]/cancel
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/campanhas/[campaignId]/enviar
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/campanhas/[campaignId]/reject
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/campanhas/[campaignId]/submit
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx

## /api/org/[orgId]/crm/clientes
- app/org/_internal/core/(dashboard)/crm/clientes/page.tsx

## /api/org/[orgId]/crm/clientes/[customerId]
- app/org/_internal/core/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[orgId]/crm/clientes/[customerId]/notas
- app/org/_internal/core/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[orgId]/crm/clientes/[customerId]/tags
- app/org/_internal/core/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/org/[orgId]/crm/config
- app/org/[orgId]/policies/PoliciesToolClient.tsx
- app/org/_internal/core/(dashboard)/crm/journeys/page.tsx

## /api/org/[orgId]/crm/journeys
- app/org/_internal/core/(dashboard)/crm/journeys/page.tsx

## /api/org/[orgId]/crm/journeys/[id]
- app/org/_internal/core/(dashboard)/crm/journeys/page.tsx

## /api/org/[orgId]/crm/journeys/[id]/pause
- app/org/_internal/core/(dashboard)/crm/journeys/page.tsx

## /api/org/[orgId]/crm/journeys/[id]/publish
- app/org/_internal/core/(dashboard)/crm/journeys/page.tsx

## /api/org/[orgId]/crm/relatorios
- app/org/_internal/core/(dashboard)/crm/relatorios/page.tsx

## /api/org/[orgId]/crm/saved-views
- app/org/_internal/core/(dashboard)/crm/clientes/page.tsx
- app/org/_internal/core/(dashboard)/crm/segmentos/page.tsx

## /api/org/[orgId]/crm/saved-views/[id]
- app/org/_internal/core/(dashboard)/crm/clientes/page.tsx
- app/org/_internal/core/(dashboard)/crm/segmentos/page.tsx

## /api/org/[orgId]/crm/segmentos
- app/org/_internal/core/(dashboard)/crm/campanhas/page.tsx
- app/org/_internal/core/(dashboard)/crm/segmentos/page.tsx

## /api/org/[orgId]/crm/segmentos/[segmentId]
- app/org/_internal/core/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/org/[orgId]/crm/segmentos/[segmentId]/preview
- app/org/_internal/core/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/org/[orgId]/dashboard/tools/visibility
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/events/[id]/attendees
- app/org/[orgId]/check-in/OrgCheckInOperationsClient.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/org/[orgId]/events/[id]/invite-token
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/events/[id]/invites
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx

## /api/org/[orgId]/events/[id]/refund
- app/org/_internal/core/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/org/[orgId]/events/create
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx

## /api/org/[orgId]/events/list
- app/components/checkin/CheckinScanner.tsx
- app/org/[orgId]/check-in/OrgCheckInOperationsClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/events/summary
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/events/update
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/faturacao
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/finance/exports/fees
- app/org/[orgId]/finance/FinanceToolClient.tsx

## /api/org/[orgId]/finance/exports/ledger
- app/org/[orgId]/finance/FinanceToolClient.tsx

## /api/org/[orgId]/finance/exports/payouts
- app/org/[orgId]/finance/FinanceToolClient.tsx

## /api/org/[orgId]/finance/invoicing
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/overview
- app/org/[orgId]/finance/FinanceToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/payouts/connect
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/payouts/list
- app/org/_internal/core/pagamentos/PayoutsPanel.tsx

## /api/org/[orgId]/finance/payouts/settings
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/payouts/status
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/payouts/summary
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/finance/reconciliation
- app/org/[orgId]/finance/FinanceToolClient.tsx

## /api/org/[orgId]/inscricoes
- app/org/_internal/core/(dashboard)/inscricoes/page.tsx

## /api/org/[orgId]/inscricoes/[id]
- app/org/_internal/core/(dashboard)/inscricoes/[id]/page.tsx
- app/org/_internal/core/(dashboard)/inscricoes/page.tsx

## /api/org/[orgId]/inscricoes/[id]/export
- app/org/_internal/core/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[orgId]/inscricoes/[id]/submissions
- app/org/_internal/core/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[orgId]/inscricoes/[id]/summary
- app/org/_internal/core/(dashboard)/inscricoes/[id]/page.tsx

## /api/org/[orgId]/loyalty/programa
- app/org/_internal/core/(dashboard)/crm/loyalty/page.tsx

## /api/org/[orgId]/loyalty/recompensas
- app/org/_internal/core/(dashboard)/crm/loyalty/page.tsx

## /api/org/[orgId]/loyalty/regras
- app/org/_internal/core/(dashboard)/crm/loyalty/page.tsx

## /api/org/[orgId]/marketing/overview
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/me
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/(dashboard)/settings/page.tsx
- app/org/_internal/core/(dashboard)/staff/page.tsx
- app/org/_internal/core/DashboardClient.tsx
- app/org/_internal/core/ObjectiveSubnav.tsx
- app/org/_internal/core/OrganizationDashboardShell.tsx
- app/org/_internal/core/OrganizationTopBar.tsx

## /api/org/[orgId]/ops/feed
- app/org/[orgId]/finance/FinanceToolClient.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/pagamentos/invoices
- app/org/_internal/core/pagamentos/invoices/invoices-client.tsx

## /api/org/[orgId]/policies
- app/org/[orgId]/policies/PoliciesToolClient.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/policies/[id]
- app/org/[orgId]/policies/PoliciesToolClient.tsx

## /api/org/[orgId]/policies/padel
- app/org/[orgId]/policies/PoliciesToolClient.tsx

## /api/org/[orgId]/policies/store
- app/org/[orgId]/policies/PoliciesToolClient.tsx

## /api/org/[orgId]/promo
- app/org/_internal/core/DashboardClient.tsx
- app/org/_internal/core/promo/PromoCodesClient.tsx

## /api/org/[orgId]/promo/[id]
- app/org/_internal/core/promo/PromoCodesClient.tsx

## /api/org/[orgId]/refunds/list
- app/org/_internal/core/pagamentos/RefundsPanel.tsx

## /api/org/[orgId]/reservas
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/reservas/[id]/cancel
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/charges
- app/org/_internal/core/(dashboard)/reservas/_components/BookingChargesPanel.tsx

## /api/org/[orgId]/reservas/[id]/checkout
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/invites
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/no-show
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/participants
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/reschedule
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/[id]/split
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/clientes
- app/org/_internal/core/(dashboard)/reservas/clientes/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/config
- app/[username]/_components/ReservasBookingClient.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/(dashboard)/settings/page.tsx
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/reservas/delays
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/org/[orgId]/reservas/disponibilidade
- app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/org/[orgId]/reservas/disponibilidade/changesets
- app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]
- app/org/[orgId]/bookings/availability/conflicts/[changeSetId]/page.tsx

## /api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/apply
- app/org/[orgId]/bookings/availability/conflicts/[changeSetId]/page.tsx

## /api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/cancel
- app/org/[orgId]/bookings/availability/conflicts/[changeSetId]/page.tsx

## /api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/conflicts/[conflictId]/resolve
- app/org/[orgId]/bookings/availability/conflicts/[changeSetId]/page.tsx

## /api/org/[orgId]/reservas/profissionais
- app/org/[orgId]/bookings/availability/page.tsx
- app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/(dashboard)/reservas/profissionais/page.tsx

## /api/org/[orgId]/reservas/profissionais/[id]
- app/org/_internal/core/(dashboard)/reservas/profissionais/page.tsx

## /api/org/[orgId]/reservas/recursos
- app/org/[orgId]/bookings/availability/page.tsx
- app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/(dashboard)/reservas/recursos/page.tsx

## /api/org/[orgId]/reservas/recursos/[id]
- app/org/_internal/core/(dashboard)/reservas/recursos/page.tsx

## /api/org/[orgId]/reservas/summary
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/servicos
- app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx
- app/org/_internal/core/(dashboard)/reservas/novo/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx
- app/org/_internal/core/(dashboard)/reservas/servicos/page.tsx
- app/org/_internal/core/DashboardClient.tsx

## /api/org/[orgId]/servicos/[id]
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/addons
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/addons/[addonId]
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/class-series
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/class-series/[seriesId]
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/class-sessions
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/packages
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/packages/[packageId]
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/packs
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/servicos/[id]/packs/[packId]
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx

## /api/org/[orgId]/store
- app/org/[orgId]/store/OrgStoreToolClient.tsx

## /api/org/[orgId]/store/bundles
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreBundleItemsPanel.tsx
- components/store/StoreBundlesPanel.tsx

## /api/org/[orgId]/store/bundles/[id]
- components/store/StoreBundlesPanel.tsx

## /api/org/[orgId]/store/bundles/[id]/items
- components/store/StoreBundleItemsPanel.tsx
- components/store/StoreBundlesPanel.tsx

## /api/org/[orgId]/store/bundles/[id]/items/[itemId]
- components/store/StoreBundleItemsPanel.tsx

## /api/org/[orgId]/store/categories
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreCategoriesPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/categories/[id]
- components/store/StoreCategoriesPanel.tsx

## /api/org/[orgId]/store/orders
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreOrdersPanel.tsx

## /api/org/[orgId]/store/orders/[orderId]
- components/store/StoreOrdersPanel.tsx

## /api/org/[orgId]/store/orders/[orderId]/shipments
- components/store/StoreOrdersPanel.tsx

## /api/org/[orgId]/store/overview
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreOverviewPanel.tsx

## /api/org/[orgId]/store/preview
- app/org/[orgId]/store/OrgStoreToolClient.tsx

## /api/org/[orgId]/store/products
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreProductDigitalAssetsPanel.tsx
- components/store/StoreProductImagesPanel.tsx
- components/store/StoreProductOptionValuesPanel.tsx
- components/store/StoreProductOptionsPanel.tsx
- components/store/StoreProductVariantsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/digital-assets
- components/store/StoreProductDigitalAssetsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/digital-assets/[assetId]
- components/store/StoreProductDigitalAssetsPanel.tsx

## /api/org/[orgId]/store/products/[id]/images
- components/store/StoreProductImagesPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/images/[imageId]
- components/store/StoreProductImagesPanel.tsx

## /api/org/[orgId]/store/products/[id]/options
- components/store/StoreProductOptionsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/options/[optionId]
- components/store/StoreProductOptionsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/options/[optionId]/values
- components/store/StoreProductOptionValuesPanel.tsx

## /api/org/[orgId]/store/products/[id]/options/[optionId]/values/[valueId]
- components/store/StoreProductOptionValuesPanel.tsx

## /api/org/[orgId]/store/products/[id]/variants
- components/store/StoreBundleItemsPanel.tsx
- components/store/StoreProductVariantsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/products/[id]/variants/[variantId]
- components/store/StoreProductVariantsPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/org/[orgId]/store/shipments/[shipmentId]
- components/store/StoreOrdersPanel.tsx

## /api/org/[orgId]/store/shipping/methods/[methodId]
- components/store/StoreShippingMethodsPanel.tsx
- components/store/StoreShippingSettingsPanel.tsx

## /api/org/[orgId]/store/shipping/methods/[methodId]/tiers
- components/store/StoreShippingTiersPanel.tsx

## /api/org/[orgId]/store/shipping/settings
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreShippingSettingsPanel.tsx

## /api/org/[orgId]/store/shipping/tiers/[tierId]
- components/store/StoreShippingTiersPanel.tsx

## /api/org/[orgId]/store/shipping/zones
- app/org/[orgId]/store/OrgStoreToolClient.tsx
- components/store/StoreShippingMethodsPanel.tsx
- components/store/StoreShippingSettingsPanel.tsx
- components/store/StoreShippingTiersPanel.tsx
- components/store/StoreShippingZonesPanel.tsx

## /api/org/[orgId]/store/shipping/zones/[zoneId]
- components/store/StoreShippingSettingsPanel.tsx
- components/store/StoreShippingZonesPanel.tsx

## /api/org/[orgId]/store/shipping/zones/[zoneId]/methods
- components/store/StoreShippingMethodsPanel.tsx
- components/store/StoreShippingSettingsPanel.tsx
- components/store/StoreShippingTiersPanel.tsx

## /api/org/[orgId]/tournaments/blocks/bulk
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/tournaments/blocks/overrides
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/org/[orgId]/tournaments/broadcast
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/org/[orgId]/tournaments/create
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/org/[orgId]/tournaments/pairings/swap
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/org/[orgId]/trainers/profile
- app/org/_internal/core/(dashboard)/treinadores/page.tsx

## /api/org/[orgId]/username
- app/org/_internal/core/(dashboard)/settings/page.tsx

## /api/org/[orgId]/venues/recent
- lib/canonicalOrgUiEndpointRegistry.ts

## /api/organizations/search
- app/components/Navbar.tsx
- app/social/page.tsx
- apps/mobile/features/search/api.ts

## /api/padel/calendar
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/auto-schedule
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/auto-schedule/runs/[runId]
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/auto-schedule/undo
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/claims/commit
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/calendar/matches/bulk-reschedule
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/preflight-mismatch
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/categories/my
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/clubs
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubSection.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/padel/clubs/[id]/courts
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx
- app/org/_internal/core/(dashboard)/reservas/page.tsx

## /api/padel/clubs/[id]/staff
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/clubs/[id]/staff/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/padel/discover
- apps/mobile/features/tournaments/api.ts

## /api/padel/event-categories
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/formats/plan
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/matches
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/matches/[id]/dispute
- app/[username]/padel/PadelDisputeButton.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[id]/result/confirm
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[id]/result/override
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/[id]/result/reject
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[id]/result/reset-pending
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[id]/result/submit
- app/[username]/padel/PadelResultSubmitCard.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/[id]/walkover
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/assign
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/generate
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/me/history
- app/me/page.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/me/matches
- app/me/page.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/me/summary
- app/me/page.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/onboarding
- app/me/page.tsx
- app/onboarding/padel/page.tsx
- apps/mobile/features/onboarding/api.ts

## /api/padel/ops/summary
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/pairings
- app/components/checkout/Step1Bilhete.tsx
- app/eventos/[slug]/EventPageClient.tsx
- app/eventos/[slug]/PadelSignupInline.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/[id]/accept
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/[id]/actions/cancel
- app/components/notifications/PairingInviteCard.tsx
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/padel/pairings/[id]/actions/reopen
- app/components/notifications/PairingInviteCard.tsx
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/padel/pairings/[id]/checkout
- apps/mobile/features/checkout/api.ts

## /api/padel/pairings/[id]/decline
- apps/mobile/features/tournaments/api.ts

## /api/padel/pairings/claim/[token]
- app/eventos/[slug]/EventPageClient.tsx

## /api/padel/pairings/invite-status
- app/components/notifications/PairingInviteCard.tsx
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/padel/pairings/open
- app/descobrir/_explorar/ExplorarContent.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/partnerships/agreements
- app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/agreements/[id]/approve
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[id]/grants
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[id]/pause
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[id]/revoke
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/agreements/[id]/windows
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/compensation-cases
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/organizations
- app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/overrides
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/overrides/[id]/execute
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/partnerships/tournament-requests
- app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/tournament-requests/[id]/approve
- app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/tournament-requests/[id]/reject
- app/org/_internal/core/(dashboard)/padel/parcerias/PartnershipsPageClient.tsx

## /api/padel/partnerships/workspace/[id]/calendar
- app/org/_internal/core/(dashboard)/padel/parcerias/[agreementId]/PartnershipWorkspaceClient.tsx

## /api/padel/players
- app/org/_internal/core/(dashboard)/padel/PadelHubSection.tsx

## /api/padel/public/clubs
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx

## /api/padel/public/live
- app/eventos/[slug]/PadelMatchesByCategoryClient.tsx
- app/eventos/[slug]/monitor/MonitorClient.tsx

## /api/padel/public/open-pairings
- app/padel/duplas/PadelOpenPairingsClient.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/rankings
- app/padel/rankings/PadelRankingsClient.tsx

## /api/padel/rounds/advance
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/rulesets
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/standings
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- apps/mobile/features/tournaments/api.ts

## /api/padel/teams
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/teams/[id]/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/social/page.tsx
- apps/mobile/features/notifications/api.ts

## /api/padel/teams/entries
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/tournaments/config
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/tournaments/lifecycle
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentLifecyclePanel.tsx

## /api/padel/tournaments/roles
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx

## /api/padel/tournaments/seeds
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

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

## /api/public/store/cart/bundles/[bundleKey]
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/public/store/cart/items
- apps/mobile/features/store/api.ts
- components/storefront/StorefrontCartOverlay.tsx
- components/storefront/StorefrontProductClient.tsx

## /api/public/store/cart/items/[itemId]
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

## /api/qr/[token]
- app/components/tickets/TicketCard.tsx
- app/components/tickets/TicketDynamicQr.tsx
- app/components/tickets/TicketQrBox.tsx

## /api/search
- lib/globalSearch.ts

## /api/servicos/[id]
- apps/mobile/features/services/api.ts

## /api/servicos/[id]/calendario
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx
- apps/mobile/app/service/[id]/booking.tsx

## /api/servicos/[id]/checkout
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/checkout/index.tsx

## /api/servicos/[id]/reservar
- app/[username]/_components/ReservasBookingClient.tsx
- apps/mobile/app/service/[id]/booking.tsx

## /api/servicos/list
- app/descobrir/_explorar/ExplorarContent.tsx
- app/servicos/page.tsx
- apps/mobile/__tests__/discover-pagination.contract.test.ts
- apps/mobile/features/discover/api.ts

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
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-requests
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-requests/accept
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/social/follow-requests/cancel
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/social/page.tsx

## /api/social/follow-requests/decline
- app/social/page.tsx
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
- app/social/page.tsx
- apps/mobile/features/network/api.ts

## /api/support/tickets
- app/suporte/page.tsx

## /api/tickets/resale/cancel
- apps/mobile/app/wallet/[entitlementId].tsx

## /api/tickets/resale/list
- apps/mobile/app/wallet/[entitlementId].tsx

## /api/upload
- app/components/profile/ProfileHeader.tsx
- app/org/_internal/core/(dashboard)/eventos/EventEditClient.tsx
- app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/org/_internal/core/(dashboard)/eventos/_components/EventCoverLibraryPicker.tsx
- app/org/_internal/core/(dashboard)/eventos/novo/page.tsx
- app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx
- app/org/_internal/core/(dashboard)/settings/page.tsx
- app/org/_internal/core/(dashboard)/treinadores/page.tsx
- components/store/StoreProductImagesPanel.tsx
- components/store/StoreProductsPanel.tsx

## /api/username/check
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx
- app/onboarding/perfil/page.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/users/search
- app/components/Navbar.tsx
- app/components/checkout/Step1Bilhete.tsx
- app/social/page.tsx
- apps/mobile/features/search/api.ts
