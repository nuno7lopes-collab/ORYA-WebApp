# Plano Final — Reservas/Serviços/Experiências (ORYA)

Data: 2026-02-04  
Objetivo: desenhar (e implementar sem refazer) um sistema único e escalável para **reservas/ordens**, cobrindo:

1. Serviços com preço/duração flexíveis (base + add-ons + pacotes).
2. Experiências/Festas (booking + convites + RSVP + opcional split pay).
3. Chat contextual por booking com ações operacionais (aprovação, updates, pagamentos extra).
4. Políticas automáticas de cancelamento/reagendamento e reembolsos (com fees).
5. Atrasos como **estimativa** (nunca muda a hora oficial).

---

## 1) Decisões Fechadas (SSOT Para Este Plano)

1. Modelo mental: tudo é **Booking/Order** (uma “reserva/compra”) com contexto e auditoria.
2. Cancelamento pelo cliente:
   1. Não há “créditos/vouchers”.
   2. Se quiser reagendar, tem de **reagendar no momento** (fluxo de reagendamento; não via cancelamento).
   3. No reembolso, o cliente **nunca recebe as fees**:
      1. fee ORYA (platform fee)
      2. processing fees Stripe (e card surcharge, se existir)
   4. O organizador pode configurar:
      1. permitir/proibir cancelamento
      2. permitir/proibir reagendamento
      3. janela (minutos/horas antes do início)
      4. penalização (%) em cancelamento
3. Cancelamento pela organização:
   1. Reembolso **total** ao cliente (inclui fees).
   2. A organização/plataforma absorve o custo das fees que não sejam devolvidas pelo processador.
4. Atrasos:
   1. A hora oficial do booking **não muda**.
   2. O sistema pode mostrar **hora estimada** (overlay), sempre marcada como “estimativa”.

---

## 2) Estado Atual Da Codebase (Para Aproveitar, Não Reescrever)

Já existe base sólida para reservas:

1. Modelo `Booking` e `OrganizationPolicy` em `prisma/schema.prisma`.
2. Snapshots de confirmação e cálculo de fees: `lib/reservas/confirmationSnapshot.ts`.
3. Checkout já cria `Payment` (SourceType `BOOKING`) e PaymentIntent: `app/api/servicos/[id]/checkout/route.ts`.
4. Fulfillment do booking e Transaction com `stripeFeeCents`: `lib/operations/fulfillServiceBooking.ts`.
5. Cancelamento do cliente: `app/api/me/reservas/[id]/cancel/route.ts`.
6. Cancelamento e reagendamento pela org: `app/api/organizacao/reservas/[id]/cancel/route.ts`, `app/api/organizacao/reservas/[id]/reschedule/route.ts`.

Nota: o plano abaixo é desenhado para encaixar neste “rails” e só estender onde falta.

---

## 3) Domínio (O “Modelo Mental Único”)

### 3.1 Entidades (alto nível)

1. `Service` (já existe): o “item vendável” (serviço/experiência).
2. `Booking` (já existe): a compra/reserva do cliente.
3. `OrganizationPolicy` (já existe): regras de cancel/reagendar + pagamento.
4. Add-ons e pacotes:
   1. `ServiceAddon` (novo)
   2. `ServicePackage` (novo, opcional mas recomendado para festas)
5. Participantes/Convites (para festas e reservas de grupo):
   1. `BookingInvite` (novo)
   2. `BookingParticipant` (novo)
6. Pagamentos:
   1. `Payment` (já existe) como SSOT financeiro do booking
   2. `BookingCharge` (novo) para separar “depósito”, “extra”, “split part”, etc.
7. Chat:
   1. `ChatConversation` (já existe)
   2. Link ao booking (novo) para contexto: `sourceType/sourceId` ou join table
8. Atrasos:
   1. `ScheduleDelay` (novo) para guardar o “delay atual” por profissional/recurso/court/org.

### 3.2 Invariantes (para não refazer depois)

1. Imutabilidade por booking:
   1. preço/duração e seleção de add-ons ficam “snapshotted” no booking
   2. política aplicada fica snapshotted (e versionada)
