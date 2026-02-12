# Scripts (Ops/Diagnostico)

## diagnoseTournamentsMissingEventId.js

Diagnostico read-only para o D1: lista torneios com `eventId` em falta ou orfao (sem `events` associado),
com resumo por organizacao e indicacao de ligacao direta via `events.tournament_id` (se a coluna existir).

Uso:

```bash
node scripts/diagnoseTournamentsMissingEventId.js
node scripts/diagnoseTournamentsMissingEventId.js --format json --out /tmp/diagnose_tournaments.json
node scripts/diagnoseTournamentsMissingEventId.js --format csv --out /tmp/diagnose_tournaments.csv
```

Nota sobre TLS (importante):

- Preferido: usar `DATABASE_URL` a apontar para um proxy/endpoint com CA correta (cadeia valida).
- Ultimo recurso (apenas em sandbox local): `NODE_TLS_REJECT_UNAUTHORIZED=0` para contornar certificados self-signed.

Exemplo (estrutura do output JSON):

```json
{
  "generatedAt": "2026-01-26T20:40:00.000Z",
  "hasEventTournamentIdColumn": true,
  "total": 2,
  "items": [
    {
      "tournamentId": 123,
      "eventId": null,
      "organizationId": 45,
      "eventStatus": null,
      "eventStartsAt": null,
      "eventEndsAt": null,
      "hasAnyCandidateEventDirectLink": true,
      "candidateEventId": 987
    }
  ],
  "countsByOrgAndStatus": [
    { "organizationId": 45, "eventStatus": null, "count": 2 }
  ]
}
```

## audit_event_access_policy.ts

Auditoria read-only para convites/policies:
- Policies inválidas (`inviteTokenAllowed=true` + `inviteIdentityMatch=USERNAME`)
- Convites por username inexistente
- Convites com identidade não permitida pela policy

Uso:

```bash
node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts
node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts --format=json --out /tmp/audit_access_policy.json
node -r ./scripts/load-env.js -r ts-node/register scripts/audit_event_access_policy.ts --format=md --out /tmp/audit_access_policy.md --limit=200
```

## Infra helpers (prod/dev)

### Secrets (prod + dev)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \\
  scripts/upload-secrets.sh /tmp/orya-prod-secrets.json
```

### Build & push (ECR)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \\
  scripts/build-and-push.sh
```

### Deploy ECS (CloudFormation)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \\
  WITH_ALB=true \\
  scripts/deploy-cf.sh
```

### Pause/Resume
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --pause
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/deploy-cf.sh --resume
```

### Pause/Start (ALB + ECS + IPv4)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/pause-prod.sh
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/start-prod.sh
```
Estado guardado em `scripts/aws/state/orya-prod-pause.json` (ver `docs/ssot_registry_v1.md`, apêndice de envs canónicos).

### Dev serverless (SAM)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \\
  IMAGE_URI=495219734037.dkr.ecr.eu-west-1.amazonaws.com/orya-web:latest \\
  scripts/deploy-dev.sh
```

### Healthcheck
```bash
ORYA_CRON_SECRET=*** scripts/healthcheck.sh https://orya.pt
```

### Migrations
```bash
scripts/run-migrations.sh
```

### Localhost aliases (admin/app/test)
Para usar `admin.localhost:3000`, `app.localhost:3000` e `test.localhost:3000` no dev:

```bash
DRY_RUN=true scripts/setup-localhost-aliases.sh
sudo scripts/setup-localhost-aliases.sh
```

## Executar scripts TypeScript (node)
Quando um script `.ts` não arranca com `node -r ts-node/register`, usa:

```bash
node scripts/run-ts.cjs scripts/nome-do-script.ts
```
