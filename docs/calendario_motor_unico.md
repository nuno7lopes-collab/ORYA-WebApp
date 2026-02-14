# Calendario Master Review e Contrato de Motor Unico (2026-02-14)

## 0) Objetivo
- Fechar a arquitetura de produto e tecnica para um calendario unico que centraliza:
  - reservas de servicos,
  - aulas/sessoes,
  - torneios/jogos,
  - bloqueios operacionais,
  - recursos partilhados entre organizacoes.
- Definir contratos, regras e governanca para eliminar ambiguidades e "duplas verdades".
- Consolidar um contrato unico de decisao e operacao, sem secoes de pendencia paralelas.

## 1) Decisao macro recomendada
- **Decisao recomendada (R1): motor unico logico com isolamento por organizacao + federacao de leitura.**
- Em pratica:
  - ha **um unico produto/calendario** para o utilizador,
  - ha **um unico motor canonical** de regras e conflito,
  - o write path fica **particionado por autoridade de organizacao**,
  - calendarios "globais" (organizacao mae, parceria, visoes agregadas) sao **projecoes/read models** do mesmo motor.

Esta decisao equilibra escalabilidade, isolamento de tenancy, rastreabilidade e evita criar motores diferentes por modulo.

## 2) Estado atual (evidencia tecnica)

### 2.1 Base forte ja existente
- Read model de agenda:
  - `prisma/schema.prisma` (`AgendaItem`).
  - `domain/agendaReadModel/consumer.ts`.
  - `domain/agendaReadModel/query.ts`.
- Claims multi-recurso:
  - `prisma/schema.prisma` (`AgendaResourceClaim`).
  - `app/api/padel/calendar/claims/commit/route.ts` (commit atomico com lock tecnico).
  - `prisma/migrations/20260213194000_agenda_claims_overlap_exclusion/migration.sql` (exclusion constraint no overlap).
- Multi-org e contexto:
  - `prisma/schema.prisma` (`OrganizationGroup`, `OrganizationGroupMember`, overrides).
  - `lib/organizationContext.ts`.
- Parcerias (padel) com janelas/politicas/override/compensacao:
  - `prisma/schema.prisma` (`PadelPartnershipAgreement`, `PadelPartnershipWindow`, `PadelPartnershipBookingPolicy`, etc.).
  - `domain/padel/partnershipSchedulePolicy.ts`.
  - `app/api/padel/partnerships/overrides/route.ts`.
  - `app/api/padel/partnerships/overrides/[id]/execute/route.ts`.
  - `app/api/padel/partnerships/workspace/[id]/calendar/route.ts`.

### 2.2 Gaps criticos para a visao que queres
- Prioridade de conflito nao esta fechada de forma deterministica no motor:
  - `domain/agenda/conflictEngine.ts` define prioridades, mas bloqueia pelo primeiro overlap.
- Claims bloqueiam por `organization_id` no constraint:
  - `prisma/migrations/20260213194000_agenda_claims_overlap_exclusion/migration.sql`.
  - impacto: recurso fisico partilhado entre orgs pode nao ter arbitragem global nativa.
- Agenda pessoal nao representa claramente booking de servicos na mesma semantica:
  - `app/api/me/agenda/route.ts`.
- Hard-cut canonical vs implementacao fisica re-export:
  - `proxy.ts` bloqueia legado,
  - `app/api/org/[orgId]/*` ainda re-exporta `app/api/organizacao/*`.

## 3) Opcoes de arquitetura (com tradeoff)

### Opcao A) Motor central global sem particao por org
- Pro:
  - conflito global simples.
- Contra:
  - risco de isolamento de tenancy,
  - complexidade de permissao e blast radius maior.
- Veredito:
  - nao recomendado para o teu contexto atual.

### Opcao B) Motor separado por organizacao (codigo e regras diferentes por org)
- Pro:
  - isolamento maximo.
- Contra:
  - deriva funcional, custo alto de manutencao, mais "duplas verdades".
- Veredito:
  - nao recomendado.

### Opcao C) **Motor unico canonical + particao por org + federacao (recomendado)**
- Pro:
  - regra unica de negocio,
  - isolamento por tenancy no write path,
  - suporte natural a calendario geral, por profissional, por recurso, parceria e grupo-mae via projecoes.
- Contra:
  - exige fechar bem contratos cross-org de recurso partilhado.
- Veredito:
  - **recomendado**.

## 4) Contrato alvo do motor

