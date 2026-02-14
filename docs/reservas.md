# Reservas Master Review e Plano de Fecho (2026-02-14)

## 0) Objetivo deste documento
- Fechar 100% da ferramenta de Reservas: visão de produto, contratos, regras operacionais, estados, permissões e integração com Agenda/Finanças/CRM.
- Consolidar o que já está fechado no SSOT versus o que está implementado no código.
- Expor ambiguidades, contradições e "duplas verdades" com evidência técnica.
- Manter rastreabilidade do questionário histórico e consolidar decisões aprovadas pelo owner.

## 0.1) Estado oficial (modelo 10C)
- `estado_decisao`: **EM_REVISAO_OWNER**.
- `estado_execucao`: **EM_EXECUCAO**.
- Regra de autoridade: o SSOT (`docs/ssot_registry_v1.md`) continua fonte de verdade normativa e deve ser atualizado com as decisões aprovadas neste documento.

## 1) Fontes analisadas
- Normativo:
  - `docs/ssot_registry_v1.md` (C-G, C01, D02, D03, D03.02, regras de canonicidade `/api/org/:orgId/*`)
- Documento de referência de formato:
  - `docs/padel.md`
- Roteamento e hard-cut:
  - `proxy.ts`
- APIs principais de Reservas/Agenda/Serviços:
  - `app/api/organizacao/reservas/route.ts`
  - `app/api/servicos/[id]/reservar/route.ts`
  - `app/api/servicos/[id]/checkout/route.ts`
  - `app/api/organizacao/reservas/[id]/cancel/route.ts`
  - `app/api/organizacao/reservas/[id]/reschedule/route.ts`
  - `app/api/organizacao/reservas/[id]/no-show/route.ts`
  - `app/api/me/reservas/route.ts`
  - `app/api/me/reservas/[id]/cancel/preview/route.ts`
  - `app/api/me/reservas/[id]/cancel/route.ts`
  - `app/api/me/reservas/[id]/reschedule/route.ts`
  - `app/api/me/reservas/[id]/reschedule/respond/route.ts`
  - `app/api/organizacao/agenda/route.ts`
  - `app/api/public/agenda/route.ts`
  - `app/api/me/agenda/route.ts`
  - `app/api/cron/bookings/cleanup/route.ts`
  - `app/api/cron/reservations/cleanup/route.ts`
  - `lib/cron/jobs.ts`
- Domínio e regras:
  - `domain/bookings/commands.ts`
  - `domain/agenda/conflictEngine.ts`
  - `domain/agenda/conflictResponse.ts`
  - `domain/agendaReadModel/query.ts`
  - `domain/agendaReadModel/consumer.ts`
  - `domain/softBlocks/commands.ts`
  - `domain/publicApi/agenda.ts`
  - `domain/sourceType/index.ts`
  - `lib/reservas/confirmationSnapshot.ts`
  - `lib/reservas/confirmBooking.ts`
  - `lib/reservas/backfillConfirmationSnapshot.ts`
  - `lib/reservas/access.ts`
- Modelo de dados:
  - `prisma/schema.prisma`

## 2) Veredicto executivo (direto)
- Estado de decisão do produto: **parcialmente fechado**.
- Estado da implementação: **amplo, mas com zonas críticas de ambiguidade**.
- O core transacional de reservas está sólido (booking lifecycle, checkout, cancelamento/reagendamento/no-show, snapshot e outbox).
- Existem contradições importantes a fechar para evitar divergência operacional:
  - canonicidade de rotas versus localização real da implementação,
  - conflito de nomenclatura "reservations" (ticket stock) versus "bookings" (serviços),
  - regras de conflito/priority da agenda simplificadas,
  - assimetria entre agenda do utilizador e agenda de reservas de serviços.

## 3) Escopo canónico da ferramenta Reservas

### 3.1 Domínio funcional
- Catálogo de serviços (`Service`) com política (`OrganizationPolicy`), profissionais e recursos.
- Disponibilidade semanal (`WeeklyAvailabilityTemplate`) e exceções (`AvailabilityOverride`).
- Reserva transacional (`Booking`) com estados, pagamento, snapshot de confirmação e auditoria.
- Fluxos avançados:
  - reagendamento por pedido (`BookingChangeRequest`),
  - convites/participantes (`BookingInvite`, `BookingParticipant`),
  - split de pagamento (`BookingSplit`, `BookingSplitParticipant`),
  - cobranças extra (`BookingCharge`),
  - delays operacionais (`ScheduleDelay`).
