# V9 Inventory — Frontend API Usage

Total endpoints referenced: 298

## /api/admin/config/platform-email
- app/admin/config/platform-email/page.tsx
- app/admin/organizacoes/page.tsx
- app/admin/settings/page.tsx

## /api/admin/data/purge
- app/admin/components/AdminDataPurgeTools.tsx

## /api/admin/eventos/list
- app/admin/eventos/page.tsx

## /api/admin/eventos/purge
- app/admin/eventos/page.tsx

## /api/admin/fees
- app/admin/settings/page.tsx

## /api/admin/infra/alerts/status
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/cost/summary
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/deploy
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/hard-pause
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/migrate
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/resume
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/rotate-secrets
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/soft-pause
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/start
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/status
- app/admin/infra/InfraClient.tsx

## /api/admin/infra/usage/summary
- app/admin/infra/InfraClient.tsx

## /api/admin/mfa/enroll
- app/admin/infra/InfraClient.tsx

## /api/admin/mfa/reset
- app/admin/infra/InfraClient.tsx

## /api/admin/mfa/session
- app/admin/components/AdminLayout.tsx

## /api/admin/mfa/status
- app/admin/infra/InfraClient.tsx

## /api/admin/mfa/verify
- app/admin/infra/InfraClient.tsx

## /api/admin/ops/analytics-rollups
- app/admin/organizacoes/page.tsx

## /api/admin/organizacoes/event-log
- app/admin/organizacoes/page.tsx

## /api/admin/organizacoes/list
- app/admin/organizacoes/page.tsx

## /api/admin/organizacoes/refresh-payments-status
- app/admin/organizacoes/page.tsx

## /api/admin/organizacoes/update-status
- app/admin/organizacoes/page.tsx

## /api/admin/organizacoes/verify-platform-email
- app/admin/organizacoes/page.tsx

## /api/admin/payments/dispute
- app/admin/finance/page.tsx

## /api/admin/payments/export
- app/admin/components/AdminTopActions.tsx

## /api/admin/payments/list
- app/admin/finance/page.tsx

## /api/admin/payments/overview
- app/admin/finance/page.tsx

## /api/admin/payments/refund
- app/admin/finance/page.tsx
- app/admin/tickets/page.tsx

## /api/admin/payments/reprocess
- app/admin/components/PaymentTools.tsx
- app/admin/finance/page.tsx

## /api/admin/payouts/[param]
- app/admin/finance/page.tsx

## /api/admin/payouts/[param]/[param]
- app/admin/finance/page.tsx

## /api/admin/payouts/list
- app/admin/finance/page.tsx

## /api/admin/refunds/list
- app/admin/finance/page.tsx

## /api/admin/refunds/retry
- app/admin/finance/page.tsx

## /api/admin/tickets/export
- app/admin/components/AdminTopActions.tsx

## /api/admin/tickets/list
- app/admin/tickets/page.tsx

## /api/admin/utilizadores/manage
- app/admin/utilizadores/UsersTableClient.tsx

## /api/auth/apple/link
- app/auth/callback/page.tsx

## /api/auth/login
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/auth/logout
- app/admin/components/AdminLayout.tsx
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

## /api/auth/resend-otp
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/auth/send-otp
- app/components/autenticação/AuthModal.tsx
- app/components/checkout/AuthWall.tsx

## /api/chat/attachments/presign
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/blocks
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations/[param]
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations/[param]/leave
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations/[param]/messages
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations/[param]/notifications
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/conversations/[param]/read
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/messages
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/messages/[param]
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/messages/[param]/pins
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/messages/[param]/reactions
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts

## /api/chat/search
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx

## /api/checkout/resale
- app/resale/[id]/page.tsx

## /api/checkout/status
- app/components/checkout/Step3Sucesso.tsx

## /api/convites/[param]
- app/convites/[token]/InviteClient.tsx

## /api/convites/[param]/checkout
- app/convites/[token]/InviteClient.tsx

## /api/eventos/[param]/invite-token
- app/eventos/[slug]/InviteGateClient.tsx

## /api/eventos/[param]/invites/check
- app/eventos/[slug]/InviteGateClient.tsx

## /api/explorar/list
- app/components/Navbar.tsx
- app/explorar/_components/ExplorarContent.tsx

## /api/inscricoes/[param]/submit
- app/inscricoes/[id]/FormSubmissionClient.tsx

## /api/livehub/[param]
- app/eventos/[slug]/EventLiveClient.tsx

