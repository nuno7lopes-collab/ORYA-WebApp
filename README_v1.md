This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database gates
- Prisma deve ser corrido via scripts (`npm run db:gates`).
- Os scripts aplicam caches locais em `.cache/` (não usar env inline).
- Se aparecer EPERM/ENOENT/Schema engine error, usa os scripts acima.
- Não corras `prisma` direto; usa `db:status`, `db:deploy`, `db:generate`.
- `.env` no root é a fonte canónica para Prisma CLI.
- `CHECKPOINT_DISABLE=1` deve estar ativo nos envs.
- Em CI, usa `npm run db:gates` (não usar comandos Prisma diretos).
- Em ambientes sem rede/DNS, usa `DB_GATES_MODE=offline npm run db:gates` (offline só valida/generate + testes).
- `DB_GATES_MODE=offline` é apenas para ambientes sem rede/DNS; em dev normal usa `npm run db:gates` (online default).

## Cron jobs (canónico)
- Fonte única: `lib/cron/jobs.ts`.
- Runner local: `npm run cron:local` (usa `scripts/cron-loop.js`).
- Segurança: todos os crons usam `X-ORYA-CRON-SECRET` (`ORYA_CRON_SECRET`).

Jobs e defaults:
- `operations` — `1000ms` (`CRON_OPERATIONS_INTERVAL_MS`)
- `bookings-cleanup` — `60000ms` (`CRON_BOOKINGS_INTERVAL_MS`)
- `reservations-cleanup` — `60000ms` (`CRON_RESERVATIONS_INTERVAL_MS`)
- `credits-expire` — `300000ms` (`CRON_CREDITS_INTERVAL_MS`)
- `padel-expire` — `300000ms` (`CRON_PADEL_EXPIRE_INTERVAL_MS`)
- `padel-matchmaking` — `300000ms` (`CRON_PADEL_MATCHMAKING_INTERVAL_MS`)
- `padel-split-reminders` — `300000ms` (`CRON_PADEL_SPLIT_REMINDERS_INTERVAL_MS`)
- `padel-waitlist` — `300000ms` (`CRON_PADEL_WAITLIST_INTERVAL_MS`)
- `padel-reminders` — `300000ms` (`CRON_PADEL_REMINDERS_INTERVAL_MS`)
- `padel-tournament-eve` — `3600000ms` (`CRON_PADEL_TOURNAMENT_EVE_INTERVAL_MS`)
- `entitlements-qr-cleanup` — `3600000ms` (`CRON_ENTITLEMENTS_QR_CLEANUP_INTERVAL_MS`)
- `crm-rebuild` — `86400000ms` (`CRON_CRM_REBUILD_INTERVAL_MS`)
- `crm-campanhas` — `60000ms` (`CRON_CRM_CAMPAIGNS_INTERVAL_MS`)
- `repair-usernames` — `604800000ms` (`CRON_REPAIR_USERNAMES_INTERVAL_MS`)
- `analytics-rollup` — `86400000ms` (`CRON_ANALYTICS_INTERVAL_MS`)
- `loyalty-expire` — `86400000ms` (`CRON_LOYALTY_EXPIRE_INTERVAL_MS`)

Notas operacionais:
- Política atual de manutenção: perfil híbrido equilibrado (rollups/CRM diários, cleanup QR horário, repair usernames semanal).

## Apple (D17) — envs mínimos
- Sign in with Apple:
  - `APPLE_SIGNIN_SERVICE_ID=`
  - `APPLE_SIGNIN_REDIRECT_URI=`
  - `APPLE_SIGNIN_TEAM_ID=`
  - `APPLE_SIGNIN_KEY_ID=`
  - `APPLE_SIGNIN_PRIVATE_KEY_BASE64=`
- APNs (token-based):
  - `APNS_TEAM_ID=`
  - `APNS_KEY_ID=`
  - `APNS_PRIVATE_KEY_BASE64=`
  - `APNS_TOPIC=`

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to optimize and load web fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/nextjs/next) - your feedback and contributions are welcome!

## Deploy

Deploy this app on AWS (for example, App Runner/ECS + ALB/CloudFront), and keep runtime env vars in AWS Secrets Manager.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API response envelope (SSOT)

JSON routes must return a single envelope:

- Success: `{ ok: true, requestId, correlationId, data }`
- Error: `{ ok: false, requestId, correlationId, errorCode, message, retryable, details? }`

Use `withApiEnvelope` + `respondOk` / `respondError` from `lib/http/envelope.ts` in JSON routes. It preserves `Response`/`NextResponse` behavior (streams, files, webhooks) and normalizes legacy payloads.

### Special routes (not wrapped)

The following routes return raw/stream/file responses and must **not** be wrapped automatically:

- SSE: `app/api/padel/live/route.ts`
- Uploads/formData: `app/api/upload/route.ts`
- ICS/downloads: `app/api/me/reservas/[id]/calendar.ics/route.ts`
- Webhooks (raw body): `app/api/stripe/webhook/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/organizacao/payouts/webhook/route.ts`
- Binary assets: `app/api/org/[orgId]/store/products/[id]/digital-assets/route.ts`
- Imports: `app/api/organizacao/padel/imports/inscritos/route.ts`
- Internal ops (raw/outbox): `app/api/internal/worker/operations/route.ts`

### Webhooks fail-closed

Inbound webhooks must resolve `organizationId`. If they cannot, they must return a 4xx response and **must not** write side-effects.
