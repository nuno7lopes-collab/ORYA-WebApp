# Plano Mestre de Execução Padel (2026-02-12)

## 1) Resumo
Este plano executa 100% do `docs/padel.md` com corte de legacy, organização por níveis (base -> avançado), sincronização total Web/API/Mobile/widgets, e gates técnicos obrigatórios por fase.
O plano é decisão-completo: o implementador não precisa escolher arquitetura, naming, compatibilidade ou rollout.

## 2) Decisões fechadas para esta execução
- Nome do documento canónico: `docs/padel_execucao.md`.
- Estratégia: execução por ondas com hard cut.
- Compatibilidade: corte imediato de legacy por fase (sem dual-compat prolongada).
- Modo de cutover: janela técnica curta por fase.
- Âmbito: WebApp organização, APIs, mobile, widgets públicos, testes/ops.
- RBAC global: manter `rolePack` global `TOURNAMENT_DIRECTOR`; no Padel, papel operacional canónico é `DIRETOR_PROVA`.

## 2.1) Estado de execução técnica (2026-02-13)
- Implementado nesta ronda (hard-cut parcial real):
  - `AMERICANO`/`MEXICANO` removidos de `FORMAT_NOT_OPERATIONAL` na geração (`/api/padel/matches/generate` + `domain/padel/autoGenerateMatches.ts`).
  - score canónico com `mode=TIMED_GAMES` + `BYE_NEUTRAL` (`domain/padel/score.ts`, `lib/padel/validation.ts`, `/api/padel/matches`).
  - standings canónico com `entityType` e `rows`/`groups` (PLAYER para `AMERICANO`/`MEXICANO`, PAIRING restantes) em `/api/padel/standings`.
  - live público com estado de timer autoritativo (`timerState`, `serverNow`, `remainingMs`) em `/api/padel/live`.
  - endpoints de timer live: `POST /api/padel/live/timer/start`, `POST /api/padel/live/timer/stop`, `POST /api/padel/live/timer/next-round`.
  - hard-cut de claims legacy: `/api/padel/calendar` com `type=resource_claim` devolve `410 RESOURCE_CLAIM_WRITE_MOVED_TO_COMMIT`; write canónico em `/api/padel/calendar/claims/commit`.
  - enforcer de `ttlAt` para snapshots de courts parceiros em `domain/padel/partnershipSchedulePolicy.ts`.
  - gate de versão mobile (`x-client-platform=mobile`, `x-app-version`) com `426 UPGRADE_REQUIRED` em endpoints breaking.
  - snapshot de rating no fecho oficial (`COMPLETED`) integrado no lifecycle (`/api/padel/tournaments/lifecycle`).
  - carry assimétrico no ranking e regra de rei único 1.00 reforçada no read-model.
- Testes desta ronda:
  - `vitest` Padel/ops: `33 files`, `95 tests`, tudo verde.

## 3) Princípios de execução
- SSOT-first: nenhuma implementação fora de contrato normativo (`docs/ssot_registry_v1.md` + `docs/padel.md`).
- Fail-closed: qualquer formato/regra/ação não operacional devolve erro explícito, sem fallback silencioso.
- Hard cut controlado: remover legacy na mesma fase em que a alternativa entra em produção.
- Sem bypass de agenda: toda ocupação de recurso passa pelo motor canónico de conflitos.
- UX limpa: sem “Ferramenta A/B”, sem excesso de copy, fluxo orientado a ação.
- Auditoria total: overrides, revogações, conflitos, sanções e transições sempre auditáveis.

## 4) Níveis de execução (base -> avançado)

### N0 — Foundation, inventário e baseline de corte
- Objetivo: congelar baseline técnico e preparar execução sem ambiguidade.
- Entregáveis:
  - inventário de rotas Padel,
  - inventário de enums/labels legacy,
  - mapa de dependências Web/Mobile/widgets,
  - checklist de cutover por fase.
- Ficheiros-alvo iniciais: `docs/padel_execucao.md`, `docs/ssot_registry_v1.md`, `reports/*padel*`, `tests/ops/*padel*`.
- Hard cut: bloquear entrada de novo legacy via guardrails CI.
- Critério de aceite: baseline aprovado; todos os gaps atuais referenciados a uma fase N1..N9.

