# Padel Master Review e Plano de Fecho (2026-02-12)

## 0) Objetivo deste documento
- Fechar, por fases, tudo o que é Padel na ORYA: UI, UX, backend, APIs, regras, calendário, live e operação.
- Revalidar decisões já fechadas no SSOT e manter rastreabilidade histórica das ambiguidades já resolvidas.
- Registar perguntas obrigatórias ao owner e respetivas respostas finais, sem zonas cinzentas.

## 1) Fontes analisadas
- Normativo:
  - `docs/ssot_registry_v1.md` (D03, D14, D18.01..D18.16)
- Planeamento:
  - `docs/planning_registry_v1.md`
- Implementação (amostra crítica):
  - `app/organizacao/(dashboard)/padel/PadelHubClient.tsx`
  - `app/organizacao/objectiveNav.ts`
  - `app/organizacao/DashboardClient.tsx`
  - `app/organizacao/(dashboard)/eventos/novo/page.tsx`
  - `app/api/padel/clubs/route.ts`
  - `app/api/padel/clubs/[id]/courts/route.ts`
  - `app/api/padel/public/clubs/route.ts`
  - `app/api/padel/calendar/route.ts`
  - `app/api/padel/calendar/auto-schedule/route.ts`
  - `app/api/padel/matches/[id]/delay/route.ts`
  - `app/api/padel/matches/generate/route.ts`
  - `domain/padel/autoGenerateMatches.ts`
  - `domain/padel/outbox.ts`
  - `domain/padel/formatCatalog.ts`
  - `prisma/schema.prisma`
- Cobertura e testes:
  - `reports/api_orphans_v1.md`
  - Execução em `2026-02-12`: `vitest` em suites Padel/ops (`27 files`, `62 tests`, tudo verde).

## 2) Veredicto executivo (direto)
- Estado do documento de produto: **fechado em decisão**.
- Estado da implementação: **execução técnica faseada** (F0..F6), com contratos já definidos neste documento.
- Não existem ambiguidades de produto abertas neste documento.
- O trabalho remanescente é implementação, migração/higienização e hardening técnico.

## 3) Matriz de estado (Decisão / Implementação)

| Domínio | Decisão de produto | Estado de implementação |
|---|---|---|
| Core normativo Padel (D18) | Fechado | Ativo no SSOT. |
| Agenda engine única e conflitos (D03, D18.02..04) | Fechado | Base implementada; hardening e cobertura final em F3/F6. |
| API/UI coverage global | Fechado | Cobertura base validada; contratos finais e regressão contínua em F6. |
| UI/IA de módulos Padel | Fechado | Execução de renome/migração total e limpeza em F1. |
| Multi-org "clube emprestado" com autoridade final da dona | Fechado | Execução do contrato/janelas/governança em F2. |
| Catálogo de formatos Padel | Fechado | Execução técnica de `AMERICANO`/`MEXICANO` + fail-closed por superfície em F4. |
| Interclub por equipas | Fechado (fail-closed) | Motor completo em F4 mantendo bloqueio seguro até conclusão. |
| Operação de atrasos em live | Fechado | Política oficial definida; implementação e validação operacional em F4. |
| Perfil jogador (histórico de torneios ganhos detalhado) | Fechado | Read-model final e UX de perfil em F5. |
| Calendário "mor + subcalendários sincronizados" | Fechado | Claims multi-recurso e sincronização completa em F3. |

## 4) Decisões já fechadas e reconfirmadas (SSOT)
- D03: agenda única de operação e regra "quem marca primeiro ocupa", override manual auditável.
- D14: suporte a multi-organizações (mãe/filiais).
- D18.01..D18.16: unificação core Padel (verdade única de jogo, agenda sem bypass, sourceType unificado, lifecycle/live, roadmap por ondas, etc.).

Estas decisões ficam mantidas e fechadas; o que falta é execução técnica faseada para cumprir integralmente a visão aprovada.

## 5) Gaps críticos da auditoria inicial (já fechados em decisão)
- Esta secção é histórico da auditoria inicial para rastreabilidade.
- Todos os pontos abaixo foram fechados em decisão de produto (secções 8 e 9) e seguem para implementação por fase.

