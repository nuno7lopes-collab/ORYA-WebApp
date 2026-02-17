# Analise: Aulas + Treinadores + Calendario + Reservas

Data: 2026-02-17

## 1) Objetivo desta analise

Mapear o estado atual da ferramenta de clube de padel para:

- Aulas
- Treinadores
- Calendario
- Reservas

e identificar gaps + oportunidades para ter um fluxo unico e consistente.

## 2) Estado atual (resumo)

### 2.1 Treinadores (padel hub)

- UI: `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx`
- API: `app/api/org/[orgId]/trainers/route.ts`
- Perfil de treinador: `app/api/org/[orgId]/trainers/profile/route.ts`
- Modelo: `TrainerProfile` em `prisma/schema.prisma`

Hoje o treinador e uma combinacao de:

- membro STAFF com `rolePack=COACH`
- perfil `trainerProfile` (aprovacao/publicacao)

### 2.2 Aulas

- UI no padel hub (tab lessons): `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx`
- API servicos: `app/api/org/[orgId]/servicos/route.ts`
- Modelo: `Service` em `prisma/schema.prisma`

No padel hub, "Nova aula" cria servico com:

- `kind = GENERAL` (porque API default)
- `categoryTag = "AULAS"`
- `instructorId = null`

### 2.3 Reservas

- Pagina central: `app/org/_internal/core/(dashboard)/reservas/page.tsx`
- Profissionais: `app/api/org/[orgId]/reservas/profissionais/route.ts`
- Disponibilidade por escopo: `app/api/org/[orgId]/reservas/disponibilidade/route.ts`
- Lista/criacao de reservas: `app/api/org/[orgId]/reservas/route.ts`

Reservas usa `ReservationProfessional`, `ReservationResource`, `WeeklyAvailabilityTemplate`, `AvailabilityOverride`.

### 2.4 Calendario

- Calendario org (week/day): `app/org/[orgId]/calendar/_components/*`
- API agenda: `app/api/org/[orgId]/agenda/route.ts`
- Read model: `domain/agendaReadModel/query.ts` + `domain/agendaReadModel/consumer.ts`
- Calendario de torneio padel: `app/api/padel/calendar/route.ts`

## 3) O que ja esta ligado (positivo)

1. O calendario de torneio padel ja protege conflitos com reservas:
   - `app/api/padel/calendar/route.ts` carrega bookings ativos para conflito.

2. Reservas ja bloqueia conflitos com sessoes de aula recorrente (`ClassSession`):
   - `app/api/org/[orgId]/reservas/route.ts`
   - `lib/reservas/confirmBooking.ts`

3. O calendario org ja usa profissionais/recursos/courts de reservas:
   - `app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx`
   - `app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx`

4. Lessons do padel hub ja tem links para bookings/catalogo:
   - `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx`

## 4) Gaps principais (priorizados)

## P0 - Identidade duplicada de treinador

Hoje existem 3 conceitos proximos mas separados:

- `TrainerProfile` (coach aprovado/publicado)
- `ReservationProfessional` (agenda/booking)
- `PadelClubStaff` (staff do clube de padel)

Nao existe sincronizacao canonica entre eles.

Impacto:

- treinador aprovado pode nao existir como profissional de reservas
- tab "Treinadores" e tab "Aulas/Reservas" podem mostrar equipas diferentes

Evidencia:

- `app/api/org/[orgId]/trainers/route.ts`
- `app/api/org/[orgId]/reservas/profissionais/route.ts`
- `app/api/padel/clubs/[id]/staff/route.ts`

## P0 - Aulas criadas no padel hub nao ficam realmente modeladas como "CLASS"

No padel hub, `handleCreateLesson` cria servico via `/servicos` sem `kind=CLASS`.
Fica `GENERAL + categoryTag=AULAS`.

Impacto:

- perde-se o fluxo nativo de series/sessoes (`ClassSeries`, `ClassSession`)
- menor qualidade operacional para aulas recorrentes

Evidencia:

- `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx` (`LESSON_TAG`, `handleCreateLesson`)
- `app/api/org/[orgId]/servicos/route.ts` (`kind: "GENERAL"`)
- `app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx` (features de `service.kind === "CLASS"`)

## P0 - Instrutor publico desconectado do fluxo interno

Pagina publica de treinador lista aulas por `service.instructorId = trainer.userId`.
Mas no fluxo interno atual nao se define `instructorId` ao criar/editar aulas no padel hub.

Impacto:

- treinador publico pode aparecer sem aulas mesmo com aulas no sistema

Evidencia:

- `app/[username]/treinadores/[trainer]/page.tsx` (query por `instructorId`)
- `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx` (criacao sem instrutor)
- `app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx` (payload PATCH sem `instructorId`)

## P1 - Agenda da organizacao ignora CLASS_SESSION no endpoint

O materializador grava `SourceType.CLASS_SESSION`, mas:

- `app/api/org/[orgId]/agenda/route.ts` so inclui BOOKING (+ EVENT/TOURNAMENT)
- `domain/agendaReadModel/query.ts` default tambem nao inclui CLASS_SESSION

Impacto:

- calendario org nao mostra sessoes de aula recorrente como itens de agenda

Evidencia:

- `domain/agendaReadModel/consumer.ts` (materializa class sessions)
- `app/api/org/[orgId]/agenda/route.ts`
- `domain/agendaReadModel/query.ts`

## P1 - Ligacao UX fraca entre "Treinadores" e "Disponibilidade/Reservas"

Existe ligacao de lessons para bookings, mas em treinadores nao ha "ir para agenda do profissional" nem "criar profissional de reservas" no mesmo contexto.

Impacto:

- operacao manual extra
- maior chance de dados incompletos

Evidencia:

- `app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx` (tab trainers)

## P2 - Analitica fragmentada

Padel analytics foca torneios; reservas summary foca bookings gerais.
Nao ha KPI unico de aulas+treinadores (ocupacao por coach, taxa de conversao por aula, no-show por treinador).

Evidencia:

- `app/api/org/[orgId]/padel/analytics/route.ts`
- `app/api/org/[orgId]/reservas/summary/route.ts`

## 5) Oportunidade de arquitetura alvo (simples)

Criar uma "ponte canonica" entre dominos:

- `TrainerProfile.userId` <-> `ReservationProfessional.userId` (1:1 por organizacao)
- Aulas de padel devem ser `Service.kind = CLASS` quando forem recorrentes
- `Service.instructorId` deve ser opcional mas suportado em UI/API

E no calendario:

- Exibir `CLASS_SESSION` no calendario org (com label de aula e profissional/court)

## 6) Plano recomendado (faseado)

### Fase 1 (rapido, 1 sprint)

1. Auto-link treinador->profissional:
   - ao aprovar/publicar treinador, garantir `ReservationProfessional` (upsert por `userId`).
2. Melhorar UX no tab Treinadores:
   - botao "Abrir agenda" (bookings availability filtrado por profissional)
   - botao "Criar em reservas" quando nao existir profissional.
3. Incluir `instructorId` no editar servico (UI/API).

### Fase 2 (qualidade de produto)

1. Criacao de aula no padel hub com escolha de tipo:
   - Aula unica -> `GENERAL`
   - Aula recorrente -> `CLASS`
2. Se `CLASS`, abrir logo setup de `ClassSeries`.
3. Possibilidade de predefinir instrutor e court.

### Fase 3 (calendario unificado)

1. Incluir `SourceType.CLASS_SESSION` em `/api/org/[orgId]/agenda`.
2. Tratar na UI como item de agenda (novo kind ou kind dedicado).
3. Filtros por tipo: Reserva, Aula recorrente, Evento, Torneio.

## 7) Resultado esperado

Com estas ligacoes:

- treinador aprovado passa a ser operavel na agenda sem passos manuais
- aulas deixam de ser "servicos genericos" e passam a ter ciclo completo
- calendario org fica realmente unico para operacao diaria
- menos conflitos e menos incoerencia de dados entre padel e reservas

