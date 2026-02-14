# Reservas Master Review e Plano de Fecho (2026-02-14)

## 0) Objetivo deste documento
- Fechar 100% da ferramenta de Reservas: visão de produto, contratos, regras operacionais, estados, permissões e integração com Agenda/Finanças/CRM.
- Consolidar o que já está fechado no SSOT versus o que está implementado no código.
- Expor ambiguidades, contradições e "duplas verdades" com evidência técnica.
- Manter rastreabilidade do questionário histórico e consolidar decisões aprovadas pelo owner.

## 0.1) Regra de autoridade
- O SSOT (`docs/ssot_registry_v1.md`) continua fonte de verdade normativa e deve ser atualizado com as decisões aprovadas neste documento.

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
- Estado de decisão do produto: **fechado para v1 (exceto trilho dedicado de redesign de split)**.
- Estado da implementação: **amplo e pronto para execução por ondas no v1**.
- O core transacional de reservas está sólido (booking lifecycle, checkout, cancelamento/reagendamento/no-show, snapshot e outbox).
- Ambiguidade remanescente principal: apenas o pacote `SPLIT_V2` (redesign dedicado).

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
- Contrato aprovado: timeline pessoal deve incluir `Booking` com labels separadas (`RESERVA_SERVICO` e `BILHETE_EVENTO`).

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
- Decisão fechada:
  - limite canónico passa para `MAX_PENDING_PER_USER = 1` (igual para utilizador autenticado e guest por email).

### 5.2 Assignment mode
- `resolveServiceAssignmentMode`:
  - serviço `COURT` pode usar modo da organização (`PROFESSIONAL` ou `RESOURCE`),
  - outros serviços forçam `PROFESSIONAL`.
- Decisão fechada:
  - modelo canónico passa para três modos explícitos:
    - `PROFESSIONAL_ONLY`,
    - `RESOURCE_ONLY`,
    - `PROFESSIONAL_AND_RESOURCE`.
  - overbooking permanece proibido por default.

### 5.3 Disponibilidade e conflito
- Estado atual de implementação: slot grid de 15 min.
- Contrato aprovado: motor canónico em blocos de 5 min; UI pode continuar a projetar em grelha de 15 min por default.
- Disponibilidade calculada com templates + overrides + bloqueios.
- Bloqueios considerados:
  - bookings ativos,
  - hard blocks.
- Decisão fechada:
  - `ClassSession` fica fora do v1 de Reservas (sem bloqueio operacional nesta fase).
- Soft block fica fora do v1 (sem efeito no write-path de ocupação nesta fase).
- Conflito responde em envelope canónico `AGENDA_CONFLICT`.

### 5.4 Endereço
- Fluxos críticos exigem morada com `AddressSourceProvider.APPLE_MAPS`.
- Se `locationMode = CHOOSE_AT_BOOKING`, endereço e obrigatório na reserva.

### 5.5 Guest booking
- Permitido apenas se policy tiver `guestBookingAllowed`.
- Guest exige nome, email e consentimento.
- Telemovel passa a opcional (metadata de contacto, nao identidade canónica).
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
  - sem fee financeiro por default nesta fase (foco operacional/CRM),
  - reversão permitida por `OWNER/ADMIN` até `T+24h`, sem motivo obrigatório, com trilho de auditoria.

### 5.9 Convites, split e charges
- Convites: limite `MAX_INVITES = 20`, dedupe por contacto, token único.
- Split: suporta `FIXED` e `DYNAMIC`; bloqueia reconfiguração quando já há participantes `PAID`.
- Charges: criação/listagem de cobranças extras com token de pagamento.
- Decisão fechada:
  - charges após conclusão da reserva ficam bloqueadas.

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
- Decisão acordada (2B híbrido):
  - linguagem de produto (UI): "Reserva" pode ser guarda-chuva semântico;
  - domínio técnico: manter entidades separadas (`Booking` para serviço, `TicketReservation` para bilhete/evento);
  - operação/runbook/cron: nomes explícitos por domínio, sem colidir termos técnicos.

### R2) Hard-cut SSOT vs implementação física no namespace legado (SEV-1)
- Evidência:
  - `proxy.ts` devolve `410 LEGACY_ROUTE_REMOVED` para `/api/organizacao/*`.
  - `app/api/org/[orgId]/*` re-exporta `@/app/api/organizacao/*`.