- Agenda operacional canónica (`AgendaItem`) alimentada por evento/outbox.

### 3.2 Limites explícitos de domínio
- `TicketReservation` (stock de bilhetes de eventos) nao e a mesma entidade que `Booking` (reserva de serviço).
- Estado atual de implementação: `/api/me/agenda` agrega eventos/tickets/inscricoes/jogos/forms e ainda nao inclui explicitamente `Booking` de serviços.
- Contrato aprovado: agenda pessoal deve incluir `Booking` com labels separadas (`RESERVA_SERVICO` e `BILHETE_EVENTO`).

## 4) Matriz de contratos (SSOT x Código)

| Contrato/Decisão | SSOT | Evidência de Código | Estado |
|---|---|---|---|
| D02 Owner de Agenda/Booking em Reservas | Fechado | `docs/ssot_registry_v1.md` + write/read em `Booking`, `AgendaItem` | Em linha |
| D03 "quem marca primeiro ocupa" + sem sobreposição automática | Fechado | `evaluateCandidate` + `AGENDA_CONFLICT` nas rotas de booking/reschedule | Parcial (engine simplificado) |
| D03.02 janela de pedido de mudança da org ate T-4h | Fechado | `app/api/organizacao/reservas/[id]/reschedule/route.ts` (`hoursUntilBooking < 4`) | Em linha |
| D03.02 resposta do user ate 24h ou T-2h | Fechado | `expiresAt = min(now+24h, booking.startsAt-2h)` no mesmo endpoint | Em linha |
| D03.02 cancelamento pela org com refund total | Fechado | `computeCancellationRefundFromSnapshot(... actor: "ORG") -> FULL_REFUND` | Em linha |
| C01 Reservas <-> Padel via agenda | Fechado | Agenda read model + claims/eventlog/outbox | Parcial (detalhes de prioridade/sugestao a fechar) |
| Canonicidade `/api/org/:orgId/*` e hard-cut legado | Fechado | `proxy.ts` retorna `410 LEGACY_ROUTE_REMOVED` para `/api/organizacao/*` | Parcial (implementacao ainda vive no namespace legado e e re-exportada) |

## 5) Regras fechadas encontradas na implementação

### 5.1 Lifecycle da reserva
- Estados ativos: `PENDING_CONFIRMATION`, `PENDING`, `CONFIRMED`.
- Estados terminais: `CANCELLED`, `CANCELLED_BY_CLIENT`, `CANCELLED_BY_ORG`, `COMPLETED`, `NO_SHOW`, `DISPUTED`.
- Pré-reserva pendente com hold:
  - `PENDING_HOLD_MINUTES = 10` em criação org e pública.
- Limite de pendentes em fluxo público:
  - `MAX_PENDING_PER_USER = 3` por user autenticado ou `guestEmail`.

### 5.2 Assignment mode
- `resolveServiceAssignmentMode`:
  - serviço `COURT` pode usar modo da organização (`PROFESSIONAL` ou `RESOURCE`),
  - outros serviços forçam `PROFESSIONAL`.

### 5.3 Disponibilidade e conflito
- Estado atual de implementação: slot grid de 15 min.
- Contrato aprovado: motor canónico em blocos de 5 min; UI pode continuar a projetar em grelha de 15 min por default.
- Disponibilidade calculada com templates + overrides + bloqueios.
- Bloqueios considerados:
  - bookings ativos,
  - class sessions,
  - soft blocks.
- Conflito responde em envelope canónico `AGENDA_CONFLICT`.

### 5.4 Endereço
- Fluxos críticos exigem morada com `AddressSourceProvider.APPLE_MAPS`.
- Se `locationMode = CHOOSE_AT_BOOKING`, endereço e obrigatório na reserva.

### 5.5 Guest booking
- Permitido apenas se policy tiver `guestBookingAllowed`.
- Guest exige nome, email, telemovel e consentimento.
- Consentimentos são ingeridos para CRM.

### 5.6 Checkout/Pagamentos
- Checkout rejeita reservas fora de `PENDING_CONFIRMATION`/`PENDING`.
- Bloqueia checkout com split em aberto (`SPLIT_ACTIVE`).
- Para pagos, gate de readiness (`PAYMENTS_NOT_READY`) valida email oficial/Stripe por tipo de org.
- Suporta checkout free (`finalizeFreeServiceBooking`) quando total e 0.
- Usa idempotency key no fluxo de pagamento.

