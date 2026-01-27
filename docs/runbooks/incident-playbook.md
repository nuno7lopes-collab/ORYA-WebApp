# Incident mini-playbook (C8)

Objetivo: procedimentos acionaveis para incidentes operacionais, alinhados com fail-closed, EventLog/Outbox e idempotencia.

0) Antes de tudo (regra de ouro)
- Nunca editar rows de ledger / EventLog / Outbox a mao.
- Nunca reprocessar sem saber se o consumer e idempotente (assumir que sim, mas confirmar dedupe keys).
- Tudo o que e interno exige `X-ORYA-CRON-SECRET` (401 sem header = esperado).
- Se nao tens `organizationId`: no-op / fail-closed (nao inventar org).

Headers (template)

```
export ORYA_CRON_SECRET="..."
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  <URL>
```

1) Incidente: "Rollups parados / analytics stale"

Sinais
- KPIs "congelados", dashboards com valores antigos.
- Ops dashboard/SLO ok, mas a "freshness" dos rollups nao mexe.

Diagnostico (ordem)
1) Confirmar saude:
   - `GET /api/internal/ops/health`
   - `GET /api/internal/ops/dashboard`
2) Confirmar execucao do rollup:
   - ver se o cron chama `POST /api/internal/analytics/rollup` (ver C1 cron coverage).
3) Confirmar "freshness":
   - verificar `analyticsRollup.bucketDate` (DB) para o ultimo dia/materializacao.
   - se nao houver acesso DB, confirmar logs do job/cron e dashboards que leem `analyticsRollup`.

Acao segura (manual)
- Correr manualmente:

```
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -X POST "http://localhost:3000/api/internal/analytics/rollup"
```

- Repetir no maximo 1 vez se falhar, para nao duplicar carga.

Se falhar
- Capturar erro e parar.
- Verificar: secret, auth, timeouts, DB lock/latencia.
- Se for erro de schema/migration: bloquear release ate fix.

Mitigacoes / prevencao
- Garantir que o job existe no cron-loop (C1 analytics-rollup).
- Manter nota de intervalo e runtime esperado (C5 operability checklist).

2) Incidente: "DLQ / outbox a subir (publish failed / deadLetteredAt)"

Sinais
- Logs `[outbox] publish failed`
- DLQ count aumenta / eventos nao chegam a read-models
- Features "paradas": ops feed, notificacoes, etc.

Diagnostico (ordem)
1) Estado geral:
   - `GET /api/internal/ops/health`
2) Ver DLQ:
   - `GET /api/internal/outbox/dlq`
3) Classificar causa:
   - erro transitorio (rede/timeout)
   - erro deterministico (payload invalido, contract drift)
   - consumer down

Acao segura
- Primeiro corrigir causa (se for deterministico, replay sem fix = loop).
- Depois replay controlado (por evento):

```
# listar DLQ (limite opcional)
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/outbox/dlq?limit=50"

# replay por eventId
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/internal/outbox/replay" \
  -d '{"eventId":"evt_123"}'
```

Regras
- Replay deve ser idempotente (dedupe) - confirmar em `domain/outbox/producer.ts` e consumer.
- Nunca apagar rows em DLQ.
- Se a mesma falha voltar: parar replay e abrir issue.

Checklist de fecho
- DLQ estabiliza (nao cresce)
- Read-models voltam a materializar
- Ops dashboard normaliza

3) Incidente: "Payouts bloqueados / Connect falha / pagamentos nao libertam"

Sinais
- Orgs nao conseguem completar onboarding
- `payouts-release` corre mas nao produz efeitos
- Falhas Stripe (connect/account status)

Diagnostico (ordem)
1) Confirmar cron payouts:
   - job `payouts-release` no cron-loop
   - endpoint `POST /api/cron/payouts/release` com secret
2) Confirmar estado Stripe Connect (org):
   - `GET /api/organizacao/payouts/status` (requer auth de owner)
3) Confirmar que nao e "bloqueio legal" (depende do A):
   - se existir gate de legal acceptance, pode ser expected fail-closed

Acao segura
- Re-executar release manual (uma vez):

```
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -X POST "http://localhost:3000/api/cron/payouts/release"
```

- Se o Connect onboarding esta incompleto:
  - refazer account link: `POST /api/organizacao/payouts/connect` (auth owner)
  - confirmar requirements no status

Se for mismatch Standard vs Express
- Nao migrar em incidente.
- Abrir ticket de decisao (produto/ops) e documentar impacto.

Checklist de fecho
- `payouts-release` volta a correr sem erros
- Estado de conta Stripe "ready"
- Ledger/exports consistentes (sem edits)

4) "Stop the bleeding" (kill switches / modos seguros)

Acoes seguras sem SafetyCase/KillSwitch (ainda nao implementado no A):
- Pausar crons (parar o runner ou usar `CRON_ONLY`/`CRON_SKIP`).
- Desativar funcionalidades por config/env (se existir).
- Rotacao do secret (`X-ORYA-CRON-SECRET`) como ultimo recurso.

Nota: Kill switches formais ainda NAO EXISTEM - dependem do A (P0).

5) Template de incidente (colar no Slack/issue)
- Quando comecou:
- Sintoma visivel:
- Endpoint(s) afetados:
- Metrica (DLQ count / rollup freshness / payout backlog):
- Acao tomada (curl + timestamp):
- Resultado:
- Follow-ups (PRs, decisoes):

Referencias
- C1: analytics-rollup (cron coverage)
- C2: outbox-dlq runbook
- C5: operability checklist