- Risco:
  - dupla verdade arquitetural; manutenção e onboarding confusos.
- Decisão acordada (3A):
  - hard-cut físico total do legado no write-path;
  - handlers devem residir fisicamente no namespace canónico `app/api/org/[orgId]/*`;
  - re-exports de legado não são solução final aceitável.

### R3) Conflict engine simplificado ignora prioridade declarada (SEV-1)
- Evidência:
  - `domain/agenda/conflictEngine.ts` define prioridades por tipo,
  - mas na decisão final bloqueia pelo primeiro overlap e devolve `BLOCKED_BY_EQUAL_PRIORITY`.
- Risco:
  - resultado pode contrariar expectativa de prioridade de negócio e gerar recusas indevidas.
- Decisão acordada (4A):
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
- Decisão acordada:
  - agenda pessoal é timeline unificada de compromissos (não write-model);
  - inclui `Booking` de serviços;
  - labels canónicas separadas: `RESERVA_SERVICO` e `BILHETE_EVENTO`.

### R5) Janela de reagendamento da org hardcoded vs políticas snapshot (SEV-2)
- Evidência:
  - `app/api/organizacao/reservas/[id]/reschedule/route.ts` usa regra fixa `T-4h`.
  - cliente usa janela derivada de snapshot/policy em rotas `me/reservas`.
- Risco:
  - assimetria de regras e potencial conflito contratual com cliente.
- Decisão acordada (4C):
  - default mantém `T-4h`;
  - regra passa a parametrizável por policy versionada da organização, com guardrails canónicos.

### R6) Fail-closed forte por snapshot em reservas confirmadas (SEV-2)
- Evidência:
  - cancel/preview/reschedule/no-show bloqueiam sem snapshot.
  - backfill existe, mas é operação manual/processual.
- Risco:
  - bloqueio operacional se houver backlog sem snapshot.
- Decisão acordada (5C):
  - manter fail-closed sem operação "às cegas";
  - backfill automático obrigatório com SLO;
  - runbook de remediação para casos que não recuperem automaticamente.

### R7) Três superfícies públicas de disponibilidade com lógica duplicada (SEV-2)
- Evidência:
  - `slots`, `disponibilidade`, `calendario` repetem blocos extensos de seleção/normalização.
- Risco:
  - deriva funcional silenciosa entre endpoints.
- Decisão acordada (6A):
  - contrato público canónico único de disponibilidade;
  - eliminar duplicidade funcional entre `slots`/`disponibilidade`/`calendario` durante a migração.

### R8) Regra de endereço estritamente Apple Maps (SEV-3)
- Evidência:
  - validação explícita de `AddressSourceProvider.APPLE_MAPS` em fluxos críticos.
- Risco:
  - lock-in de provider e fricção em integrações/futuras migrações.
- Decisão acordada (7A):
  - provider oficial de geocoding/autocomplete/mapa = `APPLE_MAPS`;
  - `IP geolocation` é apenas sinal auxiliar (país/cidade aproximada, ranking e defaults), nunca fonte de morada exata;
  - não introduzir multi-provider nesta fase;
  - em falha de geocode da Apple, o registo fica `PENDING_GEOCODE` e entra em retry automático; não inventar coordenadas por IP;
  - em conflito entre sinais (`APPLE_MAPS` vs IP), prevalece `APPLE_MAPS`.

### R9) Inconsistência documental local (SEV-3) — RESOLVIDO
- Decisão do owner:
  - a remoção de `docs/discover_web_app_intentional_differences_v1.md` e `docs/organizacoes_ferramentas_*.md` foi intencional.
- Estado:
  - não tratar como pendência ativa desta revisão.

## 7) Contratos e regras consolidados (owner)

### 7.1 Naming canónico
- Acordado (2B híbrido):
  - UI pode usar "Reserva" como macro-categoria;
  - domínio técnico mantém separação obrigatória entre `Booking` (serviço) e `TicketReservation` (bilhete).

### 7.2 Semântica de agenda
- Fechado: agenda operacional e timeline pessoal partilham o mesmo motor canónico, com projeções diferentes por contexto de UI.

