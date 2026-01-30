# Release checklist (19.6 gates)

Objetivo: checklist executavel para release (DoD de producao).

## Ordem de execucao (obrigatoria)
1) Gates offline (sem DB):
   - `npm run db:gates:offline`
2) Suites de testes (vitest):
   - `npx vitest run tests/finance tests/fiscal tests/outbox tests/ops tests/notifications tests/analytics`
3) Gates online (com DB):
   - `npm run db:gates`

## Pass/Fail (criterios)
- PASS:
  - Todos os comandos acima terminam com exit code 0.
  - Nenhum teste falha.
  - Guardrails/rg em `db:gates` passam sem drift.
- FAIL:
  - Qualquer comando falha ou termina com exit code != 0.
  - Qualquer suite tem testes a falhar.
  - Qualquer guardrail acusa drift.

## Como correr em local
- Requisitos:
  - `.env.local` com credenciais necessarias.
  - DB acessivel para `npm run db:gates` (online).
- Execucao:
  - Correr a ordem acima no terminal.

## Como correr em CI
- Requisitos:
  - Variables de ambiente definidas no CI (DB e segredos necessarios).
  - Etapas separadas para gates offline, vitest suites e gates online.
- Exemplo de sequencia:
  1) `npm run db:gates:offline`
  2) `npx vitest run tests/finance tests/fiscal tests/outbox tests/ops tests/notifications tests/analytics`
  3) `npm run db:gates`

## Checklist final (antes do go-live)
- Ambiente:
  - `scripts/check-db-env.js` OK.
  - Variaveis obrigatorias confirmadas em secrets manager.
  - URL base e health check OK (`/api/internal/health`).
- E2E:
  - Fluxo P0 (intent -> webhook -> status -> entitlement -> check-in) com requestIds registados.
  - Fluxo P1 (refund/dispute -> ledger -> invalidacao) com requestIds registados.
- Observabilidade:
  - `/api/internal/ops/health` OK.
  - `/api/internal/ops/slo` sem backlog antigo/dlq.
  - Sentry sem spike de erros.
- Mobile/A11y/Perf:
  - Lighthouse + axe executados (sem regressao critica).
  - Device farm ou browserstack OK.
- Rollback:
  - TaskDefinition anterior registado.
  - Runbook `docs/runbooks/deploy-rollback.md` pronto.

## Evidencia minima a arquivar
- Logs com requestId/correlationId dos fluxos E2E.
- Saida dos testes (typecheck/lint/vitest).
- Dumps de queries DB (payments, ledger, entitlements, checkins).

## Notas
- Se `db:gates` falhar por infra/DB indisponivel, bloquear release ate resolver.
- Qualquer nova suite critica deve ser adicionada a este checklist.

## Troubleshooting comum
- Prisma EPERM / cache:
  - Fazer: apagar cache local do Prisma em `/tmp` e correr `npm run db:gates:offline` de novo.
  - Nao fazer: forcar permissoes globais ou mexer em `/var` sem necessidade.
- `.git` nao writable:
  - Mover o repo para um path writable antes de correr gates/testes.
- 401 em cron endpoints:
  - Esperado sem `X-ORYA-CRON-SECRET`; confirmar header.
- Dashboards a zeros:
  - Suspeitar de read-models/materializers atrasados; verificar outbox/ops feed e SLO (`/api/internal/ops/slo`).