## /api/maps/apple-token
- app/components/maps/AppleMapsLoader.tsx

## /api/me/agenda
- app/agora/page.tsx
- app/components/home/HomePersonalized.tsx
- app/me/carteira/WalletHubClient.tsx
- app/me/page.tsx

## /api/me/claim-guest
- app/auth/callback/page.tsx
- app/hooks/useUser.ts

## /api/me/consents
- app/me/settings/page.tsx

## /api/me/contact-phone
- app/[username]/_components/ReservasBookingClient.tsx

## /api/me/loyalty/recompensas
- app/me/carteira/WalletHubClient.tsx

## /api/me/loyalty/recompensas/[param]/resgatar
- app/me/carteira/WalletHubClient.tsx

## /api/me/purchases
- app/me/compras/page.tsx

## /api/me/reservas
- app/me/reservas/page.tsx

## /api/me/reservas/[param]
- app/[username]/_components/ReservasBookingClient.tsx

## /api/me/reservas/[param]/cancel
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/cancel/preview
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/invites
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/invites/resend
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/reschedule
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/review
- app/me/reservas/page.tsx

## /api/me/reservas/[param]/split
- app/me/reservas/page.tsx

## /api/me/settings/delete
- app/me/settings/page.tsx

## /api/me/settings/email
- app/me/settings/page.tsx

## /api/me/settings/save
- app/me/settings/page.tsx

## /api/me/store
- app/me/loja/page.tsx

## /api/me/store/bundles
- app/me/loja/page.tsx

## /api/me/store/categories
- app/me/loja/page.tsx

## /api/me/store/orders
- app/me/loja/page.tsx

## /api/me/store/overview
- app/me/loja/page.tsx

## /api/me/store/products
- app/me/loja/page.tsx

## /api/me/store/purchases
- app/me/carteira/WalletHubClient.tsx
- app/me/compras/loja/page.tsx

## /api/me/store/purchases/[param]
- app/me/compras/loja/[orderId]/page.tsx

## /api/me/store/purchases/[param]/invoice
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx

## /api/me/store/purchases/[param]/receipt
- app/me/compras/loja/[orderId]/page.tsx
- app/me/compras/loja/page.tsx

## /api/me/store/shipping/settings
- app/me/loja/page.tsx

## /api/me/wallet
- app/components/checkout/Step3Sucesso.tsx
- app/components/wallet/useWallet.ts

## /api/me/wallet/[param]
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/notifications
- app/components/Navbar.tsx
- app/components/mobile/MobileTopBar.tsx
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx

## /api/notifications/mark-click
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx

## /api/notifications/mark-read
- app/components/notifications/NotificationBell.tsx
- app/social/page.tsx

## /api/notifications/prefs
- app/me/settings/page.tsx

## /api/organizacao/audit
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/avaliacoes
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizacao/checkin
- app/components/checkin/CheckinScanner.tsx

## /api/organizacao/checkin/preview
- app/components/checkin/CheckinScanner.tsx

## /api/organizacao/club/finance/overview
- app/organizacao/(dashboard)/clube/caixa/page.tsx

## /api/organizacao/consentimentos/[param]
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/organizacao/crm/campanhas
- app/organizacao/(dashboard)/crm/campanhas/page.tsx

## /api/organizacao/crm/campanhas/[param]/enviar
- app/organizacao/(dashboard)/crm/campanhas/page.tsx

## /api/organizacao/crm/clientes
- app/organizacao/(dashboard)/crm/clientes/page.tsx

## /api/organizacao/crm/clientes/[param]
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/organizacao/crm/clientes/[param]/notas
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/organizacao/crm/clientes/[param]/tags
- app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx

## /api/organizacao/crm/relatorios
- app/organizacao/(dashboard)/crm/relatorios/page.tsx

## /api/organizacao/crm/segmentos
- app/organizacao/(dashboard)/crm/campanhas/page.tsx
- app/organizacao/(dashboard)/crm/segmentos/page.tsx

## /api/organizacao/crm/segmentos/[param]
- app/organizacao/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/organizacao/crm/segmentos/[param]/preview
- app/organizacao/(dashboard)/crm/segmentos/[segmentId]/page.tsx

## /api/organizacao/estatisticas/buyers
- app/organizacao/DashboardClient.tsx

## /api/organizacao/estatisticas/overview
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/DashboardClient.tsx

## /api/organizacao/estatisticas/time-series
- app/organizacao/DashboardClient.tsx

