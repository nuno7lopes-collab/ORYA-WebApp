# Infra modes (local/public)

## Quick commands

Local (zero cost, full dev stack) — default for web + mobile:
```bash
npm run dev:all
```
Wrapper (same behavior, plus defaults for dev speed):
```bash
scripts/infra-mode.sh local
```

Para pausar 

AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --pause


Public minimum (cheap, web only):
```bash
scripts/infra-mode.sh public-min
```

Public always-on (web + worker):
```bash
scripts/infra-mode.sh public-on
```

## Highlights

- local: zero infra cost, full dev stack.
- public-min: cheapest public HTTPS.
- public-on: public HTTPS + worker always running.

## What each mode does

local
- Starts the full local dev stack (server + cron + worker + chat ws + redis + stripe listen).
- Uses the faster dev bundler by default (`dev:fast` / Turbopack). Override with `DEV_ALL_NEXT_SCRIPT=dev`.
- Serializes cron jobs locally and skips duplicate `operations` cron when the worker is running.
- Mobile ready: `dev:all` binds to `0.0.0.0` and auto-detects a LAN IP for public URLs.
- If the auto LAN IP is wrong, set `DEV_ALL_PUBLIC_HOST=your.lan.ip`.

Overrides (optional):
```bash
DEV_ALL_NEXT_SCRIPT=dev DEV_ALL_CRON_MAX_CONCURRENCY=4 DEV_ALL_SKIP_OPERATIONS_CRON=0 scripts/infra-mode.sh local
```

## How to stop public-min / public-on (to avoid cost)
- Soft pause (scale to zero, keeps stack):
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --pause
```
- Hard pause (delete stack):
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --hard-pause
```
- Resume later:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --resume
```
- No AWS resources are changed.

public-min
- Web task only, ALB + HTTPS, worker OFF.
- Public subnets forced (no NAT).
- Route53 records auto-created (root + admin).

public-on
- Web task + worker task, ALB + HTTPS.
- Public subnets forced (no NAT).
- Route53 records auto-created (root + admin).

## Domains (defaults)

- Public webapp: orya.pt
- Admin: admin.orya.pt

You can override if needed:
```bash
export ROOT_DOMAIN="orya.pt"
export APP_DOMAIN="orya.pt"
export ADMIN_DOMAIN="admin.orya.pt"
```

## AWS inputs (auto)

The script auto-detects the hosted zone for ROOT_DOMAIN and will create DNS records.
If ALB_CERT_ARN is not provided, it creates an ACM cert via Route53 validation.

## Cost summary (base, per hour/day)

Assumptions (for these estimates):
- 0.5 vCPU + 1 GB per task (current ECS defaults).
- ALB base + 1 LCU/hour.
- Public IPv4 charged per IP-hour.
- No NAT, no CloudWatch logs, no data transfer, no Secrets cost.

| Mode | Hourly | Daily | What is running |
| --- | ---: | ---: | --- |
| local | 0.0000 | 0.0000 | Everything local |
| public-min | 0.0751 | 1.8022 | 1 web task + ALB + 3 public IPs |
| public-on | 0.1073 | 2.5751 | 1 web + 1 worker + ALB + 4 public IPs |

Notes:
- ALB cost depends on LCUs (traffic). If LCUs rise, cost increases.
- Public IP cost applies per in-use IP-hour (ALB uses 2 IPs; each task with public IP adds 1).
- These are base compute-only numbers; egress and storage are extra.

Pricing inputs used for the table:
- Fargate Linux/X86 (Europe): €0.00001276 per vCPU-sec and €0.00000140 per GB-sec.
- ALB: €0.0266 per hour + €0.0079 per LCU-hour (assume 1 LCU).
- Public IPv4: $0.005 per IP-hour (converted to EUR at 1 EUR = 1.1919 USD, OeNB 2026-01-30).