### G1) IA/Nomenclatura no frontend organizacional
- Evidência:
  - `app/organizacao/objectiveNav.ts` usa `"Ferramenta A"` / `"Ferramenta B"`.
  - `app/organizacao/(dashboard)/padel/PadelHubClient.tsx` usa `"Ferramenta A · Clube"` e `"Ferramenta B · Torneios"`.
  - `app/organizacao/DashboardClient.tsx` e `app/organizacao/OrganizationBreadcrumb.tsx` usam `"Ferramentas"`.
- Impacto:
  - Fricção de UX e incoerência com o modelo que queres (clean, direto, sem copy desnecessário).
- Contrato fechado para implementação:
  - Renomear IA para 2 módulos explícitos:
    - `Gestão de Clube Padel`
    - `Torneios de Padel`
  - Retirar terminologia "Ferramenta A/B" de toda a navegação.

### G2) Multi-org real para clube emprestado (governação da dona)
- Hoje:
  - Existe `kind=PARTNER` + `sourceClubId` em `PadelClub`.
  - Parceiro é criado na org que vai organizar (cópia/referência), sem contrato formal de capacidade.
  - Não há workflow de pedido/aprovação/revogação por janelas, com autoridade final da org dona.
- Contrato fechado para implementação:
  - Introduzir contrato explícito de partilha:
    - `ClubShareAgreement` (ownerOrgId, partnerOrgId, clube, estado, vigência).
    - `ClubShareWindow` (courtIds, horários, dias, capacidade, regras override).
    - `ClubShareBookingPolicy` (prioridades, hard stops, cancelamento, custos).
  - Toda ocupação pela organização parceira passa por estas janelas.
  - Owner mantém direito final de aprovação/override auditável.

### G3) Conflito técnico no fluxo de parceiros (diretório -> courts)
- Evidência:
  - `eventos/novo`: função `createPartnerCourts()` tenta criar courts via `POST /api/padel/clubs/{id}/courts`.
  - `app/api/padel/clubs/[id]/courts/route.ts` bloqueia clubes `PARTNER` com `CLUB_READ_ONLY`.
  - Criação de torneio exige courts selecionados.
- Risco:
  - Onboarding de parceiro pode ficar bloqueado em cenários reais.
- Contrato fechado para implementação:
  - Modelo híbrido canónico aprovado:
    - **Proxy read-only de courts do source club** como fonte principal.
    - **Snapshot local temporário** apenas para resiliência (`version` + `ttl` + revalidação).
    - Em divergência, prevalece sempre a fonte principal da organização dona.

### G4) Catálogo de formatos SSOT vs código
- SSOT D18.11 inclui: `AMERICANO` e `MEXICANO`.
- Implementação atual:
  - `prisma/schema.prisma` enum `padel_format` não inclui os dois.
  - `domain/padel/formatCatalog.ts` também não inclui.
  - Wizards/UI também não expõem esses formatos.
- Contrato fechado para implementação:
  - Alinhar `schema` + domínio + UI com SSOT para `AMERICANO` e `MEXICANO`.
  - Manter rollout `fail-closed` até cada superfície estar 100% operacional.

### G5) Calendário "mor + subcalendários sincronizados" e multi-recurso
- Estado:
  - Calendário de torneio/court está forte.
  - Falta fecho produto transversal para:
    - calendário-mor por organização,
    - subcalendário por campo,
    - subcalendário por profissional/treinador,
    - sincronização entre eles sem ambiguidade.
- Contrato fechado para implementação:
  - Modelo canónico com ocupação multi-entidade:
    - `resourceClaims[]` por slot (court, trainer, room, etc.).
  - Um slot só confirma se **todas** as claims estiverem válidas.
  - Visualização:
    - calendário-mor (sumário),
    - drill-down por recurso/profissional,
    - origem do bloqueio claramente visível.

### G6) Delay/live em operação real (atrasos encadeados)
- Estado:
  - Delay e auto-reschedule existem (`PADEL_MATCH_DELAY_REQUESTED`, outbox, autoschedule).
  - Falta decisão fechada de política operacional de cascata.
- Contrato fechado para implementação:
  - Política explícita por torneio:
    - `delayPolicy`: `SINGLE_MATCH` | `CASCADE_SAME_COURT` | `GLOBAL_REPLAN`.
    - limites de atraso, buffer dinâmico, prioridade (KO vs grupos), regra de proteção de reservas externas.

### G7) Perfil jogador e histórico de títulos
- Estado:
  - Existe perfil com stats, forma recente, jogos.
  - Não está fechado produto para "torneios ganhos" com detalhamento auditável no perfil.