### 7.3 Política de conflitos
- Acordado (4A):
  - hard constraints prevalecem sempre;
  - fora hard constraints, `first_confirmed_wins`;
  - empate técnico no mesmo instante/lote usa prioridade de tipo: `HARD_BLOCK` > `MATCH` (`reasonCode=MATCH_SLOT`) > `BOOKING` > `SOFT_BLOCK`;
  - tie-break final auditável: `confirmedAt` -> `claimId` (fallback `createdAt`).

### 7.4 Governança de snapshot
- Acordado (5C):
  - fail-closed obrigatório para ações dependentes de snapshot;
  - backfill automático com SLO e monitorização;
  - remediação manual só por fluxo operacional auditável.

### 7.5 Convergência de disponibilidade pública
- Acordado (6A):
  - contrato público canónico único de disponibilidade;
  - superfícies antigas devem convergir para o contrato único e ser removidas/deprecadas;
  - rotas legadas descontinuadas devolvem `410 LEGACY_ROUTE_REMOVED`.

### 7.6 Política de providers de localização
- Acordado (7A):
  - `APPLE_MAPS` é o único provider oficial para endereço/coords canónicas;
  - IP só pode ser usado como contexto aproximado, nunca como verdade de morada;
  - sem provider manual de localização nesta fase.

### 7.7 Override com impacto em cliente
- Acordado:
  - sem impacto de cliente, override operacional pode ser direto (auditado);
  - com impacto em cliente confirmado, existem duas vias válidas:
    - via 1: pedido de troca (aceitação do cliente);
    - via 2: override com cancelamento e reembolso total imediato.

### 7.8 Capacidade (serviço/recurso/profissional)
- Acordado:
  - modos canónicos: `SINGLE`, `FIXED_N`, `UNBOUNDED`;
  - `UNBOUNDED` só para tipos de recurso autorizados por policy (allow-list), nunca como bypass de recurso físico escasso;
  - UI/UX deve explicar o modo de capacidade no setup e no detalhe do recurso para evitar confusão operacional.

### 7.8.1 Assignment canónico
- Acordado:
  - assignment canónico por serviço usa três modos:
    - `PROFESSIONAL_ONLY`,
    - `RESOURCE_ONLY`,
    - `PROFESSIONAL_AND_RESOURCE`.
  - overbooking é proibido por default (só pode existir no futuro por policy explícita).

### 7.9 Identidade guest e contacto
- Acordado:
  - sem OTP por telemóvel nesta fase;
  - telemóvel opcional em reservas e convites;
  - identidade canónica de guest baseada em email (merge posterior para conta autenticada quando aplicável).
  - merge de histórico guest para conta autenticada é automático por email.

### 7.10 Estados pendentes
- Acordado:
  - para utilizador, existe um único estado visível `PENDING`;
  - internamente mantêm-se subestados técnicos:
    - `HOLD` (ocupação temporária curta, default 10m, para proteção de concorrência);
    - `AWAITING_CONFIRMATION` (confirmação transacional em curso).

### 7.11 Ocupação do calendário
- Acordado:
  - projeção visível de ocupação mostra apenas itens `CONFIRMED`;
  - `HOLD` continua a bloquear concorrência apenas no motor interno (não aparece na ocupação pública).

### 7.12 Auto-complete grace
- Acordado:
  - `autoCompleteGrace` default = `+2h`;
  - configurável por policy no intervalo `[0h, 72h]`.

### 7.13 Grelha temporal (decisão A)
- Acordado:
  - motor canónico opera sempre em blocos de 5 minutos;
  - UI usa grelha compacta com marcas principais de 15/30 minutos;
  - precisão canónica de 5 minutos mantém-se para cálculo de conflito/disponibilidade e casos como durações não redondas (ex.: 55m).

### 7.14 Hard block operacional
- Acordado:
  - hard block é bloqueio temporal real e pode ser aplicado por escopo: `GLOBAL_ORG`, `RESOURCE`, `PROFESSIONAL`;
  - ao criar hard block, novas confirmações ficam bloqueadas imediatamente na janela afetada;
  - se o hard block for removido, a janela volta a aceitar confirmações automaticamente;
  - se houver itens confirmados já existentes na janela, o hard block entra em resolução operacional com pendências até fechar impactos;
  - o hard block só fica concluído quando todas as pendências associadas estiverem resolvidas (troca aceite ou cancelamento+reembolso total);
  - se não houver impacto em cliente, pode fechar por realocação operacional automática (auditada).

