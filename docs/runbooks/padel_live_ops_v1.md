# Padel Live Ops Runbook v1

## 1. Objetivo
Operar em produção o domínio Padel + Reservas (campos, aulas, torneios e serviços associados) com contratos canónicos fechados, cutover hard-cut e monitorização operacional contínua.

## 2. Pré-live (T-24h até T-30m)
- Validar schema/migrações em staging e produção:
  - migrações base de torneio/ranking já vigentes
  - migração de fecho Reservas+Aulas+Torneios (grid/duration policy, vínculos treinador-profissional, constraints de classe)
- Executar backfills idempotentes por ordem:
  - backfill `trainer -> reservation professional` (dry-run, depois apply)
  - backfill `GENERAL + categoryTag=AULAS -> CLASS` (dry-run, depois apply)
  - backfill `COURT -> service_duration_prices (30/60/90/120)` (dry-run, depois apply)
  - rebuild/materialize agenda para garantir `CLASS_SESSION`
  - regra obrigatória: todos os backfills com paginação (`limit/cursor`) e repetíveis sem efeitos colaterais
- Endpoints internos canónicos para jobs idempotentes:
  - dry-run: `POST /api/internal/ops/padel/backfill?limit=50`
  - apply: `POST /api/internal/ops/padel/backfill?apply=true&limit=50`
  - headers: `X-ORYA-CRON-SECRET: <ORYA_CRON_SECRET>`
  - paginação: usar `nextCursor` em `cursor=<nextCursor>`
- Confirmar readiness:
  - `GET /api/padel/ops/summary?eventId=<id>`
  - `GET /api/internal/ops/padel/integrity?eventId=<id>`
  - validar `CLASS_SESSION` presente em `/api/org/[orgId]/agenda`
  - validar recusa server-side de `startsAt` fora da grelha configurada
  - validar policy de duração de campos: catálogo fixo `30/60/90/120`, subset ativo por organização e `allowCustomDuration=false`
- Smoke técnico obrigatório (gate de cutover):
  - `npm run typecheck`
  - `npx vitest run tests/**/*.test.ts`
  - `npx vitest run tests/ops/padel*.test.ts`
  - `npx vitest run tests/padel/*.test.ts`
  - `npx vitest run tests/agenda/*.test.ts`
  - `npx vitest run tests/bookings/*.test.ts`

## 3. Durante Live
- Monitorizar cada 5 minutos:
  - `pendingSplitCount`, `waitlistCount`, `liveMatchesCount`, `delayedMatchesCount`
  - `conflictsClaimsCount`, `overridesCount`, `pendingCompensationCount`
  - `rankingSanctionsActive`, `delaysByPolicy`
  - `coachOccupancyRate`, `coachNoShowRate`, `classConversionRate`
  - `autoScheduleBlockedByClassSessionCount`, `autoScheduleSkippedByBookingCount`
  - `scheduleWriteGatewayDecisionLatencyMs`
  - `matchStartingSoonSentCount`
  - `publicLivePayloadStreamCoverage`
  - `calendarConflictPreflightMismatchCount`
- Alertas determinísticos (fonte canónica `/api/padel/ops/summary`):
  - `SLOT_OVERRUN_ALERT`: disparar quando `delayedMatchesCount >= 8` ou `delayedMatchesCount/liveMatchesCount > 0.25` por janela contínua de 10 minutos.
  - `MASS_CONFLICT_ALERT`: disparar quando `conflictsClaimsCount` cresce `>= 10` em 5 minutos.
  - `OVERRIDE_SPIKE_ALERT`: disparar quando `overridesCount` na última hora `>= max(5, 3x baseline média-horária de 7 dias)`.
  - `AUTO_SCHEDULE_INFEASIBLE_SPIKE`: disparar quando `AUTO_SCHEDULE_INFEASIBLE` sobe abruptamente (> 3x baseline de 60 min).
  - `PUBLIC_LIVE_5XX_SPIKE`: disparar quando `/api/padel/public/live` ou `/api/padel/public/calendar` excedem 1% de 5xx em 15 min.
