# Padel Live Ops Runbook v1

## 1. Objetivo
Operar torneios Padel em produção com governança de lifecycle, parceria entre clubes, ranking v2 e notificações determinísticas.

## 2. Pré-live (T-24h até T-30m)
- Validar schema em produção:
  - migração `padel_ranking_filters_and_tier`
  - migração `padel_player_history_projection`
- Executar backfill idempotente:
  - metadados `tier/clubId/city` em `padel_rating_events`
  - projeção `padel_player_history_projection` por eventos concluídos
  - endpoint canónico interno:
    - dry-run: `POST /api/internal/ops/padel/backfill?limit=50`
    - apply: `POST /api/internal/ops/padel/backfill?apply=true&limit=50`
    - headers: `X-ORYA-CRON-SECRET: <ORYA_CRON_SECRET>`
    - paginação: usar `nextCursor` em `cursor=<nextCursor>`
- Confirmar readiness por evento:
  - `GET /api/padel/ops/summary?eventId=<id>`
  - `GET /api/internal/ops/padel/integrity?eventId=<id>` com secret interno
- Verificar governança de tier:
  - se `tournamentTier` for `OURO`/`MAJOR`, confirmar approval `APPROVED`
- Smoke técnico obrigatório:
  - `npm run typecheck`
  - `npx vitest run tests/ops/padel*.test.ts`
  - `npx vitest run tests/padel/*.test.ts`

## 3. Durante Live
- Monitorizar cada 5 minutos:
  - `pendingSplitCount`, `waitlistCount`, `liveMatchesCount`, `delayedMatchesCount`
  - `conflictsClaimsCount`, `overridesCount`, `pendingCompensationCount`
  - `rankingSanctionsActive`, `delaysByPolicy`
- Regras operacionais:
  - atraso: default `CASCADE_SAME_COURT`
  - incidentes especiais: somente write-path canónico
  - override de parceria: sempre com `reasonCode` auditável
- Notificações:
  - validar emissão `MATCH_CHANGED` para `DELAYED/RESCHEDULED`
  - confirmar deep link canónico para `/eventos/:slug`

## 4. Pós-live
- No `COMPLETED`:
  - validar rebuild de rating (`ratingSnapshot`)
  - validar rebuild de histórico competitivo (`historyProjection`)
- Integridade final:
  - `GET /api/internal/ops/padel/integrity?eventId=<id>`
  - confirmar `issues` dentro do limite operacional acordado
  - em reprocessamento pontual:
    - `POST /api/internal/ops/padel/backfill?apply=true&eventId=<id>&rebuildHistoryProjection=true`
    - `POST /api/internal/ops/padel/cleanup?apply=true&eventId=<id>&rebuildHistory=true`
- Relatório:
  - total de overrides
  - compensações pendentes
  - sanções aplicadas/ativas

## 5. Rollback
- Rollback é de aplicação, não de schema (migrações forward-only).
- Passos:
  - reverter deploy backend/web/mobile/widgets
  - desativar leitura de novas superfícies se necessário (`/api/padel/me/history`, tier approvals)
  - manter jobs idempotentes ativos (cleanup/integrity)
- Após rollback:
  - repetir smoke técnico
  - confirmar estabilidade por 30 minutos antes de novo cutover

## 6. Checklist de Cutover
- Fase 1: migrações aplicadas
- Fase 2: backfill concluído
- Fase 3: backend deployado
- Fase 4: frontend/mobile/widgets deployados
- Fase 5: smoke + monitorização 24h
- Go-live: somente com gates verdes consecutivos
