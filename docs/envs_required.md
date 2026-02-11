# Envs Required (NORMATIVE — production + CI)

**Index**
- Core runtime
- Supabase
- Stripe
- Apple Sign‑In / APNS / Maps
- AWS (Secrets/Deploy)
- Local dev / CI
- SOT Snapshot
- Mobile Local Dev
- AWS Pause/Start


This doc lists the required env vars for core services and where to store them.
Keep secrets out of git. Use single-line base64 for Apple keys.

## Core runtime (server)
- DATABASE_URL
- DIRECT_URL (Prisma)
- APP_ENV (prod|test; optional override, otherwise inferred from host)
- FORCE_APP_ENV / APP_ENV_FORCE (override hard)
- SINGLE_DB_MODE=1 (force app env to prod; useful when prod+dev share one DB)
- QR_SECRET_KEY
- SES_REGION
- SES_IDENTITY_DOMAIN
- SES_SMTP_USERNAME
- SES_SMTP_PASSWORD
- EMAIL_FROM (optional, defaults to noreply@SES_IDENTITY_DOMAIN)
- APP_BASE_URL / NEXT_PUBLIC_BASE_URL (recommended, used by checkout flows)
- ORYA_CRON_SECRET (required for /api/internal + /api/cron)
- REDIS_URL (required em produção para rate-limit distribuído e chat realtime)
- CHAT_ATTACHMENTS_BUCKET (override bucket para anexos de chat)
- CHAT_ATTACHMENTS_PUBLIC (true para URLs públicas de anexos; default false)

Feature flags (server, optional):
- STORE_ENABLED (ativa a loja no geral)
- STORE_DIGITAL_ENABLED (ativa downloads/ativos digitais da loja)
- WIDGETS_ENABLED (ativa endpoints públicos de widgets)
- PUBLIC_API_ENABLED (ativa chaves/API pública para terceiros)

## Supabase
Required:
- SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE

Optional:
- SUPABASE_STORAGE_BUCKET_UPLOADS
- SUPABASE_STORAGE_BUCKET_AVATARS
- SUPABASE_STORAGE_BUCKET_EVENT_COVERS
- SUPABASE_STORAGE_SIGNED_URLS
- SUPABASE_STORAGE_SIGNED_TTL_SECONDS
- SUPABASE_COOKIE_DOMAIN / NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN

## Stripe
Required (prod):
- STRIPE_SECRET_KEY_LIVE
- STRIPE_SECRET_KEY_TEST
- STRIPE_WEBHOOK_SECRET_LIVE
- STRIPE_WEBHOOK_SECRET_TEST
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST

Optional:
- STRIPE_SECRET_KEY (fallback)
- STRIPE_WEBHOOK_SECRET (fallback)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (fallback)
- STRIPE_MODE / STRIPE_ENV (override only for Stripe: prod|test)
- NEXT_PUBLIC_STRIPE_MODE / NEXT_PUBLIC_STRIPE_ENV (client override for Stripe: prod|test)
- STRIPE_PAYOUTS_WEBHOOK_SECRET (Stripe Connect payouts webhook)
- STRIPE_PAYOUTS_WEBHOOK_SECRET_LIVE
- STRIPE_PAYOUTS_WEBHOOK_SECRET_TEST
- STRIPE_FEE_* (only if overriding fee defaults)

Nota: o runtime usa os _LIVE/_TEST quando presentes; em dev/staging pode funcionar apenas com os
fallbacks (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).

Checkout behavior guardrails:
- Paid checkout without publishable key must fail fast on client with explicit code:
  - `CONFIG_STRIPE_KEY_MISSING`
- Free checkout (`amountCents=0`) must not depend on Stripe publishable key.

## Apple Sign-In
Required:
- APPLE_SIGNIN_SERVICE_ID
- APPLE_SIGNIN_REDIRECT_URI
- APPLE_SIGNIN_TEAM_ID
- APPLE_SIGNIN_KEY_ID
- APPLE_SIGNIN_PRIVATE_KEY_BASE64

## APNS (token-based)
Required:
- APNS_TEAM_ID
- APNS_KEY_ID
- APNS_PRIVATE_KEY_BASE64
- APNS_TOPIC

## Apple Maps
Required (canonical):
- APPLE_MAPS_TEAM_ID
- APPLE_MAPS_KEY_ID
- APPLE_MAPS_PRIVATE_KEY_BASE64

Optional:
- APPLE_MAPS_ORIGIN
- APPLE_MAPS_TOKEN_TTL_SECONDS (defaults to 900 seconds)

## Apple .p8 -> base64 (single line)
1) Download the .p8 (e.g. AuthKey_ABC123.p8).
2) Encode to single-line base64:
   - macOS: `base64 -i AuthKey_ABC123.p8 | tr -d '\n'`
   - Linux: `base64 -w 0 AuthKey_ABC123.p8`
3) Paste into the *_PRIVATE_KEY_BASE64 env var.
4) Rotate keys periodically and keep the raw .p8 off the repo.