- Regras operacionais:
  - atraso: default `CASCADE_SAME_COURT`
  - bulk-block de torneio: sempre por política `CASCADE_SAME_COURT` salvo override explícito
  - arbitragem canónica de calendário inclui `CLASS_SESSION` com prioridade: `HARD_BLOCK > CLASS_SESSION > MATCH > BOOKING > SOFT_BLOCK`
  - incidentes especiais: somente write-path canónico
  - override operacional: sempre com `reasonCode` auditável
  - edição de recursos com `courtId != null`: proibida no endpoint genérico (`COURT_RESOURCE_MANAGED_BY_COURT`)
- Notificações:
  - validar emissão `MATCH_CHANGED` para `DELAYED/RESCHEDULED`
  - validar reminder `MATCH_STARTING_SOON` com janela default de 15 minutos
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
  - métricas de aulas e treinadores (ocupação/no-show/conversão)

## 5. Rollback
- Rollback é de aplicação, não de schema (migrações forward-only).
- Passos:
  - reverter deploy backend/web/mobile/widgets
  - manter jobs idempotentes ativos (cleanup/integrity/backfill)
  - não executar rollback de schema
- Após rollback:
  - repetir smoke técnico
  - confirmar estabilidade por 30 minutos antes de novo cutover
  - validar ausência de crescimento anómalo em `conflictsClaimsCount` e `overridesCount`

## 6. Checklist de Cutover
- Fase 1: migrações forward-only aplicadas
- Fase 2: backfills dry-run e apply concluídos, com relatório de idempotência
- Fase 3: backend deployado (validação server-side de grid ativa)
- Fase 4: frontend/mobile/widgets deployados (UI em grid por org + catálogo 30/60/90/120 com subset ativo)
- Fase 5: smoke de ponta-a-ponta executado e aprovado
- Fase 6: monitorização reforçada 24h (métricas de torneio e aulas/treinadores)
- Go-live: somente com gates verdes consecutivos

## 7. Smoke de Negócio Obrigatório
- Cenário canónico:
  - criar treinador
  - publicar/aprovar treinador
  - validar upsert `ReservationProfessional`
  - no PadelHub, se não existir profissional ativo, executar `Criar em reservas`
  - criar aula recorrente `CLASS` com `ClassSeries`/`ClassSession`
  - validar recusa de `startMinute` fora de `bookingGridMinutes` no endpoint de class-series
  - validar presença da sessão no calendário org (`day/week`)
  - tentar criar reserva sobreposta
  - validar recusa por conflito (`SLOT_TAKEN`)
  - tentar auto-agendar `MATCH` sobre `CLASS_SESSION` (mesmo campo e overlap)
  - em `ALLOW_PARTIAL`, validar `200` com `skippedByMatch[].reason=CLASS_SESSION_CONFLICT` e `unscheduledByReason.CLASS_SESSION_CONFLICT`
  - em `REQUIRE_FULL`, validar `409 AUTO_SCHEDULE_INFEASIBLE` com `skippedByMatch` e conflito explicitado
  - tentar auto-agendar `MATCH` sobre `BOOKING` (mesmo campo e overlap)
  - em `ALLOW_PARTIAL`, validar `200` com `skippedByMatch[].reason=BOOKING_CONFLICT` e `unscheduledByReason.BOOKING_CONFLICT`
  - no calendário de dia/semana, arrastar jogo para outro slot horário (drag temporal)
  - validar preflight inline: mensagem explícita de bloqueio quando houver `CLASS_SESSION`/`BOOKING`/`HARD_BLOCK`
  - validar paridade `Simular` vs `Aplicar`: mesmas razões em `unscheduledByReason` para o mesmo input
- Registar evidências:
  - request/response dos endpoints
  - IDs de entidades criadas
  - timestamp UTC de execução