### 4.1 Principios inviolaveis
- Nenhuma rota pode ocupar recurso fora do motor de calendario.
- Commit de ocupacao e atomico:
  - slot + claims + locks na mesma transacao.
- Se 1 claim falhar:
  - rollback total.
- Idempotencia obrigatoria por comando.
- Override apenas com RBAC + auditoria + motivo.

### 4.2 Modelo canonical de ocupacao
- Entidade base (evolucao de `AgendaResourceClaim`):
  - `claimId`
  - `organizationId` (tenant executor)
  - `authorityOrganizationId` (dona do recurso para arbitragem)
  - `resourceKey` (global canonical)
  - `resourceType`
  - `resourceId`
  - `sourceType`
  - `sourceId`
  - `startsAt`, `endsAt`
  - `status` (`CLAIMED`, `RELEASED`, `CANCELLED`)
  - `bundleId` (commit multi-claim)
  - `idempotencyKey`
  - `metadata`

### 4.3 Resource key canonical (decisao aprovada)
- Regra final:
  - `resourceKey = "{resourceType}:{authorityOrganizationId}:{resourceId}"`.
- Exemplo:
  - court da org 17 -> `COURT:17:44`.
- Beneficio:
  - conflito cross-org real para recursos partilhados sem ambiguidade.

### 4.4 Politica de conflito deterministic
- Regra em camadas (4A aprovado):
  1. Hard constraints bloqueiam sempre (`HARD_BLOCK`, compliance, manutencao, seguranca).
  2. Fora hard constraints, aplica-se `first_confirmed_wins`.
  3. Quando houver empate tecnico no mesmo instante/lote de confirmacao, aplicar prioridade por tipo:
     - `HARD_BLOCK` > `MATCH` (com `reasonCode=MATCH_SLOT`) > `BOOKING` > `CLASS_SESSION` > `SOFT_BLOCK`.
- Tie-break final deterministico:
  - menor `confirmedAt` vence,
  - depois menor `claimId` vence,
  - fallback tecnico: menor `createdAt` quando `confirmedAt` nao existir.
- Resultado de conflito deve devolver:
  - quem bloqueou,
  - porque bloqueou,
  - qual regra aplicada.

### 4.5 Taxonomia `MATCH` vs `MATCH_SLOT` (em revisao owner)
- Recomendacao aplicada para alinhamento documental (aguarda teu ok final):
  - `sourceType` canónico: `MATCH` (unico).
  - `MATCH_SLOT` fica como `reasonCode`/contexto de bloqueio, nao como novo `sourceType`.
- Motivo:
  - evita duplicacao de taxonomia,
  - preserva compatibilidade com SSOT/C01 e `AgendaSourceType` atual.

## 5) Calendarios que o produto deve expor

### 5.1 Calendario geral da organizacao
- Agrega todos os itens ativos da org.
- Fonte: read model canonical (`AgendaItem` + claims por join/projecao).

### 5.2 Calendario por profissional
- Filtro por profissional.
- Mostra ocupacao propria + bloqueios organizacionais que afetam.

### 5.3 Calendario por recurso
- Filtro por recurso (court, sala, equipamento, etc.).
- Base principal para detectar e explicar conflitos.

### 5.4 Calendario por evento/torneio
- Foco operacional por evento.
- Deve continuar alinhado com regras Padel existentes.

### 5.5 Calendario pessoal do utilizador
- Definicao operacional:
  - timeline pessoal consolidada de compromissos (nao e write-model).
- Semantica clara entre:
  - reserva de servico,
  - reserva de bilhete,
  - jogo,
  - inscricao.
- Nomes/labels sem ambiguidade.

### 5.6 Calendario de parceria (cross-org)
- Lane dona, lane parceira, lane de claims partilhadas.
- Ja existe base em `app/api/padel/partnerships/workspace/[id]/calendar/route.ts`.

### 5.7 Calendario da organizacao mae (grupo)
- Deve ser **projecao agregada read-only** das filiais por default.
- Escrita da mae em filial deve ser comando delegado explicito (auditado).

## 6) Multi-org: como fechar

### 6.1 Regra de autoridade
- Cada recurso tem uma autoridade unica (normalmente a org dona).
- Apenas autoridade pode definir:
  - hard blocks finais,
  - janelas de partilha,
  - override final.

### 6.2 Regra de motor por organizacao
- Nao criar motores diferentes por org.
- Usar o mesmo motor (mesma logica), com particao por tenant e autoridade de recurso.

