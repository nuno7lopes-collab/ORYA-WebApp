# ORYA Padel — Auditoria Técnica “a fundo” (Torneios/Jogos/Live/Resultados/Calendário)

Data: 2026-02-21  
Escopo validado: backend, contratos API, runbooks, domínio de scheduling/live/resultados, testes unitários/contratuais relevantes.

## 1) Resumo executivo

O ORYA já tem uma base de torneios bastante avançada e, em vários pontos, acima do estado “só runbook”:

- Formatos de torneio estão modelados e com geração real (incluindo `AMERICANO` e `MEXICANO`).
- Há workflow de resultados completo (submit/confirm/reject/override/dispute) com idempotência e auditoria.
- Existe live público (`/api/padel/public/live`) e calendário público (`/api/padel/public/calendar`), com standings e feed.
- Há autoschedule com constraints e validação de conflitos no calendário de padel.
- Há delay policy com default `CASCADE_SAME_COURT` e eventos/auditoria associados.

Ponto crítico: ainda existe assimetria entre `CLASS_SESSION` e motor de conflitos/calendário de torneios. Este é o principal gap para ficar “absolutamente perfeito”.

## 2) Como deveria funcionar “perfeito” (objetivo-alvo)

Mantém-se a tua definição funcional como alvo correto:

- Planeamento rápido + formatos múltiplos + geração automática + ajustes manuais seguros.
- Live operacional com estados claros e operações rápidas.
- Resultados validados, confirmados e auditáveis.
- Notificações event-driven e experiência pública sem depender da app.
- Calendário único (SSOT) para reservas, aulas, jogos e bloqueios.

## 3) Comparação com benchmark (PadelTeams / similares)

Face ao benchmark que definiste, o ORYA já cobre grande parte do “core competitivo”:

- Gestão end-to-end de competição: presente.
- Live e estado competitivo: presente.
- Resultados com governança (disputa/override): presente.
- Notificações de alteração/resultado: presente.
- Camada pública de acompanhamento: presente.

Diferenças para fechar no nível “top”:

- Uniformizar completamente `CLASS_SESSION` na arbitragem de conflitos de torneio.
- Expor metadados de transmissão/streaming e tempo decorrido explícito no payload live.
- Consolidar checklist/testes de agenda classe+torneio conforme runbook.

## 4) O que está confirmado no ORYA (evidência técnica)

### 4.1 Formatos e geração de jogos

Confirmado em catálogo e geração:

- `TODOS_CONTRA_TODOS`
- `QUADRO_ELIMINATORIO`
- `GRUPOS_ELIMINATORIAS`
- `QUADRO_AB`
- `DUPLA_ELIMINACAO`
- `NON_STOP`
- `CAMPEONATO_LIGA`
- `AMERICANO`
- `MEXICANO`

Referências:
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/formatCatalog.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/generate/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/autoGenerateMatches.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/mexicanoRecomposition.ts`

### 4.2 Live ops, atraso e políticas

- Delay route com política default `CASCADE_SAME_COURT`.
- Emissão de evento outbox + event log + audit trail na operação de atraso.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/[id]/delay/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/docs/runbooks/padel_live_ops_v1.md`
- `/Users/nuno/orya/ORYA-WebApp/tests/padel/matchDelayRoute.test.ts`

### 4.3 Workflow de resultados (estado, validação, confirmação, disputa)

Confirmado:

- Ações: `submit_result`, `confirm_result`, `reject_result`, `reset_pending_result`, `override_result`, `dispute_result`, `walkover`, `retired`, `cancel_match`.
- Estados intermédios e finais: `RESULT_SUBMITTED`, `PENDING_CONFIRMATION`, `PENDING_REVIEW_EXPIRED`, `DISPUTED`, `OFFICIAL`, `WALKOVER`, `RETIRED`.
- Idempotência por `tournamentId + matchId + action + actorId + clientRequestId`.
- Regras de score parametrizadas (`scoreRules`) + snapshot de regra no resultado.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/resultWorkflow.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/[id]/result/submit/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/[id]/result/confirm/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/[id]/dispute/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/matches/[id]/walkover/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/tournaments/config/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/score.ts`

### 4.4 Notificações e dedupe

Confirmado:

- `MATCH_CHANGED`, `MATCH_RESULT`, `NEXT_OPPONENT`, `BRACKET_PUBLISHED`, etc.
- Dedupe com `scheduleVersion` para mudanças de match.
- Rate-limit por match para reduzir spam.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/domain/notifications/tournament.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/notifications/matchChangeDedupe.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/notifications/producer.ts`
- `/Users/nuno/orya/ORYA-WebApp/tests/notifications/matchChangedDedupe.test.ts`

### 4.5 Camada pública e exportações

Confirmado:

- Live público: `/api/padel/public/live`.
- Calendário público: `/api/padel/public/calendar`.
- Exportações de calendário/bracket em HTML/PDF/CSV/ICS.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/public/live/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/public/calendar/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/liveReadModel.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/org/[orgId]/padel/exports/calendario/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/org/[orgId]/padel/exports/bracket/route.ts`

### 4.6 Motor de reservas e consistência base

Confirmado:

- Lock transacional com `pg_advisory_xact_lock`.
- Passo interno de 5 minutos (`SLOT_STEP_MINUTES = 5`).
- Conflito com `ClassSession` na confirmação de booking devolve `SLOT_TAKEN`.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/lib/reservas/confirmBooking.ts`
- `/Users/nuno/orya/ORYA-WebApp/tests/bookings/confirmBookingRaceLock.test.ts`
- `/Users/nuno/orya/ORYA-WebApp/tests/bookings/confirmBookingClassSessionConflict.test.ts`
- `/Users/nuno/orya/ORYA-WebApp/tests/bookings/confirmBookingGridPolicy.test.ts`