### 7.15 Motivo e auditoria de hard block
- Acordado:
  - `reasonCode` é obrigatório no hard block;
  - texto livre é opcional;
  - existe `reasonCode` default genérico e catálogo extensível por organização;
  - toda ação de hard block guarda `createdBy/updatedBy`, timestamps e trilho before/after.

### 7.16 Soft block (v1)
- Acordado:
  - soft block não entra no v1 operacional de reservas/calendário;
  - `SOFT_BLOCK` pode continuar reservado na taxonomia para evolução futura, sem efeito de bloqueio nesta fase.

### 7.17 Limite de pré-reserva pendente
- Acordado:
  - cada utilizador/guest pode ter no máximo 1 pré-reserva ativa de cada vez;
  - comportamento de UX: a pré-reserva ativa deve ficar visível e poder ser cancelada explicitamente.

### 7.18 Seleção automática de recurso
- Acordado:
  - quando o sistema precisa de escolher recurso automaticamente, a ordem é:
    - menor capacidade que ainda serve,
    - menor prioridade,
    - menor `id`.
  - prioridade é campo opcional de configuração operacional (serviço/recurso/profissional), com default neutro;
  - em default (sem configuração), prioridade não altera comportamento.

### 7.19 Política de reagendamento por ator (organização vs cliente)
- Acordado:
  - organização e cliente têm políticas separadas de reagendamento;
  - organização:
    - default operacional mantém `T-4h` antes do início;
    - pode ser parametrizado por policy da organização dentro de guardrails canónicos;
  - cliente:
    - pode estar desligado por policy (`allowCustomerReschedule=false`);
    - quando ligado, usa janela própria por policy (independente da janela da organização);
  - snapshot de policy no `CONFIRMED` continua a ser a referência transacional para decisão;
  - UX não expõe minutos técnicos (ex.: `3240`/`1080`): configuração e UI usam horas/dias/semanas.

### 7.20 Criação de reservas no backoffice (v1)
- Acordado:
  - criação interna/manual de reservas por backoffice é proibida;
  - objetivo canónico: evitar pagamentos fora da aplicação e manter trilho financeiro único;
  - ocupações operacionais offline devem ser representadas por `HARD_BLOCK` (com motivo e auditoria), nunca por reserva manual interna;
  - superfícies de criação interna devem responder `410` após hard-cut;
  - legado e superfícies ambíguas de criação interna devem ser removidos/higienizados no hard-cut.

### 7.21 Superfícies de produto (feed, timeline e terminologia)
- Acordado:
  - `Reserva` em produto = `Booking` de serviço;
  - `Bilhete` = evento;
  - `Inscrição` = torneio;
  - feed público fica focado em eventos e torneios (não inclui reservas de serviço);
  - timeline pessoal inclui reservas, bilhetes e inscrições;
  - timeline pessoal separa itens ativos e histórico.

## 8) Questionário mestre de fecho total
- Nota: esta secção é histórico de perguntas da revisão profunda; decisões aprovadas nesta ronda estão consolidadas nas secções 6, 7 e 11.
- Itens sem decisão explícita nesta secção são backlog exploratório e não bloqueiam o pacote de decisões já acordado.

### A) Visão de produto e escopo
1. DECIDIDO: UX separa claramente `Reserva` (serviço) de `Bilhete` (evento) e `Inscrição` (torneio).
2. DECIDIDO: em produto, `Reserva` significa `Booking` de serviço.
3. DECIDIDO: timeline pessoal inclui reservas de serviço (`Booking`).
4. DECIDIDO: feed não inclui reservas de serviço; fica em eventos e torneios.
5. DECIDIDO: timeline pessoal inclui reservas, bilhetes e inscrições (ativos + histórico).
6. DECIDIDO: calendário da organização mantém foco operacional de ocupação (recurso/profissional), não feed social.
7. DECIDIDO: terminologia de produto mantém `Reserva`/`Bilhete`/`Inscrição`; domínio técnico interno permanece em inglês.
8. DECIDIDO: todos os subdomínios de Reservas desta fase ficam fechados neste documento; não abrir novos subdomínios antes do pacote dedicado `SPLIT_V2`.