### 6.3 Grupo (mae/filiais)
- Mae recebe feed agregado de agenda de todas as filiais.
- Filial mantem autonomia operacional.
- Mae pode:
  - observar tudo (se permissao),
  - emitir override delegado (se politica permitir).

## 7) Parcerias entre organizacoes: fecho recomendado

### 7.1 O que fica
- Contratos de parceria e janelas existentes mantem-se como base.

### 7.2 Regras operacionais consolidadas
- Claim cross-org com arbitragem por `resourceKey` global (nao apenas por `organizationId` local).
- SLA de snapshot parceiro:
  - expira -> write bloqueado por fail-closed.
  - leitura continua com estado `stale` sinalizado.
- Politica de compensacao:
  - auto quando regra contratual e deterministica,
  - manual quando ha excecao/comercial,
  - prazo maximo definido por contrato de parceria.

## 8) Riscos tecnicos de execucao (sem pendencia de decisao)

1. Prioridade real de conflitos nao esta refletida no motor atual (`domain/agenda/conflictEngine.ts`).
2. Claims anti-overlap sao por `organization_id` (nao por autoridade global de recurso) em `prisma/migrations/20260213194000_agenda_claims_overlap_exclusion/migration.sql`.
3. Semantica da agenda pessoal mistura tipos sem contrato final (`app/api/me/agenda/route.ts`).
4. Namespace canonical vs localizacao fisica de handlers ainda em transicao (`proxy.ts` + re-exports em `app/api/org/[orgId]`).
5. "reservas" em dominios diferentes (booking servico vs ticket reservation) ainda gera risco operacional de naming/runbook.

## 9) Contratos API alvo (v1 de consolidacao)

### 9.1 Commit canonical de ocupacao
- `POST /api/org/:orgId/calendar/claims/commit`
- payload:
  - `idempotencyKey`
  - `sourceType`, `sourceId`
  - `claims[]` (cada claim com `resourceKey`, `resourceType`, `resourceId`, `startsAt`, `endsAt`)
- resposta:
  - `accepted` ou `AGENDA_CONFLICT` com detalhe estruturado.

### 9.2 Release/cancel claim
- `PATCH /api/org/:orgId/calendar/claims/:claimId`
- mudanca de estado e janela sob lock.

### 9.3 Read agenda
- `GET /api/org/:orgId/calendar`
- filtros:
  - `from`, `to`
  - `view=GENERAL|PROFESSIONAL|RESOURCE|EVENT|GROUP`
  - `professionalId`, `resourceKey`, `eventId`, `groupId`, `includeExternal`.

### 9.4 Feed grupo-mae
- `GET /api/org/:orgId/calendar/group`
- somente agregacao de filiais permitidas por RBAC/scope.

## 10) Faseamento de execucao recomendado

### F0) Fecho de decisoes
- Higienizar contrato unico e remover estados antigos de pendencia.

### F1) Motor de conflito deterministico
- Corrigir algoritmo do `conflictEngine`.
- Cobrir testes de prioridade + desempate.

### F2) Resource key global + autoridade
- Adicionar campos e migracao.
- Ajustar exclusion constraint para dominio de conflito correto.

### F3) Consolidacao de endpoints calendar
- Formalizar endpoint canonical unico para commit claims.
- Remover bypasss residuais por modulo.

### F4) Calendarios agregados (org, profissional, recurso, grupo)
- Projetar visoes e filtros sem duplicar regras.

### F5) Cross-org partnership hardening
- Integrar arbitragem global de recurso partilhado.
- Fechar compensacao e SLA snapshot.

### F6) Operacao e observabilidade
- metricas (conflict rate, override rate, expiracao snapshot, backlog de compensacao),
- runbooks e SLO/SLA.

## 11) Criterios de sucesso (go-live gate)
- 0 conflitos duplos no mesmo `resourceKey` e janela para claims `CLAIMED`.
- 0 write path fora do motor canonical de calendario.
- Toda acao de override auditavel.
- Calendario geral == soma consistente dos subcalendarios.
- Calendario grupo-mae consistente com filiais sem escrita implicita.

## 12) Resumo executivo final
- A tua visao de "um calendario geral alimentado por subcalendarios" e viavel com a base atual.
- O ponto critico para fechar a 100% e **autoridade e arbitragem de recurso partilhado cross-org**.
- Recomendacao final:
  - manter um motor unico canonical,
  - particao por org no write path,
  - resource key global para shared resources,
  - calendario mae como agregacao read-first,
  - override sempre auditado e explicitamente delegado.

