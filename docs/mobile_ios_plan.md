# ORYA iOS Plan (B2C-only)
> Escopo: iOS B2C. Regras de produto/SSOT em `docs/ssot_registry.md` e `docs/blueprint.md`.

## 1) Product scope (locked)
- Mobile is **ONLY USER (B2C)**.
- All B2B/backoffice/admin/staff/check-in/finance/CRM operations remain web-only.
- Admin remains web-only with strong auth + 2FA.

## 2) Mandatory iOS MVP (execution order)
1. Auth + onboarding:
   - Apple, Google, email/password, OTP, magic link.
   - Onboarding with skips for non-critical inputs.
   - Preferências/interesses no onboarding; localização e nível padel pedidos no fim como permissões opcionais.
2. Discover + Agora:
   - Discover split by Padel / Eventos / Serviços.
   - Agora with live hubs + personalized feed.
   - Discover filtros: cidade/localização, data, preço, categoria/tipo.
3. Global search:
   - Offers + users + organizations (search global).
4. Offer detail:
   - Event/tournament/service detail with high-quality motion and prefetch.
5. Universal checkout:
   - Native-first flow, resume supported (10 min).
6. Wallet:
   - Bilhetes + inscrições + reservas, QR and history (sem wallet monetária; apenas passes/entitlements).
   - Apple Wallet Pass (bilhetes no MVP; extensível).
7. Social:
   - Follow users/orgs + activity feed.
8. Event chat:
   - Participants-only (entitlement-gated).
9. Profile/settings:
   - Basic profile + language + notifications + privacy.

## 2.1) MVP explicit scope (B2C-only)
- Feed personalizado + live hubs (Agora).
- Discover (Padel/Eventos/Serviços) + search global (ofertas + utilizadores + organizações).
- Detalhe de oferta (evento/torneio/serviço) com pré-checkout/resumo.
- Checkout nativo com Apple Pay + cartão + MBWay (redirects apenas in-app quando inevitável).
- Carteira (bilhetes/inscrições/reservas) + QR + histórico + Apple Wallet Pass.
- Rede: seguir pessoas/clubes + feed de atividade.
- Chat do evento apenas para participantes (entitlements).
- Perfil + definições básicas.
- Push notifications (compras, cancelamentos, live/start, updates, padel reminders).

## 3) UX direction (Liquid Glass)
- Premium Apple-like look:
  - Translucent/blurred surfaces on key zones (headers/cards/hero), not everywhere.
  - Depth via subtle highlights, soft shadows, low-noise gradients.
  - 44px minimum touch targets and smooth motion.
- Avoid generic Material patterns.
- Light + dark themes required.

## 4) Payments and checkout constraints
- Native checkout is the default.
- Allowed methods: Apple Pay, card, MBWay.
- Redirect flows are only acceptable inside app context when unavoidable.
- Track purchase funnel + resume/abandon.

## 5) Wallet constraints
- Wallet includes active + history tabs.
- QR must be available when entitlement allows.
- Apple Wallet Pass is MVP target (tickets first, extend later).

## 6) Notifications
- Push triggers (MVP): purchase confirmation, cancellations, event start/live updates.
- Padel reminders: T-48/T-36/T-24/T-23 + status transitions.
- Email is secondary, only for critical/security communications.

## 6.1) Padel state notifications (MVP)
- PENDING → MATCHMAKING → CONFIRMED/EXPIRED.
- Reminders em T-48, T-36, T-24, T-23 (ajustáveis).

## 7) Data/performance/analytics
- Partial offline cache (recent discover, wallet, detail snapshots).
- TanStack Query with resilient retry/stale policies.
- Analytics adapter implementado (stub em `apps/mobile/lib/analytics.ts`); provider real pendente.

## 7.1) Performance baselines
- Thumbnails “small” no feed + lazy loading.
- Prefetch de detalhe no tap.
- Skeletons + transições suaves (Apple-like).

## 8) TestFlight readiness criteria
- Smooth onboarding with skips.
- Discover + Agora + Search stable.
- Checkout flow stable with resume.
- Wallet list/detail/QR stable.
- Social and event chat basics functional.
- Crash-free in internal testing with acceptable performance.

## 9) Current implementation status (developer branch)
- Foundation stack active: Expo Router + NativeWind + TanStack Query + Zustand.
- Liquid glass primitives active: `LiquidBackground`, `GlassCard`, `GlassPill`, `SectionHeader`.
- ✅ (1) Auth + onboarding complete: Apple/Google/email+password/OTP/magic link, onboarding with skips (padel/localização opcionais).
- ✅ (2) Discover + Agora complete: Discover split (Padel/Eventos/Serviços) + filtros + live hubs + feed personalizado.
- ✅ (3) Global search complete: ofertas + utilizadores + organizações com estados loading/empty/error.
- Discover uses real data + featured rails + filters (kind/preço/cidade/data) + search + richer cards (distância quando disponível) + auto paginação.
- Event cards now include ticket type summary + price range + attendance + availability pills, with shared image transitions to detail.
- Search screen now includes loading skeletons and better caching defaults.
- Discover cards now show availability pills (ticket types) + optional distance pill and prefetch detail routes for smoother transitions.
- ✅ (4) Offer detail complete: event/service detail with prefetch, shared image transitions, ticket selection + pre-checkout summary.
- ✅ (5) Universal checkout complete: native Stripe PaymentSheet (Apple Pay + card + MBWay) with 10‑min resume + status checks.
- ✅ (6) Wallet complete: list + detail + QR + history, Apple Wallet Pass endpoint + Add to Wallet CTA.
- ✅ Push registration + permissions UI (profile) wired; backend triggers via `domain/notifications/consumer` + `lib/push/apns` (precisa chaves APNS em prod).
- Agora tab implemented with real timeline/personalized feed.
- Network tab implemented with real suggestions + follow/unfollow actions.