### 5.7 Snapshot de confirmação
- Versão canónica: `BOOKING_CONFIRMATION_SNAPSHOT_VERSION = 5`.
- `confirmBooking` falha sem snapshot de política/preço (fail-closed).
- Backfill disponível para reservas sem snapshot (`backfillConfirmationSnapshot`).

### 5.8 Cancelamento/Reagendamento/No-show
- Cliente:
  - cancelamento/reagendamento de `CONFIRMED` exige snapshot válido,
  - sem snapshot: `BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED`.
- Organização:
  - pode cancelar `PENDING*` ou `CONFIRMED` antes do início,
  - refund total para cancelamento da organização.
- No-show:
  - só após início da reserva,
  - exige snapshot,
  - refund calculado por política de no-show no snapshot.

### 5.9 Convites, split e charges
- Convites: limite `MAX_INVITES = 20`, dedupe por contacto, token único.
- Split: suporta `FIXED` e `DYNAMIC`; bloqueia reconfiguração quando já há participantes `PAID`.
- Charges: criação/listagem de cobranças extras com token de pagamento.

### 5.10 Delays operacionais
- Delay por escopo (`ORGANIZATION`/`PROFESSIONAL`/`RESOURCE`).
- Limite técnico: `MAX_DELAY_MINUTES = 480`.
- Pode notificar reservas confirmadas em janela configurável.

## 6) Achados críticos (ambiguidade, erro potencial, dupla verdade)

### R1) Colisão semântica "reservations" vs "bookings" (SEV-1)
- Evidência:
  - `app/api/cron/bookings/cleanup/route.ts` trata `Booking` (serviços).
  - `app/api/cron/reservations/cleanup/route.ts` trata `TicketReservation` (eventos).
  - `lib/cron/jobs.ts` expõe ambos como jobs distintos.
- Risco:
  - operação/confusão em incidentes, monitorização e runbooks.
- Decisão a fechar:
  - nomenclatura canónica por domínio e rename técnico (endpoint/key/heartbeat/runbook).

### R2) Hard-cut SSOT vs implementação física no namespace legado (SEV-1)
- Evidência:
  - `proxy.ts` devolve `410 LEGACY_ROUTE_REMOVED` para `/api/organizacao/*`.
  - `app/api/org/[orgId]/*` re-exporta `@/app/api/organizacao/*`.
- Risco:
  - dupla verdade arquitetural; manutenção e onboarding confusos.
- Decisão a fechar:
  - migrar fisicamente handlers para `app/api/org/[orgId]/*` ou formalizar camada adapter com prazo de remoção.

### R3) Conflict engine simplificado ignora prioridade declarada (SEV-1)
- Evidência:
  - `domain/agenda/conflictEngine.ts` define prioridades por tipo,
  - mas na decisão final bloqueia pelo primeiro overlap e devolve `BLOCKED_BY_EQUAL_PRIORITY`.
- Risco:
  - resultado pode contrariar expectativa de prioridade de negócio e gerar recusas indevidas.
- Decisão fechada (4A):
  - regra em camadas: hard constraints primeiro; fora isso `first_confirmed_wins`;
  - empate técnico no mesmo instante/lote resolve por prioridade de tipo;
  - tie-break determinístico por `confirmedAt` e depois `claimId` (fallback `createdAt`);
  - override permanece explícito, auditável e por política.

### R4) Agenda do utilizador mistura "RESERVA" de tickets e omite Booking de serviços (SEV-2)
- Evidência:
  - `app/api/me/agenda/route.ts` consulta `ticketReservation` e marca como `RESERVA`.
  - não consulta `prisma.booking`.
- Risco:
  - semântica confusa para utilizador: "reserva" pode significar bilhete, não serviço.
- Decisão fechada:
  - agenda pessoal é timeline unificada de compromissos (não write-model);
  - inclui `Booking` de serviços;
  - labels canónicas separadas: `RESERVA_SERVICO` e `BILHETE_EVENTO`.

### R5) Janela de reagendamento da org hardcoded vs políticas snapshot (SEV-2)
- Evidência:
  - `app/api/organizacao/reservas/[id]/reschedule/route.ts` usa regra fixa `T-4h`.
  - cliente usa janela derivada de snapshot/policy em rotas `me/reservas`.