- Contrato fechado para implementação:
  - Read model de histórico competitivo:
    - posição final por torneio/categoria,
    - dupla parceira,
    - árvore/resultado consultável,
    - conquistas oficiais.

## 6) Arquitetura alvo (padel-first, sem ambiguidades)

### 6.1 Calendário canónico
- Entidade de ocupação única (já alinhada com D03/D18) com claims múltiplas:
  - `court:{id}`
  - `trainer:{id}` / `staff:{id}` (quando aplicável)
  - `club:{id}` (escopo)
- Regras:
  - sem claim válida -> não agenda;
  - conflito em qualquer claim -> bloqueia;
  - override só por RBAC + trilho de auditoria.

### 6.2 Clube parceiro (multi-org)
- Fluxo obrigatório:
  1. Organização parceira envia pedido.
  2. Owner org aprova contrato e janelas.
  3. Organização parceira agenda apenas dentro de janela.
  4. Owner pode pausar/revogar janela.
- Este fluxo é obrigatório e já aprovado para execução.

### 6.3 Torneios e formatos
- Catálogo único de formatos (SSOT) + estado operacional por formato:
  - `SUPPORTED`
  - `ROADMAP`
  - `BLOCKED`
- Regra: formato oficial sem implementação numa superfície -> erro explícito (fail-closed), nunca fallback silencioso.

## 7) Faseamento de execução para fecho total

### Fase 0 — Materialização técnica de decisões fechadas [Gate obrigatório]
- Materializar decisões fechadas em contratos técnicos versionados (IA, parceria, formatos, ranking e atraso/buffer).

### Fase 1 — IA/UI limpa e consistente
- Remover "Ferramenta A/B" e "Ferramentas".
- Reestruturar navegação para:
  - Gestão de Clube Padel
  - Torneios de Padel
- Reduzir copy redundante e manter dashboard limpa.

### Fase 2 — Multi-org operacional (clube emprestado)
- Implementar contrato de partilha + janelas + aprovação.
- Resolver inconsistência de courts em parceiro (proxy/snapshot).
- Garantir autoridade final da org dona com auditoria.

### Fase 3 — Calendário mor + subcalendários sincronizados
- Implementar claims multi-recurso.
- Master calendar + drill-down por campo/profissional.
- Garantir sincronização e conflitos determinísticos.

### Fase 4 — Torneios/regras/live 100% fechados
- Alinhar catálogo de formatos com SSOT.
- Completar motor interclub por equipas (sem fallback).
- Fechar política de atrasos em cascata e buffers.
- Validar notificações operacionais e de jogador.

### Fase 5 — Jogador, ranking e histórico competitivo
- Histórico de títulos e posições finais.
- Ranking por escopo/categoria/tempo com regras claras.
- Exposição intuitiva no perfil do utilizador.

### Fase 6 — Hardening final (go-live gate)
- Contratos API/UI estáveis.
- Typecheck/lint/testes verdes consecutivos.
- Runbook de operação live.
- Auditoria de permissões e override.

## 8) Estado de decisão do owner (2026-02-12)

### 8.0 Regra de linguagem (fechado)
- Não usar o termo em inglês para participante/organização externa em produto/documentação de Padel.
- Termos oficiais: `parceiro` e `parceria`.

### 8.1 Decisões fechadas nesta ronda