## AWS (Secrets Manager / App Runner / ECS)
- Store each env var as a secret (one value per key).
- Keep base64 strings as-is (single line, no quotes).
- Wire secrets into the service/task env.
- Separate prod/staging secrets and rotate on schedule.

Current groups (documented as configured in PROD/DEV):
- `orya/prod/app`, `orya/prod/supabase`, `orya/prod/payments`, `orya/prod/apple`, `orya/prod/email`, `orya/prod/admin`
- `orya/dev/app`, `orya/dev/supabase`, `orya/dev/payments`, `orya/dev/apple`, `orya/dev/email`, `orya/dev/admin`

## AWS deploy
- Store env vars in AWS Secrets Manager/SSM.
- Attach them to App Runner/ECS task definitions by environment.
- Base64 values must be single line (no quotes, no line breaks).
- Redeploy services after changes.

## Local dev / CI
- Use `.env` or `.env.local` locally.
- CI can use dummy values for non-prod gates (do not use real secrets).

## Client (optional)
- NEXT_PUBLIC_APP_ENV (prod|test override for client)

---

## SOT Snapshot (Prod + Local) — NON-NORMATIVE
Este snapshot substitui o snapshot anterior e serve apenas como fotografia do estado atual.
Os requisitos normativos de envs permanecem nas secções acima.

Gerado: 2026-02-08 20:40:07

### PROD (AWS Secrets Manager)
Fonte: AWS Secrets Manager (live)

#### app
- existe (exemplo): ADMIN_ACTION_IP_ALLOWLIST, ADMIN_MFA_BREAK_GLASS_TOKEN, ADMIN_MFA_REQUIRED, ADMIN_TOTP_ENCRYPTION_KEY, ADMIN_USER_IDS, ALERTS_SNS_TOPIC_ARN, APP_BASE_URL, APP_ENV, CLOUDWATCH_LOG_GROUP, CLOUDWATCH_LOG_RETENTION_DAYS, CLOUDWATCH_METRICS_NAMESPACE, DATABASE_URL, DIRECT_URL, ICS_SECRET_KEY, INFRA_READ_ONLY, INTERNAL_SECRET_HEADER, LOG_FORMAT, LOG_LEVEL, NEXT_PUBLIC_APP_ENV, NEXT_PUBLIC_BASE_URL, ORYA_CRON_SECRET, PWA_MANIFEST_URL, QR_SECRET_KEY, REDIS_URL, S3_SECRETS_BUCKET, XRAY_DAEMON_ADDRESS, XRAY_ENABLED

#### apple
- existe (16): APNS_KEY_ID, APNS_PRIVATE_KEY_BASE64, APNS_TEAM_ID, APNS_TOPIC, APPLE_MAPS_KEY_ID, APPLE_MAPS_ORIGIN, APPLE_MAPS_PRIVATE_KEY_BASE64, APPLE_MAPS_TEAM_ID, APPLE_PAY_CERTIFICATE_BASE64, APPLE_PAY_DOMAIN_VERIFICATION_FILE, APPLE_PAY_MERCHANT_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY_BASE64, APPLE_SIGNIN_REDIRECT_URI, APPLE_SIGNIN_SERVICE_ID, APPLE_SIGNIN_TEAM_ID

#### email
- existe (5): EMAIL_FROM, SES_IDENTITY_DOMAIN, SES_REGION, SES_SMTP_PASSWORD, SES_SMTP_USERNAME

#### payments
- existe (9): NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST, STRIPE_SECRET_KEY, STRIPE_SECRET_KEY_LIVE, STRIPE_SECRET_KEY_TEST, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_LIVE, STRIPE_PAYOUTS_WEBHOOK_SECRET_LIVE

#### supabase
- existe (5): NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE, SUPABASE_URL

#### admin/infra extras
- existe (6): DEVICE_FARM_KEY, DEVICE_FARM_PROVIDER, DEVICE_FARM_USER, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD, STAGING_ADMIN_SESSION