### B) Contratos API e canonicidade
9. DECIDIDO: hard-cut definitivo de `/api/organizacao/*` sem exceções.
10. DECIDIDO: migração física dos handlers para `app/api/org/[orgId]/*`.
11. DECIDIDO: re-exports só temporários com deadline explícito de remoção.
12. DECIDIDO: versionamento formal dos contratos de reservas (`v1`/`v2`) com changelog.
13. DECIDIDO: envelope de erro uniforme em todas as rotas de reservas (incluindo públicas).
14. DECIDIDO: códigos internos em inglês técnico; UX/UI sempre em português.
15. DECIDIDO: idempotency key também no `POST /reservar` (não apenas checkout).
16. DECIDIDO: publicar tabela oficial de estados/erros por endpoint.

### C) Lifecycle e estados
17. DECIDIDO: UI usa estado único `PENDING`; backend mantém subestados técnicos (`HOLD` e `AWAITING_CONFIRMATION`).
18. DECIDIDO: `HOLD` protege concorrência por janela curta (10m) e `AWAITING_CONFIRMATION` cobre confirmação transacional.
19. DECIDIDO: `DISPUTED` fica reservado para casos financeiros/reconciliação (não estado operacional do dia a dia).
20. DECIDIDO: manter transição automática `CONFIRMED -> COMPLETED` por cron (com `autoCompleteGrace` por policy).
21. DECIDIDO: `autoCompleteGrace` default `+2h`, configurável por policy entre `0h` e `72h`.
22. DECIDIDO: `NO_SHOW` pode ser revertido por `OWNER/ADMIN` até `T+24h` (auditável).
23. DECIDIDO: manter `CANCELLED_BY_*` como canónico operacional; UI mostra apenas "Cancelado".

### D) Política de conflito/agenda
24. DECIDIDO: prioridade por tipo em empate técnico usa `HARD_BLOCK > MATCH (reasonCode=MATCH_SLOT) > BOOKING > SOFT_BLOCK` (com `SOFT_BLOCK` fora do v1 operacional).
25. DECIDIDO: tie-break oficial = `confirmedAt` e depois `claimId` (fallback `createdAt`).
26. DECIDIDO: `evaluateCandidate` deve implementar explicitamente a regra em camadas aprovada.
27. DECIDIDO: hard block bloqueia novas confirmações imediatamente; remoção do hard block reabre a janela automaticamente.
28. DECIDIDO: override manual com trilho de auditoria também para reservas de serviço.
29. DECIDIDO: perfis default de override = `OWNER`, `CO_OWNER`, `ADMIN` (com possibilidade de abrir `STAFF` por policy explícita).
30. DECIDIDO: override com impacto em reserva de utilizador não exige sempre aceitação; pode ser pedido+aceitação ou cancelamento+reembolso total imediato.
31. DECIDIDO: sem resposta do cliente = recusado por omissão.
32. DECIDIDO: em override com impacto financeiro, fluxo de compensação/reembolso deve ser automático e integrado.

### E) Disponibilidade e calendário
33. DECIDIDO: convergir para um endpoint público canónico de disponibilidade; endpoints legados devolvem `410`.
34. DECIDIDO: não manter três contratos públicos; manter apenas o endpoint canónico.
35. DECIDIDO: janela pública de procura mantém "mês atual + 3 meses" por default.
36. DECIDIDO: grelha de visualização não é fixa estrita de 15m; UI é compacta com marcas principais 15/30m.
37. DECIDIDO: motor mantém granularidade canónica de 5m para todos os serviços (sem múltiplas granularidades por serviço nesta fase).
38. DECIDIDO: remover `shouldUseOrgOnly` como código morto legado.
39. DECIDIDO: `ClassSession` fica fora do v1 de Reservas e não bloqueia ocupação neste contrato.
40. DECIDIDO: delays operacionais não são expostos ao cliente no calendário de Reservas (ficam no contexto operacional/live quando aplicável).