| ID | Estado | Decisão fechada |
|---|---|---|
| 1 | Fechado | Remover totalmente “Ferramenta A/B” e “Ferramentas” da área organizacional. |
| 2 | Fechado | Nomes finais: `Gestão de Clube Padel` e `Torneios de Padel`. |
| 3 | Fechado | Dashboard limpa por defeito, escondendo módulos não ativos/relevantes. |
| 4 | Fechado | Limite de copy por secção: máximo 1 linha de apoio. |
| 5 | Fechado | Modelo oficial com contrato de partilha e aprovação da organização dona do clube. |
| 6 | Fechado | Organização dona pode revogar a parceria a meio, com regras de proteção operacional. |
| 7 | Fechado | Staff externo por parceria com grants temporários, escopo limitado, revogação automática e auditoria. |
| 9 | Fechado | Aprovação granular por court e por janela horária. |
| 10 | Fechado | Conflito com modelo misto: `first-confirmed` + `override` explícito auditável da organização dona. |
| 11 | Fechado | Calendário-mor obrigatório por organização. |
| 12 | Fechado | Subcalendários obrigatórios por campo e por profissional quando aplicável. |
| 12.1 | Fechado | Onboarding obrigatório antes de ficar ativo (campos mandatórios). |
| 13 | Fechado | Sincronização obrigatória campo + profissional (ambos livres). |
| 14 | Fechado | Política padrão de atraso: `CASCADE_SAME_COURT`. |
| 15 | Fechado | Buffer com default 10 min e alta configurabilidade por organização/torneio, com guardrails canónicos. |
| 16 | Fechado | Reorganização do catálogo e contratos em camadas versionadas, com snapshot por torneio. |
| 17 | Fechado | `AMERICANO` e `MEXICANO` entram com implementação 100% da lógica. |
| 18 | Fechado | Regras de qualificação em grupos configuráveis por torneio, sem quebrar autoagendamento. |
| 19 | Fechado | Desempates por preset com override, em sintonia com autoagendamento. |
| 20 | Fechado | NON_STOP com regra oficial integrada, cronómetro sincronizado e motor operacional completo. |
| 21 | Fechado | Delay policy default oficial: `CASCADE_SAME_COURT`. |
| 22 | Fechado | Delay/replan em live: Owner/Admin/Diretor Prova; staff apenas com permissão explícita. |
| 23 | Fechado | Bloqueio automático de edição de resultado após janela temporal de segurança. |
| 24 | Fechado | WO/retirement/injury com confirmação única qualificada (`DIRETOR_PROVA` ou `REFEREE`) e gate obrigatório de diretor por torneio. |
| 25 | Fechado | Perfil mostra títulos ganhos por torneio. |
| 26 | Fechado | Perfil com histórico completo de bracket por torneio. |
| 27 | Fechado | Ranking global fechado em 15 decisões normativas (Rei 1.00 único, Glicko-2 duplas, pesos, governança de tiers, degelo, anti-fraude, claim). |
| 28 | Fechado | Jogador sem conta entra como provisório sem exposição no ranking global até claim, com merge retroativo idempotente. |
| 29 | Fechado | Hierarquia marca mãe -> vários clubes entra já nesta fase. |
| 30 | Fechado | Autonomia operacional das filiais com guardrails herdados da mãe. |
| 31 | Fechado | Relatórios consolidados na mãe + drill-down por filial. |

### 8.2 Pendências finais (estado atual)
- Nenhuma pendência aberta.

### 8.3 Fechos adicionais desta ronda (owner)
- `R1` Fechado (`1A`): Courts de clube parceiro seguem modelo híbrido canónico
  - fonte principal em proxy read-only da organização dona;
  - snapshot local temporário apenas para resiliência (`version` + `ttl` + revalidação);
  - prevalência da fonte principal em caso de divergência.
- `R2` Fechado (`2A`): Conflitos de agenda entre dona/parceria mantêm modelo base
  - regra `first-confirmed`;
  - override apenas por fluxo explícito, auditável e com notificação/compensação.
- `R3` Fechado (`3B`): papel operacional de direção migra para convenção `DIRETOR_PROVA` também no escopo de torneio, com migração integral
  - remoção de 100% de legado nominal (`DIRECTOR`) após migração;
  - higienização completa de enums, contratos API, UI labels, auditoria e documentação.
- `R5` Fechado (`5A`): ranking passa a arquitetura com motor global Glicko-2 independente
  - cálculo canónico em modelo próprio (`rating`, `RD`, `sigma`, histórico de eventos de rating);
  - `PadelRankingEntry` permanece read-model/projeção para leitura rápida e ranking views.
- `R6` Fechado (`6.1..6.8`): formatos `AMERICANO` e `MEXICANO` fechados como first-class com operação canónica
  - `AMERICANO`: individual rotativo, ranking individual, foco em adaptação a parceiros distintos.
  - `MEXICANO`: individual com `sobe/desce` por performance e recomposição automática de quartetos por ronda.
  - unidade de jogo por tempo com sincronização global (default `20` min, configurável `15..22`).
  - sistema de pontos `3/1/0` com desempate canónico por `diferença de games > games ganhos > confronto direto`.
  - algoritmo de geração prioriza combinações inéditas (variedade máxima antes de repetição).
  - `BYE` neutro obrigatório (sem benefício/perda indevida por sorteio).
  - ao entrar em `LOCKED`, formato e regras ficam congelados (imutabilidade operacional).
  - formatos entram já no catálogo oficial em modo `fail-closed` até o motor estar 100% operacional por superfície.