## 5) Gaps reais e ambiguidades (o que atacava já)

## GAP 1 — `CLASS_SESSION` não está fechado como 1ª classe na agenda consumida por torneios

Sintoma técnico:

- A agenda da organização só pede `BOOKING/EVENT/TOURNAMENT` em `sourceTypes`.
- O read model mapeia só `TOURNAMENT` e `BOOKING`; os restantes caem como `EVENT`.

Risco:

- Sessões de aula podem não ser representadas corretamente na leitura operacional do calendário.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/app/api/org/[orgId]/agenda/route.ts`
- `/Users/nuno/orya/ORYA-WebApp/domain/agendaReadModel/query.ts`
- `/Users/nuno/orya/ORYA-WebApp/prisma/schema.prisma` (enum `SourceType` inclui `CLASS_SESSION`)

## GAP 2 — Conflict engine base não aceita `CLASS_SESSION` como tipo canónico

Sintoma técnico:

- `AgendaCandidateType` é só `HARD_BLOCK|MATCH|BOOKING|SOFT_BLOCK`.
- Teste valida fail-closed para `CLASS_SESSION`.

Risco:

- Dependência de mapeamentos indiretos para tratar aulas como “MATCH”, com potencial de inconsistência.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/domain/agenda/conflictEngine.ts`
- `/Users/nuno/orya/ORYA-WebApp/tests/agenda/conflictEngine.test.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/calendar/claims/commit/route.ts`

## GAP 3 — Autoschedule de torneio não consulta `ClassSession` explicitamente

Sintoma técnico:

- No autoschedule entram `MATCH`, `BOOKING`, `HARD_BLOCK`, `SOFT_BLOCK`.
- `ClassSession` não é carregada diretamente nessa rota.

Risco:

- Se `ClassSession` não estiver espelhada como `BOOKING`/claim equivalente, pode haver janela de conflito.

Referência:
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/calendar/auto-schedule/route.ts`

## GAP 4 — Drift entre runbook prescritivo e cobertura de testes atual

Sintoma:

- O runbook prescreve testes/itens de agenda classe+torneio que não aparecem materializados com os nomes previstos.

Risco:

- Falsa sensação de cobertura completa em live ops.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/docs/runbooks/reservas_aulas_torneios_pr_pack_v1.md`
- `/Users/nuno/orya/ORYA-WebApp/tests/`

## GAP 5 — Live público ainda sem metadados de streaming/elapsed explícito

Estado atual:

- Há `startAt/endAt` e agrupamentos live/upcoming/latest.
- Não há contrato explícito de `streamUrl/isStreaming/elapsedSeconds`.

Referências:
- `/Users/nuno/orya/ORYA-WebApp/domain/padel/liveReadModel.ts`
- `/Users/nuno/orya/ORYA-WebApp/app/api/padel/public/live/route.ts`

## 6) Plano de execução objetivo para fechar “perfeito”

## Fase 1 — SSOT calendário e conflitos

1. Estender `AgendaCandidateType` para incluir `CLASS_SESSION` com prioridade explícita.
2. Incluir `SourceType.CLASS_SESSION` no `/api/org/[orgId]/agenda`.
3. Corrigir mapping em `agendaReadModel/query` para `kind: "CLASS"` (em vez de cair em `EVENT`).
4. Incluir `ClassSession` explicitamente no `padel/calendar/auto-schedule` (ou garantir claim canónico equivalente com teste).

## Fase 2 — Hardening operacional live

1. Testes E2E de conflito cruzado `MATCH x CLASS_SESSION x BOOKING`.
2. Testes de regressão de arbitragem com overrides e reasonCode.
3. Garantir observabilidade por reason codes de skip/replan.

## Fase 3 — Experiência pública e benchmark parity

1. Expor `stream` metadata por jogo no read model público.
2. Expor `elapsed`/timer canónico para jogos `IN_PROGRESS`.
3. Fechar payload de subscrição/eventos para mobile com contrato estável por versão.

## Fase 4 — Gate de qualidade

1. Gate CI para suites críticas de padel/live/agenda.
2. Checklist de go-live com evidências automáticas (não manual).

## 7) Checklist final de “está perfeito?”

- [ ] Torneios gerados automaticamente para formatos alvo, com round progression correta.
- [ ] Calendário impede conflitos com reservas, aulas (`CLASS_SESSION`), jogos e bloqueios de forma uniforme.
- [ ] Reagendamento manual/automático é auditável e com motivo obrigatório.
- [ ] Resultados têm validação + confirmação + disputa + idempotência.
- [ ] Notificações live são deduplicadas e previsíveis.
- [ ] Página pública cobre live/resultados/calendário com dados suficientes para acompanhar sem app.

## 8) Conclusão

O ORYA já não está num estado “incipiente” de torneios; está num estado “operável com maturidade”.  
Para chegar ao nível “absolutamente perfeito” que definiste, o foco deve ser fechar a fronteira `CLASS_SESSION` dentro do motor de agenda/conflitos de torneios e completar o contrato de live público (stream/timer), mantendo os gates de teste alinhados com o runbook.