### N1 — Contratos canónicos e normalização SSOT
- Objetivo: alinhar contrato funcional único antes de mexer na persistência.
- Entregáveis:
  - atualização normativa para papel operacional de torneio (`DIRETOR_PROVA`),
  - catálogo oficial de formatos com `AMERICANO` e `MEXICANO`,
  - contratos versionados de formato/regras/schedule/ranking.
- Ficheiros-alvo: `docs/ssot_registry_v1.md`, `docs/padel_execucao.md`.
- Hard cut: remover referências normativas ambíguas (`DIRECTOR` como papel operacional de torneio em Padel).
- Critério de aceite: SSOT consistente com `docs/padel.md` e sem decisões pendentes.

### N2 — Persistência e migrações hard cut (sem legado)
- Objetivo: executar migração de dados/esquema para suportar o modelo final.
- Mudanças de schema obrigatórias:
  - `enum padel_format`: adicionar `AMERICANO`, `MEXICANO`.
  - `enum PadelTournamentRole`: substituir `DIRECTOR` por `DIRETOR_PROVA`.
  - novos modelos: `PadelPartnershipAgreement`, `PadelPartnershipWindow`, `PadelPartnershipBookingPolicy`, `PadelPartnerRoleGrant`, `PadelPartnerCourtSnapshot`.
  - novos modelos ranking: `PadelRatingProfile`, `PadelRatingEvent`, `PadelRatingSanction`, `PadelTournamentTierApproval`.
  - novo modelo de claims multi-recurso: `AgendaResourceClaim` (resourceType/resourceId/sourceType/sourceId/window).
  - atualizações em `PadelTournamentConfig`: referências para snapshots de contrato versionado.
- Migração de dados:
  - mapear `PadelTournamentRoleAssignment.role=DIRECTOR` para `DIRETOR_PROVA`.
  - preencher snapshots de contratos em torneios já `LOCKED/LIVE/COMPLETED`.
  - inicializar `PadelRatingProfile` a partir de `PadelRankingEntry` com seed controlado (rating 1200).
- Hard cut: remover paths de leitura/escrita que dependam de enums antigos.
- Critério de aceite: migrations executam limpo em fresh clone + seed; sem `DIRECTOR` residual em schema/dados Padel.

### N3 — Backend Core: parceria entre organizações + agenda canónica multi-recurso
- Objetivo: fechar operação real de clube emprestado e sincronização de calendários.
- Entregáveis backend:
  - fluxo de parceria: pedido, aprovação, vigência, revogação, janelas por court/horário, política por acordo.
  - modelo híbrido de courts parceiro: proxy read-only como fonte; snapshot local só para resiliência (`version`, `ttl`, revalidação).
  - conflitos: `first-confirmed` por defeito; override só owner/admin da organização dona com auditoria e compensação automática.
  - claims multi-recurso: slot só confirma quando court + profissional/staff + demais claims estão livres.
  - semântica canónica de confirmação (`first-confirmed`):
    - confirmação apenas por transação atómica única (`slot + resourceClaims[] + locks`);
    - qualquer falha de claim/conflito provoca rollback total (sem estado parcial).
  - concorrência:
    - lock técnico por recurso/janela no write-path para eliminar corrida em picos de marcação.
  - compensação em override:
    - algoritmo determinístico obrigatório: `Mesmo Clube (outro campo)` -> `Próxima Janela Disponível`;
    - sem alternativa, criar incidente operacional `PENDING_COMPENSATION` com alerta prioritário.
  - governança de override:
    - `reasonCode` obrigatório e auditável.
- Endpoints novos/alterados:
  - `POST /api/padel/partnerships/agreements`
  - `POST /api/padel/partnerships/agreements/:id/windows`
  - `POST /api/padel/partnerships/agreements/:id/grants`
  - `POST /api/padel/partnerships/overrides`
  - `GET /api/padel/calendar` e `POST /api/padel/calendar` passam a devolver/aceitar `resourceClaims` em modo transacional atómico.
- Ficheiros-alvo iniciais:
  - `app/api/padel/clubs/route.ts`
  - `app/api/padel/clubs/[id]/courts/route.ts`
  - `app/api/padel/calendar/route.ts`
  - `app/api/padel/calendar/auto-schedule/route.ts`
  - `domain/agenda/*`