- `R7` Fechado (`P1 A`): política de `atraso + buffer` oficial
  - buffer automático por política canónica de torneio/agenda;
  - override manual permitido apenas com trilho de auditoria;
  - comportamento automático mantém guardrails (conflitos, descanso mínimo, prioridades e proteção operacional).
- `R8` Fechado (`A1..A5`): fecho técnico de ambiguidades operacionais
  - `A1` claims multi-recurso em `first-confirmed` passam a definição canónica de confirmação atómica:
    - confirmação só existe quando `slot + resourceClaims[] + locks` são persistidos na mesma transação;
    - se qualquer validação/conflito falhar, existe rollback total (sem estado parcial);
    - concorrência controlada por lock técnico por recurso/janela no write-path.
  - `A2` override com compensação automática determinística:
    - ordem canónica: `Mesmo Clube (outro campo)` -> `Próxima Janela Disponível`;
    - sem alternativa, estado obrigatório `PENDING_COMPENSATION` com alerta prioritário e tratamento operacional;
    - `reasonCode` obrigatório para auditoria, governança e eventual sanção por abuso.
  - `A3` separação formal de snapshots:
    - `snapshot operacional` (resiliência curta com `ttl/version`);
    - `snapshot de torneio` imutável após `LOCKED` (integridade competitiva).
    - alterações no clube fonte após `LOCKED` não alteram condições do torneio em curso.
  - `A4` regras de desempate passam a matriz canónica por formato:
    - cada formato consulta a sua ordem explícita de critérios;
    - inclui tratamento de `BYE`;
    - define confronto direto por formato (incluindo rotativo/individual).
  - `A5` ranking oficial passa a contrato matemático explícito e versionado:
    - fórmula v1 de `Glicko-2` + conversão logarítmica `rating -> nível` ficam seladas;
    - coeficientes de `carry` e `underdog` ficam parametrizados no `RankingPolicyContract`;
    - alterações futuras apenas por nova versão (`v2+`), preservando histórico auditável.

## 9) Contratos robustos fechados (referência de execução)

### 9.1 ID 7 — Staff externo em parceria
Decisão fechada do owner:
- Manter catálogo canónico de roles (SSOT D18.09), sem enum paralelo.
- Introduzir `PartnerRoleGrant` por torneio:
  - `origin=PARTNER`,
  - `grantedBy`,
  - `startsAt`,
  - `expiresAt`,
  - `autoRevoke=true`.
- Capability matrix limitada por role (sem governance global da organização dona).
- Roles operacionais de parceria permitidas com escopo temporal e funcional limitado.
- Revogação automática no fim do torneio + revogação manual imediata pela organização dona.
- Suporte a parceiros recorrentes com template de grant, mantendo sempre TTL/escopo obrigatório.

### 9.2 ID 8 — Courts de clube parceiro
- Recomendação A:
  - Modelo híbrido canónico:
  - Fonte principal = proxy read-only da organização dona.
  - Snapshot local temporário apenas para resiliência operacional (`cache snapshot`) com `version`, `ttl` e revalidação.
  - Separação obrigatória:
    - `snapshot operacional` para disponibilidade/sync corrente;
    - `snapshot de torneio` congelado em publish/`LOCKED`.
  - Em conflito, prevalece sempre a fonte principal da organização dona.
- Alternativa B:
  - Snapshot total local sincronizado periodicamente.
- Nota:
  - A reduz divergência e mantém robustez em cenários reais.

### 9.3 ID 10 — Prioridade em conflito de agenda
Decisão fechada do owner:
- Modelo misto obrigatório:
  - Regra base: `first-confirmed` mantém slot.
  - Semântica técnica de confirmado:
    - confirmação só é válida com persistência atómica de `slot + claims` no mesmo commit;
    - qualquer falha numa claim invalida a operação completa (rollback total).
  - Se houver conflito crítico, abre fluxo de revisão para Owner/Admin da organização dona.
  - Apenas com `override` explícito e auditável pode haver alteração de slot confirmado.
- `Override` exige:
  - cálculo de impacto,
  - notificação imediata à organização parceira,
  - compensação automática com reagendamento prioritário dentro da janela de parceria.
- Sem `override` explícito, slot confirmado de parceria não é removido.

