# ORYA iOS Plan (B2C-only)

## Scope (confirmed)
- Mobile = ONLY USER (B2C).
- Web-only: org/admin/staff/check-in/finance/backoffice.

## MVP Modules (ordered)
1) Auth + onboarding (Apple, Google, email/pass, OTP, magic link)
2) Agora (personalized feed + live hubs)
3) Discover (Padel/Eventos/Serviços) + global search
4) Offer detail (evento/torneio/serviço)
5) Universal checkout (native, resume 10 min)
6) Wallet (bilhetes/inscrições/reservas) + QR + Apple Wallet Pass
7) Social (follow people/orgs + activity feed)
8) Event chat (participants w/ entitlement)
9) Profile + settings (language, notifications, privacy)

## UX / Design
- "Liquid Glass" on key surfaces (cards, headers, hero) only.
- Light + dark themes.
- 44px tap targets, soft motion, clean typography.

## Payments & Checkout
- Native checkout only (Apple Pay + card + MBWay).
- Redirects allowed only inside app webview when unavoidable.
- Resume/abandon tracking and recovery.

## Notifications
- Push: purchase, cancellations, live/start, event updates.
- Padel reminders: T-48, T-36, T-24, T-23 + status changes.
- Email only for critical/security flows.

## Wallet
- Apple Wallet Pass in MVP (tickets first, extensible to others).
- History: upcoming + basic historical list.

## Search
- Global: offers + users + orgs.
- Filters: city/geo, date, price, category/type.
- Sorting: relevance + distance (optional permission).

## Offline
- Partial cache (recent offers + wallet + last detail).
- Short TTL.

## Analytics
- Adapter layer prepared; provider pending.
- Events: screen_view, taps, checkout funnel, purchase, resume/abandon, social, padel.

## Release criteria (TestFlight internal)
- Onboarding solid with skips.
- Discover + search + agora smooth.
- Native checkout stable, resume works.
- Wallet + QR + Apple Wallet Pass works.
- Social basic + event chat works.
- Crash-free, acceptable performance.

## Current status (mobile)
- Base: Expo Router + NativeWind + TanStack Query + Zustand.
- Liquid Glass primitives done (LiquidBackground, GlassCard, GlassPill, SectionHeader).
- Discover feed uses real API + featured carousel + filters + search + skeletons.
- Event detail styled + transition.

## Next execution (Phase 2.1)
- Commit assets separately (icons/splash).
- Validate expo start -c on iOS.
- Implement global search screen (offers + users + orgs).
- Expand offer detail transitions.