- Hard cut: remover criação local de courts parceiro fora do contrato canónico.
- Critério de aceite: cenário “org parceira organiza no clube dono” funciona fim-a-fim com aprovação/revogação/auditoria.

### N4 — Motor de torneios e formatos first-class
- Objetivo: ter motor único e completo para todos os formatos oficiais.
- Entregáveis:
  - `AMERICANO` e `MEXICANO` first-class no catálogo, wizard, geração, live e standings.
  - `NON_STOP` com cronómetro sincronizado, entrada rápida de resultados, ranking instantâneo, “sobe/desce” no modo Mexicano.
  - lock operacional: em `LOCKED`, formato e regras imutáveis.
  - matriz canónica de desempate por formato:
    - cada formato define ordem explícita de desempate (`1..n`);
    - tratamento de `BYE` obrigatório por formato;
    - definição de `confronto direto` obrigatória por formato (incluindo rotativo/individual).
  - snapshot de formato/regra:
    - `snapshot operacional` (resiliência de operação);
    - `snapshot de torneio` imutável após publish/`LOCKED`.
  - contratos versionados por torneio:
    - `TournamentFormatContract`
    - `MatchRuleContract`
    - `SchedulePolicyContract`
    - `RankingPolicyContract`
  - snapshot obrigatório no publish.
- Endpoints/tipos:
  - `app/api/padel/matches/generate/route.ts` e `domain/padel/autoGenerateMatches.ts` com estratégia por formato.
  - erro explícito `FORMAT_NOT_OPERATIONAL` quando superfície não suporta formato.
- Ficheiros-alvo iniciais:
  - `domain/padel/formatCatalog.ts`
  - `app/api/padel/tournaments/config/route.ts`
  - `app/api/padel/matches/generate/route.ts`
  - `app/organizacao/(dashboard)/eventos/novo/page.tsx`
- Hard cut: remover fallback implícito para `TODOS_CONTRA_TODOS` quando formato inválido.
- Critério de aceite: geração e operação live corretas para todos os formatos oficiais.

### N5 — Live Ops: atraso, buffer, incidentes e autoridade operacional
- Objetivo: operação live robusta em cenários reais de atraso/conflito.
- Entregáveis:
  - política oficial de atraso: default `CASCADE_SAME_COURT`; suportar `SINGLE_MATCH` e `GLOBAL_REPLAN`.
  - buffer automático hierárquico: court > fase > torneio > organização > global; limites 5..20; guardrails KO/finais min 10.
  - WO/retirement/injury com confirmação qualificada (`DIRETOR_PROVA` ou `REFEREE`) e hard gate de diretor por torneio.
  - janela de bloqueio de edição de resultado com override auditável por role permitida.
- Endpoints/tipos:
  - `POST /api/padel/matches/[id]/delay` inclui `delayPolicy`, impacto, replan result.
  - `POST /api/padel/matches/[id]/walkover` inclui `confirmedByRole`, `confirmationSource`.
  - `POST /api/padel/matches/[id]/dispute` com estados de resolução alinhados ao snapshot de regras.
- Hard cut: remover fluxos de resolução sem trilho de auditoria.
- Critério de aceite: atraso em cascata não quebra reservas externas; incidentes críticos resolvidos com governança correta.

### N6 — Ranking Global v2 (Glicko-2) + governança anti-fraude
- Objetivo: substituir ranking simplificado por motor canónico aprovado.
- Entregáveis:
  - motor global independente (`rating`, `RD`, `sigma`) e read-model rápido.
  - escala visual invertida 1.00..6.00, rei único 1.00, efeito de arrasto do #1, 2 casas decimais.
  - contrato matemático v1 explícito e versionado:
    - função `rating -> nível` logarítmica com parâmetros canónicos;
    - coeficientes `carry` e `underdog` explícitos no `RankingPolicyContract`;
    - proibição de ajustes ad-hoc fora de versão.
  - multiplicadores oficiais: social x0.5, amigável competitivo x1.0, bronze/prata x1.3, ouro/major x2.0.
  - degelo: +0.02/semana após 30 dias, cap +1.00.
  - sanções: 3 disputas inválidas (suspensão 15 dias), 5 não-validados (bloqueio de novos jogos), reset parcial +1.00.
  - claim retroativo de provisório: 6 meses.
  - governança de tiers: Ouro/Major só com aprovação ORYA + critérios canónicos.