### 9.4 ID 15 — Buffer entre jogos
Decisão fechada do owner:
- Default global: 10 min.
- Modo operacional oficial: automático por política, com override manual auditável.
- Configuração hierárquica (mais específico prevalece):
  - `courtBufferOverride` (opcional),
  - `phaseBufferOverride`,
  - `tournamentBufferOverride`,
  - `organizationDefaultBuffer`,
  - fallback global.
- Limites canónicos: 5..20 min.
- Guardrails:
  - KO/finais: mínimo 10 min.
  - Grupos e NON_STOP: pode descer a 5 min.
  - Autoagendamento nunca pode quebrar o mínimo efetivo.

### 9.5 ID 16 — Catálogo de formatos e contratos transversais
- Recomendação A:
  - Reorganização em 4 camadas versionadas:
  - `TournamentFormatContract` (estrutura macro).
  - `MatchRuleContract` (pontuação, tie-break, WO, retirement).
  - `SchedulePolicyContract` (duração, buffer, atrasos, prioridade).
  - `RankingPolicyContract` (pontos, rating, validade temporal).
  - Cada torneio congela snapshot das 4 camadas no publish.
  - Mudanças futuras só por nova versão, nunca retroativas.
- Alternativa B:
  - Manter contrato único simples com campos opcionais.
- Nota:
  - A é mais robusta e evita regressões cross-módulo.

### 9.6 ID 20 — NON_STOP (regra oficial integrada)
- Recomendação A:
  - Regra oficial de plataforma:
  - Blocos fixos por ronda (default 20 min, configurável 15-22).
  - Contagem por games (proset curto) e fecho por buzina.
  - Se termina empatado no último game, ponto de ouro obrigatório.
  - Tabela: vitória 3, empate 1, derrota 0.
  - Desempate: pontos > confronto direto > diferença de games > games ganhos.
  - Motor obrigatório:
  - gerador automático de rotação,
  - cronómetro sincronizado,
  - entrada rápida de resultado,
  - ranking instantâneo,
  - “sobe e desce” automático no modo Mexicano.
- Alternativa B:
  - NON_STOP sem ponto de ouro final e com empate permitido sempre.
- Nota:
  - A oferece melhor previsibilidade competitiva e UX live.

### 9.7 ID 24 — Dupla confirmação de WO/retirement/injury
Decisão fechada do owner:
- Modelo “confirmação única qualificada”.
- WO/retirement/injury pode ser confirmado por `DIRETOR_PROVA` ou `REFEREE`.
- Hard gate: nenhum torneio publica sem pelo menos 1 `DIRETOR_PROVA` atribuído.
- Se confirmado por `REFEREE`, notificação automática ao `DIRETOR_PROVA` e trilho de auditoria reforçado.
- Em fases críticas (meias/final), exigir confirmação por `DIRETOR_PROVA` ou `Owner/Admin`.

### 9.8 ID 27 — Ranking (modelo robusto)
Decisões fechadas do owner:
- `27.1` Rei do ranking: `Nível 1.00` único global (meritocracia absoluta).
- `27.2` Relatividade do nível: o nível visual pode piorar por arrasto se o #1 subir.
- `27.3` Precisão visível: 2 casas decimais.
- `27.4` Rating inicial: `1200` pontos, equivalente visual inicial a `5.00`.
- `27.5` Mapeamento `rating -> nível`: função logarítmica.
- `27.6` Motor: `Glicko-2` adaptado a duplas (`rating`, `RD`, `σ`).
- `27.7` Jogos sociais contam (peso menor) e vencedor pode perder pontos se a performance ficar abaixo da expectativa.
- `27.8` Multiplicadores oficiais:
  - Social `x0.5`,
  - Amigável Competitivo `x1.0`,
  - Torneio Bronze/Prata `x1.3`,
  - Torneio Ouro/Major `x2.0`.
- `27.9` Governança de tiers:
  - Ouro/Major não pode ser auto-atribuído por qualquer organização.
  - Tiers Ouro/Major exigem critérios canónicos (ex.: validação de federação/parceria oficial, requisitos mínimos e aprovação ORYA).
  - Bronze/Prata pode ter auto-classificação com guardrails, sujeito a auditoria e reclassificação.
- `27.10` Distribuição em duplas: ponderada por “carry”, protegendo extremos e isolando mérito individual.
- `27.11` Inatividade: após 30 dias, degelo de `+0.02` nível/semana, com cap máximo total de `+1.00`.
- `27.12` Anti-fraude:
  - 3 disputas inválidas -> suspensão 15 dias.
  - 5 jogos não-validados por culpa do jogador -> bloqueio de novos jogos até regularização.
  - Penalizações afetam ranking e features da app, não reservas de campo nem acesso operacional das organizações.