### F) Serviço, assignment e capacidade
41. DECIDIDO: serviços não-COURT deixam de ficar bloqueados por regra fixa; passam a obedecer ao assignment configurado.
42. DECIDIDO: permitir modo híbrido (`PROFESSIONAL_AND_RESOURCE`).
43. DECIDIDO: seleção automática de recurso = menor capacidade válida, depois menor prioridade, depois menor `id`.
44. DECIDIDO: overbooking proibido por default nesta fase.
45. DECIDIDO: evitar fusão automática de capacidades; quando serviço usa profissional+recurso, a oferta é configurada explicitamente (como serviço próprio) e o booking valida disponibilidade de ambos, sem "junção implícita" de regras.

### G) Políticas e snapshot
46. DECIDIDO: snapshot obrigatório para qualquer ação em `CONFIRMED`.
47. DECIDIDO: auto-backfill diário obrigatório com SLO operacional.
48. DECIDIDO: SLO alvo de reservas confirmadas sem snapshot = `<0.1%`.
49. DECIDIDO: política de cancelamento/reagendamento vive no snapshot após confirmação.
50. DECIDIDO: mudanças de policy não alteram reservas já confirmadas (snapshot histórico imutável).
51. DECIDIDO: ausência de policy default bloqueia confirmação (fail-closed).
52. DECIDIDO: manter endpoint interno de auditoria de integridade de snapshot.

### H) Cancelamento/reagendamento/no-show
53. DECIDIDO: organização pode cancelar reserva confirmada até antes do início (com auditoria e política aplicável).
54. DECIDIDO: reagendamento pedido pela organização mantém default `T-4h`.
55. DECIDIDO: janela de reagendamento da organização é parametrizável por policy (com guardrails canónicos).
56. DECIDIDO: reagendamento do cliente usa janela própria por policy (separada da organização).
57. DECIDIDO: reagendamento parcial (troca só profissional/recurso) fica como operação interna auditável da organização, não como self-service do cliente.
58. DECIDIDO: no-show sem fee financeiro por default nesta fase (foco operacional/CRM).
59. DECIDIDO: mesma regra de no-show para todos os clientes (sem diferenciação VIP/recorrente).
60. DECIDIDO: no-show é marcação analítica/CRM; reversão remove a marca de no-show sem criar lógica operacional extra no lifecycle de produto.

### I) Guest booking e identidade
61. DECIDIDO: guest booking fica ativo apenas em policy explícita.
62. DECIDIDO: telefone de guest é opcional (não obrigatório).
63. DECIDIDO: sem OTP por telemóvel nesta fase.
64. DECIDIDO: `MAX_PENDING_PER_USER = 1` para utilizador autenticado e guest por email.
65. DECIDIDO: criação interna da organização (backoffice booking) não entra no contrato v1; limite aplica apenas a fluxos canónicos de reserva do utilizador/guest.
66. DECIDIDO: identidade canónica de guest por email; telefone fica apenas como contacto opcional.
67. DECIDIDO: merge guest -> conta autenticada é automático por email.

### J) Pagamentos, split e charges
68. DECIDIDO: cancelamento pela organização em reserva confirmada implica refund total.
69. DECIDIDO: cancelamento do cliente segue retenção de fees/penalty conforme policy aplicável.
70. MOVIDO PARA `SPLIT_V2`: definição final de participantes manuais vs convite formal será fechada no redesign de split.
71. DECIDIDO: split aberto bloqueia checkout principal da reserva.
72. MOVIDO PARA `SPLIT_V2`: obrigatoriedade de `deadlineAt` e auto-cancel no split será fechada no redesign de split.
73. DECIDIDO: charges extra não podem ser criadas após conclusão da reserva.
74. MOVIDO PARA `SPLIT_V2`: catálogo final de charge types relacionado a split/convites será fechado no redesign de split.
75. MOVIDO PARA `SPLIT_V2`: idempotência forte de split/invite/charge será redesenhada e fechada em pacote único.

### K) RBAC e operação
76. DECIDIDO: STAFF mantém sem acesso a scope `ORGANIZATION` em disponibilidade (v1).
77. DECIDIDO: Reservas não usa delays operacionais nesta fase; exceção apenas para cascata de torneios no módulo de Padel.
78. DECIDIDO: step-up só para ações críticas (`refund` manual, override com impacto financeiro, alteração de policy crítica e mudança de ownership/credenciais financeiras).
79. DECIDIDO: `reasonCode` não é obrigatório para reversão de no-show; mantém-se opcional para no-show e recomendável em cancelamento da org.
80. DECIDIDO: auditoria obrigatória (before/after) para override, cancelamento org, reagendamento org, no-show/reversão, hard block, alterações de policy e configurações financeiras.