- Endpoints/tipos:
  - `GET /api/padel/rankings` v2 com filtros `scope`, `periodDays`, `tier`, `clubId`, `city`.
  - `POST /api/padel/rankings/rebuild` (interno/admin).
  - `POST /api/padel/rankings/sanctions`.
- Hard cut: `PadelRankingEntry` deixa de ser motor de cálculo; passa a read-model/projeção.
- Critério de aceite: resultados reproduzíveis; anti-fraude e degelo aplicados conforme contrato.

### N7 — UI/UX WebApp organização (alto nível, limpa, sem legacy textual)
- Objetivo: experiência de gestão perfeita, intuitiva e sem ruído.
- Entregáveis IA/copy:
  - remover 100% de “Ferramenta A/B” e “Ferramentas”.
  - módulos finais: `Gestão de Clube Padel` e `Torneios de Padel`.
  - dashboard limpa por contexto; no máximo 1 linha de apoio por secção.
- Entregáveis funcionais UX:
  - calendário-mor com atividade agregada; drill-down por campo/profissional; conflitos visíveis com causa.
  - fluxo de parceria explícito com estados e permissões temporais.
  - wizards de torneio com validação imediata de regras e formatos.
- Ficheiros-alvo iniciais:
  - `app/organizacao/objectiveNav.ts`
  - `app/organizacao/DashboardClient.tsx`
  - `app/organizacao/OrganizationBreadcrumb.tsx`
  - `app/organizacao/OrganizationTopBar.tsx`
  - `app/organizacao/(dashboard)/padel/PadelHubClient.tsx`
  - `app/organizacao/(dashboard)/eventos/novo/page.tsx`
- Hard cut: remover labels, badges e descrições legacy em toda a navegação.
- Critério de aceite: navegação Padel em 2 módulos claros; zero strings legacy na UI.

### N8 — Mobile + widgets + notificações sincronizadas
- Objetivo: alinhamento total da experiência do jogador com operação web.
- Entregáveis:
  - mobile (`apps/mobile`) usa contratos v2 de ranking, calendário, próximos jogos, incidentes e formatos.
  - notificações operacionais: próximo jogo, court, adversário, atraso/replan, mudanças de bracket.
  - widgets públicos (`app/widgets/padel/*`) alinhados com snapshots e regras oficiais.
- Ficheiros-alvo iniciais:
  - `apps/mobile/features/tournaments/api.ts`
  - `apps/mobile/features/tournaments/hooks.ts`
  - `apps/mobile/app/padel/index.tsx`
  - `apps/mobile/features/notifications/*`
  - `app/widgets/padel/*`
- Hard cut: remover consumo de payloads legacy incompatíveis com v2.
- Critério de aceite: paridade funcional Web/Mobile para jogador em torneio live.

### N9 — Hardening final, observabilidade e go-live gates
- Objetivo: fechar execução sem regressão e sem dívida residual.
- Entregáveis:
  - guardrails CI reforçados para formato, roles, rotas, labels e no-legacy.
  - runbook de cutover por fase com checklist pré/durante/pós janela técnica.
  - dashboards de observabilidade para conflitos, atrasos, replan, ranking, sanções.
  - auditoria final de permissões e overrides.
- Hard cut final: remoção definitiva de código morto/flags temporárias/mapeamentos de transição.
- Critério de aceite: testes verdes consecutivos; execução limpa em fresh clone; zero referências legacy Padel.

## 5) Mudanças públicas de API/interfaces/types (obrigatórias)

### APIs novas
- `POST /api/padel/partnerships/agreements`
- `POST /api/padel/partnerships/agreements/:id/windows`
- `POST /api/padel/partnerships/agreements/:id/grants`
- `POST /api/padel/partnerships/overrides`
- `POST /api/padel/rankings/rebuild` (interna/admin)
- `POST /api/padel/rankings/sanctions`

### APIs alteradas (breaking)
- `POST /api/padel/matches/generate` passa a falhar fechado para formato inválido ou não operacional.
- `POST /api/padel/matches/[id]/delay` exige contrato explícito de política de atraso.
- `POST /api/padel/matches/[id]/walkover` exige metadados de confirmação qualificada.
- `GET /api/padel/rankings` muda semântica para motor Glicko-2 v2 e read-model.