2. Auditoria:
   1. toda ação (cancel/reagendar/delay/pagamento extra) gera `OrganizationAudit` + EventLog/Outbox quando aplicável
3. Idempotência:
   1. checkout e reembolsos com idempotency keys determinísticas
4. Multi-tenant:
   1. todas queries com `organizationId` coerente

---

## 4) Políticas De Cancelamento/Reagendamento (Automáticas)

### 4.1 Campos necessários (DB)

Adicionar a `OrganizationPolicy` (e incluir no snapshot):

1. `allowCancellation` (boolean)
2. `cancellationWindowMinutes` (já existe)
3. `cancellationPenaltyBps` (int, 0–10000)  
   Regra recomendada: penalização aplica-se ao **baseCents** (serviço) e não ao total com fees.
4. `allowReschedule` (boolean)
5. `rescheduleWindowMinutes` (int)

### 4.2 Cálculo de reembolso (SSOT)

Definir 2 funções, sempre baseadas no snapshot (e usando fees reais quando existirem):

1. Cancelado pelo cliente:
   1. `totalPaidCents` = total que entrou no PaymentIntent (inclui card surcharge, se existir)
   2. `feesNonRefundableCents` = `platformFeeCents` + `stripeFeeCentsActualOrEstimate` + `cardPlatformFeeCents`
   3. `penaltyCents` = round(`baseCents * cancellationPenaltyBps/10000`)
   4. `refundCents` = max(0, `totalPaidCents - feesNonRefundableCents - penaltyCents`)
2. Cancelado pela organização:
   1. `refundCents` = `totalPaidCents` (full refund)

Implementação:

1. Atualizar `computeCancellationRefundFromSnapshot(...)` em `lib/reservas/confirmationSnapshot.ts` para suportar:
   1. refund “CLIENT_CANCEL_KEEP_FEES”
   2. refund “ORG_CANCEL_FULL”
2. Atualizar:
   1. `app/api/me/reservas/[id]/cancel/route.ts`
   2. `app/api/organizacao/reservas/[id]/cancel/route.ts`

### 4.3 Reagendamento (sem “crédito”)

1. Cliente:
   1. `POST /api/me/reservas/[id]/reschedule`
   2. valida ownership + janela `rescheduleWindowMinutes`
   3. valida conflitos/availability (reuso da lógica da org)
   4. mantém o mesmo bookingId e o mesmo pagamento (não cria “voucher”)
2. Organização:
   1. já existe `.../reschedule`
   2. opcional futuro (mais “perfeito”): “proposta de reagendamento” com link de aceitação do cliente.

---

## 5) Serviços Com Add-ons / Pacotes (Duração e Preço Variáveis)

### 5.1 Modelo recomendado

1. Serviço Base (`Service`):
   1. `durationMinutes`, `unitPriceCents` continuam como base
2. Add-ons (`ServiceAddon`):
   1. `deltaMinutes`
   2. `deltaPriceCents`
   3. regras: `maxQty`, `requires`, `incompatibleWith`, `category`, `sortOrder`
3. Pacotes (`ServicePackage`, opcional):
   1. preset de add-ons (e/ou overrides)
   2. ideal para festas (“Pacote Piratas”, “Pacote Premium”)

### 5.2 Booking snapshot de seleção

Guardar no booking (snapshot):

1. `baseCents`, `baseMinutes`
2. lista de add-ons selecionados (ids + qty + deltas)
3. totais resultantes: `effectiveDurationMinutes`, `effectiveBaseCents`

### 5.3 API impact (crítico para não refazer)

Endpoints que precisam aceitar a seleção (para duração/slots certos):

1. `POST /api/servicos/[id]/reservar`  
   incluir `selectedAddons` (e `packageId`, se aplicável)
2. `GET /api/servicos/[id]/slots` e `.../disponibilidade`  
   aceitar `selectedAddons` para calcular conflito e disponibilidade com duração efetiva
3. `POST /api/servicos/[id]/checkout`  
   usar preço efetivo do snapshot, não o `service.unitPriceCents`

