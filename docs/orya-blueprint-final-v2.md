ORYA — Blueprint Final (Mercado + Ferramentas + Fronteiras + Execução) v1.4

Fonte única (Source of Truth) para o plano do dashboard (Organização) e da plataforma ORYA (Utilizador + Social + Organizações).
Qualquer documento “AS-IS”, notas soltas ou referências de mercado não substitui este blueprint.
Este blueprint está escrito para ser executável “à risca”: define owners, contratos, políticas, UX mínima e decisões tecnológicas.

⸻

0) Objetivo e visão

Objetivo: transformar a ORYA num ecossistema integrado (utilizador + organizações) ao nível das melhores plataformas globais de eventos, reservas e gestão de clubes — com módulos verticais (Padel, Eventos) a consumir serviços horizontais (Reservas, Finanças, CRM, Equipa/RBAC, Check-in, Promoções, Loja, Formulários, Perfil público, Definições, Chat interno).

Visão prática (fontes únicas):
	•	Uma agenda (Reservas)
	•	Um perfil de utilizador + grafo social (Social)
	•	Um perfil público de organização (Organization)
	•	Pagamentos e fees centralizados (Finanças)
	•	RBAC centralizado (Equipa)
	•	Orquestração por eventos internos (EventBus + EventLog + Audit)

⸻

1) Princípios (TO-BE)
	•	Simplicidade e automação: defaults fortes; menos passos; menos fricção.
	•	Operacional e robusto: tempo real onde importa; fallback operacional; auditoria.
	•	Experiência premium: UI consistente, previsível, acessível, rápida.
	•	Integração sem monólito: fronteiras claras; integração via contratos; sem duplicar lógica.
	•	Determinismo financeiro: ledger único e reconciliável; idempotência obrigatória.
	•	RGPD by design: minimização de PII em logs; consentimentos; retenção.

⸻

2) Modelo de plataforma (User + Social + Organizações)

2.1 Utilizador (app)

O utilizador é “rede social + discovery + compra + histórico”:
	•	Descobrir e pesquisar Eventos / Torneios / Reservas (superfícies separadas).
	•	Páginas: /app/rede, /app/explorar, /app/agora, /app/descobrir (não há feed único).
	•	Notificações do utilizador (outbox + preferências).
	•	Perfil do utilizador:
	•	público/privado (apenas 2 níveis)
	•	próximos eventos, eventos passados
	•	Padel: jogos/resultados, estatísticas (vitórias/%, lado, preferências), conquistas
	•	interesses
	•	histórico financeiro (movimentos/faturas conforme aplicável)

2.2 Social (seguidores)
	•	Existe followers + follow requests.
	•	Não há “amigos” mutual como conceito base.
	•	Organizações têm seguidores mas não seguem ninguém.
	•	Regra: follow request acontece apenas quando o perfil é privado.

2.3 Organizações
	•	Uma Organization é uma entidade pública com branding e montra (serviços, eventos, torneios, loja, etc.).
	•	Organizações são compostas por utilizadores:
	•	um user pode ser membro de várias organizações com roles diferentes por organização.
	•	existem OrganizationMember e OrganizationMemberInvite.
	•	Multi-instância:
	•	Padel suporta múltiplos clubes/locais por organização (ex.: PadelClub, PadelClubCourt).
	•	Reservas suporta recursos (ReservationResource) e profissionais.

⸻

3) Arquitectura de ferramentas (horizontais vs verticais)

3.1 Ferramentas horizontais (Core)
	•	Reservas — agenda engine, bookings, disponibilidade, recursos, profissionais, políticas, no-show.
	•	Check-in — scanner QR, listas, logs, presença/no-show, antifraude (fase 2).
	•	Finanças — checkout unificado, ledger, fees ORYA, refunds/chargebacks, invoices, payouts.
	•	Equipa (RBAC) — membros, convites, roles, scopes, auditoria.
	•	Notificações — outbox, preferências, templates, delivery logs.
	•	CRM — customer profiles, consentimentos, timeline, segmentos, (fase 2: automações/campanhas).
	•	Formulários — campos extra/waivers por contexto; exports.
	•	Promoções — códigos, regras, bundles, limites/anti-abuso, tracking.
	•	Loja — catálogo, stock, POS/checkout via Finanças, relatórios.
	•	Chat interno — canais por contexto, alertas do sistema, pesquisa e mentions.
	•	Perfil público — páginas públicas agregadas (org/jogador), seguidores, stats e share.
	•	Pesquisa & Discovery — indexação unificada por tipo (eventos/torneios/reservas) + filtros.
	•	Definições — branding, políticas, templates, integrações, RGPD.

