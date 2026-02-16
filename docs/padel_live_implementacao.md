# Padel Live - Plano de Implementacao (2026-02-16)

## 0) Objetivo desta frente
- Executar o live de torneios Padel com:
  - leitura canonica unica (interna + publica),
  - operacao rapida para organizador,
  - experiencia clara para jogador,
  - consumo publico sem login em web.

## 1) Dependencias e sequencing
- Sequencia obrigatoria:
  - fechar `B2` (agenda/bookings write-path unico),
  - depois executar `B3-LIVE`.
- Dependencias tecnicas diretas:
  - `domain/agenda/conflictEngine.ts`,
  - `app/api/padel/calendar/claims/commit/route.ts`,
  - `app/api/padel/calendar/route.ts`,
  - `domain/padel/matchSlots/commands.ts`,
  - read models de standings/matches/public calendar.

## 2) Estado atual resumido
- Base ja existente:
  - calendario live e claims (`app/api/padel/calendar/*`),
  - matches (delay/dispute/walkover/undo),
  - standings e geracao de jogos,
  - superficies publicas de calendario.
- Gaps para este plano:
  - contrato unificado de resultado `imediato + oficial`,
  - matriz canonica de permissoes por modo (staff/jogador/confirmacao/disputa),
  - caminho formal de `reset_pending_result`,
  - contrato minimo de `override_result`,
  - definicao objetiva de `affectsStandings` no snapshot,
  - regra de expiracao de `PENDING_CONFIRMATION`,
  - contrato objetivo de standings para `CANCELLED/WALKOVER/RETIRED`,
  - idempotencia formal por comando/scope e por transicao de estado,
  - UX live consolidada por persona,
  - TV Mode como superficie principal,
  - notificacoes micro-evento por proximo jogo com dedupe/rate-limit por prioridade,
  - contrato de visibilidade publica/PII.

## 3) Arquitetura alvo (B3-LIVE)
- Write-path canonico:
  - score/match state -> `domain/padel/matches|matchSlots` -> eventlog/outbox -> projecoes.
- Read-path canonico:
  - superficies interna/publica leem os mesmos read-models live.
- Projecoes obrigatorias:
  - `live_now_by_court`,
  - `upcoming_matches_by_player`,
  - `latest_results_feed`,
  - `standings_with_tiebreak_explain`.

## 4) Fases executaveis (B3-L0..B3-L7)

### B3-L0) Contratos e schema
- Fechar enums/contratos de estado de resultado live.
- Definir `ResultValidationMode` por torneio/categoria.
- Definir `PendingConfirmationWindowMinutes`.
- Definir `PendingReviewExpired` como estado operacional obrigatorio.
- Definir `reset_pending_result` com `targetState` e trilho auditavel.
- Definir `override_result` com pre-condicoes de estado e evidencias obrigatorias.
- Definir matriz de permissao por modo (`IMMEDIATE_OFFICIAL` e `IMMEDIATE_PENDING_THEN_OFFICIAL`).
- Definir `affectsStandings` no snapshot de match e regra de calculo por fase.
- Definir semantica de standings para `CANCELLED`, `WALKOVER`, `RETIRED`.
- Definir `technicalWinScore` e `retirementScoreRule` obrigatorios por `MatchScoringProfile`.
- Definir `idempotencyKey` por comando e scope canonico.
- Definir regras de idempotencia por transicao de estado (NOOP/erro por comando).
- Deliverables:
  - atualizacoes em `prisma/schema.prisma`,
  - contratos em `domain/padel/*`.
- Gate:
  - `npm run typecheck` verde.