### L) Observabilidade e runbooks
81. DECIDIDO: separar cron keys/nomenclatura por domínio (`bookings` vs `ticket-reservations`) no próximo sprint.
82. DECIDIDO: em fase de desenvolvimento, manter observabilidade mínima essencial sem alertas de email ativos.
83. DECIDIDO: dashboard de integridade completo é obrigatório nesta fase.
84. DECIDIDO: SLOs canónicos iniciais = checkout success >=99%, conflict false-positive <=0.5%, refund latency <=24h, no-show resolution <=24h.
85. DECIDIDO: runbook único de Reservas é obrigatório (incidente + operação diária + reconciliação).

### M) Migração e hard-cut
86. DECIDIDO: execução por ondas com hard-cut final obrigatório (sem convivência legacy no estado final).
87. DECIDIDO: migrações obrigatórias pré-go-live = rotas canónicas, naming de cron/domínio, backlog de snapshot dentro de SLO, limpeza de código morto e remoção de superfícies legacy.
88. REMOVIDO_DO_V1: regras de freeze/go-live não entram nesta fase atual de desenvolvimento.
89. DECIDIDO: sem compatibilidade temporária para consumidores externos fora da superfície canónica v1.
90. DECIDIDO: "100% fechado" nesta fase = todas as decisões fora `SPLIT_V2` marcadas como decididas + critérios de aceite da secção 9 cumpridos + zero ambiguidades abertas fora de split.