3.2 Ferramentas verticais (Domínio)
	•	Eventos — criação, tickets/lotes, sessões, páginas públicas base (SEO), exports.
	•	Padel — Clube — hub operacional do clube (KPIs, atalhos, metadados Padel).
	•	Padel — Torneios — competição (formatos, inscrições, matches, bracket, standings), live ops e widgets.

⸻

4) Decisions Locked v1.4 (não avançar sem isto)

D1) Evento base obrigatório para torneios

Todo torneio de Padel tem eventId obrigatório.
	•	Eventos: tickets, SEO, página pública base, sessões, “camada de evento”.
	•	Padel Torneios: competição, matches, bracket/standings, live ops.

D2) Owners (fontes de verdade) — semântica blindada
	•	Ticketing / Sessions / Página pública base / Entitlements de acesso: Eventos
	•	Competição / Registos / Brackets / Matches / Resultados: Padel Torneios
	•	Agenda / Disponibilidade / Booking / No-show / MatchSlots: Reservas
	•	Pagamentos / Fees / Ledger / Refund / Payout / Invoice: Finanças
	•	Check-in / Presence logs / Scanner: Check-in
	•	Customer + Consent + Timeline: CRM
	•	Roles + Scopes + Auditoria RBAC: Equipa

Regra: nenhum domínio duplica estado de outro owner. Integração só via contratos.

D3) Agenda Engine e prioridade de conflitos

Prioridade MVP: HardBlock > MatchSlot > Booking > SoftBlock
Qualquer override exige permissão + auditoria.

D3.1 MatchSlot é sempre hard-block funcional
MatchSlot nunca pode ser “soft” nem interpretável; é bloqueio real no calendário.

D4) Stripe Connect + Fees ORYA (decisão única)
	•	Connect obrigatório já (v1.x): cada Organization tem stripeAccountId.
	•	Finanças é o único gateway: nenhum módulo cria intents/sessions diretamente no Stripe.
	•	ORYA cobra fee e é configurável no painel Admin (admin.orya.pt / admin.localhost:3000).

D4.1 Política de Fee (Admin)
	•	Configuração por organização (default) + overrides por tipo de origem:
	•	defaultFee (percentual ou fixa)
	•	overridesBySourceType (ex.: tickets vs bookings vs inscrições)
	•	limites (min/max) opcionais
	•	O cálculo do fee é determinístico e escrito no ledger.

D5) RBAC mínimo viável + Role Packs

Introduzir já:
	•	CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE
Com mapa fixo para roles/scopes existentes (ver Secção 11).

D6) Notificações como serviço (com logs e opt-in)

Templates, consentimento RGPD, logs de delivery, outbox e preferências.

D7) sourceType canónico (Finanças/ledger/check-in)

Todos os checkouts e entitlements usam sourceType canónico e unificado (ver Secção 7).

D8) Política de entrada (ticket obrigatório) é parte do evento

Definir requiresTicketForEntry (ver Secção 8) para eliminar ambiguidade no check-in.

⸻

5) Mapa de Domínio (owners + integrações)

Regra: módulos verticais consomem horizontais via contratos.

Entidades core (owner):
	•	Reservas: CalendarResource, ReservationResource, ReservationProfessional, Booking, Availability, CalendarBlock/Override, Service
	•	Eventos: Event (e sessões quando aplicável), TicketType, TicketOrder
	•	Padel Torneios: Tournament, PadelRegistration, Match, Bracket/Standings, MatchState
	•	Finanças: Payment, LedgerEntry, Refund, Invoice, Payout
	•	Check-in: Entitlement, EntitlementQrToken, EntitlementCheckin (fonte actual)
	•	CRM: CustomerProfile, Consent, TimelineEvent, Segments
	•	Equipa: OrganizationMember, OrganizationMemberPermission, OrganizationAuditLog
	•	Infra transversal: EventLog (bus log), IdempotencyKey (padrão; tabela opcional)

⸻

6) Contratos de Integração v1.4 (mínimos obrigatórios)

C1) Reservas ↔ Padel (agenda e slots)

Padel cria slots/bloqueios via contrato; Reservas responde com conflitos/sugestões.

Representação canónica de MatchSlot
	•	MatchSlot é um CalendarBlock/Override em Reservas:
	•	kind=BLOCK, reason=MATCH_SLOT, resourceId=courtId, start/end
	•	Padel nunca escreve no calendário diretamente.

C2) Finanças ↔ Todos (checkout/refunds) — gateway único

