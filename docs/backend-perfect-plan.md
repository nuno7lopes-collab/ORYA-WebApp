# ORYA backend perfect plan

## Goals
- Simple, modular backend with clear category ownership.
- Each org has a single primary category that defines onboarding, required fields, profile tabs, dashboard, and permissions.
- Core stays clean and stable; modules evolve independently.

## Final categories (pillars)
- PADEL
  - Subtypes: own clubs vs external clubs; tournaments/leagues/pairings as subtypes.
- EVENTOS
  - Ticketing + templates for talks/experiences/volunteer (template types, not categories).
- RESERVAS
  - Services/activities with schedule and policies (cancel/refund/deposit).
- CLUBS (Community/Memberships)
  - Memberships, tiers, perks, access control, posts/announcements.

## Core domain (shared)
- Identity + access: Profile, Organizer, OrganizerMember, OrganizerMemberInvite, OrganizerOwnerTransfer.
- Org config: OrganizationForm, OrganizationFormField, OrganizationFormSubmission, OrganizationUpdate, OrganizationModuleEntry,
  OrganizerOfficialEmailRequest, OrganizationAuditLog.
- Commerce + ops: PaymentEvent, Operation, PlatformSetting, Refund, SaleSummary, SaleLine.
- Promo: PromoCode, PromoRedemption (optional core capability).
- Notifications + email: Notification, NotificationPreference, NotificationOutbox, EmailIdentity, EmailOutbox, MatchNotification.
- Global ids: GlobalUsername, Lock.
- Infrastructure/auth tables (supabase): follows, organizer_follows, audit_log_entries, flow_state, identities, instances,
  mfa_*, oauth_*, one_time_tokens, refresh_tokens, saml_*, schema_migrations, sessions, sso_*, users.

## Module mapping (current schema)
- EVENTOS
  - Event, EventInvite, EventCategory, TicketType, Ticket, GuestTicketLink, TicketReservation, EventInterest,
    StaffAssignment, TicketTransfer, TicketResale.
  - Entitlement, EntitlementCheckin, EntitlementQrToken (keep here if tied to ticket access).
- PADEL
  - PadelPlayerProfile, PadelClub, PadelClubCourt, PadelClubStaff, PadelCategory, PadelEventCategoryLink,
    PadelRuleSet, PadelTournamentConfig, PadelCourtBlock, PadelAvailability, PadelPairing, PadelPairingHold,
    PadelPairingSlot, TournamentEntry, PadelTeam, PadelMatch, PadelRankingEntry, Tournament, TournamentStage,
    TournamentGroup, TournamentMatch, TournamentAuditLog.
- RESERVAS
  - Missing (only TicketReservation exists, which is event ticket hold, not general booking).
- CLUBS
  - Missing (no membership plans/tiers/perks models yet).

## API mapping (current)
- Core/auth: app/api/auth/*, app/api/users/*, app/api/profiles/*, app/api/username/*,
  app/api/notifications/*, app/api/email/*, app/api/upload/*, app/api/social/*.
- Organizer core: app/api/organizador/organizations/*, app/api/organizador/become, app/api/organizador/me,
  app/api/organizador/username, app/api/organizador/updates/*, app/api/organizador/staff/*,
  app/api/organizador/payouts/*, app/api/organizador/finance/*, app/api/organizador/pagamentos/*,
  app/api/organizador/marketing/*, app/api/organizador/estatisticas/*.
- EVENTOS: app/api/eventos/*, app/api/organizador/events/*, app/api/organizador/checkin/*,
  app/api/tickets/*, app/api/payments/*, app/api/checkout/*, app/api/stripe/webhook, app/api/inscricoes/*,
  app/api/organizador/inscricoes/*.
- PADEL: app/api/padel/*, app/api/organizador/padel/*, app/api/organizador/tournaments/*, app/api/tournaments/*,
  app/api/cron/padel/*.
- RESERVAS: app/api/cron/reservations/cleanup (ticket holds only).

## What to migrate vs delete (rules)
- Migrate if: active data, paid flows, tickets, pairings, tournaments, staff, or org core.
- Delete if: no UI entrypoint + no data in prod + not referenced by other modules.
- Keep but gate by category: promos, marketing, analytics, payouts, payments, notifications.

## Known gaps (to build)
- RESERVAS module: services, availability, resources, bookings, policies, refunds.
- CLUBS module: membership plans, tiers, perks, access control, community posts/announcements.
- Category-driven onboarding: schema for required fields + profile tabs + dashboard blocks.

## Cleanup candidates (needs confirmation before delete)
- Duplicate event resale endpoints: app/api/eventos/[slug]/resales vs app/api/eventos/[slug]/revendas.
- Legacy fields/types not referenced by UI (example: galleryImages in app/types/event.ts).
- Optional organizer sections that are not used (marketing/promoters/content) if we want a strict minimal scope.

## Execution checklist
1) Define category blueprint (required fields, tabs, dashboard blocks).
2) Enforce category gating in organizer dashboard and routes.
3) Build RESERVAS schema + APIs.
4) Build CLUBS schema + APIs (memberships).
5) Remove confirmed dead code and legacy endpoints.
6) Final pass on UI to match new categories.