### Notas de consistência
- Este snapshot é informativo; requisitos normativos ficam nas secções acima.
- Apple Maps: o runtime usa apenas `APPLE_MAPS_*`.
- Stripe: quando `*_LIVE/*_TEST` não existem, o runtime usa os fallbacks `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- DB única: quando `SINGLE_DB_MODE=1`, o runtime força `APP_ENV=prod`.
- Stripe local: `STRIPE_MODE`/`NEXT_PUBLIC_STRIPE_MODE` pode forçar chaves de teste sem alterar o ambiente da DB.

### LOCAL (.env.local)
Fonte: `/Users/nuno/orya/ORYA-WebApp/.env.local`

#### app
- existe (exemplo): ADMIN_ACTION_IP_ALLOWLIST, ADMIN_MFA_BREAK_GLASS_TOKEN, ADMIN_MFA_REQUIRED, ADMIN_TOTP_ENCRYPTION_KEY, ADMIN_USER_IDS, ALERTS_SNS_TOPIC_ARN, APP_BASE_URL, APP_ENV, CLOUDWATCH_LOG_GROUP, CLOUDWATCH_LOG_RETENTION_DAYS, CLOUDWATCH_METRICS_NAMESPACE, DATABASE_URL, DIRECT_URL, ICS_SECRET_KEY, INFRA_READ_ONLY, INTERNAL_SECRET_HEADER, LOG_FORMAT, LOG_LEVEL, NEXT_PUBLIC_APP_ENV, NEXT_PUBLIC_BASE_URL, ORYA_CRON_SECRET, PWA_MANIFEST_URL, QR_SECRET_KEY, REDIS_URL, S3_SECRETS_BUCKET, SINGLE_DB_MODE, XRAY_DAEMON_ADDRESS, XRAY_ENABLED

#### apple
- existe (16): APNS_KEY_ID, APNS_PRIVATE_KEY_BASE64, APNS_TEAM_ID, APNS_TOPIC, APPLE_MAPS_KEY_ID, APPLE_MAPS_ORIGIN, APPLE_MAPS_PRIVATE_KEY_BASE64, APPLE_MAPS_TEAM_ID, APPLE_PAY_CERTIFICATE_BASE64, APPLE_PAY_DOMAIN_VERIFICATION_FILE, APPLE_PAY_MERCHANT_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY_BASE64, APPLE_SIGNIN_REDIRECT_URI, APPLE_SIGNIN_SERVICE_ID, APPLE_SIGNIN_TEAM_ID

#### email
- existe (5): EMAIL_FROM, SES_IDENTITY_DOMAIN, SES_REGION, SES_SMTP_PASSWORD, SES_SMTP_USERNAME

#### payments
- existe (9): NEXT_PUBLIC_STRIPE_MODE, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST, STRIPE_MODE, STRIPE_PAYOUTS_WEBHOOK_SECRET_TEST, STRIPE_SECRET_KEY, STRIPE_SECRET_KEY_TEST, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_TEST
- falta (3): NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE, STRIPE_SECRET_KEY_LIVE, STRIPE_WEBHOOK_SECRET_LIVE

#### supabase
- existe (5): NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE, SUPABASE_URL

#### admin/infra extras
- existe (6): DEVICE_FARM_KEY, DEVICE_FARM_PROVIDER, DEVICE_FARM_USER, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD, STAGING_ADMIN_SESSION

---

## Mobile Local Dev (Expo Go) — quick steps
### 1) Start backend (local)
```bash
npm run dev:all
```
`dev:all` now binds to `0.0.0.0` and auto-detects your LAN IP for public URLs.  
If it picks the wrong IP, override:
```bash
DEV_ALL_PUBLIC_HOST=192.168.1.98 npm run dev:all
```

### 2) Start mobile (Expo Go)
```bash
npm run mobile:dev
```

### 3) Mobile env (LAN base URL)
You can keep `apps/mobile/.env` with:
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```
The mobile app now auto-resolves the correct LAN IP at runtime.

### 4) Quick connectivity check (iPhone Safari)
```
http://192.168.1.98:3000
```
If this doesn’t open: check same Wi‑Fi, VPN/Private Relay off, macOS Firewall.

---

## AWS Pause/Start (Prod) — cost control runbook
Este runbook cria um "pause" controlado para reduzir custos de:
- Amazon Elastic Load Balancing (ALB)
- Amazon ECS (Fargate)
- Amazon VPC (custos de IPv4 publico associados ao ALB)

### O que o pause faz
- Remove o ALB do stack (via CloudFormation), eliminando custo de Load Balancer e IPs publicos associados.
- Faz scale do ECS para 0 (Fargate para).
- Guarda estado (parametros do stack + desired counts) num ficheiro local.

Impacto: **downtime total** enquanto estiver pausado.

### O que o start faz
- Recria o ALB se estava ativo antes do pause.
- Restaura parametros do stack e desired counts anteriores.
- Faz scale do ECS para os valores originais.

### Requisitos
- AWS CLI configurado
- Profile com acesso a CloudFormation/ECS/ELB
- `AWS_PROFILE` e `AWS_REGION` definidos (ou defaults `codex` e `eu-west-1`)
- Stack CloudFormation em estado estavel (`UPDATE_COMPLETE` ou `UPDATE_ROLLBACK_COMPLETE`)

### Uso

Pause:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/pause-prod.sh
```

Start:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/start-prod.sh
```

Opcional (dry-run):
```bash
DRY_RUN=true scripts/aws/pause-prod.sh
DRY_RUN=true scripts/aws/start-prod.sh
```

Estado:
- Fica em `scripts/aws/state/orya-prod-pause.json` (podes definir `STATE_FILE`).

### Notas importantes
- O pause remove o ALB e pode apagar registos DNS (se existirem no stack).
- O VPC nao e apagado; apenas deixam de existir custos de IPv4 publico associados ao ALB.
- Se precisares de manter DNS ativo, nao uses este pause.
- Se precisas de Free Tier no CloudWatch, desativa `Container Insights` no ECS.
- Para pausar novamente, remove o ficheiro de estado ou define `STATE_FILE` para um novo caminho.