Todos criam checkout via Finanças; estado “pago/refund/chargeback/payout” vem sempre de Finanças.

Obrigatório no contrato:
	•	organizationId
	•	sourceType (canónico)
	•	sourceId
	•	amount, currency
	•	customerId (ou userId mapeado para CRM)
	•	idempotencyKey

C3) Check-in ↔ Eventos/Reservas/Padel — via Entitlement unificado

Check-in valida QR e resolve a origem:
	•	ticket (Eventos) ou
	•	booking (Reservas) ou
	•	inscrição Padel (Padel Torneios)

E grava:
	•	EntitlementCheckin + EventLog(checkin.*) + presença/no-show conforme política.

C4) CRM ↔ Todos (timeline)

CRM recebe eventos a partir do EventLog (não ponto-a-ponto), para timeline/segmentação.

C5) Notificações ↔ Todos

Triggers por eventos do sistema + templates + opt-in + logs.

C6) Inscrições Padel vs Bilhetes (coexistência simples e eficaz)

Source of truth:
	•	Inscrição Padel = entidade competitiva (dupla/categoria) owned by Padel
	•	Bilhete = entidade de acesso/presença owned by Eventos
	•	Pagamentos sempre via Finanças (checkout e ledger únicos)

Regras:
	1.	Padel nunca cria bilhetes; Eventos nunca cria inscrições.
	2.	Toda inscrição Padel referencia eventId (D1).
	3.	Estado “pago” vem sempre de Finanças.
	4.	Check-in aceita ticket/booking/inscrição conforme política do evento (D8).

⸻

7) Entitlements e sourceType (canónico e unificado)

7.1 Entitlement unificado (um modelo, múltiplas origens)

Reusar/estender o modelo Entitlement existente para cobrir:
	•	Ticket (Eventos)
	•	Booking (Reservas)
	•	Padel registration (Padel)
	•	Loja (opcional/fase 2 para pickup/fulfillment)

Campos obrigatórios:
	•	Entitlement.sourceType
	•	Entitlement.sourceId
	•	Entitlement.holderUserId (ou customerId se necessário)
	•	Entitlement.status (VALID/USED/REVOKED/EXPIRED)
	•	QR token via EntitlementQrToken (token seguro)

Nota: organizationId pode ser derivado do sourceId (eventId/bookingId); só adicionar campo se necessário por performance.

7.2 sourceType canónico v1

Lista oficial (não inventar fora disto):
	•	TICKET_ORDER (Eventos)
	•	BOOKING (Reservas)
	•	PADEL_REGISTRATION (Padel Torneios)
	•	STORE_ORDER (Loja)

Compatibility mapping temporário
	•	Se existir SERVICE_BOOKING no repo → mapear para BOOKING no adapter.

Regra: ledger e check-in guardam apenas sourceType canónico.

⸻

8) Check-in Policy (ticket obrigatório) — definição final

8.1 Onde vive
	•	Default em Event.checkinPolicy
	•	Override opcional em Session.checkinPolicyOverride (se houver sessões)

8.2 Campos mínimos
	•	requiresTicketForEntry: boolean
	•	allowBookingQr: boolean
	•	allowRegistrationQr: boolean

8.3 Defaults recomendados
	•	Eventos “entrada”: requiresTicketForEntry=true
	•	Torneios Padel: requiresTicketForEntry=false, allowRegistrationQr=true
	•	Reservas (serviços): allowBookingQr=true (se a organização activar check-in para bookings)

8.4 Regra principal

Se requiresTicketForEntry=true:
	•	inscrição Padel não substitui ticket
	•	booking QR só vale se explicitamente permitido e fizer sentido no contexto (ex.: aula/evento híbrido)

⸻

9) PRDs por ferramenta (produto + técnico, com limites)

9.1 Eventos

Faz: criar eventos, sessões, tickets/lotes, página pública base (SEO), exports.
Integra: Finanças, Check-in, Promoções, CRM, Formulários.
Não faz: competição, ledger, RBAC.

9.2 Reservas

Faz: agenda engine, bookings, recursos, profissionais, disponibilidade, políticas, no-show.
Fase 2: waitlist, recorrência, open matches, multi-dia (base alojamentos).
Não faz: ledger, campanhas.

9.3 Padel — Clube

Faz: hub operacional, KPIs, atalhos, metadados.
Não faz: ledger, campanhas.

9.4 Padel — Torneios

Faz: wizard, inscrições, formatos, geração, live ops, bracket/standings, widgets.
Integra: Eventos (eventId), Reservas (matchSlots), Finanças, Check-in, CRM.

9.5 Check-in