- Risco:
  - assimetria de regras e potencial conflito contratual com cliente.
- Decisão a fechar:
  - manter assimetria como regra de negócio explícita ou parametrizar também para organização.

### R6) Fail-closed forte por snapshot em reservas confirmadas (SEV-2)
- Evidência:
  - cancel/preview/reschedule/no-show bloqueiam sem snapshot.
  - backfill existe, mas é operação manual/processual.
- Risco:
  - bloqueio operacional se houver backlog sem snapshot.
- Decisão a fechar:
  - SLO de backfill automático + política de remediação em incidentes.

### R7) Três superfícies públicas de disponibilidade com lógica duplicada (SEV-2)
- Evidência:
  - `slots`, `disponibilidade`, `calendario` repetem blocos extensos de seleção/normalização.
- Risco:
  - deriva funcional silenciosa entre endpoints.
- Decisão a fechar:
  - extrair motor único para leitura de disponibilidade e padronizar contratos de resposta.

### R8) Regra de endereço estritamente Apple Maps (SEV-3)
- Evidência:
  - validação explícita de `AddressSourceProvider.APPLE_MAPS` em fluxos críticos.
- Risco:
  - lock-in de provider e fricção em integrações/futuras migrações.
- Decisão a fechar:
  - manter hard lock ou abrir enum de providers homologados.

### R9) Inconsistência documental local (SEV-3) — RESOLVIDO
- Decisão do owner:
  - a remoção de `docs/discover_web_app_intentional_differences_v1.md` e `docs/organizacoes_ferramentas_*.md` foi intencional.
- Estado:
  - não tratar como pendência ativa desta revisão.

## 7) Contratos e regras que precisam de fecho explícito (owner)

### 7.1 Naming canónico
- `reserva` (serviço) vs `reserva` (ticket stock) precisa de vocabulário oficial único.

### 7.2 Semântica de agenda
- Fechado: agenda operacional e agenda pessoal partilham o mesmo motor canónico, com projeções diferentes por contexto de UI.

### 7.3 Política de conflitos
- Fechado (4A):
  - hard constraints prevalecem sempre;
  - fora hard constraints, `first_confirmed_wins`;
  - empate técnico no mesmo instante/lote usa prioridade de tipo: `HARD_BLOCK` > `MATCH` (`reasonCode=MATCH_SLOT`) > `BOOKING` > `CLASS_SESSION` > `SOFT_BLOCK`;
  - tie-break final auditável: `confirmedAt` -> `claimId` (fallback `createdAt`).

### 7.4 Governança de snapshot
- Definir SLA de criação/backfill e política de fallback permitida (ou proibição total de fallback).

### 7.5 Convergência de disponibilidade pública
- Definir contrato único entre `slots`, `disponibilidade` e `calendario`.

## 8) Questionário mestre de fecho total
- Nota: esta secção é histórico de perguntas da revisão profunda; decisões já aprovadas nesta ronda estão consolidadas nas secções 6, 7 e 11.

### A) Visão de produto e escopo
1. Reservas de serviços e reservas de bilhetes devem continuar como produtos separados no UX, ou queres convergência de linguagem?
2. Queres que o termo "reserva" em produto signifique apenas `Booking` de serviço?
3. A Agenda de utilizador deve incluir obrigatoriamente reservas de serviço (`Booking`)?
4. Queres expor `Booking` no mesmo feed junto com eventos/jogos?
5. Quais entidades entram no "calendário mor" do utilizador: eventos, jogos, bilhetes, reservas de serviço, aulas, torneios?
6. Quais entidades entram no "calendário mor" da organização?
7. Queres diferença de terminologia entre B2C (utilizador) e B2B (organização)?
8. Existe algum subdomínio de Reservas fora deste documento que deva ser incorporado já?

### B) Contratos API e canonicidade
9. Confirmas hard-cut definitivo de `/api/organizacao/*` sem exceções?
10. Queres migração física dos handlers para `app/api/org/[orgId]/*` nesta fase?
11. Aceitas manter re-exports temporários com deadline explícito de remoção?
12. Queres versionamento formal dos contratos de reservas (v1/v2) com changelog?
13. Queres envelope de erro 100% uniforme em todas as rotas de reservas (incluindo públicas)?
14. Devemos padronizar códigos de erro em português ou inglês técnico (não misto)?
15. Queres idempotency key também no `POST /reservar` (não apenas checkout)?
16. Queres publicar tabela oficial de estados/erros por endpoint?

