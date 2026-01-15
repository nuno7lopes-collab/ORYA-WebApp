# ORYA v2 Consumer Plan (PT)

Documento tecnico para alinhar modelo de dados, navegacao e migracao do consumer com a taxonomia
Eventos / Experiencias / Reservas e o objetivo "Descobrir -> Decidir -> Fazer".

## 1) Taxonomia operativa (regra de ouro)

### Eventos
- Definicao: algo com data/hora fixa (momento especifico).
- Regra: se tem uma hora fixa -> Evento.
- CTA: Comprar / Inscrever.
- Backend: startAt/endAt fixos, bilhetica, check-in, cancelamento ligado ao evento.

### Experiencias
- Definicao: atividade com varias sessoes/horarios, recorrente ou one-off.
- Regra: se e uma atividade "para fazer" com varias sessoes -> Experiencia.
- CTA: Ver sessoes / Reservar lugar.
- Backend: entidade principal + sessoes. Cada sessao pode vender por bilhete, reserva ou inscricao.

### Reservas
- Definicao: marcacao de um servico/recurso por slot.
- Regra: se estas a marcar um servico/recurso numa agenda -> Reserva.
- CTA: Marcar / Escolher horario.
- Backend: slot-based, 1:1 ou grupo por slot, politicas de cancelamento por servico.

## 2) Modelo de dados (proposta final)

### 2.1 Novas entidades

#### Experience
- id
- organizationId
- slug
- title
- description
- coverImageUrl
- locationCity / locationLat / locationLng / locationText
- tags (inclui "coisas locais" como tag/colecao)
- status (DRAFT | PUBLISHED | ARCHIVED)
- createdAt / updatedAt

#### ExperienceSession
- id
- experienceId
- startAt / endAt / timezone
- capacity
- priceFrom / currency
- checkoutMode (TICKET | RESERVA | INSCRICAO)
- status (DRAFT | PUBLISHED | CANCELLED | SOLD_OUT)
- ticketEventId? (quando checkoutMode = TICKET)
- serviceId? / availabilityGroupId? (quando checkoutMode = RESERVA)
- formId? (quando checkoutMode = INSCRICAO)

#### DiscoveryTag (ou LocalCollection)
- id
- slug (ex: "coisas-locais", "meetup", "corridas")
- label
- isFeatured

#### ContentTag
- id
- contentType (EVENT | EXPERIENCE)
- contentId
- tagId

### 2.2 Entidades existentes (reutilizacao)

- Event, TicketType, Ticket, Checkin: continuam para Eventos e sessoes ticketed de Experiencias.
- Service, Availability, Booking, BookingPolicyRef: continuam para Reservas e sessoes de Experiencias com checkoutMode=RESERVA.
- OrganizationForm: usado quando checkoutMode=INSCRICAO (inscricoes).
- Organization, OrganizationMember: mantem ownership, permissoes e perfil publico.

### 2.3 Vistas de agregacao (nao-table)

#### DiscoveryItem (view/DTO)
- type: EVENT | EXPERIENCE | RESERVA
- sourceId
- title
- nextTime (startAt ou proxima sessao)
- priceFrom
- distanceKm
- city
- org
- followersCount
- tags

#### PlanItem (view/DTO)
- type: EVENT | EXPERIENCE | RESERVA
- sourceId
- startAt
- title
- status (CONFIRMED | PENDING | CANCELLED)
- inviteStatus?

## 3) Mapa de rotas e fluxos (consumer)

### 3.1 Navegacao (4 areas)
- / (Feed / Descobrir)
- /pesquisa (ou /explorar)
- /planos
- /me (Perfil) + /notificacoes

### 3.2 Feed (Descobrir)
Blocos fixos:
- Hoje perto de ti (Eventos + Experiencias)
- Proximos (ordenado por data)
- Reservas rapidas (3-6 sugestoes relevantes)
- Na tua rede (1 bloco pequeno)

Filtros rapidos:
- Hoje / Esta semana
- Categoria: Eventos | Experiencias | Reservas
- Gratuito
- Distancia
- So com quem segues

### 3.3 Pesquisa (descoberta intencional)
- Pesquisa por: evento/experiencia, organizacao, tipo ("padel", "workshop", "barbearia")
- Sugestoes: trending, perto de mim, esta semana

### 3.4 Planos
- Lista cronologica: bilhetes, reservas, inscricoes, convites pendentes.
- Acoes: cancelar, reagendar, aceitar convite, partilhar.

### 3.5 Paginas de detalhe
Rotas sugeridas:
- /eventos/[slug]
- /experiencias/[slug]
- /experiencias/[slug]/sessoes (opcional)
- /reservas/[slug] (ou /servicos/[id] legado)

Estrutura:
- titulo + local + distancia + rating/credibilidade
- 3 bullets (o que e / inclui / duracao)
- prova social (seguidores/interessados)
- politica de cancelamento (1 linha)
- CTA sticky (Comprar/Reservar/Inscrever)
- extras em accordion (descricao longa, FAQ, regras)

## 4) Plano de migracao (sem quebrar o atual)

### Fase 0: alinhamento e flags
- Definir enums e DTOs (DiscoveryItem, PlanItem).
- Adicionar tags/colecoes (coisas locais) como metadata.
- Criar feature flag para feed unificado.

### Fase 1: Experiencias (MVP)
- Criar tabelas Experience + ExperienceSession.
- Permitir sessoes com checkoutMode=TICKET (mapa para Event).
- Adicionar rotas /experiencias e cards no feed.
- Backfill: criar Experience para cada "evento recorrente" selecionado.

### Fase 2: Experiencias com reservas
- Suportar checkoutMode=RESERVA ligado a Service/Availability.
- Unificar blocos "Reservas rapidas" com sessao de experiencia quando aplicavel.

### Fase 3: Planos unificados
- Construir PlanItem a partir de Ticket + Booking + FormSubmission.
- Ligar convites e notificacoes ao novo agregador.

### Fase 4: limpeza e compatibilidade
- Manter rotas antigas com redirect.
- Rever componentes que assumem apenas Eventos.
- Ajustar search para indexar eventos + experiencias + reservas.

## 5) MVP tecnico (entregavel inicial)
- Feed unificado (Eventos + Experiencias)
- Experiencias com sessoes ticketed
- CTA sticky e pagina de detalhe consistente
- Planos com bilhetes e reservas
- Search basico com filtros por tipo e local