Faz: scanner QR + lista manual, logs, presença, no-show, idempotência.
Fase 2: self check-in + antifraude.

9.6 Finanças

Faz: checkout, fees ORYA, ledger, refunds/chargebacks, invoices, payouts.
Obrigatório: nenhum checkout fora de Finanças.

9.7 Equipa (RBAC)

Faz: membros, convites, roles/scopes, packs, auditoria.

9.8 CRM

Faz: base unificada, consentimentos, timeline, segmentos.
Fase 2: automações/campanhas.

9.9 Perfil público

Faz: páginas públicas (org/jogador), seguidores, stats e share.
Owner de dados: CRM/Padel/Eventos; Perfil público agrega.

9.10 Definições

Faz: branding, políticas, templates, integrações, RGPD.

9.11 Formulários

Faz: campos extra e waivers por contexto; exports.

9.12 Promoções

Faz: códigos, regras, bundles, tracking, anti-abuso.

9.13 Loja

Faz: catálogo, stock, POS/checkout via Finanças, relatórios.

9.14 Chat interno

Faz: canais por contexto + alertas do sistema; pesquisa e mentions.

⸻

10) Sub-navegação TO-BE (rotas canónicas)

10.1 Serviços (sub-nav própria)

/organizacao/servicos
	•	?tab=overview
	•	?tab=disponibilidade
	•	?tab=precos (packs/créditos)
	•	?tab=profissionais
	•	?tab=recursos
	•	?tab=politicas
	•	?tab=integracoes

10.2 Seguidores (no Perfil público da organização)

/organizacao/perfil/seguidores
	•	?tab=followers
	•	?tab=pedidos (se houver pedidos)

10.3 Check-in (rota canónica)

/organizacao/checkin
	•	?tab=scanner
	•	?tab=lista
	•	?tab=sessoes
	•	?tab=logs
	•	?tab=dispositivos (fase 2)

Alias/redirect:
	•	AS-IS: /organizacao/scan
	•	TO-BE: /organizacao/checkin (canónica)

⸻

11) RBAC v1.4 — packs, roles e scopes (mapa fixo)

11.1 Roles “reais” (por organização)
	•	OWNER, CO_OWNER, ADMIN, STAFF, TRAINER, PROMOTER, VIEWER

11.2 Implementação dos scopes (alinhada com o repo)
	•	Permissões implementadas via OrganizationModule + ModuleAccessLevel (VIEW/EDIT).
	•	Scopes canónicos são lógicos e mapeiam para módulos existentes:
	•	EVENTS_* → EVENTOS
	•	PADEL_* → TORNEIOS
	•	RESERVAS_* → RESERVAS
	•	FINANCE_* → FINANCEIRO
	•	CRM_* → CRM
	•	SHOP_* → LOJA
	•	TEAM_* → STAFF
	•	SETTINGS_* → DEFINICOES
	•	CHECKIN_* → EVENTOS/TORNEIOS (até existir módulo próprio)

11.3 Role Packs (presets) → roles+scopes

Packs são “atalhos” para onboarding e consistência de permissões.

	•	CLUB_MANAGER
	•	base role: ADMIN
	•	scopes: PADEL_*, RESERVAS_*, CHECKIN_*, CRM_READ/WRITE, TEAM_READ, SETTINGS_READ
	•	TOURNAMENT_DIRECTOR
	•	base role: STAFF
	•	scopes: PADEL_*, EVENTS_READ/WRITE, CHECKIN_READ/WRITE, RESERVAS_READ
	•	FRONT_DESK
	•	base role: STAFF
	•	scopes: CHECKIN_*, RESERVAS_READ/WRITE, EVENTS_READ, CRM_READ
	•	COACH
	•	base role: TRAINER
	•	scopes: RESERVAS_READ/WRITE, PADEL_READ, CRM_READ
	•	REFEREE
	•	base role: STAFF
	•	scopes: PADEL_READ/WRITE (limitado a matches/live ops), EVENTS_READ, CHECKIN_READ

Bridge/migração RBAC
	•	roles antigas mapeiam para estes packs/roles sem quebrar acesso (compatibilidade).

⸻

12) Infra do produto (EventBus, EventLog, Idempotência, Auditoria)

12.1 EventBus (pub/sub)
	•	publish/subscribe interno
	•	idempotência por evento
	•	consumers tolerantes a replays

12.2 EventLog (obrigatório para tudo crítico)

EventLog é:
	•	log técnico do event bus
	•	trilho de auditoria do sistema
	•	base para ingest no CRM e para troubleshooting