- `27.13` Reset parcial controlado: penalização padrão de `+1.00` no nível visual.
- `27.14` Torneios oficiais: override final do organizador (zero contestação na app).
- `27.15` Claim retroativo: janela máxima de 6 meses.

Contrato funcional aprovado para implementação:
- Escala visual invertida `1.00` (elite) -> `6.00` (inicial).
- Base interna em pontos de skill (Glicko-2) e conversão para escala visual.
- Motor de cálculo isolado em domínio de rating global (não acoplado ao perfil/read-model).
- Snapshot de torneio obrigatório para evitar alterações de seeding a meio do torneio.
- Views de ranking: global, clube e localização, mantendo cálculo central único.
- Tier governance com classificação oficial de torneio e trilho de aprovação/auditoria.

### 9.9 ID 28 — Jogadores sem conta no ranking
Decisão fechada do owner:
- Rankings são sempre de jogadores (não de organizações).
- Jogador sem conta entra via `PadelPlayerProfile` com estado `provisório`, mantendo histórico completo.
- Não aparece no leaderboard público global até claim de conta.
- Exposição pública mínima:
  - apenas em contexto do próprio torneio (nome de inscrição),
  - sem perfil público de ranking global.
- Após claim da conta:
  - merge idempotente de histórico e ativação pública.

### 9.10 ID 6 — Formatos AMERICANO/MEXICANO (fecho final)
Decisão fechada do owner:
- `6.1` `AMERICANO` oficial = individual rotativo com ranking individual.
- `6.2` `MEXICANO` oficial = individual com mecânica `sobe/desce` e recomposição de quartetos.
- `6.3` unidade oficial por tempo = `20` min default (range `15..22`), com fecho sincronizado.
- `6.4` pontuação oficial = vitória `3`, empate `1`, derrota `0`; desempate por diferença de games.
- `6.5` gerador deve priorizar combinações inéditas entre jogadores.
- `6.6` `BYE` neutro canónico = `1` ponto, `0` diferença de games (`gamesFor=0`, `gamesAgainst=0`) e sem vantagem em confronto direto.
- `6.7` ao estado `LOCKED`, regras e formato ficam congelados até fim do torneio.
- `6.8` rollout com `fail-closed`: catálogo oficial imediato e bloqueio explícito onde motor ainda não esteja completo.

### 9.11 Fecho técnico transversal (A1..A5)
Decisão fechada do owner:
- Claims multi-recurso com atomicidade obrigatória no write-path:
  - `resourceClaims[]` entram por operação transacional única;
  - sem transação completa não existe reserva confirmada.
- Override/compensação:
  - política determinística obrigatória com fallback para `PENDING_COMPENSATION`.
- Snapshot partner/source:
  - resiliência operacional e integridade de torneio são tratados por snapshots distintos e com comportamento explícito.
- Matriz de desempate por formato:
  - tabela canónica única por formato (incluindo `BYE` e confronto direto).
- Ranking v1:
  - fórmula explícita, parametrizada e versionada (`RankingPolicyContract`) sem ajustes ad-hoc.

## 10) Critérios de aceite final (definição de "perfeito" para este scope)
- Todas as pendências da secção 8.2 fechadas.
- IA/nomenclatura final aplicada em todo o frontend organizacional.
- Multi-org parceiro com contrato/janelas/aprovação operacional.
- Calendário mor + subcalendários sincronizados com conflitos determinísticos.
- Confirmação de agenda multi-recurso com transação atómica e sem estados parciais.
- Override com compensação determinística e fallback operacional `PENDING_COMPENSATION`.
- Catálogo de formatos alinhado com SSOT e contratos versionados.
- Matriz de desempate canónica por formato aplicada e testada (incluindo `BYE` e confronto direto).
- Delay/live com política oficial implementada e testada.
- Perfil jogador com histórico competitivo final definido.
- Ranking v1 com fórmula explícita/versionada aplicada no motor canónico e read-model coerente.
- Guardrails de teste e contratos API/UI verdes em ambiente limpo.

## 11) Próximo passo imediato
- Converter decisões fechadas em backlog executável por fase (F0..F6), com tasks técnicas e critérios de aceite por entrega.