## 13) Ronda de fecho com owner (2026-02-14) - estado

### 13.1 Decisoes aprovadas pelo owner nesta ronda
1. **D01 APROVADO_OWNER (A)**: motor unico logico com writes por organizacao e leitura federada; mae com visao geral + vistas por filial.
2. **D02 APROVADO_OWNER (B, com clarificacao)**: calendario nao e ferramenta de escrita manual principal; e preenchido automaticamente por comandos de dominio; escrita direta so em excecao (override/hard block).
3. **D03 APROVADO_OWNER (A)**: calendario geral deriva sempre do mesmo motor dos subcalendarios.
7. **D07 APROVADO_OWNER (A)**: `resourceKey` global com autoridade do recurso.
8. **D08 APROVADO_OWNER (A com baixa burocracia)**: org dona tem autoridade final; friccao extra so em acoes criticas.
10. **D10 APROVADO_OWNER (A)**: mae com visao global total.
11. **D11 APROVADO_OWNER (A)**: filtros completos (filial/profissional/recurso/tipo) para evitar confusao.
12. **D12 APROVADO_OWNER (A + regra de governanca B)**: mae pode aplicar hard blocks; filiais continuam com equipa e gestao propria; filial pode pedir remocao, mas aprovacao final e sempre da mae.
13. **D13 APROVADO_OWNER (A)**: agenda pessoal inclui booking de servico.
16. **D16 APROVADO_OWNER (A)**: override exige motivo padrao + texto.
17. **D17 APROVADO_OWNER (A com politica de notificacao por impacto)**: audit/evento sempre; notificacao apenas quando ha impacto real em clientes/inscritos/staff afetado.
19. **D19 APROVADO_OWNER (custom)**: unidade temporal canónica de 5 minutos.
20. **D20 APROVADO_OWNER (B)**: sem buffer tecnico global obrigatorio por default.
21. **D21 APROVADO_OWNER (A)**: buffer configuravel por tipo (profissional/recurso/jogo/servico).
23. **D23 APROVADO_OWNER (A com janela explicita)**: `PENDING` ocupa enquanto hold estiver ativo.
25. **D25 APROVADO_OWNER (A)**: endpoint canónico unico de commit claims.
26. **D26 APROVADO_OWNER (A)**: legado de write-path deve ser removido totalmente.
31. **D31 APROVADO_OWNER (A)**: mostrar quem bloqueou/origem em conflitos (respeitando permissao).
32. **D32 APROVADO_OWNER (A)**: vistas timeline + grelha semanal.
33. **D33 APROVADO_OWNER (A)**: modo explicacao de conflito obrigatorio.

### 13.2 Decisoes aprovadas pelo owner nesta ronda
4. **D04 APROVADO_OWNER (C ajustado)**: regra base e `first_confirmed_wins`; hard constraints (compliance/manutencao/bloqueio forte) prevalecem sempre.
5. **D05 APROVADO_OWNER (A ajustado)**: desempate deterministico por `confirmedAt` asc e depois `claimId` asc (fallback `createdAt` quando necessario).
6. **D06 APROVADO_OWNER (A)**: empate perfeito ou estado incerto -> fail-closed.
9. **D09 APROVADO_OWNER (A ajustado)**: capacidade por recurso com modos `SINGLE`, `FIXED_N`, `UNBOUNDED`; calendario respeita modo configurado por tipo de recurso/profissional.
14. **D14 APROVADO_OWNER (A ajustado)**: labels separados na agenda pessoal; para evitar ambiguidade usar `RESERVA_SERVICO` e `BILHETE_EVENTO` (quando modulo de bilhete existir).
15. **D15 APROVADO_OWNER (A ajustado)**: timeline pessoal unica com filtros por tipo; eventos de bilhete sao timeline pessoal (nao ocupacao de recurso no motor).
18. **D18 APROVADO_OWNER (B)**: bypass de hard-stop so para OWNER/ADMIN, com motivo e auditoria reforcada; para impacto alto, confirmacao adicional.
22. **D22 APROVADO_OWNER (A)**: motor fica sem `PENDING_CLAIM` em v1 (`CLAIMED/RELEASED/CANCELLED` apenas).
24. **D24 APROVADO_OWNER (A)**: no-show mantem historico auditavel e liberta ocupacao futura.
27. **D27 APROVADO_OWNER (A)**: versao explicita de contrato API (`v1`, `v2`) obrigatoria.
28. **D28 APROVADO_OWNER (A faseado)**: SLO alvo p95 de commit: fase inicial `<=500ms`, alvo final `<=300ms`.
29. **D29 APROVADO_OWNER (A+B)**: alertas em tempo real + relatorio semanal.
30. **D30 APROVADO_OWNER (A com leitura degradada)**: snapshot expirado bloqueia novos writes (fail-closed); leitura permanece com `stale`.
34. **D34 APROVADO_OWNER (C)**: rollout por piloto curto e depois ondas.
35. **D35 APROVADO_OWNER (sem feature flags de produto)**: rollout por fases sem toggles de ativacao/desativacao funcional em runtime para clientes.
36. **D36 APROVADO_OWNER (B)**: freeze apenas para changes que tocam scheduling/core de agenda.

