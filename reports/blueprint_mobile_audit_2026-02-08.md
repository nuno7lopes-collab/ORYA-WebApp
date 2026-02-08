# Auditoria Blueprint v9 — Mobile (Eventos/Torneios/Checkout/Bilhetes/QR)

Data: 2026-02-08

## Escopo
- App mobile: páginas de evento/torneio, fluxo de inscrição, checkout, carteira/bilhetes/QR.
- APIs públicas usadas pelo mobile: `GET /api/eventos/[slug]/public`, `POST /api/eventos/[slug]/invite-token`, `POST /api/eventos/[slug]/invites/check`, `GET /api/padel/standings`, `GET /api/padel/matches`, `GET /api/padel/public/open-pairings`, `POST /api/padel/pairings/[id]/checkout`.
- Regras de acesso/convite e entitlements conforme `docs/blueprint.md` e `docs/ssot_registry.md`.

## Alinhamentos verificados
- Access badge e gating por `EventAccessPolicy.mode` no mobile. Evidência: `apps/mobile/app/event/[slug].tsx`.
- Checkout com idempotência e `sourceType` canónico (EVENT_TICKET / PADEL_REGISTRATION). Evidência: `apps/mobile/features/checkout/store.ts`, `apps/mobile/app/checkout/index.tsx`.
- Entitlements na carteira com estados canónicos e consumo via `consumedAt` (sem `USED`). Evidência: `apps/mobile/features/wallet/types.ts`, `apps/mobile/features/wallet/WalletEntitlementCard.tsx`.
- Padel live apenas quando `competitionState=PUBLIC`. Evidência: `apps/mobile/app/event/[slug].tsx`.
- Padel standings/matches enriquecidos e exibidos com nomes. Evidência: `app/api/padel/standings/route.ts`, `apps/mobile/app/event/[slug].tsx`.

## Gaps / Drift (relativo ao Blueprint v9)
1) **InviteIdentityMatch não é aplicado nos convites por identificador** — **RESOLVIDO**
- O endpoint `/api/eventos/[slug]/invites/check` foi atualizado para respeitar `inviteIdentityMatch` e bloquear usernames inexistentes. Evidência: `app/api/eventos/[slug]/invites/check/route.ts`.

2) **Invite token bloqueado quando `inviteIdentityMatch=USERNAME`** — **RESOLVIDO (por regra de policy)**
- A policy agora explicita que `inviteTokenAllowed` exige `inviteIdentityMatch=EMAIL|BOTH` (USERNAME não suporta tokens).
- Enforced em `lib/checkin/accessPolicy.ts` (erro `INVITE_TOKEN_REQUIRES_EMAIL`) e propagado em `domain/access/evaluateAccess.ts`, `lib/invites/inviteTokens.ts`, `domain/finance/checkout.ts`.

## Decisões recentes refletidas no Blueprint
- **Guest checkout bloqueado na app mobile** e permitido apenas na WebApp/site quando `guestCheckoutAllowed=true`. Evidência: `docs/blueprint.md` (D8.2 + 7.1) e `docs/ssot_registry.md`.

## Recomendações
- Atualizar `/api/eventos/[slug]/invites/check` para respeitar `EventAccessPolicy.inviteIdentityMatch` e `inviteTokenAllowed`.
- Atualizar `evaluateEventAccess` para suportar `inviteIdentityMatch=USERNAME/BOTH` no fluxo de token, em linha com D8.2.