### C) Lifecycle e estados
17. `PENDING_CONFIRMATION` e `PENDING` devem continuar ambos, ou simplificamos para um estado pendente único?
18. Qual é a diferença funcional que queres manter entre esses dois estados?
19. `DISPUTED` em reservas de serviço está fechado como estado operacional real ou reservado?
20. Queres transição automática `CONFIRMED -> COMPLETED` por cron manter como está?
21. Qual janela de grace para auto-complete (atual 2h) queres como regra final?
22. `NO_SHOW` pode ser revertido? Se sim, por quem e até quando?
23. `CANCELLED` genérico deve ser eliminado em favor de `CANCELLED_BY_*`?

### D) Política de conflito/agenda
24. FECHADO: prioridade por tipo em empate técnico usa `HARD_BLOCK > MATCH (reasonCode=MATCH_SLOT) > BOOKING > CLASS_SESSION > SOFT_BLOCK`.
25. FECHADO: tie-break oficial = `confirmedAt` e depois `claimId` (fallback `createdAt`).
26. FECHADO: `evaluateCandidate` deve implementar explicitamente a regra em camadas aprovada.
27. Queres sugestões automáticas de horários alternativos no erro de conflito?
28. Queres override manual com trilho de auditoria também para reservas de serviço (não só padel)?
29. Que perfis podem fazer override: OWNER/CO_OWNER/ADMIN apenas?
30. Override em reserva de utilizador exige sempre pedido/aceitação do cliente?
31. Se cliente não responde, mantemos "recusado por omissão"?
32. Queres compensação automática quando override desloca reserva paga?

### E) Disponibilidade e calendário
33. Queres manter três endpoints públicos (`slots`, `disponibilidade`, `calendario`) ou reduzir para um contrato canónico?
34. Se mantiver os três, quais diferenças de output são obrigatórias para cada um?
35. Janela pública de procura fica 3 meses (atual) ou outro horizonte?
36. Grelha de 15 min é fixa para todos os serviços?
37. Queres permitir grelha por serviço (ex.: 5/10/20 min)?
38. `shouldUseOrgOnly` deve virar regra configurável real ou remover código morto?
39. Em `RESOURCE`, classes (`ClassSession`) devem bloquear sempre ou só quando mapeadas a recurso/court?
40. Queres expor delays operacionais ao cliente em tempo real no calendário?

### F) Serviço, assignment e capacidade
41. Serviços não-COURT devem continuar bloqueados em modo RESOURCE sem exceção?
42. Queres permitir serviços híbridos (profissional + recurso obrigatório simultâneo)?
43. Em modo RESOURCE, seleção automática de recurso deve obedecer a quê: menor capacidade válida, prioridade, preço, fairness?
44. Queres política explícita para overbooking controlado?
45. Queres diferenciar capacidade lógica de reserva e capacidade física de espaço/court?

### G) Políticas e snapshot
46. Snapshot continua obrigatório para qualquer ação em `CONFIRMED`?
47. Queres auto-backfill diário obrigatório (com SLO) para evitar bloqueios?
48. Qual SLO aceitável de reservas confirmadas sem snapshot (0%, <0.1%, outro)?
49. Política de cancelamento/reagendamento deve viver apenas no snapshot após confirmação?
50. Quando policy muda, reservas antigas seguem snapshot histórico (imutável) ou regra nova?
51. Queres bloqueio de confirmação quando policy default está ausente?
52. Queres endpoint interno de auditoria de integridade de snapshot?

### H) Cancelamento/reagendamento/no-show
53. Regra da organização "pode cancelar confirmado até antes do início" mantém-se?
54. Reagendamento pedido pela organização continua com janela fixa T-4h?
55. Queres janela T-4h parametrizável por policy/org?
56. Reagendamento do cliente deve usar janela própria ou mesma janela de cancelamento?
57. Queres permitir reagendamento parcial (troca só profissional/recurso sem mudar hora)?
58. No-show: fee fixo em cents e suficiente, ou queres fee percentual por policy?
59. Em no-show, queres regras diferentes para cliente recorrente/VIP?
60. Qual status final esperado quando no-show é contestado e revertido?