### Tipos/enum/modelos
- `padel_format`: incluir `AMERICANO`, `MEXICANO`.
- `PadelTournamentRole`: `DIRETOR_PROVA`, `REFEREE`, `SCOREKEEPER`, `STREAMER`.
- Novos modelos: `PadelPartnershipAgreement`, `PadelPartnershipWindow`, `PadelPartnershipBookingPolicy`, `PadelPartnerRoleGrant`, `PadelPartnerCourtSnapshot`, `AgendaResourceClaim`, `PadelRatingProfile`, `PadelRatingEvent`, `PadelRatingSanction`, `PadelTournamentTierApproval`.
- `PadelRankingEntry`: manter como read-model, não motor de cálculo.

## 6) Plano de testes e cenários de validação

### Testes unitários
- geração de formatos por estratégia, incluindo `AMERICANO`/`MEXICANO` e `NON_STOP`.
- motor Glicko-2 adaptado a duplas; carry, underdog, degelo, sanções.
- políticas de atraso/buffer com guardrails e limites.
- atomicidade de `resourceClaims[]` (commit completo ou rollback total).
- algoritmo determinístico de compensação e transição para `PENDING_COMPENSATION`.

### Testes de integração API
- parceria inter-organizações: pedido -> aprovação -> janela -> agendamento -> revogação.
- conflito de agenda: `first-confirmed` + override auditável.
- publicação/lock/live com snapshots imutáveis.
- incidentes WO/retirement/injury com roles corretas.
- lock de concorrência em claims multi-recurso sob carga concorrente.
- matriz de desempate por formato (incluindo `BYE` e confronto direto rotativo).

### Testes E2E Web/Mobile
- organização cria torneio completo e opera live até final.
- jogador recebe notificações e acompanha bracket/resultados.
- perfil mostra títulos e histórico detalhado do torneio.
- ranking global/clube/localização consistente após jogos e torneios.

### Guardrails de regressão (CI obrigatório)
- proibir strings/labels legacy (“Ferramenta A/B”, “Ferramentas”) em UI Padel.
- proibir enum/roles operacionais legacy no domínio Padel.
- proibir fallback silencioso de formato.
- proibir writes fora da Agenda Engine.

## 7) Matriz de rastreabilidade `padel.md` -> níveis
- IDs 1,2,3,4 -> N7.
- IDs 5,6,7,8,9,10 + R1,R2 -> N3.
- IDs 11,12,12.1,13 -> N3 e N7.
- IDs 14,15,21,22,23,24 + R7 -> N5.
- IDs 16,17,18,19,20 + R6 -> N4.
- IDs 25,26 -> N8.
- IDs 27,28 + R5 -> N6.
- IDs 29,30,31 -> N3, N7, N9.

## 8) Cutover operacional por fase (padrão obrigatório)
- Pré-janela: freeze de writes Padel da fase; backup lógico; validação de migração em staging.
- Janela: aplicar migração; deploy backend/web/mobile; executar smoke pack da fase.
- Pós-janela: abrir writes; monitorizar métricas 24h; fechar relatório de fase.
- Rollback: restore do backup da fase + tag anterior; incidente obrigatório em runbook.

## 9) Assunções e defaults adotados
- O plano usa `docs/padel_execucao.md` como documento canónico de execução.
- `rolePack` global `TOURNAMENT_DIRECTOR` mantém-se; somente o papel operacional Padel muda para `DIRETOR_PROVA`.
- Sem compatibilidade longa de legacy; cortes são imediatos com janela técnica curta.
- Implementação inclui `apps/mobile` no mesmo roadmap, não numa vaga posterior.
- Não há decisões pendentes de produto; pendências remanescentes são só execução técnica.

## 10) Definition of Done final
- Todas as fases N0..N9 concluídas com critérios de aceite cumpridos.
- `docs/padel_execucao.md` atualizado com evidência por fase.
- SSOT, schema, APIs, UI Web, Mobile e widgets alinhados.
- Zero referências legacy Padel em código ativo.
- Suites de teste e guardrails verdes de forma consecutiva em ambiente limpo.

## 11) Estado de execução (implementado neste ciclo)

### N1 — Contratos canónicos e SSOT
- Feito:
  - normalização do papel operacional de torneio para `DIRETOR_PROVA` no SSOT.