### 5.4 UX (cliente)

1. No detalhe do serviço:
   1. bloco “Escolhe a duração” (base + add-ons)
   2. mostra “Tempo total” e “Total”
2. Evitar “género” como modificador; usar “comprimento/complexidade”.

---

## 6) Festas/Experiências (Convites + RSVP + Split Pay)

### 6.0 Decisão estrutural (Booking vs Event)

Existem 2 caminhos viáveis:

1. **Booking-first (recomendado para “modelo mental único”)**  
   Festas são `Booking` + `BookingInvite/BookingParticipant`.  
   Prós: UX e operações unificadas com serviços, menos “produto paralelo”.  
   Contras: duplicas parte do stack de convites/RSVP que já existe em `Event` (tickets/invites).
2. **Event-first (reuso máximo do stack existente)**  
   Festas são `Event` + ticket types + invites; e (opcional) criar um `Booking` “operacional” ligado ao evento para agenda/staff.  
   Prós: RSVP/tickets/convites já maduros; split pay pode encaixar via tickets.  
   Contras: ficas com 2 objetos principais (Event + Booking) e precisas de uma camada de “unificação” na UI.

Recomendação prática: começar Booking-first e apenas “bridgar” para Event se/quando precisares de features de bilhética/check-in/scanners.

### 6.1 MVP “perfeito”

1. Organização cria “Pacotes de Festa” (ServicePackage + templates):
   1. preço base
   2. inclui X participantes
   3. extras como add-ons
2. Cliente reserva data/hora (Booking com partySize e resourceId opcional)
3. Após confirmação:
   1. gera “Convite digital” (página pública por token)
   2. lista de convidados + RSVP

### 6.2 Split pay (modelo desde início)

Mesmo que o UI saia faseado, modelar já:

1. `BookingCharge`:
   1. `kind`: BASE | DEPOSIT | EXTRA | SPLIT_PART
   2. `payerKind`: ORGANIZER | INVITEE
   3. `amountCents`, `status`
2. `BookingInvite` pode ter `chargeId` associado quando o convidado tem de pagar.

### 6.3 Fluxos de pagamento para festas

1. One payer:
   1. organizador paga tudo (simples)
2. Split:
   1. organizador define `pricePerGuestCents` ou “por tipo”
   2. convites carregam link de pagamento individual
   3. booking fica “confirmado operacionalmente” mas com estado de cobrança “parcial”

---

## 7) Chat Por Booking (Com Contexto + Ações)

### 7.1 Link ao booking

Opção recomendada (simples):

1. adicionar em `ChatConversation`:
   1. `sourceType` (enum, usar `SourceType.BOOKING`)
   2. `sourceId` (string; bookingId)
   3. índice `(organizationId, sourceType, sourceId)`

### 7.2 Ações do lado da organização (MVP)

1. “Enviar update” (status)
2. “Pedir aprovação” (sim/não)  
   Ex.: “Aprovado trocar peça +30€?”
3. “Criar pagamento extra”  
   cria `BookingCharge(kind=EXTRA)` + PaymentIntent e envia link no chat

Cada ação gera:

1. mensagem de sistema no chat (metadata)
2. notificação (in-app e email)
3. auditoria + event log

---

## 8) Atrasos (Estimativa, Nunca Hora Oficial)

### 8.1 Modelo

1. `ScheduleDelay`:
   1. `organizationId`
   2. `scopeType`: ORGANIZATION | PROFESSIONAL | RESOURCE | COURT
   3. `scopeId`
   4. `delayMinutes` (valor absoluto atual)
   5. `effectiveAt`, `createdByUserId`, `reason`

### 8.2 API + UI

1. Org dashboard:
   1. “Marcar atraso +15m” por profissional/recurso
   2. opcional: “notificar todos os afetados”
2. Consumidor:
   1. mostra:
      1. Hora oficial (fixa)
      2. Hora estimada (badge “estimativa”, pode mudar)

### 8.3 Notificações

1. Email/push apenas se:
   1. atraso > X minutos
   2. e booking começa em menos de Y horas
2. dedupe por booking + delay revision

---