### B3-L1) Motor de resultado e progressao
- Implementar fluxo `RESULT_SUBMITTED -> PENDING_CONFIRMATION -> OFFICIAL`.
- Bloquear progressao automatica enquanto houver pendente que impacte classificacao.
- Garantir idempotencia de submit/confirm/reject/dispute/walkover/retired/cancel.
- Garantir idempotencia de dominio por estado (transicoes invalidas sem duplo efeito).
- Implementar expiracao `PENDING_CONFIRMATION -> PENDING_REVIEW_EXPIRED` sem auto-oficializacao.
- Bloquear advancement ate revisao operacional apos expiracao.
- Implementar `reset_pending_result` e `override_result` com guardrails de estado/permissao.
- Deliverables:
  - `domain/padel/matches/commands.ts`,
  - `domain/padel/standings.ts`,
  - `app/api/padel/matches/*`.
- Gate:
  - suites `tests/padel/*match*`, `tests/padel/standings*` verdes.

### B3-L2) Live publico (sem login)
- Criar contrato unico para pagina publica:
  - hero + KPIs,
  - agora por campo,
  - calendario/grupos/quadro/resultados/participantes.
- Manter coerencia com estado canonico interno.
- Aplicar mascara de dados/PII no payload publico (nome + inicial, sem dados sensiveis).
- Deliverables:
  - `app/api/padel/public/*`,
  - paginas web publicas live.
- Gate:
  - testes de contrato API publica + smoke web.

### B3-L3) Live jogador (app com login)
- Cartao `Proximo jogo` canonico.
- Feed pessoal:
  - jogo agendado,
  - alteracao de campo/hora,
  - resultado oficial,
  - proximo adversario definido.
- Deliverables:
  - `app/api/padel/me/summary/route.ts`,
  - `app/api/padel/me/matches/route.ts`,
  - `app/api/padel/me/history/route.ts`.
- Gate:
  - suites `tests/padel/me*` verdes.

### B3-L4) Operacao live organizador
- Painel live com:
  - score rapido,
  - acoes `WO`, `RETIRED`, `CANCELLED` (quando permitido),
  - visibilidade de pendentes/disputas/expirados para revisao.
- RBAC de torneio aplicado em todas as acoes criticas.
- Fila operacional de expirados com SLA visual (`<=30s`) e prioridade alta.
- Deliverables:
  - `app/api/padel/matches/[id]/*`,
  - `app/api/org/[orgId]/padel/audit/route.ts`.
- Gate:
  - suites `tests/padel/matchWalkoverRoute.test.ts`,
  - `tests/padel/matchDisputeRoute.test.ts`,
  - `tests/padel/criticalAudit.test.ts`.

### B3-L5) TV Mode (pilar)
- Superficie `TV_MODE` com estados:
  - pre-jogo,
  - em jogo,
  - pos-jogo.
- Layout sports broadcast:
  - score grande,
  - campo,
  - tempo/estado,
  - proximos jogos.
- Deliverables:
  - rota/page dedicada de monitor,
  - dados live em refresh rapido.
- Gate:
  - teste de contrato de dados + QA visual desktop/mobile.

### B3-L6) Notificacoes live
- Suporte a subscricao:
  - competicao/categoria,
  - geral.
- Eventos obrigatorios:
  - `JOGADOR`: jogo agendado, T-30, T-15, mudanca campo/hora, resultado, proximo adversario.
  - `GERAL`: inicio/fim competicao e fecho de grupos.
- Canal:
  - apenas app mobile para utilizadores autenticados,
  - sem notificacoes web/publicas.
- Regras tecnicas obrigatorias:
  - dedupe por `userId + matchId + eventType + scheduledAt`,
  - rate limit por prioridade (`CRITICAL` max `3` por match/utilizador em `30 min`, exceto cancelamento; `NON_CRITICAL` max `5` em `90 min`),
  - suporte a `quietHours` opcional.
- Deliverables:
  - produtores outbox live,
  - templates e preferencias de notificacao.
- Gate:
  - testes de dispatch/dedupe + preferencias por canal.

### B3-L7) Hardening e go-live dev
- Guardrails finais:
  - sem divergencia entre superficie interna/publica,
  - sem bypass de write-path,
  - paridade de estados live,
  - sem leituras ad-hoc fora de projecoes canonicas de live.
