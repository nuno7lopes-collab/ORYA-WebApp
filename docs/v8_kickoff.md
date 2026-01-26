# v8 Kickoff

SSOT normativo: `docs/orya_blueprint_v9_final.md` (v9).  

## Status v8
- D5 = DONE: guards canónicos (org/group), owner transfer idempotente com EventLog/Outbox na mesma tx, convites/permissões auditáveis; RG extra=0 (sem checks ad‑hoc em routes).
- Ficheiros chave: lib/organizationGroupAccess.ts, lib/organizationRbac.ts, app/api/organizacao/organizations/owner/transfer/route.ts, app/api/organizacao/organizations/owner/confirm/route.ts, app/api/organizacao/organizations/members/invites/route.ts.
- Gates: db:gates online+offline OK; RG bypass=0 (organizationMember.findFirst/ownerId direto).
  - Comandos: npm run db:gates; npm run db:gates:offline; rg -n "organizationMember\\.findFirst|ownerId\\s*=" app lib domain tests -S; rg -n "if \\(!.*can|hasPermission\\(|isOwner\\(" app/api/organizacao -S.
- D0 = DONE: API pública read‑only por API key de organização (scopes mínimos + rate‑limit por key+IP; sem PII).

## Política de Localização — Implementado
- Persistência apenas coarse (city/region) + consentimento explícito (PENDING/GRANTED/DENIED).
- Precisão (lat/lon/accuracy) só runtime/TTL; nunca em DB/logs.
- Granularidade e fonte explícitas (PRECISE/COARSE + GPS/WIFI/IP/MANUAL); alterações geram EventLog.
- Contrato: /api/me/location/consent, /api/me/location/coarse, /api/location/ip (coarse IP).
- Contrato de Localização (mínimo):
  - Profile: locationConsent, locationGranularity, locationSource, locationCity, locationRegion, locationUpdatedAt.
  - Snapshot runtime (não persistido): lat, lon, accuracyMeters, source, granularity, timestamp.

## Location Policy (v8) — DONE
Objetivo
- Localização privacy‑first: nunca persistir lat/lon; só coarse (cidade/região) + consentimento + fonte + granularidade.

Modelo canónico (mínimo)
- Profile só guarda coarse:
  - locationConsent {GRANTED, DENIED, PENDING}
  - locationSource {GPS, WIFI, IP, MANUAL}
  - locationGranularity {PRECISE, COARSE} (no Profile apenas COARSE efetivo)
  - locationCity, locationRegion (coarse)
  - locationUpdatedAt
  - (opcional) geohash truncado/coarse (não usado no v8)
- Proibição explícita: latitude/longitude não podem existir em Profile/logs.