## /api/organizacao/events/[param]/attendees
- app/organizacao/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/organizacao/events/[param]/invites
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx

## /api/organizacao/events/[param]/refund
- app/organizacao/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx

## /api/organizacao/events/create
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/organizacao/events/list
- app/components/checkin/CheckinScanner.tsx
- app/organizacao/(dashboard)/categorias/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/DashboardClient.tsx

## /api/organizacao/events/update
- app/eventos/[slug]/EventLiveClient.tsx
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx
- app/organizacao/DashboardClient.tsx

## /api/organizacao/finance/overview
- app/organizacao/DashboardClient.tsx

## /api/organizacao/finance/reconciliation
- app/organizacao/pagamentos/ReconciliationPanel.tsx

## /api/organizacao/inscricoes
- app/organizacao/(dashboard)/inscricoes/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizacao/inscricoes/[param]
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx
- app/organizacao/(dashboard)/inscricoes/page.tsx

## /api/organizacao/inscricoes/[param]/export
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/organizacao/inscricoes/[param]/submissions
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/organizacao/inscricoes/[param]/summary
- app/organizacao/(dashboard)/inscricoes/[id]/page.tsx

## /api/organizacao/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx

## /api/organizacao/loja
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/bundles
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/categories
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/orders
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/overview
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/preview
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizacao/loja/products
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loja/shipping/settings
- app/organizacao/(dashboard)/loja/page.tsx

## /api/organizacao/loyalty/programa
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/organizacao/loyalty/recompensas
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/organizacao/loyalty/regras
- app/organizacao/(dashboard)/crm/loyalty/page.tsx

## /api/organizacao/marketing/overview
- app/organizacao/DashboardClient.tsx

## /api/organizacao/me
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
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

## /api/organizacao/organizations
- app/me/page.tsx
- app/organizacao/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/organizacao/organizations/[param]
- app/organizacao/(dashboard)/settings/page.tsx

## /api/organizacao/organizations/leave
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/organizations/members
- app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx
- app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx
- app/organizacao/(dashboard)/staff/page.tsx
- app/organizacao/DashboardClient.tsx
- app/organizacao/promo/PromoCodesClient.tsx

## /api/organizacao/organizations/members/invites
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/organizations/members/permissions
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/organizations/owner/transfer
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/organizations/settings/official-email
- app/organizacao/(dashboard)/settings/page.tsx
- app/organizacao/OrganizationDashboardShell.tsx

## /api/organizacao/organizations/settings/official-email/confirm
- app/organizacao/(dashboard)/settings/verify/page.tsx

## /api/organizacao/organizations/switch
- app/convites/organizacoes/OrganizationInvitesClient.tsx
- app/organizacao/OrganizationDashboardShell.tsx
- app/organizacao/OrganizationTopBar.tsx
- app/organizacao/organizations/OrganizationsHubClient.tsx
- components/organization/BecomeOrganizationForm.tsx

## /api/organizacao/padel/analytics
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/audit
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/broadcast
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/exports/analytics
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/exports/bracket
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/exports/calendario
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/exports/inscritos
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/exports/resultados
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/imports/inscritos
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/mix/create
- app/organizacao/(dashboard)/padel/mix/novo/page.tsx

## /api/organizacao/padel/pairings/swap
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/waitlist
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/padel/waitlist/promote
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/organizacao/pagamentos/invoices
- app/organizacao/pagamentos/invoices/invoices-client.tsx

## /api/organizacao/payouts/connect
- app/organizacao/DashboardClient.tsx

## /api/organizacao/payouts/list
- app/organizacao/pagamentos/PayoutsPanel.tsx

## /api/organizacao/payouts/status
- app/organizacao/DashboardClient.tsx

## /api/organizacao/payouts/summary
- app/organizacao/DashboardClient.tsx

## /api/organizacao/policies
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/politicas/page.tsx

## /api/organizacao/policies/[param]
- app/organizacao/(dashboard)/reservas/politicas/page.tsx

## /api/organizacao/promo
- app/organizacao/DashboardClient.tsx
- app/organizacao/promo/PromoCodesClient.tsx

## /api/organizacao/promo/[param]
- app/organizacao/promo/PromoCodesClient.tsx

## /api/organizacao/refunds/list
- app/organizacao/pagamentos/RefundsPanel.tsx

## /api/organizacao/reservas
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/DashboardClient.tsx