### I) Guest booking e identidade
61. Guest booking fica ativo por defeito apenas em policy explícita (como hoje)?
62. Queres guest sem telefone? (atual exige telefone)
63. Queres guest com OTP antes de checkout?
64. `MAX_PENDING_PER_USER = 3` mantém-se? Qual limite final?
65. Limite também deve aplicar no fluxo de criação interna da organização?
66. Queremos unificar identidade de guest por email+telefone, só email, ou outro?
67. Qual política para merge guest -> conta autenticada após claim/login?

### J) Pagamentos, split e charges
68. Confirmas regra: cancelamento pela org = refund total sempre?
69. Confirmas regra: cancelamento do cliente = retem fees + penalty por policy?
70. Em split, pode haver participantes sem convite (manual) no contrato final?
71. Split aberto deve bloquear qualquer checkout principal (como hoje)?
72. Queres prazo obrigatório (`deadlineAt`) no split com auto-cancel?
73. Charges extra podem ser criadas após conclusão da reserva?
74. Queres catálogo de tipos de charge fechado (EXTRA, no-show extra, material, etc.)?
75. Queres idempotência forte para criação de charge/split/invite?

### K) RBAC e operação
76. STAFF pode continuar sem acesso a scope `ORGANIZATION` em disponibilidade?
77. TRAINER deve poder gerir delays do seu escopo?
78. Quais ações exigem step-up (2FA/reauth) em Reservas?
79. Queres reasonCode obrigatório em cancelamento da org e no-show?
80. Quais ações entram em auditoria obrigatória com payload before/after?

### L) Observabilidade e runbooks
81. Queres separar cron keys e nomenclatura de domínio (`bookings` vs `ticket-reservations`) já no próximo sprint?
82. Quais alertas obrigatórios: snapshot missing, conflito alto, refund failed, cron falhado?
83. Queres dashboard de integridade para Reservas com KPIs canónicos?
84. Quais SLOs finais (checkout success, conflict false-positive, refund latency, no-show resolution)?
85. Queres runbook único de Reservas (incidente + operação diária + reconciliação financeira)?

### M) Migração e hard-cut
86. Queres hard-cut imediato das superfícies ambíguas ou faseamento por ondas?
87. Quais migrações são obrigatórias antes de go-live (rotas, naming, snapshot backlog, cron rename)?
88. Qual janela de freeze para alterações em contratos de Reservas?
89. Quais consumidores externos/mobile precisam de compatibilidade temporária?
90. Qual critério objetivo de "fechado a 100%" para esta ferramenta?

## 9) Critérios de aceite para declarar Reservas "100% fechado"
- Contratos API canónicos publicados e versionados.
- Sem namespace legado ativo para consumo externo (`/api/organizacao/*` removido de vez).
- Sem ambiguidades abertas nos 90 pontos do questionário.
- Engine de conflito alinhado com prioridade oficial aprovada.
- Snapshot policy/pricing sem backlog pendente acima do SLO.
- Runbook + observabilidade + alertas em produção.

## 10) Plano de execução recomendado (após respostas do owner)
- F0: fecho de decisão (questionário + minuta final).
- F1: contratos e nomenclatura (API/cron/erros/estados).
- F2: engine de conflito e convergência de disponibilidade.
- F3: agenda do utilizador + integração de bookings.
- F4: hardening financeiro/snapshot e operação.
- F5: hard-cut final e validação de regressão.

## 11) Decisões tomadas nesta revisão
- Criado este documento como baseline canónica de revisão profunda de Reservas.
- Fechado (owner): política de conflito em camadas (4A), com hard constraints + `first_confirmed_wins` + desempate determinístico.
- Fechado (owner): código de erro canónico de conflito = `AGENDA_CONFLICT`; nomenclatura legado de conflito deve ser removida/higienizada da documentação.
- Fechado (owner): motor canónico em blocos de 5 min, com projeção UI em 15 min por default.
- Fechado (owner): agenda pessoal unificada inclui `Booking`, com labels canónicas separadas (`RESERVA_SERVICO` e `BILHETE_EVENTO`).
- Fechado (owner): modelo de estado documental 10C (dois eixos: decisão e execução).
- Em revisão owner (recomendação): manter apenas `sourceType=MATCH`; `MATCH_SLOT` fica como `reasonCode` (sem criar novo `AgendaSourceType`).