Regras de PII e retenção
	•	EventLog guarda IDs e metadados mínimos (sem PII desnecessária).
	•	Retenção: 90–180 dias (configurável).
	•	Auditoria (RBAC) pode ter retenção maior com payload reduzido.

Unicidade de idempotência
	•	chave única: (organizationId, eventType, idempotencyKey)

12.3 Idempotência (padrão transversal)

Obrigatório em:
	•	checkout e refunds (Finanças)
	•	check-in (Check-in)
	•	operações live (Padel)
	•	criação/alteração crítica (Reservas/Eventos)

⸻

13) Plano executável (Sprints 0–4)

Sprint 0 — Fundação (contratos + correções estruturais)

Criar:
	•	domain/contracts/reservas.ts
	•	domain/contracts/financas.ts
	•	domain/contracts/checkin.ts
	•	domain/contracts/crm.ts
	•	domain/contracts/notifications.ts
	•	domain/eventBus/eventBus.ts (publish/subscribe + idempotência)
	•	middleware/orgRbacGuard.ts

Alterar/Adicionar em DB (Prisma):
	•	EventLog (+ constraints idempotência)
	•	NotificationTemplate (se ainda não existir)
	•	enums/fields: Entitlement.sourceType, Event.checkinPolicy, Session.checkinPolicyOverride
	•	RBAC: roles/scopes/packs e bridge

Refactors obrigatórios (corrigir quebras)
	•	Agenda: deprecar PadelCourtBlock/PadelAvailability e centralizar em Reservas.
	•	Pagamentos: remover checkout direto Stripe em Reservas; tudo via Finanças.
	•	CRM: parar ingest ponto-a-ponto; usar EventLog como fonte de eventos.
	•	Check-in: preparar suporte a bookings e inscrições via entitlement unificado.

Sprint 1 — Reservas core + Finanças (gateway único)
	•	Finalizar Agenda Engine + prioridades (D3).
	•	Checkout de booking via Finanças (sourceType=BOOKING).
	•	Políticas de cancelamento/no-show com logs + EventLog.

Sprint 2 — Padel torneios core (com Event obrigatório + agenda certa)
	•	Enforce tournament.eventId (já existe; manter).
	•	Wizard mínimo + inscrições.
	•	MatchSlots criados via Reservas (contrato) como bloqueios MATCH_SLOT.
	•	Pagamentos inscrições via Finanças (sourceType=PADEL_REGISTRATION).

Sprint 3 — Operação (Live + Check-in completo)
	•	Live score estável + monitor + idempotência.
	•	Check-in:
	•	QR ticket (TICKET_ORDER)
	•	QR inscrição (PADEL_REGISTRATION) conforme policy
	•	QR booking (BOOKING) para organizações que activem

Sprint 4 — CRM + Perfil público + Exports operáveis
	•	Ingest do EventLog para timeline CRM.
	•	Seguidores + stats básicos no perfil público.
	•	Exports (PDF/CSV) a partir das fontes correctas (owners).

⸻

14) Métricas e Definition of Done

KPIs prioritários
	•	Tempo para criar torneio completo (end-to-end)
	•	% auto-schedule sem conflitos hard
	•	Conversão página pública → compra
	•	Ocupação de recursos (por resource e por profissional)
	•	No-show rate (reservas e eventos)

DoD (qualidade)
	•	Logs e auditoria em ações críticas
	•	Mensagens de erro previsíveis e úteis
	•	Idempotência em checkout/check-in/live updates
	•	UI gating consistente com scopes
	•	Nenhum módulo escreve fora do owner (D2)
	•	Nenhum checkout fora de Finanças (D4)

⸻

15) Pendências v2 (não bloqueiam v1)
	•	Reservas multi-dia (base alojamentos)
	•	Integrações alojamento (Airbnb/Booking) como fase final/enterprise
	•	Self check-in antifraude
	•	ELO/Glicko (quando houver volume)
	•	Fee por item (por evento/serviço específico), se fizer sentido

⸻

16) Referências de mercado (barra de excelência)
	•	Eventos: Eventbrite, Cvent
	•	Reservas: Mindbody, Skedda, Fresha; (raquetes) Playtomic
	•	Torneios: Tournament Software, Tournify, PadelTeams
	•	Pagamentos: Stripe + Connect
	•	CRM: HubSpot; (campanhas) Mailchimp/Klaviyo
	•	Chat: Slack/Discord (referência UX)

⸻

17) Nota final (regra de ouro)

Se uma decisão não estiver aqui, não está decidida.
Se uma implementação contradizer D2/D4/D3, é bug de arquitetura, não é “trade-off”.