### N2 — Persistência e migração hard cut
- Feito:
  - `enum padel_format` atualizado com `AMERICANO` e `MEXICANO`.
  - `enum PadelTournamentRole` atualizado para `DIRETOR_PROVA` (sem `DIRECTOR`).
  - migração criada: `prisma/migrations/20260212221500_padel_format_and_tournament_role_hardcut/migration.sql`.

### N3 — Backend Core (parcerias + agenda canónica)
- Feito:
  - modelos N3 introduzidos no schema:
    - `PadelPartnershipAgreement`
    - `PadelPartnershipWindow`
    - `PadelPartnershipBookingPolicy`
    - `PadelPartnerRoleGrant`
    - `PadelPartnerCourtSnapshot`
    - `PadelPartnershipOverride`
    - `AgendaResourceClaim`
  - enums N3 introduzidos:
    - `PadelPartnershipStatus`
    - `PadelPartnershipPriorityMode`
    - `AgendaResourceClaimType`
    - `AgendaResourceClaimStatus`
  - migração N3 criada: `prisma/migrations/20260212233500_padel_partnership_core_n3/migration.sql`.
  - APIs canónicas implementadas:
    - `POST/GET /api/padel/partnerships/agreements`
    - `POST /api/padel/partnerships/agreements/:id/windows`
    - `POST /api/padel/partnerships/agreements/:id/grants`
    - `POST /api/padel/partnerships/overrides`
  - calendário canónico:
    - `GET /api/padel/calendar` passa a incluir `resourceClaims`.
    - `POST /api/padel/calendar` aceita `type=resource_claim` com validação de conflito fail-closed.
  - fluxo parceiro:
    - sync automático de courts parceiro via `domain/padel/partnerCourtSync.ts`.
    - criação/edição local de courts em clube `PARTNER` mantém-se bloqueada (`CLUB_READ_ONLY`) no write-path.
    - create de torneio (`/api/organizacao/events/create`) valida `PARTNER` com parceria aprovada e janelas ativas no período do evento (fail-closed).

### N4 — Motor de formatos (fail-closed)
- Feito:
  - catálogo canónico atualizado em `domain/padel/formatCatalog.ts`.
  - `POST /api/padel/matches/generate` sem fallback implícito para formato inválido (`INVALID_FORMAT`).
  - formatos `AMERICANO`/`MEXICANO` marcados como não operacionais no gerador (`FORMAT_NOT_OPERATIONAL`) até motor completo.
  - wizard/listas de formato atualizados para expor `AMERICANO` e `MEXICANO`.

### N5 — Live Ops (atraso + política + constraints de parceria)
- Feito:
  - `POST /api/padel/matches/[id]/delay` aceita `delayPolicy` (`SINGLE_MATCH`, `CASCADE_SAME_COURT`, `GLOBAL_REPLAN`) com default canónico `CASCADE_SAME_COURT`.
  - payload de outbox/auditoria do delay passa a incluir `delayPolicy`.
  - `PADEL_MATCH_DELAY_REQUESTED` executa replaneamento por política:
    - `SINGLE_MATCH`: replan só do jogo atrasado.
    - `CASCADE_SAME_COURT`: replan do jogo atrasado + pendentes no mesmo campo a partir do jogo afetado.
    - `GLOBAL_REPLAN`: replan global dos pendentes do torneio.
  - integração de constraints de parceria no autoschedule e no outbox de delay:
    - resolução fail-closed por acordo/janela/snapshot.
    - injeção de blocos sintéticos fora das janelas aprovadas.
  - `POST /api/padel/calendar/auto-schedule` falha fechado com `PARTNERSHIP_CONSTRAINTS_BLOCKED` quando a parceria não permite o slot.
  - governança de incidentes (`walkover/retirement/injury` e resolução de disputa):
    - confirmação operacional canónica com `confirmedByRole` (`DIRETOR_PROVA|REFEREE`) e `confirmationSource`.
    - gate de ronda crítica KO: meias/final exige direção (`DIRETOR_PROVA` ou `Owner/Admin`).
    - fail-closed se o torneio não tiver pelo menos 1 `DIRETOR_PROVA`.
    - hard-cut de payload em incidentes:
      - `walkover`: exige `confirmedByRole` e `confirmationSource`.
      - `dispute` resolve: exige `resolutionStatus` e `confirmationSource`.
    - quando confirmação/resolução é feita por `REFEREE`, sistema envia alerta automático para perfis `DIRETOR_PROVA` do torneio.
    - anti-bypass obrigatório:
      - `POST /api/padel/matches` rejeita resultados especiais com `SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT`.
      - UI live/monitor/dashboard usa endpoint dedicado `POST /api/padel/matches/:id/walkover`.
  - lifecycle de publicação reforçado:
    - `POST /api/padel/tournaments/lifecycle` bloqueia `PUBLISHED` com `TOURNAMENT_DIRECTOR_REQUIRED` quando faltar `DIRETOR_PROVA`.
  - create de evento Padel reforçado:
    - auto-atribuição idempotente de `DIRETOR_PROVA` ao criador do evento para eliminar torneio sem direção operacional.