## /api/organizacao/reservas/[param]/cancel
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/checkout
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/invites
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/no-show
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/participants
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/reschedule
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/[param]/split
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/clientes
- app/organizacao/(dashboard)/reservas/clientes/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/delays
- app/organizacao/(dashboard)/reservas/page.tsx

## /api/organizacao/reservas/disponibilidade
- app/organizacao/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/organizacao/reservas/disponibilidade/[param]
- app/organizacao/(dashboard)/reservas/_components/AvailabilityEditor.tsx

## /api/organizacao/reservas/profissionais
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/profissionais/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizacao/reservas/profissionais/[param]
- app/organizacao/(dashboard)/reservas/profissionais/page.tsx

## /api/organizacao/reservas/recursos
- app/organizacao/(dashboard)/reservas/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/recursos/[id]/page.tsx
- app/organizacao/(dashboard)/reservas/recursos/page.tsx
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizacao/reservas/recursos/[param]
- app/organizacao/(dashboard)/reservas/recursos/page.tsx

## /api/organizacao/servicos
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/reservas/novo/page.tsx
- app/organizacao/(dashboard)/reservas/page.tsx
- app/organizacao/(dashboard)/reservas/servicos/page.tsx
- app/organizacao/DashboardClient.tsx

## /api/organizacao/servicos/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/addons
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/addons/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/packages
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/packages/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/packs
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/servicos/[param]/packs/[param]
- app/organizacao/(dashboard)/reservas/[id]/page.tsx

## /api/organizacao/tournaments/[param]/featured-match
- app/eventos/[slug]/EventLiveClient.tsx

## /api/organizacao/tournaments/[param]/generate
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/[param]/live
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/[param]/matches/[param]/result
- app/eventos/[slug]/EventLiveClient.tsx

## /api/organizacao/tournaments/[param]/matches/[param]/undo
- app/eventos/[slug]/EventLiveClient.tsx

## /api/organizacao/tournaments/[param]/participants
- app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx

## /api/organizacao/tournaments/[param]/rules
- app/eventos/[slug]/EventLiveClient.tsx

## /api/organizacao/tournaments/[param]/sponsors
- app/eventos/[slug]/EventLiveClient.tsx

## /api/organizacao/tournaments/create
- app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx

## /api/organizacao/trainers
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/staff/page.tsx

## /api/organizacao/trainers/profile
- app/organizacao/(dashboard)/treinadores/page.tsx

## /api/organizacao/username
- app/organizacao/OrganizationPublicProfilePanel.tsx

## /api/organizations/search
- app/components/Navbar.tsx
- app/social/page.tsx

## /api/padel/calendar
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/calendar/auto-schedule
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

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

## /api/padel/clubs/[param]/courts
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx
- app/organizacao/(dashboard)/padel/torneios/novo/PadelTournamentWizardClient.tsx

## /api/padel/clubs/[param]/staff
- app/organizacao/(dashboard)/eventos/novo/page.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/community/posts
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/event-categories
- app/organizacao/(dashboard)/eventos/EventEditClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/live
- app/eventos/[slug]/PadelPublicTablesClient.tsx
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/eventos/[slug]/score/PadelScoreboardClient.tsx
- app/widgets/padel/bracket/BracketWidgetClient.tsx
- app/widgets/padel/calendar/CalendarWidgetClient.tsx
- app/widgets/padel/next/NextMatchesWidgetClient.tsx
- app/widgets/padel/standings/StandingsWidgetClient.tsx

## /api/padel/matches
- app/eventos/[slug]/EventLiveClient.tsx
- app/eventos/[slug]/PadelPublicTablesClient.tsx
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
- app/widgets/padel/bracket/BracketWidgetClient.tsx
- app/widgets/padel/calendar/CalendarWidgetClient.tsx
- app/widgets/padel/next/NextMatchesWidgetClient.tsx

## /api/padel/matches/[param]/delay
- app/eventos/[slug]/monitor/PadelMonitorClient.tsx
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/matches/[param]/dispute
- app/[username]/padel/PadelDisputeButton.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/[param]/undo
- app/eventos/[slug]/EventLiveClient.tsx

## /api/padel/matches/assign
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/matches/generate
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/onboarding
- app/me/page.tsx
- app/onboarding/padel/page.tsx

## /api/padel/ops/summary
- app/organizacao/(dashboard)/padel/PadelHubClient.tsx

## /api/padel/pairings
- app/components/checkout/Step1Bilhete.tsx
- app/eventos/[slug]/EventPageClient.tsx
- app/eventos/[slug]/PadelSignupInline.tsx
- app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx

## /api/padel/pairings/claim/[param]
- app/eventos/[slug]/EventPageClient.tsx

## /api/padel/pairings/invite-status
- app/components/notifications/PairingInviteCard.tsx
- app/me/bilhetes/[id]/TicketDetailClient.tsx

## /api/padel/pairings/open
- app/explorar/_components/ExplorarContent.tsx

## /api/padel/players
- app/organizacao/(dashboard)/padel/PadelHubSection.tsx

## /api/padel/public/calendar
- app/eventos/[slug]/calendario/page.tsx

## /api/padel/public/clubs
- app/organizacao/(dashboard)/eventos/novo/page.tsx

## /api/padel/public/open-pairings
- app/padel/duplas/PadelOpenPairingsClient.tsx

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

## /api/profiles/save-basic
- app/components/autenticação/AuthModal.tsx
- app/components/profile/ProfileHeader.tsx
- app/onboarding/perfil/page.tsx

## /api/qr/[param]
- app/components/tickets/TicketCard.tsx
- app/components/tickets/TicketLiveQr.tsx
- app/components/tickets/TicketQrBox.tsx

## /api/servicos/[param]/calendario
- app/[username]/_components/ReservasBookingClient.tsx

## /api/servicos/[param]/checkout
- app/[username]/_components/ReservasBookingClient.tsx

## /api/servicos/[param]/reservar
- app/[username]/_components/ReservasBookingClient.tsx

## /api/servicos/[param]/slots
- app/[username]/_components/ReservasBookingClient.tsx
- app/me/reservas/page.tsx

## /api/servicos/list
- app/explorar/_components/ExplorarContent.tsx
- app/servicos/page.tsx

## /api/social/[param]
- app/components/mobile/MobileProfileOverview.tsx
- app/components/profile/ProfileHeader.tsx

## /api/social/follow
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/rede/page.tsx
- app/social/page.tsx

## /api/social/follow-organization
- app/components/Navbar.tsx
- app/components/profile/OrganizationFollowClient.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/social/page.tsx

## /api/social/follow-requests
- app/social/page.tsx

## /api/social/follow-requests/[param]
- app/social/page.tsx

## /api/social/follow-requests/cancel
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/social/page.tsx

## /api/social/follow-status
- app/[username]/FollowClient.tsx

## /api/social/following
- app/components/home/HomePersonalized.tsx

## /api/social/organization-follow-status
- app/components/profile/OrganizationFollowClient.tsx

## /api/social/organization-followers
- app/components/profile/OrganizationProfileHeader.tsx

## /api/social/suggestions
- app/rede/page.tsx
- app/social/page.tsx

## /api/social/unfollow
- app/[username]/FollowClient.tsx
- app/components/Navbar.tsx
- app/rede/page.tsx
- app/social/page.tsx

## /api/social/unfollow-organization
- app/components/Navbar.tsx
- app/components/profile/OrganizationFollowClient.tsx
- app/eventos/[slug]/EventLiveClient.tsx
- app/social/page.tsx

## /api/store/cart
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx
- components/storefront/StorefrontCheckoutClient.tsx

## /api/store/cart/bundles
- components/storefront/StorefrontBundleCard.tsx

## /api/store/cart/bundles/[param]
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/store/cart/items
- components/storefront/StorefrontCartOverlay.tsx
- components/storefront/StorefrontProductClient.tsx

## /api/store/cart/items/[param]
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/store/checkout
- components/storefront/StorefrontCheckoutClient.tsx

## /api/store/checkout/prefill
- components/storefront/StorefrontCheckoutClient.tsx

## /api/store/digital/download
- app/me/compras/loja/page.tsx
- components/storefront/StorefrontDownloadsClient.tsx

## /api/store/digital/grants
- app/me/compras/loja/page.tsx
- components/storefront/StorefrontDownloadsClient.tsx

## /api/store/digital/lookup
- components/storefront/StorefrontDownloadsClient.tsx

## /api/store/orders/invoice
- app/loja/seguimento/page.tsx

## /api/store/orders/lookup
- app/loja/seguimento/page.tsx

## /api/store/orders/receipt
- app/loja/seguimento/page.tsx

## /api/store/recommendations
- components/storefront/StorefrontCartClient.tsx
- components/storefront/StorefrontCartOverlay.tsx

## /api/store/shipping/methods
- components/storefront/StorefrontCheckoutClient.tsx

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

## /api/widgets/padel/calendar
- app/widgets/padel/calendar/page.tsx