Comportamento
- /api/me/location/* grava apenas coarse no Profile.
- EventLog só quando há org ativa + membership válido.
- Discovery usa coarse (cidade/região) e fallback por IP; sem consentimento não assume localização.

Retenção/TTL
- V1: não guarda preciso; coarse persiste.
- Backlog futuro: TTL de snapshot runtime (sem persistência).

Provas / Gates
- npm run db:gates:offline
- npx vitest run tests/location
- rg -n "profile\\.(update|create)" app lib domain -S | rg -n "(lat|lon|latitude|longitude)"
- rg -n "console\\.log|logger\\." app lib domain | rg -n "(lat|lon|latitude|longitude)"
- Nota: qualquer match com lat/lon nestes RG = regressão (FAIL).

## Backlog canónico v8 (D0–D9)

### D1 — Evento base obrigatório para torneios
- Objetivo: todo torneio Padel tem eventId obrigatório.
- Outputs mínimos: Event base (tickets/SEO/página/sessões/entitlements) + Padel Torneios (competição/matches/bracket/live ops).
- Riscos: garantir ligação Event↔Torneio sem drift.
- Decisões necessárias: regra D1 mantém-se FECHADA.
- Gate 3 scoped a D1 (tournaments/agenda); global fica para D1.2 para evitar refactor massivo fora do slice.

### D1.2 — Legacy padel/tournaments routes → Outbox consumer (DONE)
- app/api/padel/calendar/auto-schedule/route.ts
  - Hoje: calcula auto‑schedule e aplica alterações directas.
  - Side‑effects a mover: criação/actualização de agenda/matches → consumer idempotente (Outbox).
- app/api/padel/matches/[id]/delay/route.ts
  - Hoje: altera agenda/estado do match inline.
  - Side‑effects a mover: updates de match/agenda → consumer idempotente (Outbox).
- app/api/padel/matches/route.ts
  - Hoje: updateMatch directo dentro do handler.
  - Side‑effects a mover: updates de match → consumer idempotente (Outbox).
- app/api/organizacao/tournaments/[id]/matches/[matchId]/result/route.ts
  - Hoje: updateMatchResult directo no handler.
  - Side‑effects a mover: updateMatchResult → consumer idempotente (Outbox).
- Gate global (D1.2): rg -n "generateBracket|autoSchedule|createMatch|updateMatch" app/api -S -g '!domain/tournaments/**' -g '!domain/outbox/**' -g '!app/api/internal/**'
- DONE: routes só state→Outbox+EventLog; worker/consumer executa geração/updates com dedupe.
- Nota: global rg match restante é import‑only (computeAutoSchedulePlan), sem side‑effects.

### D1.3 — Discover + Search (Explorar) (DONE)
- Endpoints read‑only: /api/explorar/list (DTO unificado).
- DTO canónico: domain/events/publicEventCard.ts (isGratis via deriveIsFreeEvent, priceFrom, host/loc).
- Search builder: domain/search/publicEventSearch.ts (q/city/from/to + cursor; sem index).
- Gates: db:gates:offline + vitest search/ops/outbox; RG EventLog/Outbox=0 nas routes; RG writes=0 em search/discover; RG sourceType/sourceId=0 fora do módulo canónico.

### D2 — Owners (fontes de verdade) — DONE
- Owners: transfer canónico (initiate/confirm) com 1 pending por org + idempotência.
- Payments: Payment+Ledger SSOT; SaleSummary/SaleLine/PaymentEvent = read-models via outbox consumer.
- Access: Entitlement é prova; Ticket/Booking/Registration são estado operacional.
- Drift removido: gate por ticket.status (padel pairing) → Entitlement-first.
- Drift removido: free-entry por SaleSummary/Ticket → Entitlement-first.
- Guardrails: routes só state + EventLog/Outbox; read-model writes só no consumer; ledger append-only.
- Guardrails: writes de Entitlement apenas nos módulos canónicos (finance/outbox/ops).
- Guardrails: booking.status só em allowlist de workflow/scheduling.
- Guardrails: org-context tokens obrigatórios; metadata org resolution só no allowlist.
- Risco aceite: endpoint resolve org via account.metadata.organizationId com fallback stripeAccountId (input externo).

### D3 — Agenda (read-model) — DONE
- AgendaItem canónico (orgId, sourceType, sourceId, title snapshot, startsAt/endsAt, status, lastEventId) + unique (org, sourceType, sourceId).
- Consumer idempotente: EventLog allowlist → materializa AgendaItem (dedupe por lastEventId) via outbox/worker.
- Gates: db:gates:offline + vitest agenda/outbox/ops/rbac OK; RG agenda writes só no consumer.
- Semântica de overlap (canónica): intervalos [start,end) com boundaries “touching allowed”.

### D3.2 — Calendar outbound (ICS) — DONE
- Rotas read‑only: /api/me/reservas/[id]/calendar.ics (owner‑only).
- Helpers: lib/calendar/ics.ts + lib/calendar/links.ts; UI usa links canónicos (ICS/Google/Outlook).
- Gates: db:gates:offline + vitest agenda/outbox/ops OK; RG EventLog/Outbox=0 nas routes ICS.

### D3.3 — SoftBlock + AgendaItem coverage (DONE, audited)
- SoftBlock canónico (schema+migração) com comandos em domain/softBlocks e rotas org‑scoped; validações de intervalo e scope.
- Workflow v8: state write + EventLog + Outbox na mesma tx (append.ts/producer.ts); outbox AGENDA_ITEM_UPSERT_REQUESTED → consumer idempotente (AgendaItem).
- Conflitos: prioridade HardBlock > MatchSlot > Booking > SoftBlock; SoftBlock nunca bloqueia prioridades acima.
- Gates: db:gates:offline; vitest tests/agenda tests/outbox tests/ops; RG agenda writes só no consumer; RG Outbox/EventLog writes fora dos canónicos = 0.
- Dívida técnica (drift): writes diretos legacy ainda existem em app/api/padel/calendar/*, app/api/padel/matches/*, app/api/organizacao/reservas/*, app/api/servicos/* (rebuild cobre). Refactor para EventLog+Outbox fica para D3.5.

### D4 — Finanças determinística (Stripe Connect + Fees ORYA)
- Objetivo: Payment + Ledger SSOT; Stripe Connect obrigatório; idempotência total.
- Outputs mínimos: createCheckout via Finanças, snapshot imutável, ledger append‑only, reconciliação fees, refunds/chargebacks.
- Riscos: drift financeiro e duplicações sem idempotência.
- Decisões necessárias: Stripe Connect Standard + Destination Charges + Application Fee (D4.0/0.1 FECHADO).
- D4.2: DONE — refunds agora passam pelo gateway com assertConnectReady + org resolvido (FINANCE_ORG_NOT_RESOLVED) e idempotência "refund:SOURCE:ID".
- D4.2: EventLog + Outbox na mesma tx em refunds (booking + ticket).
- D4.2: gates OK (RG stripe.refunds.create=0 fora do gateway; vitest finance/outbox).
- D4.x: DONE — legacy finance routes sem side‑effects (checkout/status read‑only; payments/intent desativado). Gates OK (RG stripe.*=0 fora do gateway; db:gates:offline + vitest finance/outbox).

### D5 — RBAC mínimo viável + Role Packs
- Objetivo: roles/scopes canónicos com packs definidos.
- Outputs mínimos: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE + mapas fixos.
- Riscos: permissões inconsistentes.
- Decisões necessárias: resolução determinística orgId por rota (D5.1).

### D6 — Notificações como serviço
- Objetivo: serviço de notificações com logs e opt‑in.
- Outputs mínimos: templates, consentimento RGPD, logs de delivery, outbox e preferências.
- Riscos: compliance/entrega falha.
- Decisões necessárias: manter SSOT de notificações (D6).
- Estado: DONE + D6.2 DONE (hardening delivery).
- Allowlist EventLog (v1): loyalty.earned / loyalty.spent / padel.registration.created / padel.registration.expired / organization.owner_transfer.*.
- D6.2: backoff/retentativas no outbox (nextAttemptAt) + idempotência via sourceEventId.
- Notas: criação de Notification sempre via consumer; routes apenas enfileiram Outbox/consumo de EventLog.
- Hardening: unique sourceEventId no read-model (idempotência por upsert) + gate de routes internal com requireInternalSecret().
- Gates: npm run db:gates:offline; npx vitest run tests/notifications tests/push tests/outbox tests/ops; rg sendApns/api.push (fora apns.ts) = 0; rg Notification writes (fora consumer) = 0; rg OutboxEvent.create (fora producer) = 0; rg EventLog.create (fora append) = 0.

### D10.4 — Ops SLO/Health (DONE)
- Endpoints read‑only: /api/internal/ops/health, /api/internal/ops/slo, /api/internal/ops/dashboard.
- Helpers canónicos: domain/ops/health.ts + domain/ops/slo.ts (queries baratas com janelas/take).
- Gates: db:gates:offline; vitest ops/outbox; RG Outbox/EventLog/create=0 nas rotas ops; requireInternalSecret() em todas.

### D11 — Search Index (EventLog → SearchIndexItem)
- Objetivo: materializar SearchIndexItem via consumer idempotente e migrar search/discover para read‑model.
- Outputs mínimos: SearchIndexItem (visibility PUBLIC|HIDDEN) + consumer por outbox; search/discover lê apenas SearchIndexItem.
- Estado: DONE (event/org status emitindo SEARCH_INDEX_*; consumer dedupe por lastEventId).
- Gates: db:gates:offline; vitest tests/searchIndex tests/search tests/outbox tests/ops; RG SearchIndexItem writes só em domain/searchIndex/**; RG EventLog/Outbox writes fora dos helpers = 0.
- TicketType pricing/visibility writes ⇒ MUST call domain/searchIndex/triggers.ts
- soldQuantity updates ⇒ OUT_OF_SCOPE (no search impact)

### D11.1 — Discover/Explore → SearchIndexItem (DONE)
- /api/explorar/list agora lê exclusivamente SearchIndexItem (read‑model).
- DTO canónico mantém‑se (publicEventCard); filtros paritários e paginação por cursor string.
- Nota anti‑drift: sem fallback para Event; index lag aceite e documentado.
- Gates: db:gates:offline; vitest tests/search tests/outbox tests/ops; RG prisma writes=0 nas rotas; RG Outbox/EventLog writes=0 fora dos produtores.

### D11.2 — SearchIndex coverage expansion (DONE, audited)
- Triggers V1: event create/update/cancel/isDeleted; ticketType updates; admin purge; org status ACTIVE/INACTIVE.
- Dedupe por lastEventId; quando evento não existe → visibilidade HIDDEN (fail closed).
- /api/public/v1/events e /api/public/v1/tournaments mantêm 410 (PUBLIC_API_GONE) até read‑model dedicado.
- Gates: db:gates:offline; vitest tests/searchIndex tests/search tests/publicApi tests/outbox tests/ops; RG SearchIndexItem/Outbox/EventLog writes=0 fora dos canónicos.
- TicketType pricing/visibility writes ⇒ MUST call domain/searchIndex/triggers.ts
- soldQuantity updates ⇒ OUT_OF_SCOPE (no search impact)
- D11.2 coverage audit: ticketType writes mapped; triggers enforced
- Anti-drift: qualquer novo write de TicketType deve chamar triggers.ts

### D7 — sourceType canónico
- Objetivo: sourceType único para Finanças/ledger/check‑in.
- Outputs mínimos: SourceRef canónico + allowlist global.
- Allowlist (v8): TICKET_ORDER, BOOKING, PADEL_REGISTRATION, STORE_ORDER, SUBSCRIPTION, MEMBERSHIP, EVENT, TOURNAMENT, MATCH, LOYALTY_TX.
- Riscos: drift entre módulos.
- Decisões necessárias: não criar sourceType fora da lista (D7).
- Estado: DONE (writers EventLog/Outbox/Agenda/Notifications/Analytics normalizados).
- Gates: db:gates:offline; vitest tests/sourceType tests/agenda tests/analytics tests/notifications tests/ops tests/outbox tests/finance; rg sourceType/sourceId string-literals = 0.

### D8 — EventAccessPolicy (acesso + convites)
- Objetivo: policy única para acesso/convites/guest checkout/check‑in.
- Outputs mínimos: policy versionada, convites por token, locks após vendas/entitlements.
- Riscos: UI/backend drift.
- Decisões necessárias: política canónica FECHADA (D8).
- Estado: Piloto DONE; D8.2 DONE (rings + gates A/B); D8.3 DONE (refactor global por escopo, gate semântico=0); D8.4 DONE (cleanup dos matches fora do scope).
- D8.4: gate semântico (paywall/pass/access deny/allowed) = 0 nos 6 ficheiros alvo.
- D8.4: helpers renomeados (hasAccess/canAccess → accessLevelSatisfies/canView*) para evitar ad‑hoc.
- D8.4: RG prova “0 ad‑hoc” no scope eventos/checkout/payments/store + 6 ficheiros de cleanup.
- D8.2: engine aplicado em checkout (domain/finance/checkout) + entrypoint /api/payments/intent; gates A/B=0.
- D8.3: gate semântico (escopo eventos/checkout/payments/store) = 0; comandos: npm run db:gates:offline; npx vitest run tests/access tests/finance tests/rbac tests/ops tests/outbox.

### D9 — Merchant of Record + fiscalidade
- Objetivo: MoR por defeito = Organização; ORYA cobra fee B2B.
- Outputs mínimos: registo de movimentos + exports; configuração “como emite faturação”.
- Riscos: compliance fiscal.
- Decisões necessárias: ORYA não obriga faturação interna (D9.1).
- Estado: DONE (V1 CSV-only) — config de faturação em OrganizationSettings + exports CSV (ledger/fees/payouts) read-only. Anti-drift D4.8 fechado: derivedIsFree canónico; 0 leituras de Event.isFree em app.
- Gates: npm run db:gates:offline; npx vitest run tests/fiscal tests/finance tests/rbac tests/outbox tests/ops; RG exports sem writes.
- Regra: 0€ tickets só quando Event.pricingMode=FREE_ONLY (erro: EVENT_ZERO_PRICE_REQUIRES_EXPLICIT_FREE_MODE; FREE_ONLY bloqueia tickets pagos).
- Anti-drift (sempre corre): rg -n "EventLog\\.(create|createMany)|eventLog\\.(create|createMany)" app/api/organizacao/events -S = 0; rg -n "OutboxEvent\\.create|outboxEvent\\.create" app/api/organizacao/events -S = 0; rg -n "\\bEvent\\.isFree\\b|\\bisFree\\b" app -S = 0.