### N7 — UI/UX naming hard cut
- Feito:
  - remoção de labels legacy `Ferramenta A/B` e `Ferramentas` na navegação organizacional Padel.
  - nomenclatura final aplicada: `Gestão de Clube Padel` e `Torneios de Padel`.

### N9 — Guardrails de regressão
- Feito:
  - reforço de guardrails em `tests/ops/padelCatalogAndRoleGuardrails.test.ts`:
    - bloqueio de `DIRECTOR` em runtime Padel.
    - bloqueio de labels legacy em navegação organizacional Padel.
    - validação de enum/catálogo para `AMERICANO` e `MEXICANO`.
  - novo guardrail N3 em `tests/ops/padelPartnershipContractGuardrails.test.ts`:
    - valida schema de parceria/claims.
    - valida existência das rotas canónicas de parceria.
    - valida bloqueio write-path para courts de clube parceiro.
    - valida suporte de `resource_claim` no calendário.

### Validação executada
- `npm run prisma:generate` -> OK
- `npx vitest run tests/ops/padelCatalogAndRoleGuardrails.test.ts` -> OK
- `npx vitest run tests/ops/padel*.test.ts` -> OK
- `npm run typecheck` -> OK

### Incremento adicional (2026-02-13)
- N2/N3:
  - migração complementar criada: `prisma/migrations/20260213013000_padel_final_closure_core/migration.sql`.
  - introduzidos no schema:
    - `PadelPartnershipCompensationCase`,
    - `bundleId` em `AgendaResourceClaim`,
    - campos de execução em `PadelPartnershipOverride` (`reasonCode`, `executedByUserId`, `executedAt`, `executionStatus`),
    - `PadelRatingProfile`, `PadelRatingEvent`, `PadelRatingSanction`, `PadelTournamentTierApproval`.
- N3:
  - endpoint canónico de commit atómico de claims multi-recurso:
    - `POST /api/padel/calendar/claims/commit`
    - lock transacional por recurso com `pg_advisory_xact_lock`,
    - rollback total em conflito, sem estado parcial,
    - `bundleId` comum ao conjunto de claims.
  - lifecycle de parceria completado com rotas dedicadas:
    - `POST /api/padel/partnerships/agreements/:id/approve`
    - `POST /api/padel/partnerships/agreements/:id/pause`
    - `POST /api/padel/partnerships/agreements/:id/revoke`
  - override operacional executável:
    - `POST /api/padel/partnerships/overrides/:id/execute`
    - compensação determinística (`mesmo clube/outro campo` -> `próxima janela`) com janela de 48h,
    - fallback para `PENDING_COMPENSATION` quando não há alternativa,
    - `reasonCode` obrigatório no create de override.
  - revogação automática de grants expirados:
    - `GET /api/cron/padel/partnership-grants/revoke`.
- N6:
  - motor de rating Glicko-2 v2 implementado em `domain/padel/ratingEngine.ts`.
  - `GET/POST /api/padel/rankings` migrado para leitura/projeção v2.
  - nova rota interna de rebuild:
    - `POST /api/padel/rankings/rebuild`.
  - nova rota de sanções:
    - `POST /api/padel/rankings/sanctions`.

### Validação adicional deste incremento
- `npm run prisma:generate` -> OK
- `npm run typecheck` -> OK
- `npx vitest run tests/ops/padelPartnershipContractGuardrails.test.ts tests/ops/padelCatalogAndRoleGuardrails.test.ts tests/padel/matchDelayRoute.test.ts tests/padel/matchDisputeRoute.test.ts tests/padel/matchWalkoverRoute.test.ts` -> OK