- Deliverables:
  - runbook live,
  - checklist de incidentes,
  - guardrail CI anti-bypass de comando/projecao,
  - endpoint raw de diagnostico segregado por ambiente/permissao (`dev/staging` tecnico; `prod` apenas admin com step-up + audit; nunca para UI publica/app).
- Gate:
  - `npm run typecheck`,
  - `npm run test -- tests/padel`,
  - guardrails ops live verdes.

## 5) Mapa de codigo alvo (incremental)
- API:
  - `app/api/padel/calendar/route.ts`
  - `app/api/padel/calendar/auto-schedule/route.ts`
  - `app/api/padel/calendar/claims/commit/route.ts`
  - `app/api/padel/matches/[id]/delay/route.ts`
  - `app/api/padel/matches/[id]/dispute/route.ts`
  - `app/api/padel/matches/[id]/walkover/route.ts`
  - `app/api/padel/public/calendar/route.ts`
  - `app/api/padel/standings/route.ts`
- Dominio:
  - `domain/padel/matches/commands.ts`
  - `domain/padel/matchSlots/commands.ts`
  - `domain/padel/standings.ts`
  - `domain/padel/tournamentLifecycle.ts`

## 6) Plano de testes (novos alvos)
- `tests/padel/liveResultConfirmation.test.ts`
- `tests/padel/livePendingConfirmationExpiry.test.ts`
- `tests/padel/livePermissionsMatrix.test.ts`
- `tests/padel/liveResetPendingResult.test.ts`
- `tests/padel/liveOverrideContract.test.ts`
- `tests/padel/liveAffectsStandingsGating.test.ts`
- `tests/padel/liveStandingExceptions.test.ts`
- `tests/padel/liveIdempotencyCommands.test.ts`
- `tests/padel/liveStateTransitionGuards.test.ts`
- `tests/padel/livePublicParity.test.ts`
- `tests/padel/livePublicDataMasking.test.ts`
- `tests/padel/liveTvModeContract.test.ts`
- `tests/padel/liveNotifications.test.ts`
- `tests/padel/liveNotificationsCriticalThrottle.test.ts`
- `tests/padel/liveTiebreakExplanation.test.ts`
- `tests/ops/padelLiveNoBypassGuardrails.test.ts`
- `tests/ops/padelLivePublicInternalParityGuardrails.test.ts`
- `tests/ops/padelLiveProjectionOnlyReadGuardrails.test.ts`
- `tests/ops/padelLiveRawDebugAccessGuardrails.test.ts`

## 7) Riscos e mitigacao
- Risco: regressao por dependencia com B2 agenda.
  - Mitigacao: congelar B2 antes de B3-L1 e executar suites agenda+padel em conjunto.
- Risco: progressao errada por resultado pendente.
  - Mitigacao: bloquear advancement sensivel enquanto pendente impacta tabela.
- Risco: ruido de notificacoes.
  - Mitigacao: dedupe, rate-limit normativo e `quietHours`.
- Risco: expiracao de pendentes bloquear operacao em pico.
  - Mitigacao: fila operacional de revisao + alertas prioritarios para direcao de prova + comando formal `reset_pending_result`.
- Risco: bypass tecnico entre backoffice/publico gerar incoerencia.
  - Mitigacao: guardrail CI anti-bypass + enforcement projection-only nos reads de live.
- Risco: exposicao indevida de PII no publico sem login.
  - Mitigacao: payload publico com data masking obrigatorio + testes de contrato.

## 8) Decisoes abertas do owner (bloqueadoras)
- Sem decisoes abertas de owner para esta frente.

## 9) Criterio de pronto para iniciar desenvolvimento
- sem decisoes abertas de owner para esta frente.
- `B2` fechado com `tests/agenda/*` verdes.
- Sequencia aprovada para iniciar `B3-L0`.