### 13.3 Clarificacoes normativas ja assumidas apos esta ronda
- "Quem confirma primeiro ocupa" e a regra base da agenda multi-modulo.
- Mudancas de horario de ocupacao ja confirmada (reserva/jogo/aula) passam por fluxo de alteracao (override ou change request), nunca por overwrite silencioso.
- Calendario geral da mae e derivado automaticamente dos eventos de agenda das filiais, sem dupla verdade.
- Calendario da mae e visao administrativa global (todas as filiais), com filtros para reduzir ruido.

### 13.4 Estado oficial (modelo 10C)
- `estado_decisao`: **EM_REVISAO_OWNER**.
- `estado_execucao`: **EM_EXECUCAO** (hardening tecnico e migracoes ainda em curso).
- Promocao para `estado_decisao=FECHADO_FINAL` so quando disseres explicitamente `FECHADO`.
- Este documento usa obrigatoriamente os dois eixos (decisao + execucao).

## 14) Glossario operacional (termos que geraram duvida)

### 14.1 "Reserva de bilhete"
- Nao e ocupacao de recurso (court/profissional/sala).
- E um evento de compra/holding de acesso a evento.
- No calendario de ocupacao do motor, **nao entra como claim de recurso**.
- Na agenda pessoal, pode aparecer como item de timeline com tipo proprio `BILHETE_EVENTO`.

### 14.2 "No-show"
- Significa: a sessao/jogo/reserva estava marcada mas a pessoa nao compareceu.
- E estado operacional/financeiro, nao mecanismo de agendamento.
- Regra fechada: manter historico e auditoria; nao bloquear ocupacoes futuras por si so.

## 15) Verificacao anti-ambiguidade dos 8 principios centrais

Principio 1:
- "Calendario e motor de ocupacao + projecao, nao ferramenta de escrita manual."
- Consistencia: mantida com D02, D25, D26.

Principio 2:
- "Escritas vem dos dominios (reserva/aula/torneio/bloqueio/mudanca)."
- Consistencia: mantida; cada dominio publica comando canonico.

Principio 3:
- "Cada acao gera comando canonico (claim/release/move) com idempotencia."
- Consistencia: mantida; `move` e operacao composta atomica.

Principio 4:
- "Commit atomico: novo claim + lock + validacao + release antigo (quando troca)."
- Consistencia: mantida com lock tecnico e fail-closed em erro.

Principio 5:
- "Regra base first confirmed wins, com excecoes hard constraints."
- Consistencia: fechada em D04 sem conflito com override.

Principio 6:
- "Mae ve tudo e atua como admin central."
- Consistencia: fechada em D10/D12; sem quebrar autonomia operacional local.

Principio 7:
- "Override existe com trilho auditavel e politica por impacto."
- Consistencia: fechada em D16/D17/D18/D29.

Principio 8:
- "Motor unico logico, multi-org por particao e autoridade de recurso."
- Consistencia: fechada em D01/D07/D30; elimina dupla verdade cross-org.

### 15.1 Regras de precedencia final (sem contradicao)
1. Hard constraints (seguranca/compliance/manutencao) bloqueiam sempre.
2. Fora isso, first-confirmed-wins.
3. Em empate tecnico no mesmo instante/lote, aplicar prioridade por tipo (`MATCH` com `reasonCode=MATCH_SLOT` acima de `BOOKING`, etc.).
4. Tie-break final: `confirmedAt` e depois `claimId` (fallback `createdAt`).
5. Excecao so por override autorizado e auditado.
6. Em incerteza tecnica/conflito irresolvevel, fail-closed.