## 9) Rotas/API (Mapa Final)

### 9.1 Público/Discovery

1. `GET /api/servicos/list` (filtros + ranking)
2. `GET /api/servicos/[id]` (inclui add-ons, pacotes, política resumida)
3. `GET /api/servicos/[id]/slots` (com seleção)

### 9.2 Cliente (Me)

1. `GET /api/me/reservas`
2. `POST /api/me/reservas/[id]/cancel` (novo cálculo refund)
3. `POST /api/me/reservas/[id]/reschedule` (novo)

### 9.3 Organização

1. `GET /api/organizacao/reservas` (inclui estimatedTime)
2. `POST /api/organizacao/reservas/[id]/cancel` (full refund)
3. `POST /api/organizacao/reservas/[id]/reschedule` (já existe)
4. `POST /api/organizacao/agenda/delay` (novo)
5. `CRUD /api/organizacao/servicos/...` (add-ons/pacotes/políticas)

### 9.4 Convites (Festas)

1. `POST /api/organizacao/reservas/[id]/invites`
2. `GET /api/invites/booking/[token]`
3. `POST /api/invites/booking/[token]/rsvp`
4. `POST /api/invites/booking/[token]/checkout` (split pay)

---

## 10) UI/UX (Perfeito e Intuitivo)

### 10.1 Discovery (cliente)

1. Explorar:
   1. tabs: Serviços | Experiências/Festas (ou filtros por “tipo”)
   2. cards com:
      1. preço “a partir de”
      2. duração “desde”
      3. próximos slots
2. Detalhe:
   1. escolha de data/hora primeiro ou add-ons primeiro (A/B), mas sempre com “Resumo” fixo
   2. política visível antes do pagamento (sem surpresas)

### 10.2 Pós-reserva (cliente)

1. Booking detail:
   1. hora oficial + hora estimada (se existir delay)
   2. botões: Reagendar | Cancelar (se permitido)
   3. chat contextual
2. Cancelar:
   1. mostra “Quanto vais receber” (estimativa) e breakdown:
      1. fees não reembolsáveis
      2. penalização
      3. total reembolso

### 10.3 Dashboard (organização)

1. Lista de reservas:
   1. por dia, com colunas: hora oficial, estimada, estado, pagamento, atribuição (profissional/recurso)
2. Detalhe:
   1. timeline auditável
   2. ações rápidas (reschedule/cancel/delay/extra payment)
3. Políticas:
   1. sliders/inputs com preview do texto legal
   2. exemplo automático (“Se cancelares a 12h… recebes X”)

---

## 11) Engenharia (Qualidade, Testes, Observabilidade)

### 11.1 Testes (mínimo para “perfeito”)

1. Unit:
   1. cálculo de refund (cliente vs org; com e sem fees reais)
   2. janela de cancel/reagendar
   3. duração/preço efetivo com add-ons
2. API integration:
   1. `me/reservas/[id]/reschedule` (ownership + janela + conflitos)
   2. cancelamento com refund parcial
3. UI:
   1. snapshot tests do resumo de checkout/política

### 11.2 Observabilidade

1. logs com `correlationId` (já existe `getRequestContext`)
2. audit obrigatório em:
   1. cancel
   2. reschedule
   3. delay
   4. extra payments
3. outbox para sincronizar agenda read model

---

## 12) Perguntas Pendentes (Para Fechar Antes de Implementar)

1. Penalização (%) aplica-se a:
   1. base do serviço
   2. total com fees
2. Reagendamento:
   1. pode alterar add-ons (e pagar diferença) ou fica bloqueado e mantém seleção?
3. Depósitos (`depositRequired`) combinam com cancelamento/reagendamento como?
4. Split pay:
   1. booking confirma quando “min paid” ou só quando “100% paid”?
   2. o organizador pode cobrir o resto a qualquer momento?
5. Convites:
   1. RSVP exige login ou pode ser por link (guest)?
   2. identity match (email/telefone) é obrigatório?
6. Delay:
   1. delay é por profissional/recurso/court ou por organização?
   2. qual o threshold para disparar notificação?