## 9) Critérios de aceite para declarar Reservas "100% fechado"
- Contratos API canónicos publicados e versionados.
- Sem namespace legado ativo para consumo externo (`/api/organizacao/*` removido de vez).
- Sem ambiguidades abertas no pacote de decisões priorizado e aprovado pelo owner (exceto trilho explícito `SPLIT_V2` enquanto estiver em redesign separado).
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
- Acordado com owner: política de conflito em camadas (4A), com hard constraints + `first_confirmed_wins` + desempate determinístico.
- Acordado com owner: código de erro canónico de conflito = `AGENDA_CONFLICT`; nomenclatura legado de conflito deve ser removida/higienizada da documentação.
- Acordado com owner: motor canónico em blocos de 5 min, com projeção UI em 15 min por default.
- Acordado com owner: timeline pessoal unificada inclui `Booking`, com labels canónicas separadas (`RESERVA_SERVICO` e `BILHETE_EVENTO`).
- Acordado com owner: taxonomia de agenda mantém `sourceType=MATCH`; `MATCH_SLOT` é `reasonCode` e não `AgendaSourceType`.
- Acordado com owner: hard-cut físico do legado de rotas/handlers canónicos.
- Acordado com owner: janela de reagendamento da organização = default `T-4h` com parametrização por policy e guardrails canónicos.
- Acordado com owner: fail-closed com backfill automático (SLO) e runbook de remediação.
- Acordado com owner: disponibilidade pública converge para contrato canónico único.
- Acordado com owner: localização canónica usa `APPLE_MAPS` (IP apenas auxiliar), sem provider manual nesta fase.
- Acordado com owner: no-show é marcado após início e pode ser revertido até `T+24h` por `OWNER/ADMIN`, sem motivo obrigatório (com auditoria).
- Acordado com owner: em impacto de cliente, override pode seguir pedido de troca **ou** cancelamento com reembolso total imediato.
- Acordado com owner: capacidade canónica por modo (`SINGLE`, `FIXED_N`, `UNBOUNDED`) com allow-list por policy para uso de `UNBOUNDED`.
- Acordado com owner: hold padrão fixo de 10m.
- Acordado com owner: estado visível único `PENDING` na UI, com subestados técnicos internos (`HOLD` e `AWAITING_CONFIRMATION`).
- Acordado com owner: ocupação visível do calendário inclui apenas itens `CONFIRMED`; `HOLD` fica interno ao motor para controlo de concorrência.
- Acordado com owner: `autoCompleteGrace` default `+2h`, configurável por policy no intervalo `0h..72h`.
- Acordado com owner: guest sem OTP por telemóvel e com telefone opcional.
- Acordado com owner: timeline pessoal (não agenda de escrita) é a superfície de compromisso do utilizador.
- Acordado com owner: conflict engine deve ser implementado conforme regra canónica antes do rollout funcional do motor.
- Acordado com owner: grelha temporal segue decisão A (motor 5m + UI compacta com marcas principais 15/30m).
- Acordado com owner: hard block por escopo (`GLOBAL_ORG`/`RESOURCE`/`PROFESSIONAL`) bloqueia novas confirmações de imediato e só fecha após resolver pendências de impacto.
- Acordado com owner: `reasonCode` obrigatório em hard block, texto opcional, com catálogo por organização e fallback genérico.
- Acordado com owner: `SOFT_BLOCK` fica fora do v1 operacional (reservado para evolução futura).
- Acordado com owner: limite de pré-reserva pendente por identidade (`user`/`guestEmail`) passa para 1.
- Acordado com owner: assignment canónico por serviço adota `PROFESSIONAL_ONLY`, `RESOURCE_ONLY`, `PROFESSIONAL_AND_RESOURCE`.
- Acordado com owner: seleção automática de recurso segue ordem determinística (capacidade válida -> prioridade -> id).
- Acordado com owner: prioridade é opcional por configuração operacional (serviço/recurso/profissional), com default neutro.
- Acordado com owner: overbooking proibido por default nesta fase.
- Acordado com owner: no-show sem fee financeiro por default (foco operacional/CRM), mantendo reversão `T+24h`.
- Acordado com owner: merge guest->conta autenticada é automático por email.
- Acordado com owner: charges extra ficam bloqueadas após conclusão da reserva.
- Acordado com owner: contratos API de reservas fecham com envelope de erro uniforme, idempotency key no `POST /reservar` e tabela oficial de estados/erros por endpoint.
- Acordado com owner: em desenvolvimento, observabilidade fica no mínimo essencial sem alertas de email ativos.
- Acordado com owner: política de reagendamento é separada por ator (organização e cliente), com snapshot em `CONFIRMED` e UX em horas/dias/semanas (sem minutos técnicos).
- Acordado com owner: reservas via backoffice ficam removidas do contrato; ocupação offline é tratada por `HARD_BLOCK` auditável.
- Acordado com owner: superfícies de produto fecham em `Reserva=Booking serviço`, `Bilhete=Evento` e `Inscrição=Torneio`, com feed em eventos/torneios e timeline pessoal (ativos+histórico) para reservas/bilhetes/inscrições.
- Acordado com owner: canonicidade de API fecha em hard-cut de `/api/organizacao/*`, migração física para `app/api/org/[orgId]/*`, re-exports só temporários com deadline e contratos versionados.
- Acordado com owner: linguagem canónica de erro mantém códigos técnicos em inglês e UX/UI em português.
- Acordado com owner: `DISPUTED` fica reservado para contexto financeiro/reconciliação e `CANCELLED_BY_*` é o canónico operacional (UI mostra "Cancelado").
- Acordado com owner: `ClassSession` sai do v1 de Reservas e deixa de bloquear ocupação no motor desta ferramenta.
- Acordado com owner: no-show segue regra única para todos os clientes; semântica de produto fica como marca analítica/CRM com reversão da marca.
- Acordado com owner: RBAC operacional mantém STAFF sem scope `ORGANIZATION`; step-up permanece apenas para ações críticas; Reservas não usa delays nesta fase (exceto cascata de torneios no módulo Padel).
- Acordado com owner: auditoria before/after obrigatória para ações críticas operacionais e financeiras.
- Acordado com owner: cron naming por domínio, runbook único obrigatório, SLOs iniciais canónicos (`checkout`, `conflict`, `refund`, `no-show`) e dashboard de integridade completo.
- Acordado com owner: migração/cutover executa por ondas com hard-cut final e sem compatibilidade legacy fora da superfície canónica.
- Acordado com owner: pendências de split são retiradas do fecho v1 e passam para trilho dedicado `SPLIT_V2`.
