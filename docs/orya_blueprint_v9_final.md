ORYA — Blueprint Final v9 (SSOT)

**Versão:** v9.0  
**Data:** 23 Jan 2026 (Europe/Lisbon)  
**Estado:** Fechado para execução (Fase 1–3)  
**Autoridade (SSOT):** Este documento substitui **todas** as versões anteriores (incl. v7/v8 e drafts) e é a única fonte normativa.  
**Regra de conflito:** em caso de divergência interna, prevalecem as secções marcadas como **FECHADO** (e, se persistir, prevalece a secção mais específica do domínio).

## Estado de Implementação (NÃO-NORMATIVO)

O estado real de execução (slices + gates) é rastreado em `docs/v10_execution_checklist.md` e no registo `docs/v9_ssot_registry.md`.  
Este blueprint é normativo/arquitetural; não é fonte de status de execução.
Fechado = decisões finais; implementação ainda em curso — ver status.

Migrations: ver `docs/v9_ssot_registry.md` e `prisma/migrations/`.

## Executive Summary (NÃO-NORMATIVO)
- A ORYA é uma plataforma integrada de descoberta + operações com módulos verticais (Eventos/Reservas/Padel/Loja/Serviços) sobre serviços horizontais canónicos.
- Invariantes: SSOT por domínio (Payment+Ledger, Entitlement, Identity), ledger append‑only, e idempotência obrigatória em operações com side‑effects.
- Multi‑tenancy explícita: todo o acesso/consulta é org‑scoped (fail‑closed).
- Contratos C1–C9 governam integrações internas; compatibilidade e observabilidade são mandatórias.
- Operação: Outbox + Jobs/Queue garantem execução assíncrona e replays seguros.
- Go‑live exige gates de SLO/SLI, retenção RGPD e auditoria (ver secções normativas).
- Não é motor de faturação do consumidor final v1; exports e ledger são obrigatórios.

```
Horizontais: Identity | Payments/Ledger | Entitlements | Notifications | Ops
      |             |                 |              |              |
Verticais:
Events ----- C2/C3/C5/C9 ------------------------------------------->
Reservations ---- C1/C2/C3 ----------------------------------------->
Padel ---------- C1/C2/C3/C6 --------------------------------------->
Store/Serviços -- C2/C5 -------------------------------------------->
```

## RACI mínimo (NÃO-NORMATIVO, mas EXECUTIVO)

Roles: Eng Lead, Product, Ops, Security, Legal/Compliance

| Área crítica | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Payments/Ledger | Eng Lead | Product | Ops, Legal/Compliance | Security |
| Entitlements/Check‑in | Eng Lead | Product | Ops | Security |
| Tenancy/Security | Security | Eng Lead | Ops | Product |
| Contracts (C1–C9) | Eng Lead | Product | Ops | Security |
| Ops/SLOs | Ops | Eng Lead | Product | Security |

## CHANGELOG (v9.0) — correções finais anti-drift
- Check‑in: normalizado para `requiresEntitlementForEntry` (ticket = entitlement) e removida ambiguidade em torneios (QR_REGISTRATION).
- QR offline assinado: fechado como Fase 3 . PassKit na V1.5 mantém validação **online** (lookup por tokenHash).
- PricingSnapshot/fees: removidas “estimates”; `processorFeesStatus=PENDING|FINAL` + `processorFeesActual` nullable até reconciliação. Net final deriva sempre do Ledger (append‑only).
- Ledger append‑only: tipos explícitos `PROCESSOR_FEES_FINAL` e `PROCESSOR_FEES_ADJUSTMENT`; net final = soma de entries por payment.
- Entitlements: `policyVersionApplied` alinhado e obrigatório para entitlements ligados a eventos.
- Contratos: Finanças passa a usar `customerIdentityId` (Identity SSOT) e snapshot fields alinhados.
- Address: removido conflito D11 vs D17 (Apple-first com fallback OSM).
- Domínio: mapa declarado “não exaustivo” + entidades mínimas adicionadas (Promoções/Notificações/Perfil/Pesquisa).
- Revenda: removidas referências a estado `USED`; consumo é metadata (`consumedAt`).
- Ticket: adicionado estado `DISPUTED` ao enum mínimo para consistência com chargebacks.
- Editorial: numeração 15.1 corrigida + referência “blueprint” alinhada para v9.
- Production Readiness: gate de go‑live + compliance/ops/DSAR/retention/release gates (Secção 19).
- Stripe: Connect Standard + funds flow FECHADO + onboarding Standard (D4.0.1 / C2.x).
- Infra: backups Supabase→S3 + isolamento multi‑tenant (12.6.2 / 19.3.1).
- Check‑in: modo recinto (8.6) para fallback operacional sem offline QR.
- Policy Defaults v1 FECHADO (Apêndice A).
- Legal: sign‑off/versionamento FECHADO (19.1).
- Stripe Standard: mitigação operacional clarificada (sem controlo directo de payouts).


> **Nota de execução (importante):** neste momento **não há dados sensíveis nem históricos que precisem de ser preservados**. Podemos **apagar os dados atuais** e **recriar tabelas/colunas** conforme o blueprint, sem plano de migração. (Isto simplifica muito as Fases 1–2: o foco é *higienizar* schema e código, não “migrar dados”.)


---

## System Invariants & Non-Negotiables (NORMATIVE)

This section defines the immutable invariants of the ORYA platform.
These rules MUST hold at all times. Any implementation that violates
one or more invariants is considered incorrect, even if functional.

### I1 — Single Source of Truth (SSOT)
Each domain has exactly one authoritative source of truth:
- Payments & money state → `Payment` + `LedgerEntry`
- Access rights → `Entitlement`
- Identity → `Identity` (USER or GUEST_EMAIL)
- Organization context → `Organization`

Derived data, caches, projections, and UI state MUST NOT be treated
as authoritative.

---

### I2 — Ledger Is Append-Only and Deterministic
`LedgerEntry` records are immutable and append-only.
They MUST:
- never be updated or deleted
- always reference a causative event
- be sufficient to fully recompute balances and net amounts

Any correction is expressed via compensating entries, never mutation.

---

### I3 — Payments Are State Machines, Not Balances
`Payment` represents lifecycle and intent, not money truth.
Final financial truth is derived exclusively from the ledger.

Processor fees MAY be unknown at creation time and MUST be reconciled
later without mutating historical entries.

---

### I4 — Entitlement Is the Canonical Proof of Access
An `Entitlement` is the only proof that a user (or guest) has access
to a resource (event, ticket, seat, experience).

UI state, QR codes, check-in logs, or payment success screens are NOT
proof of access.

---

### I5 — Explicit Organization Context (Multi-Tenancy)
All domain data MUST be scoped to an explicit `orgId`, either:
- directly (row-level), or
- indirectly via an owning entity

No query, job, webhook, or background task may operate without an
explicit organization context.

---

### I6 — Idempotency Is Mandatory for Side-Effectful Operations
Any operation that:
- creates money movement
- issues entitlements
- sends emails or webhooks
- mutates irreversible state

MUST be idempotent and safe to retry.

---

### I7 — Async Is Explicit and Observable
All asynchronous work MUST be:
- triggered via an outbox or durable queue
- observable via metrics and logs
- retryable without side effects

Fire-and-forget execution is forbidden.

---

### I8 — External Systems Are Not Trusted
External systems (payment processors, email providers, scanners,
integrations) are treated as:
- unreliable
- duplicative
- out-of-order

All inbound signals MUST be validated, deduplicated, and reconciled
against internal truth.

---

### I9 — Fail Closed on Authorization and Access
In case of uncertainty, missing data, or reconciliation lag:
- access is denied
- payouts are delayed
- irreversible actions are blocked

The system always fails closed, never open.

---

### I10 — FECHADO Decisions Are Binding
Any section or rule marked as FECHADO is final.
Implementation choices MUST adapt to the blueprint, not the inverse.

Deviation requires an explicit blueprint revision.

---

⸻

0) Objetivo e Visão

0.1 Objetivo

Transformar a ORYA num ecossistema integrado ao nível das melhores plataformas globais de:
	•	Discovery + Social + Compra + Histórico para utilizadores
	•	Gestão operacional + monetização + relacionamento para organizações

Com módulos verticais (Padel, Eventos, Serviços) a consumirem serviços horizontais (Reservas, Finanças, CRM, Equipa/RBAC, Check-in, Promoções, Loja, Formulários, Perfil público, Definições, Chat interno, Analytics).

0.2 Visão prática (fontes únicas)
	•	Uma agenda (Reservas)
	•	Um perfil de utilizador + grafo social (Social)
	•	Um perfil público de organização (Organization)
	•	Pagamentos e fees centralizados (Finanças)
	•	RBAC centralizado (Equipa)
	•	Orquestração por eventos internos (EventBus + EventLog + Audit)
	•	Uma verdade única para moradas/localização (Address Service)
	•	Métricas macro e micro (Analytics derivado do Ledger + EventLog)

⸻

1) Princípios (TO-BE)
	1.	Simplicidade e automação
Defaults fortes, menos passos, menos fricção. “O sistema sugere; o humano confirma.”
	2.	Operacional e robusto
Tempo real onde importa, fallback operacional, auditoria em tudo crítico.
	3.	Experiência premium
UI consistente e previsível, rápida, acessível, com estados claros e feedback imediato.
	4.	Integração sem monólito confuso
Fronteiras claras; integração via contratos; zero duplicação de lógica entre owners.
	5.	Determinismo financeiro
Ledger único, reconciliável; idempotência obrigatória; relatórios derivados (não inventados).
	6.	RGPD by design
Minimização de PII em logs; consentimentos; retenção; portabilidade.
	7.	Escala sem rebentar orçamento
Auto-scale e pay-as-you-go. Infra preparada para crescer, mas activada por necessidade.

⸻

2) Modelo de Plataforma (User + Social + Organizações)

2.1 Utilizador (app)

O utilizador é “rede social + discovery + compra + histórico”.

Superfícies separadas (sem feed único):
	•	/app/rede — rede, actividade social, seguir/seguir de volta (sem “amigos” como base)
	•	/app/explorar — descoberta editorial/curada (tendências, destaques, categorias)
	•	/app/agora — eventos/actividades “a acontecer” e próximos
	•	/app/descobrir — pesquisa e filtros (eventos / torneios / serviços / reservas)

Notificações do utilizador:
	•	outbox + preferências + logs de delivery (ver Notificações)

Perfil do utilizador:
	•	público/privado (2 níveis)
	•	próximos eventos, eventos passados
	•	Padel: jogos/resultados, estatísticas (vitórias/%, lado, preferências), conquistas
	•	interesses
	•	histórico financeiro (movimentos/faturas conforme aplicável)
	•	Controlo de privacidade granular (V2):
	•	mostrar/ocultar: stats padel, jogos recentes, eventos futuros, histórico (por secções)
	•	ainda com 2 níveis base (público/privado), mas com toggles por secção

2.2 Social (seguidores)

- Um utilizador pode **seguir** e **deixar de seguir** Utilizadores e Organizações.
- Uma Organização pode ter **seguidores**, mas **nunca segue ninguém** (não existe “A seguir” no perfil público de uma Organização).
- No UI, isto significa:
  - **Perfil de Utilizador**: mostra “Seguidores” e “A seguir”.
  - **Perfil de Organização**: mostra apenas “Seguidores” + crachá “Organização” (já previsto).
- No backend, isto significa:
  - A tabela/serviço de follow é única, mas com uma regra: `subjectType=ORG` não pode ser `actorType=ORG` em nenhum caso.
  - Ao pedir o perfil público de uma Organização, a API **não devolve** listas/contagens de “a seguir”, mesmo que existam (porque não podem existir).


2.3 Organizações

Uma Organization é entidade pública com branding e montra:
	•	serviços, eventos, torneios, loja, links, reviews (futuro), staff
	•	No perfil público, mostrar um **crachá “Organização”** (para distinguir de perfis de utilizador).

Membros:
	•	OrganizationMember e OrganizationMemberInvite
	•	um user pode ser membro de várias organizações com roles diferentes

Multi-instância:
	•	Padel suporta múltiplos clubes/locais por organização (ex.: PadelClub, PadelClubCourt)
	•	Reservas suporta recursos e profissionais

2.3.1 Regra de separação: Perfil Público vs Painel da Organização

Regra (não negociar)
	•	O “Perfil Público” da organização é SEMPRE o que qualquer utilizador vê — incluindo o próprio dono/admin quando está em modo Utilizador.
	•	O “Painel da Organização” (backoffice) só aparece quando o utilizador muda explicitamente para o contexto da organização (switch de contexto).
	•	Não existe “atalho” onde uma pesquisa no lado Utilizador abre o painel interno.

Implementação (o que fazer)
	•	Context Switch
		–	Header/menu com selector: [Eu] vs [Org X] (apenas se tiver membership).
		–	Em modo [Eu], todas as páginas de org abrem /:username (Perfil Público).
		–	Em modo [Org X], abre /org/:orgId/* (dashboard + ferramentas).
	•	Guardrails
		–	Front: rotas /org/:orgId/* requerem orgContext ativo.
		–	API: endpoints /org/* requerem scopes de org (RBAC).
	•	Tracking
		–	Logar eventos separados: VIEW_PUBLIC_PROFILE vs VIEW_ORG_DASHBOARD.

**Regra de routing (estilo Instagram):** páginas públicas de **Utilizador** e **Organização** vivem no mesmo namespace: `/:username`.
- O `UsernameRegistry` resolve de forma determinística se aquele `username` pertence a USER ou ORG e faz o render do perfil público correto.
- O `username` é **globalmente único** (uma organização e um utilizador **não** podem partilhar o mesmo).
- Existe lista de **reserved paths** (ex.: `app`, `org`, `organizacao`, `api`, `admin`, `support`, `login`, `signup`, `events`, `checkout`, `pricing`, `assets`, `static`, `robots.txt`, `sitemap.xml`, etc.) para evitar colisões.
- Em caso de `username` inexistente: 404.
- Em caso de `username` “released” em cooldown: continua reservado até expirar.


2.3.2 Perfil Público “componível” (page builder baseado em módulos)

Objetivo
	•	O Perfil Público da org adapta-se automaticamente ao que a org usa: Eventos / Loja / Formulários / Serviços.

Como
	•	OrgPublicProfileLayout (JSON versionado)
		–	blocks: HERO, ABOUT, EVENTS_AGENDA, STORE_GRID, SERVICES, FORMS, GALLERY, FAQ, CONTACT, FOLLOW_BUTTON, STATS
		–	condições: “mostrar bloco X apenas se módulo ativo e resolvedStoreState permitir”
	•	Render engine
		–	Front renderiza por schema (block registry) e só mostra blocos elegíveis.
	•	Agenda de eventos
		–	sempre ordenada por próximos eventos, com fallback “sem eventos” + call-to-action.
	•	Torneios
		–	tratados como Events com subtype=TOURNAMENT (não criar secção paralela no público).

2.4 Username Registry (SSOT único)

Regra:
	•	Existe um único registry: UsernameRegistry (normalizado).
	•	Tanto User como Organization “reservam” username via registry.
	•	Não existem constraints duplicadas em tabelas diferentes a competir.
		•	Normalização canónica obrigatória: lowercase + trim + colapsar espaços + Unicode NFC. (FECHADO)
		•	Confusables/homoglyphs: **fora do MVP** (fase 2). No MVP: charset permitido + bloquear mistura de scripts. (FECHADO)
	•	Reserved words + blacklist (ex.: admin, support, orya, api, etc.).
	•	Regras de tamanho: **mínimo 4 caracteres, máximo 15** (depois da normalização).
	•	Hold on release: username antigo entra em cooldown (15 dias) após rename para evitar impersonação.
	•	(Preparação futura) Verified org can claim: possibilidade de uma organização verificada reclamar username em casos excepcionais (policy + auditoria).

Operação:
	•	reserve(username, ownerType, ownerId) com idempotencyKey
	•	release só em operações explícitas (rename/delete), com audit
	•	rename = reserve novo + release antigo (transação)

Guardrail:
	•	Qualquer escrita em profiles.username ou organization.username passa pelo registry.
	•	Architecture test falha se alguém escrever username directo sem passar pelo serviço.
⸻

3) Arquitectura de Ferramentas (horizontais vs verticais)

3.1 Ferramentas horizontais (Core)
	•	Reservas — agenda engine, bookings, disponibilidade, recursos, profissionais, políticas, no-show
	•	Presença/Conclusão — **por tipo**: em *Eventos/Tickets* usa QR/check‑in; em *Reservas de serviços* (ex.: cabeleireiro) no v1 basta **marcar como “Concluída/No‑show”** pelo prestador (QR fica opcional/fase 2 se fizer sentido).
	•	Finanças — checkout unificado, ledger, fees ORYA, refunds/chargebacks, invoices, payouts
	•	Equipa (RBAC) — membros, convites, roles, scopes, auditoria
	•	Notificações — outbox, preferências, templates, delivery logs
	•	CRM — customer profiles, consentimentos, timeline, segmentos (fase 2: automações/campanhas)
	•	Formulários — campos extra/waivers por contexto; exports; assinaturas/aceites
	•	Promoções — códigos, regras, bundles, limites/anti-abuso, tracking, ROI
	•	Loja — catálogo, stock, POS/checkout via Finanças, relatórios, inventário centralizado
	•	Chat interno — canais por contexto, alertas do sistema, pesquisa e mentions
	•	Activity Feed (Ops) — feed de operações (derivado de EventLog) + canal automático no chat
	•	Perfil público — páginas públicas agregadas (org/jogador), seguidores, stats e share
	•	Pesquisa & Discovery — indexação unificada por tipo + filtros
	•	Definições — branding, políticas, templates, integrações, RGPD, export/backup
	•	Analytics — dashboards macro/micro (derivados de Ledger + EventLog; sem duplicar estado)

3.2 Ferramentas verticais (Domínio)
	•	Eventos — criação, tickets/lotes, sessões, páginas públicas base (SEO), exports, recorrência (fase 2)
	•	Serviços — catálogo de serviços (profissionais/recursos), reservas, políticas, reviews (fase 3)
	•	Padel — Clube — hub operacional do clube (KPIs, atalhos, metadados Padel)
	•	Padel — Torneios — competição (formatos, inscrições, matches, bracket/standings), live ops e widgets
	•	Digital Goods (fase 2/3) — venda de produtos digitais/cursos via Loja + Entitlements

Nota de produto: Padel é um vertical inicial forte, mas o blueprint v9 garante que Eventos/Serviços/Digital são igualmente first-class.

⸻


4) Decisions Locked v9 (não avançar sem isto)

D0) Fora de scope (v1–v3): API pública
	•	Não vamos expor API pública/SDK/webhooks para terceiros nesta fase.
	•	Apenas contratos internos versionados (Secção 6) e exports/configurações por organização.
	•	Integrações externas só via exports e integrações pontuais configuráveis (Fase 2+), sem “public API”.


D1) Evento base obrigatório para torneios

Todo torneio de Padel tem eventId obrigatório.
	•	Eventos: tickets, SEO, página pública base, sessões, entitlements
	•	Padel Torneios: competição, matches, bracket/standings, live ops

D2) Owners (fontes de verdade) — semântica blindada
	•	Ticketing / Sessions / Página pública base / Entitlements de acesso: Eventos
	•	Convites (EventInvite + InviteToken) + EventAccessPolicy: Eventos
	•	Competição / Registos / Brackets / Matches / Resultados: Padel Torneios
	•	Agenda / Disponibilidade / Booking / No-show / MatchSlots: Reservas
	•	Pagamentos / Fees / Ledger / Refund / Payout / Invoice: Finanças
	•	Check-in / Presence logs / Scanner: Check-in
	•	Customer + Consent + Timeline + Segmentos: CRM
	•	Roles + Scopes + Auditoria RBAC: Equipa
	•	Moradas: Address Service
	•	Analytics: Derivado (Ledger + EventLog); não é owner de estado transaccional

Regra: nenhum domínio duplica estado de outro owner. Integração só via contratos.

**Regra de negócio (fundamental):** **só ORGANIZAÇÕES** podem ser donas de coisas que se vendem/operam (Eventos, Loja/Produtos, Serviços/Reservas). Utilizadores **nunca** “criam/vendem em nome próprio”; apenas atuam como membros de uma Organização no **Painel da Organização** (RBAC). No lado do utilizador, mesmo sendo dono/admin, vê a Organização apenas como público.

D3) Agenda Engine e prioridade de conflitos

Prioridade MVP: HardBlock > MatchSlot > Booking > SoftBlock
Qualquer override exige permissão + auditoria.

D3.1 MatchSlot é sempre hard-block funcional
MatchSlot nunca pode ser “soft”.

D4) Finanças determinística (Stripe Connect + Fees ORYA) — decisão única

> **FECHADO (SSOT):** SSOT financeiro = `Payment` (state machine) + `LedgerEntry` (linhas imutáveis).  
> Tudo o resto (SaleSummary, dashboards, exports) é **derivado**.

Princípios
- Stripe Connect obrigatório já (v1.x): cada Organization tem `stripeAccountId`.
- **Finanças é o único gateway**: nenhum módulo cria PaymentIntents/CheckoutSessions diretamente no Stripe.
- Idempotência obrigatória em todas as operações: `idempotencyKey` por createCheckout/refund/reconcile.
- “Pago” só existe quando `Payment.status == SUCCEEDED`.

D4.0) Stripe Connect — Account Type (FECHADO)
- ORYA usa **Stripe Connect Standard** como tipo de conta por defeito para Organizações.
- A conta Stripe é do organizador (autonomia e responsabilidade fiscal/operacional).
- A ORYA não cria nem gere contas Custom nesta fase.
- Qualquer excepção (Express/Custom) só por decisão de produto + contrato (fora v1.x).

D4.0.1) Stripe Funds Flow (FECHADO)
Objetivo: definir de forma única como o dinheiro flui e onde a ORYA consegue (ou não) aplicar “risk holds”.

Decisão (v1.x):
- Modelo: **Destination Charges + Application Fee** (Stripe Connect Standard).
- A cobrança ao cliente é criada pela ORYA (Finanças) para o evento/serviço (`sourceType/sourceId`), com:
  - `application_fee_amount` = fee ORYA (conforme FeePolicyVersion)
  - `transfer_data.destination` = `Organization.stripeAccountId`

Implicações (normativas):
- Refunds são iniciados pela ORYA (Finanças) e são idempotentes.
- Disputes/chargebacks afectam `Payment/Entitlements` conforme D4.9 e Secções 7/8.
- “Risk hold” em v1.x é **operacional** (step‑up, limits, bloqueio temporário de criação de eventos/checkout); não assume controlo directo de payouts.
- Se for necessário controlo fino de payouts/transferências (hold real de fundos), isso é **fora v1.x** e requer revisão do flow (ou mudança de account type/contrato).

Regra: nenhum módulo assume “payout control” fora do que este flow permite.

D4.1 Política de Fee (Admin) (FECHADO)
- Config por organização (default) + overrides por `sourceType` (e opcionalmente por `sourceId`).
- Limites opcionais: min/max, arredondamentos, feeMode (INCLUDED/ADDED/ABSORBED — se aplicável).
- Qualquer alteração gera nova versão (`feePolicyVersion`), nunca edita retroativamente.

D4.2 PricingSnapshot (obrigatório) (FECHADO)
- `pricingSnapshot` é gravado no momento do checkout e nunca muda.
- Deve incluir, no mínimo:
  - currency, gross, discounts, taxes (se existirem), platformFee, netToOrgPending (calculado **sem** fees reais do processador)
  - `processorFeesStatus: PENDING | FINAL`
  - `processorFeesActual` (nullable até reconciliação Stripe; quando FINAL, é obrigatório)
  - feeMode resolvido (como a fee é aplicada)
  - referências: `feePolicyVersion`, `promoPolicyVersion` (se houver), `sourceType/sourceId`
  - lineItems com preços unitários e quantidades (para auditoria)
- Regra: **qualquer cálculo futuro** usa o snapshot + o Ledger (SSOT), nunca re‑calcula com regras novas.
- `netToOrgFinal` **não** vive no snapshot inicial; é sempre derivado de `SUM(entries.amountSigned)` quando `processorFeesStatus=FINAL`.

D4.3 Fee determinística + versionamento (obrigatório) (FECHADO)
- Fee calculada em Finanças durante `createCheckout` e congelada no `Payment`.
- `Payment.feePolicyVersion` obrigatório (incremental ou hash do snapshot).
- LedgerEntryType (MVP v1.x) — FECHADO
  - `GROSS`
  - `PLATFORM_FEE`
  - `PROCESSOR_FEES_FINAL`
  - `PROCESSOR_FEES_ADJUSTMENT`
  - `DISPUTE_FEE`
  - `DISPUTE_FEE_REVERSAL`
  - `REFUND_GROSS`
  - `REFUND_PLATFORM_FEE_REVERSAL`
  - `REFUND_PROCESSOR_FEES_REVERSAL`
  - `CHARGEBACK_GROSS`
  - `CHARGEBACK_PLATFORM_FEE_REVERSAL`
- Norma de sinais (obrigatória)
  - `GROSS` é positivo (+)
  - `PLATFORM_FEE` é negativo (-)
  - `PROCESSOR_FEES_FINAL` é negativo (-)
  - `PROCESSOR_FEES_ADJUSTMENT` pode ser + ou - (depende do delta)
  - `DISPUTE_FEE` é negativo (-)
  - `DISPUTE_FEE_REVERSAL` é positivo (+)
  - `REFUND_GROSS` é negativo (-)
  - `REFUND_PLATFORM_FEE_REVERSAL` é positivo (+)
  - `REFUND_PROCESSOR_FEES_REVERSAL` é positivo (+)
  - `CHARGEBACK_GROSS` é negativo (-)
  - `CHARGEBACK_PLATFORM_FEE_REVERSAL` é positivo (+)
- Regra FECHADA
  - `netToOrgFinal = SUM(entries.amountSigned)` por `paymentId` quando `processorFeesStatus=FINAL`.
  - `netToOrgPending = gross - platformFee` (informativo; não é canónico; sem fees reais do processador).
  - Refund/chargeback geram entries adicionais no mesmo `paymentId` (append-only); o `netToOrgFinal = SUM(entries.amountSigned)` continua verdadeiro após refund/chargeback.
- Alterações no Admin não afectam pagamentos antigos.

D4.4 Ledger SSOT (imutável) + reconciliação (FECHADO)
- `LedgerEntry` é append‑only (sem update/delete).
- Cada entrada tem: `entryType`, `amount`, `currency`, `paymentId`, `sourceType/sourceId`, `createdAt`, `causationId`, `correlationId`.
- Regras:
  - entradas são geradas apenas por Finanças (write‑owner)
  - replays são idempotentes (mesma causationId não duplica)
- Reconciliação (FECHADO):
  - Fonte única do fee real: `stripe.balance_transaction.fee` (ou equivalente do processor).
  - Transição:
    - `processorFeesStatus=PENDING` enquanto não existir `balance_transaction`
    - `processorFeesStatus=FINAL` quando existir
  - Entries:
    - criar `PROCESSOR_FEES_FINAL` quando chega o `balance_transaction`
    - criar `PROCESSOR_FEES_ADJUSTMENT` se, em reconciliações futuras, o fee real mudar (delta)
  - Append-only sempre: nunca editar entries antigas.
  - divergências geram `LedgerReconciliationIssue` (ver 12.4.x)

D4.5 SaleSummary (se existir) — read model derivado
- Pode existir para performance/UX, mas:
  - nunca decide estados (pago/reembolsado)
  - é re‑gerável a partir de Ledger + Payment
  - falhas são reparáveis por replay (EventLog/Jobs)
- Definição (read‑model):
  - `SaleSummary`: resumo por compra (`purchaseId`/`paymentIntentId`), totais/fees (`subtotal/discount/platformFee/cardFee/stripeFee/total/net`), `status`, owner (`ownerUserId`/`ownerIdentityId`), modo/teste (`mode`/`isTest`) e snapshots de promo (`promoCodeSnapshot/label/type/value`).
  - `SaleLine`: linhas por ticketType (`ticketTypeId`), `quantity`, `unitPrice`, `gross/net/platformFee` + snapshots de promo.
- Owner: apenas o consumer de finanças (domain/finance read‑model consumer) escreve; resto é read‑only.

D4.6 FeeMode e pricing têm um resolvedor único (FECHADO)
- `computePricing()` (Finanças) decide de forma determinística e versionada:
  - platform default
  - org default
  - override por `sourceType`
  - override por `sourceId` (opcional)
- Regra: nenhum módulo força feeMode “por fora”. Se Eventos quiserem “INCLUDED sempre”, isso é configurado como override por `sourceType=TICKET_ORDER` e fica escrito em policy versionada.

D4.7 Regras de FREE_CHECKOUT (FECHADO)
- Um checkout é “free” se:
  - `totalAmount == 0` (após promos/fees) **ou**
  - `scenario == FREE_CHECKOUT` (explicitamente resolvido por Finanças)
- Limites e anti‑abuso aplicam-se ao free checkout independentemente de qualquer flag no evento.
- Bilhetes 0€ só existem por decisão explícita:
  - `Event.allowZeroPriceTickets` (default false) **ou** policy por TicketType (recomendado).


D4.7.1 Guardrails de FREE_CHECKOUT (FECHADO)
- Anti‑abuso é **normativo** e vive em Finanças (não em Eventos):
  - Limite por `Identity` e por `eventId+ticketTypeId`: default `max=1` (configurável por policy, com guardrails globais).
  - Rate limit por IP/device + janela (ex.: 10 tentativas/5 min) + cooldown progressivo em falhas.
  - Step‑up em casos suspeitos: captcha/turnstile, obrigar login, ou bloquear por 15–60 min (policy).
  - Dedupe por idempotencyKey e por `Identity+sourceId` (não existe “free checkout repetido”).
  - Audit + EventLog obrigatórios: `free_checkout.denied` com reasonCode (sem PII).
- Regra: o mesmo conjunto de guardrails aplica-se a `totalAmount==0` e a `scenario==FREE_CHECKOUT`.

D4.8 Deprecação de `Event.isFree` (anti‑desync) (FECHADO)
Regra:
- `Event.isFree` deixa de existir como “fonte de decisão”.
- A única regra de “free” é a de D4.7.
- Para UI (“evento grátis”) é sempre derivado:
  - `derivedIsFree = (min(TicketType.price) == 0 AND não existe TicketType.price > 0)` **ou**
  - `Event.pricingMode = FREE_ONLY` (flag explícita, se precisares)
- Qualquer gating (checkout/login/anti‑abuso) **nunca** usa `Event.isFree`.

Implementação:
- Remover leituras do flag em UI/checkout.
- Se o campo ainda existir por compatibilidade, marcá-lo como deprecated e preenchê-lo apenas como read model.
- Assert em Finanças: se `totalAmount > 0` então `scenario != FREE_CHECKOUT`.

D4.9 Refunds, cancelamentos e chargebacks (FECHADO)
Cancelamento de evento:
- Ao cancelar um evento: **refund automático** para todas as compras elegíveis.
- Stripe Connect Standard:
  - o organizador paga os processing fees (quando Stripe não os devolve)
  - a ORYA devolve a sua `platformFee` (através de entrada de ledger de reversão)
- O refund é idempotente e auditável (`RefundPolicyVersion` se houver regras variáveis).

Refund manual (suporte):
- Só por casos definidos (evento cancelado, falha grave, denúncias, problema técnico confirmado).
- Não existe “refund porque faltaste”.
 
Refund parcial (FECHADO):
- `Payment=PARTIAL_REFUND` quando apenas alguns lineItems são reembolsados.
- Ledger adiciona `REFUND_GROSS` + reversões aplicáveis **por item** (append-only; pode haver múltiplos parciais).
- Em `sourceType=TICKET_ORDER`, revoga apenas os entitlements dos itens refundados (resto mantém ACTIVE).

Chargeback / dispute:
- Evento Stripe `dispute.created` → `Payment` entra em estado de disputa e:
  - Entitlements associados → `SUSPENDED` (bloqueia entrada) até resolução
- Resolução:
  - `dispute.won` → `Payment=CHARGEBACK_WON` + reactivar entitlements (se ainda fizer sentido temporalmente)
  - `dispute.lost` → `Payment=CHARGEBACK_LOST` + `Entitlement=REVOKED` + ledger com `CHARGEBACK_*` (e `DISPUTE_FEE` se aplicável)
- Fee de disputa (FECHADO):
  - `DISPUTE_FEE` é debitado à organização por defeito.
  - Se o processor reembolsar a fee num `CHARGEBACK_WON`, criar `DISPUTE_FEE_REVERSAL` (positivo).
- `Ticket.status=DISPUTED` entra em `dispute.created` (ou `charge.dispute.created`) e bloqueia entrada.
- `dispute.won` → volta a `ACTIVE` (se não houver refund/chargeback aplicado).
- `dispute.lost` → `CHARGEBACK_LOST` (estado final canónico).

⸻



D5) RBAC mínimo viável + Role Packs

Introduzir já: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE
Com mapa fixo para roles/scopes (Secção 11).

D5.1) Resolução de organização é determinística
	•	Em B2B, organizationId vem da rota (/org/:orgId/...) como fonte primária.
	•	Cookie pode existir apenas como conveniência (redirect inicial), não como base de autorização.
	•	RBAC avalia sempre com orgId explícito.
	•	Qualquer fallback (cookie/lastUsedAt) é permitido apenas para redirect/UI. Nunca para autorização.
	•	Alias legado (compatibilidade): /organizacao/* → redirect 301 para /org/:orgId/* (apenas UI).


D6) Notificações como serviço (com logs e opt-in)

Templates, consentimento RGPD, logs de delivery, outbox e preferências.

D7) sourceType canónico (Finanças/ledger/check-in)

Todos os checkouts e entitlements usam sourceType canónico e unificado (Secção 7).

D8) EventAccessPolicy (acesso + convites + identidade + claim entitlements) — definição final

> **FECHADO (SSOT):** `EventAccessPolicy` é a única fonte de verdade para:
> 1) modo de acesso (public/invite/unlisted), 2) checkout como convidado, 3) convites por token, 4) compatibilidade de identidade, e 5) check‑in (ver Secção 8).

D8.1) EventAccessPolicy é a única verdade de acesso (FECHADO)
- Substitui qualquer combo de flags legacy (`public_access_mode`, `invite_only`, etc.).
- Modelo canónico (mínimo):
  - `mode: PUBLIC | INVITE_ONLY | UNLISTED`
  - `guestCheckoutAllowed: boolean`
  - `inviteTokenAllowed: boolean`
  - `inviteIdentityMatch: EMAIL | USERNAME | BOTH`
  - `inviteTokenTTL: duration` (obrigatório se `inviteTokenAllowed=true`)
  - `checkin: { requiresEntitlementForEntry, methods[...] }` (ver Secção 8)
- **Sem fallback** entre campos. Migração/backfill obrigatório no write‑path (não na leitura).

D8.2) Convites por token (guest checkout) — versão final (FECHADO)

Convites permitem checkout como convidado via token. Login não é obrigatório, mas é incentivado.

Regras fechadas
1) InviteToken one‑time + expira
- guardar `tokenHash` (nunca token em claro)
- `expiresAt` (ex.: 7 dias; ou conforme `inviteTokenTTL`)
- `usedAt` + `usedByIdentityId`

2) Match obrigatório de identidade
- o token fica associado a `emailNormalizado` (e opcionalmente username, se usares BOTH)
- no checkout guest, o email tem de bater certo (case‑insensitive, normalizado)

3) Scope do token
- token é válido só para 1 evento e (opcional) 1 `ticketTypeId` (controlo fino)

4) Rate limit + anti‑enumeração
- limitar tentativas por IP/device
- respostas indistinguíveis (“token inválido” sem detalhes)

5) Entitlement final (SSOT) + claim posterior (FECHADO)
- compra gera `Entitlement` com `ownerIdentityId = Identity(GUEST_EMAIL)`
- quando o user criar conta e verificar o mesmo email → claim automático (Secção 7.7)
- **Propriedade do acesso nunca é OR entre campos.** Resolver sempre via `Entitlement.ownerIdentityId`.

6) Eventos VIP (login obrigatório)
- Para eventos que exijam login: `guestCheckoutAllowed=false` e `mode=INVITE_ONLY` (sem exceções).

UX recomendada
- Página de convite: “Aceitar convite” → pede nome + email (pré‑preenchido se possível)
- Pós‑compra: “Criar conta para guardar bilhetes e entrar mais rápido” (1 clique)

⸻

D8.3 Imutabilidade temporal (depois de haver vendas) (FECHADO)
- `EventAccessPolicy` é versionada (`policyVersion`) e cada alteração cria **nova versão** (append‑only; sem editar retroativamente).
- **Lock após a primeira venda/entitlement**: quando existir qualquer `Payment.status=SUCCEEDED` ou qualquer `Entitlement` emitido para o evento:
  - Campos **bloqueados** (não podem tornar-se mais restritivos nem mudar de semântica): `mode`, `guestCheckoutAllowed`, `inviteTokenAllowed`, `inviteIdentityMatch`, `requiresEntitlementForEntry`.
  - Permitido apenas:
    - **Relaxar** regras (ex.: INVITE_ONLY → UNLISTED/PUBLIC) se não quebrar direitos já emitidos.
    - Ajustar `inviteTokenTTL` apenas para **novos** convites (tokens já emitidos mantêm o seu `expiresAt`).
    - **Adicionar** métodos de check‑in (nunca remover) para compatibilidade operacional.
    - Reentrada/undo só podem **relaxar**:
      – `checkin.allowReentry`: apenas `false → true`
      – `maxEntries`, `reentryWindowMinutes`, `undoWindowMinutes`: apenas aumentar
- Snapshot aplicado:
  - `Entitlement.policyVersionApplied` passa a **obrigatório** para `sourceType=TICKET_ORDER|PADEL_REGISTRATION|BOOKING` quando associado a um evento.
  - Check-in valida por defeito contra `policyVersionApplied` armazenado no Entitlement. A policy corrente só pode relaxar regras ou adicionar métodos; nunca pode apertar constraints após emissão.




D9) Merchant of Record + fiscalidade (decisão “top”)
	•	MoR por defeito é a Organização (Connected Account)
	•	Organização é responsável por IVA / fatura ao consumidor final
	•	ORYA cobra fee de plataforma e emite fatura B2B da fee à Organização (ou documento equivalente)
	•	Excepção futura (enterprise): ORYA como MoR só por contrato/config explícita (fora v1.x)


D9.1) Faturação “não obrigatória” (posição v3) — sem risco para a ORYA

Regra:
	•	ORYA não obriga a emitir fatura dentro da ORYA.
	•	ORYA obriga SEMPRE a:
		•	registo de movimentos (ledger + exports)
		•	exports (CSV/PDF) por período
		•	configuração explícita: “Como esta organização emite faturação?”
		•	“0€ tickets” não podem existir “por acidente”.
		•	Anti-abuso é central em Finanças (rate limits, 1 por user por event, etc.).

Config “Emissão de faturação” (OrganizationSettings):
	•	Software externo (recomendado) — campo para “nome do software” + notas
	•	Manual / fora da ORYA — checklist de responsabilidade + confirmação
	•	(mais tarde) Integrações opcionais PT (Fase 2) para facilitar, não para obrigar

Objetivo:
	•	ser tooling de gestão, não “motor de incumprimento”
	•	proteger ORYA legalmente sem matar adoção

Acesso e Convites (obrigatório v1)
	•	O evento define EventAccessPolicy.
	•	Convites são regidos por policy + EventInvite (ou equivalente).
	•	Checkout e página pública respeitam apenas a policy canónica.
	•	UI deve reflectir exactamente as regras (sem “promessas”).

	Acesso Público — Deprecação de campos legacy (sem fallback)

Regra:
	•	EventAccessPolicy é a única fonte de verdade.
	•	Campos legacy (ex.: inviteOnly / publicAccessMode / publicTicketTypeIds) ficam READ-ONLY (deprecated) e deixam de ser lidos por UI/API.
	•	Se existir payload antigo, converte-se para EventAccessPolicy na escrita (write-path), nunca na leitura (read-path).

Migração:
	1) Backfill único: para cada Event, gerar EventAccessPolicy canónica.
	2) Toggle de rollout:
		•	Fase A: ler ambos, mas COMPARAR e alertar se divergirem (sem mudar UX).
		•	Fase B: UI/API lê apenas policy canónica; legacy só para export/debug.
		•	Fase C: remover fallback e remover campos legacy do schema.

Guardrail:
	•	Architecture test falha se algum módulo importar/ler os campos legacy.


D9.2) Padrões UX Globais (B2B) — para sentir “premium” em todas as ferramentas

A) Unified Search (top bar)
Uma barra de pesquisa global que aceita:
	•	ID (bookingId, paymentId, entitlementId, registrationId)
	•	email / nome (cliente)
	•	evento/torneio
E retorna resultados agrupados por tipo com ações rápidas.

B) Context Drawer (painel lateral universal)
Ao clicar em qualquer entidade (booking/payment/user/match):
	•	abre drawer lateral com:
		•	resumo
		•	ações rápidas (permitidas por RBAC)
		•	links cruzados (Finanças ↔ Reservas ↔ CRM ↔ Check-in ↔ Padel)
		•	audit log da entidade
		•	eventos relevantes do EventLog (timeline curta)
Objetivo: “não navegar por 8 páginas para resolver 1 problema”.

C) Command Palette (⌘K)
Ações instantâneas:
	•	Criar torneio / Criar evento / Criar bloqueio
	•	Mover match / Reatribuir campo
	•	Reembolsar / Abrir disputa
	•	Abrir cliente / Ver ledger
Keyboard-first onde faz sentido.

D) Operação “ops mode”
Views rápidas para staff:
	•	“Hoje” (reservas, check-ins, pendentes split-payment, alertas)
	•	“Agora” (o que está a decorrer)
	•	“Pendentes críticos” (pagamentos falhados, disputas, no-shows)
Tudo com filtros por filial/unidade.

E) Estados e feedback consistentes
Todos os módulos usam os mesmos estados:
	•	loading / empty / error / success
	•	toasts consistentes + logs (para suporte)	

D10) Jobs/Queues + Outbox (motor enterprise sem overkill) — definição final

> **FECHADO:** Tudo o que é assíncrono, re‑tentável, ou depende de webhooks externos passa por Jobs/Queues.  
> A entrega de eventos internos é garantida por Outbox + idempotência (evita “eventos perdidos”).

D10.1 Jobs/Queues (obrigatório)
- Sistema de jobs com:
  - queue, retries, backoff, e DLQ
  - prioridades (ex.: pagamentos/entitlements > notificações)
  - dedupe por `idempotencyKey`
- Tudo assíncrono passa por jobs:
  - notificações, exports, ingest CRM, sync Stripe, indexação/search
  - replays do EventLog, reminders (ex.: split payment T‑48/36/24), reconciliations
- Estado efémero com TTL (holds, locks, rate‑limits) vive em Redis; DB guarda apenas estado final/auditável.

D10.2 Outbox (obrigatório)
- Padrão:
  - Dentro da mesma transação DB que altera estado, escrever `OutboxEvent` (append‑only).
  - Worker lê Outbox e publica para:
    - Job queue (SQS) / consumidores internos
    - EventBus (quando existir)
- Campos mínimos:
  - `eventId` (UUID), `eventType`, `payload`, `createdAt`, `publishedAt`, `attempts`, `nextAttemptAt`
  - `causationId` / `correlationId`
- Garantias:
  - pelo menos uma vez (at‑least‑once) + consumidores idempotentes
  - sem “eventos perdidos” mesmo com crash entre write e publish

D10.3 EventBus na AWS — introdução faseada (sem overkill)
Fase 1:
- EventLog + Outbox + consumers no worker + SQS para jobs críticos
- simplicidade e custo baixo
- **Higienização:** remover legacy (tabelas/colunas/flags antigas), sem fallback; só fica o modelo final do blueprint.

Fase 2/3 (fan‑out real / múltiplos serviços):
- Introduzir EventBridge para routing serverless
- Regras/targets por tipo de evento
- Mantém EventLog como trilho e base de auditoria

⸻


D11) Moradas — Address Service (SSOT) + provider Apple-first com fallback

> **FECHADO (SSOT):** Todos os módulos consomem e escrevem moradas **apenas** via Address Service. Nunca há “moradas por módulo”.

Regra
- Todos os módulos (Eventos / Reservas / Loja / Serviços / Padel) consomem e escrevem moradas APENAS via Address Service (SSOT).
- O SSOT guarda SEMPRE:
  - `addressId`
  - `formattedAddress` (para UI)
  - `canonical` (estruturado: `countryCode` ISO‑3166‑1, region, locality, postalCode, street, number, etc.)
  - `geo` (lat, lng)
  - `sourceProvider` (ex.: `APPLE_MAPS` / `OSM_PHOTON` / `OSM_NOMINATIM`)
  - `sourceProviderPlaceId` (quando existir)
  - `confidenceScore` + `validationStatus` (`RAW | NORMALIZED | VERIFIED`)
- Nunca há “moradas locais” por módulo. Só referências a `addressId`.

Provider (decisão v9)
- **Primário (qualidade):** Apple Maps (autocomplete + geocode) via server token.
- **Fallback (custo zero):** Photon (autocomplete) + Nominatim (geocode/reverse), com cache agressivo.
- Regra: o client **nunca** chama providers diretamente; tudo passa por Address Service (protege keys, rate limits e consistência).

Proteções (obrigatório)
- Rate limiting por IP/user/org + quotas por módulo (para não estourar limites Apple).
- Cache em 2 níveis:
  - Redis (TTL curto) por query (autocomplete) e por placeId/geo (geocode)
  - cache persistente por `addressId` (TTL longo) e dedupe por canonical+geo
- Circuit breaker por provider:
  - se Apple falhar acima de `errorRateThreshold` (ex.: 20% em 2 min) → **fallback automático** para OSM por `cooldownMinutes` (ex.: 10)
  - durante cooldown, re-test Apple em background (probe) e só volta quando estabilizar
- Quotas “hard” por organização e por módulo:
  - ao exceder quota → degrade gracioso (só `resolvePlace` por placeId já em cache; sem autocomplete novo)
  - emitir `ops.alert` com orgId + módulo + métrica de consumo

Implementação (o que fazer)
1) AddressNormalizeJob
- Quando Address Service recebe input manual/autocomplete:
  - parse + normaliza (libpostal + regras internas)
  - geocode (Apple ou fallback)
  - grava `canonical+geo+confidence`

2) Deduplication
- Se canonical+geo (arredondado) coincidir, reusa `addressId` existente (evita duplicados).

3) UI (front)
- Autocomplete sempre passa por Address Service.
- Front recebe sugestões normalizadas + “confidence”.

⸻



D12) Split Payment Padel — regra default (48/24) + resolução determinística

Objetivo: proteger a organização de buracos operacionais e dar saídas dignas ao utilizador.

Regra base:
	•	inscrição em dupla só fica CONFIRMED quando ambos pagam
	•	existe estado pendente até T-24h do início do torneio
	•	matchmaking (open matchmaking pool) só opera na janela T-48h → T-24h

Estados canónicos (PadelRegistration):
	•	PENDING_PARTNER (falta parceiro / convite ainda não aceite)
	•	PENDING_PAYMENT (parceiro definido, falta pagamento)
	•	MATCHMAKING (entrou no pool, aguardando emparelhamento)
	•	CONFIRMED (dupla paga, vaga garantida)
	•	EXPIRED (não regularizado até T-24h)
	•	CANCELLED (ação explícita do utilizador/admin)
	•	REFUNDED (quando aplicável, com policy versionada)

Ações permitidas por janela temporal (contrato + UX):
	1)	Antes de T-48h:
		•	convidar, trocar parceiro
		•	pagar ambos (captain pays / pay both)
		•	entrar em matchmaking (opcional)
	2)	T-48h → T-24h:
		•	matchmaking ON
		•	troca de parceiro ON (com regras)
		•	pagar ambos ON
		•	sair do matchmaking ON
	3)	Depois de T-24h:
		•	ou CONFIRMED ou EXPIRED (determinístico)

Parceiro sem conta:
	•	parceiro pode ser só por email
	•	o pedido de pagamento fica associado ao email
	•	quando o utilizador cria conta com esse email, vê o pagamento pendente e consegue concluir

Reminders (Jobs):
	•	T-48h (entra janela matchmaking)
	•	T-36h (pendente)
	•	T-24h (última chamada + lock/resolve)
	•	T-23h (estado final + próximos passos)

Resolução aos T-24h:
	•	se não estiver CONFIRMED:
		•	inscrição → EXPIRED
		•	vaga libertada
		•	reembolso automático do que tiver sido pago (menos taxa de reembolso), segundo RefundPolicyVersion

Refund fee:
	•	definida como policy object versionado (RefundPolicyVersion) e auditável
	•	sempre exibida ao utilizador antes de confirmar a inscrição (transparência)

Auditoria:
	•	todas as mudanças de estado e ações críticas geram EventLog + Audit trail.

D12.5) Ops — Prisma env auto-load (FECHADO)
	•	DONE: Prisma CLI lê variáveis automaticamente do `.env` (root) sem `set -a`, `source` ou inline envs.
	•	Nota operacional: DATABASE_URL via pooler (6543) + DIRECT_URL direto (5432) e ambos com `sslmode=require`.

D13) Loyalty Points (pontos) — semi-normalizado + guardrails globais
	•	sem wallet monetária nesta fase
	•	pontos por organização (e opcional por sub-organização)
	•	taxa semi-normalizada: 100 pontos ≈ 1€ de “valor percebido” (config global)
	•	guardrails globais (caps e ranges) para evitar discrepâncias abusivas
	•	Implementação (v9):
		–	state change → outbox → worker idempotente (events: LOYALTY_EARNED / LOYALTY_SPENT)
		–	payload mínimo: { ledgerId }
		–	idempotencyKey: eventId (único por ledgerId+eventType)
		–	guardrails globais: pontos/regra 1–5000; max/dia 20000; max/user 200000; custo reward 100–500000

D14) Multi-Organizações (empresa mãe → filiais)
	•	OrganizationGroup (mãe) agrega Organizations (filiais)
	•	RBAC suporta: permissões na mãe, permissões por filial, e papéis herdáveis/limitados (Secção 11)

D15) Macro + Micro Analytics (obrigatório)
	•	relatórios financeiros e operacionais com drill-down por dimensões
	•	sempre derivados do Ledger + dimensões (sem duplicar estado “financeiro” fora de Finanças)

D16) Ops Feed (Activity Feed) é first-class
	•	eventos operacionais são publicados no EventBus e gravados no EventLog
	•	um consumer gera Activity Feed + posts automáticos no canal “Ops” do chat interno

⸻

D17) Integrações Apple — roadmap e guardrails (sem custos extra)

Objetivo
	•	Integrar profundamente com o ecossistema Apple (UX + distribuição), MAS sem criar dependências pagas fora do Apple Developer Program.

V1 (fazer já)
	•	Sign in with Apple (OAuth/OpenID) como método suportado (e obrigatório em iOS se existirem logins de terceiros).
	•	APNs para push nativo iOS (token-based auth).
	•	Deep links universal links (para eventos / bilhetes / perfil público).
	•	Share sheets iOS (partilha de links do perfil público e eventos).

V1.5 (quando Tickets estiver sólido — ainda **online**) 
	•	Apple Wallet / PassKit para bilhetes:
		–	O passe pode carregar um QR que resolve para `EntitlementQrToken` (lookup online por `tokenHash`).
		–	Updates do passe (mudança de owner, cancelamento, horário, venue) via Jobs.
		–	Revogação/suspensão via Jobs (disputes/chargebacks) e reflectida no passe.

**Offline signed QR  — FECHADO como Fase 3:**
	•	A validação offline (assinatura criptográfica local) requer:
		–	payload versionado e assinado
		–	gestão de chaves (public keys + rotação)
		–	lista de revogação/suspensão sincronizada por job
		–	política explícita de fallback para online

V2 (só se fizer sentido e sem custo extra)
	•	App Clips para “entrada rápida” em eventos:
		–	check-in / wallet add / compra rápida (Apple Pay)
		–	ativação por QR/NFC no recinto
	•	MapKit / Apple Maps:
		–	alinha com D11: Apple é o provider primário no Address Service; OSM (Photon/Nominatim) é o fallback.
		–	se houver limites/termos que afectem o autocomplete, o Address Service aplica rate limits, cache e fallback automático.

Key management
	•	Certificados/keys Apple (APNs, Pass Type ID) vivem em AWS Secrets Manager + rotação.
	•	Build e signing automatizado em CI com permissões mínimas.


5) Mapa de Domínio (owners + integrações)

> Nota: este mapa lista as entidades **mínimas e normativas** para execução; não é exaustivo. Entidades adicionais podem existir, desde que respeitem os owners e contratos.

Entidades core (owner):

Reservas
	•	CalendarResource, ReservationResource, ReservationProfessional
	•	Booking, Availability, CalendarBlock/Override, Service
	•	(fase 2) Waitlist, RecurringRule, OpenMatch

Eventos
	•	Event, Session (se aplicável)
	•	TicketType, TicketOrder
	•	(fase 2) EventSeries

Padel Torneios
	•	Tournament, PadelRegistration, Match, Bracket/Standings, MatchState
	•	TournamentRuleSetVersion (novo)
	•	TournamentFormatTemplate (novo)

Finanças
	•	Payment, LedgerEntry, Refund, RefundPolicyVersion, Invoice, Payout
	•	FeePolicy + FeePolicyVersionSnapshot
	•	(fase 2) Subscription, MembershipPlan (via Stripe Billing)

Check-in
	•	Entitlement, EntitlementQrToken, EntitlementCheckin
	•	ScannerDevice (fase 2)
	•	AccessIntegration (fase 3: portas/catracas)

CRM
	•	CustomerProfile, Consent, TimelineEvent, Segments
	•	(fase 2) Lead, Campaign, Automation

Equipa
	•	OrganizationMember, OrganizationMemberPermission, OrganizationAuditLog
	•	RolePack, CustomRole (fase 2)


Promoções
	•	Promotion, PromoCode, PromoPolicyVersion, Redemption

Notificações
	•	NotificationTemplate, NotificationPreference, NotificationDeliveryLog, NotificationOutbox

Perfil Público / Username
	•	UsernameRegistry, OrgPublicProfileLayout

Pesquisa & Discovery
	•	SearchIndexItem (read model), SearchIndexJob
Infra transversal
	•	EventLog, IdempotencyKey (padrão)
	•	Job, JobAttempt, DLQ (novo)

Address Service
	•	Address (canónico), Place (opcional), GeoPoint

Loyalty
	•	LoyaltyPolicy, LoyaltyPointLedgerEntry, RewardCatalog

Multi-org
	•	OrganizationGroup, OrganizationGroupMember (opcional)

Analytics (derivado)
	•	AnalyticsMaterializedView (opcional, derivado)
	•	“fact tables” geradas por job (opcional; não owner)

⸻

6) Contratos de Integração v3.0 (mínimos obrigatórios)

Regra: módulos verticais consomem horizontais via contratos. Contratos são tratados como APIs internas versionadas.

---

## Contract Execution Rules (GLOBAL, NORMATIVE)

This section defines the execution and compatibility rules that apply
to all internal and external contracts (C1–C9 and future additions).

These rules are mandatory and override local implementation preferences.

---

### C-G1 — Explicit Contract Ownership
Every contract MUST define:
- a single owning team or domain
- one or more known consumers

The owner is responsible for compatibility, versioning, and lifecycle.

---

### C-G2 — Contract Versioning
Contracts use semantic versioning:

- MAJOR: breaking change
- MINOR: backward-compatible additive change
- PATCH: non-behavioral clarification or bug fix

Version is explicit and never inferred.

---

### C-G3 — Backward Compatibility Is Mandatory
Consumers MUST:
- tolerate unknown fields
- not rely on field ordering
- not assume default values unless explicitly documented

Producers MUST NOT:
- remove fields in minor versions
- change field meaning without a major version

---

### C-G4 — Idempotency Semantics
If a contract triggers side effects, it MUST define:
- the idempotency key
- retry behavior
- duplicate handling guarantees

Idempotency applies across retries, crashes, and network failures.

---

### C-G5 — Error Envelope Standard
All contracts MUST use a consistent error structure containing:
- errorCode (stable, machine-readable)
- message (human-readable)
- retryable (boolean)
- correlationId

Errors without classification are forbidden.

---

### C-G6 — Time and Ordering Assumptions
Contracts MUST NOT assume:
- in-order delivery
- single delivery
- synchronized clocks

If ordering matters, the contract MUST explicitly define ordering keys
or reconciliation logic.

---

### C-G7 — Observability Obligations
Each contract MUST emit:
- success/failure metrics
- latency metrics (p50, p95)
- structured logs with correlationId

Silent failure is forbidden.

---

### C-G8 — Compatibility Testing
Any contract change MUST include:
- backward compatibility tests
- replay of at least one historical payload
- explicit validation of idempotency behavior

---

### C-G9 — Documentation Is Executable
Each contract MUST include:
- example payloads
- example error cases
- explicit state transitions (if applicable)

Ambiguous contracts are considered incomplete.

---


C1) Reservas ↔ Padel (agenda e slots)

Padel cria slots/bloqueios via contrato; Reservas responde com conflitos/sugestões.

Representação canónica de MatchSlot
	•	CalendarBlock/Override: kind=BLOCK, reason=MATCH_SLOT, resourceId=courtId, start/end
	•	Padel nunca escreve no calendário diretamente

Resposta do contrato
	•	conflitos hard detectados
	•	sugestões de horários alternativos (Fase 1)
	•	optimização/yield (Fase 3)


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C1  
**Contract Name:** Reservas ↔ Padel (agenda e slots)  
**Current Version:** v3.0.0  
**Owner:** Domain: Reservas (Agenda Engine)  
**Primary Consumers:** Padel (Torneios), ORYA-WebApp (org dashboard), internal workers

---

#### Purpose
Define a interface canónica para criação/atualização de slots/bloqueios na agenda a partir do domínio Padel, com deteção de conflitos.

---

#### Idempotency
- **Idempotency Key:** idempotencyKey
- **Scope:** per orgId + sourceType/sourceId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "orgId": "org_123",
  "resourceId": "court_45",
  "startAt": "2026-02-01T10:00:00Z",
  "endAt": "2026-02-01T11:30:00Z",
  "reason": "MATCH_SLOT",
  "sourceType": "PADEL_MATCH",
  "sourceId": "match_789",
  "idempotencyKey": "slot:match_789"
}
```

#### Output / Response (Example)
```json
{
  "accepted": true,
  "conflicts": [],
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "SCHEDULE_CONFLICT",
  "message": "Requested slot conflicts with an existing block",
  "retryable": false,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
startAt

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
N/A
C2) Finanças ↔ Todos (checkout/refunds) — gateway único

Todos criam checkout via Finanças; estado pago/refund/chargeback/payout vem sempre de Finanças.



Obrigatório:
	•	organizationId
	•	sourceType (canónico)
	•	sourceId
	•	amount, currency
	•	customerIdentityId (Identity SSOT)
	•	idempotencyKey
	•	feePolicyVersion
	• pricingSnapshotJson (imutável) no Payment + pricingSnapshotHash
	• Conteúdo mínimo do snapshot: feeMode, feeBps, feeFixed, currency, totals (gross/discounts/taxes/platformFee/total/netToOrgPending)
	•	Processor fees: `processorFeesStatus=PENDING|FINAL` + `processorFeesActual` (nullable até reconciliação Stripe).
	• O snapshot é congelado no createCheckout e nunca muda após CREATED.
	• feePolicyVersion continua obrigatório e referencia a política usada para gerar o snapshot.

C2.1) Eventos ↔ Finanças (convites) — resolução determinística
• Objetivo: evitar UI/backend drift em convites e tornar o checkout por convite 100% contratual.
• Entrada: { eventId, inviteToken?, email?, username? }
• Saída: { allowCheckout, constraints: { guestCheckoutAllowed, inviteIdentityMatch, ticketTypeScope? }, resolvedIdentity }
• Regra: Eventos define a policy e Finanças valida/impõe as constraints no createCheckout.



---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C2  
**Contract Name:** Finanças ↔ Todos (checkout/refunds) — gateway único  
**Current Version:** v3.0.0  
**Owner:** Domain: Finanças  
**Primary Consumers:** Events, Reservations, Padel, Store, ORYA-WebApp, internal workers

---

#### Purpose
Define o gateway único para criar checkouts e refunds, garantindo Payment state machine e ledger determinístico.

---

#### Idempotency
- **Idempotency Key:** idempotencyKey
- **Scope:** per orgId + sourceType + sourceId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "orgId": "org_123",
  "sourceType": "TICKET_ORDER",
  "sourceId": "to_456",
  "amount": 5000,
  "currency": "EUR",
  "customerIdentityId": "id_789",
  "idempotencyKey": "checkout:to_456"
}
```

#### Output / Response (Example)
```json
{
  "paymentId": "pay_123",
  "status": "CREATED",
  "clientSecret": "secret_abc",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "FINANCE_CONNECT_NOT_READY",
  "message": "Organization Connect account is not ready",
  "retryable": false,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☑ ledger entries
☐ entitlement issuance
☐ emails / notifications
☑ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Entitlements são emitidos apenas após Payment SUCCEEDED e reconciliação do ledger.
C3) Check-in ↔ Eventos/Reservas/Padel — via Entitlement unificado

Check-in valida QR e resolve origem:
	•	ticket (Eventos) ou booking (Reservas) ou inscrição Padel (Padel)

E grava:
	•	EntitlementCheckin + EventLog(checkin.*) + presença/no-show conforme política


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C3  
**Contract Name:** Check-in ↔ Eventos/Reservas/Padel — via Entitlement unificado  
**Current Version:** v3.0.0  
**Owner:** Domain: Check-in  
**Primary Consumers:** Events, Reservations, Padel, ORYA-WebApp, Scanner API

---

#### Purpose
Define a validação de acesso via Entitlement e o registo de consumo (check-in).

---

#### Idempotency
- **Idempotency Key:** entitlementId + scannerId + timeWindow
- **Scope:** per entitlement + scanner
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "qrPayload": "token_hash",
  "scannerIdentityId": "id_staff",
  "eventId": "evt_123",
  "deviceId": "dev_001",
  "idempotencyKey": "scan:ent_456:dev_001:2026-02-01T10:00Z"
}
```

#### Output / Response (Example)
```json
{
  "allow": true,
  "entitlementId": "ent_456",
  "consumedAt": "2026-02-01T10:00:05Z",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "ENTITLEMENT_NOT_ACTIVE",
  "message": "Entitlement is not active or already consumed",
  "retryable": false,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Consumo é metadata (consumedAt), nunca estado.
C4) CRM ↔ Todos (timeline)

CRM recebe eventos a partir do EventLog (não ponto-a-ponto).


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C4  
**Contract Name:** CRM ↔ Todos (timeline)  
**Current Version:** v3.0.0  
**Owner:** Domain: CRM  
**Primary Consumers:** EventLog consumers, ORYA-WebApp, internal workers

---

#### Purpose
Define a ingestão de eventos para timeline e segmentação CRM.

---

#### Idempotency
- **Idempotency Key:** eventId
- **Scope:** global
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "eventId": "evtlog_123",
  "eventType": "BOOKING_CONFIRMED",
  "orgId": "org_123",
  "identityId": "id_456",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "status": "INGESTED",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "EVENTLOG_NOT_FOUND",
  "message": "No event found for the given eventId",
  "retryable": true,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Ingestão é idempotente e tolera replays.
C5) Notificações ↔ Todos

Triggers por eventos do sistema + templates + opt-in + logs.


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C5  
**Contract Name:** Notificações ↔ Todos  
**Current Version:** v3.0.0  
**Owner:** Domain: Notificações  
**Primary Consumers:** Events, Finance, CRM, Padel, ORYA-WebApp, internal workers

---

#### Purpose
Define o disparo e entrega de notificações (in-app/push) a partir de eventos do sistema.

---

#### Idempotency
- **Idempotency Key:** sourceEventId
- **Scope:** per identity + eventId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "eventId": "evtlog_123",
  "eventType": "payment.succeeded",
  "orgId": "org_123",
  "identityId": "id_456",
  "channel": "PUSH",
  "templateKey": "PAYMENT_SUCCEEDED",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "status": "QUEUED",
  "notificationId": "notif_789",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "PUSH_TOKEN_NOT_FOUND",
  "message": "No push token available for identity",
  "retryable": false,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☑ emails / notifications
☑ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Envio real ocorre apenas via consumer idempotente.
C6) Inscrições Padel vs Bilhetes (coexistência simples e eficaz)
	•	inscrição Padel é competitiva (Padel)
	•	bilhete é acesso/presença (Eventos)
	•	pagamentos sempre via Finanças

Regras:
	1.	Padel nunca cria bilhetes; Eventos nunca cria inscrições
	2.	inscrição Padel referencia eventId
	3.	pago vem de Finanças
	4.	check-in aceita ticket/booking/inscrição conforme policy do evento


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C6  
**Contract Name:** Inscrições Padel vs Bilhetes (coexistência simples e eficaz)  
**Current Version:** v3.0.0  
**Owner:** Domain: Padel (Torneios)  
**Primary Consumers:** Events, Finance, Check-in, ORYA-WebApp

---

#### Purpose
Define a coexistência entre inscrições Padel e bilhetes, mantendo pagamentos e check-in canónicos.

---

#### Idempotency
- **Idempotency Key:** idempotencyKey
- **Scope:** per padelRegistrationId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "padelRegistrationId": "reg_123",
  "eventId": "evt_456",
  "paymentId": "pay_789",
  "sourceType": "PADEL_REGISTRATION",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "status": "LINKED",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "PAYMENT_NOT_SUCCEEDED",
  "message": "Payment must be SUCCEEDED before confirmation",
  "retryable": true,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Inscrição e bilhete permanecem entidades distintas; Entitlement é o acesso.
C7) Address Service ↔ Todos (moradas e localizações)
	•	criação/normalização de moradas passa pelo Address Service
	•	módulos guardam apenas addressId (ou placeId) e nunca strings “soltas” como fonte de verdade
	•	migração: adapters para eliminar “várias verdades” existentes


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C7  
**Contract Name:** Address Service ↔ Todos (moradas e localizações)  
**Current Version:** v3.0.0  
**Owner:** Domain: Address Service  
**Primary Consumers:** Events, Reservations, Store, Services, Padel, ORYA-WebApp

---

#### Purpose
Define a normalização e resolução de moradas via Address Service (SSOT).

---

#### Idempotency
- **Idempotency Key:** placeId
- **Scope:** per placeId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "placeId": "apple:place_123",
  "label": "Club ORYA, Lisboa",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "addressId": "addr_123",
  "formattedAddress": "Rua X, Lisboa",
  "geo": {"lat": 38.72, "lng": -9.14},
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "ADDRESS_NOT_RESOLVED",
  "message": "Unable to resolve placeId",
  "retryable": true,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Deduplicação por canonical+geo evita duplicados.
C8) Loyalty ↔ CRM/Finanças/Promoções
	•	pontos gerados por eventos (compra, presença, actividade)
	•	redemptions obedecem a guardrails globais + política da organização
	•	pontos não alteram ledger financeiro (não é dinheiro) — mas podem gerar descontos via Promoções


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C8  
**Contract Name:** Loyalty ↔ CRM/Finanças/Promoções  
**Current Version:** v3.0.0  
**Owner:** Domain: Loyalty  
**Primary Consumers:** CRM, Finance, Promotions, ORYA-WebApp

---

#### Purpose
Define emissão e resgate de pontos de fidelização a partir de eventos canónicos.

---

#### Idempotency
- **Idempotency Key:** eventId
- **Scope:** per identity + eventId
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "eventId": "evtlog_123",
  "eventType": "LOYALTY_EARNED",
  "orgId": "org_123",
  "identityId": "id_456",
  "points": 100,
  "sourceRef": {"sourceType": "BOOKING", "sourceId": "bk_789"},
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "status": "APPLIED",
  "balance": 1200,
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "LOYALTY_POLICY_VIOLATION",
  "message": "Points award violates policy",
  "retryable": false,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
NONE

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☐ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Pontos não alteram ledger financeiro.
C9) Activity Feed ↔ EventLog/Chat
	•	consumer do EventLog transforma eventos seleccionados em:
	•	ActivityItem (UI)
	•	mensagem automática no canal “Ops” (Chat interno)

⸻


---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C9  
**Contract Name:** Activity Feed ↔ EventLog/Chat  
**Current Version:** v3.0.0  
**Owner:** Domain: Ops Feed / Chat  
**Primary Consumers:** Ops UI, Chat interno, ORYA-WebApp

---

#### Purpose
Define a materialização do Activity Feed a partir do EventLog e a publicação no canal Ops.

---

#### Idempotency
- **Idempotency Key:** eventId
- **Scope:** global
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "eventId": "evtlog_123",
  "eventType": "payment.succeeded",
  "orgId": "org_123",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "status": "POSTED",
  "activityItemId": "act_456",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "OPS_CHANNEL_UNAVAILABLE",
  "message": "Unable to post to Ops channel",
  "retryable": true,
  "correlationId": "corr_abc"
}
```

---

#### Ordering & Duplication
This contract MUST tolerate:
- duplicate delivery
- out-of-order delivery

If ordering is required, the following key is authoritative:
createdAt

---

#### Side Effects
This contract MAY trigger:
☐ ledger entries
☐ entitlement issuance
☐ emails / notifications
☑ downstream async jobs

All side effects MUST be idempotent and observable.

---

#### Observability
This contract MUST emit:
- success/failure counters
- latency metrics (p50, p95)
- structured logs with correlationId and orgId

---

#### Compatibility Rules
- Fields may only be added as OPTIONAL in minor versions.
- Fields may only be removed or redefined in major versions.
- Consumers MUST tolerate unknown fields.

---

#### Failure Mode
On uncertainty or partial failure:
- the contract MUST fail closed
- no irreversible side effects may be committed

---

#### Notes
Consumer dedupe por eventId; replays não duplicam items.

7) Entitlements e sourceType (canónico e unificado)

> **FECHADO (SSOT):** Entitlement + Identity são a única fonte de verdade de “quem tem direito a quê”. Tickets/Bookings/Registos são *origens* (source), não “provas” de acesso.

7.1 Modelo de Identidade (FECHADO)
- `Identity` é o “dono” canónico de coisas (tickets, bookings, etc.).
- Tipos:
  - `USER` (userId)
  - `GUEST_EMAIL` (emailNormalizado + emailHash)
- Permite:
  - compras como convidado (guest checkout) quando permitido pela `EventAccessPolicy`
  - claim/merge posterior para user (quando o email for verificado)
  - RGPD delete/anonymize sem destruir ledger (ledger mantém apenas IDs/pseudónimos)

7.2 Entitlement states (FECHADO)
`PENDING | ACTIVE | REVOKED | EXPIRED | SUSPENDED`
- `PENDING`: criado mas ainda não “válido” (ex.: pagamento em processamento, hold de reserva).
- `ACTIVE`: válido para uso (entrada/consumo).
- `REVOKED`: invalidado por política (refund concluído, cancelamento, ação admin, violação).
- `EXPIRED`: passou a janela temporal (evento já ocorreu / reserva já passou / TTL).
- `SUSPENDED`: bloqueado temporariamente (chargeback, fraude, investigação, disputa).

> **Regra:** “USADO/CONSUMIDO” não é um estado. Consumo é metadata (ver 7.3) para evitar drift e conflitos.

7.3 Consumo (check‑in / presença) como metadata (FECHADO)
- Campos recomendados no Entitlement (ou em `EntitlementConsumption`):
  - `consumedAt` (nullable)
  - `consumedByIdentityId` (quem consumiu; tipicamente igual ao owner, mas pode existir “transfer/scan”)
  - `consumedByDeviceId` / `scannerId` (auditoria)
  - `consumedLocation` (opcional)
  - `consumedMethod` (`QR`, `MANUAL`, `NFC` futuro)
- Idempotência: consumo idempotente por `(entitlementId, scannerId, timeWindow)`.

7.4 Entitlement unificado (escopo)
Cobre:
- Ticket (Eventos)
- Booking (Reservas)
- Padel registration (Padel)
- Loja (fase 2: pickup/fulfillment + digital goods)

Campos mínimos (write model):
- `sourceType`, `sourceId`
- `ownerIdentityId` (**SSOT**)
- `status` (enum FECHADO)
- `validFrom`, `validUntil` (ou derivado do evento/reserva)
- `createdAt`, `updatedAt`
- `policyVersionApplied` (**obrigatório** quando `entitlement.eventId != null` e existe `EventAccessPolicy` para esse `eventId`; opcional apenas quando não há policy aplicável)

7.5 sourceType canónico (FECHADO)
Lista oficial:
- `TICKET_ORDER`
- `BOOKING`
- `PADEL_REGISTRATION`
- `STORE_ORDER`
- (fase 2) `SUBSCRIPTION`, `MEMBERSHIP`

Regra:
- Ledger e check‑in guardam apenas `sourceType` canónico.
- Não criar “sourceType por módulo” fora desta lista; se precisares, adiciona aqui com versionamento.

Separação de enums (SSOT D7):
- `FinanceSourceType` = lista acima (SSOT para Finanças/ledger/check‑in).
- `AgendaSourceType` = `EVENT`, `TOURNAMENT`, `MATCH`, `SOFT_BLOCK`, `HARD_BLOCK` (apenas agenda/check‑in).
- Normalização deve escolher o enum certo por domínio (finance vs agenda).  

7.6 Segurança de Entitlements (mínimo v1–v2)
- QR tokens nunca reversíveis (guardar **hash**, nunca token em claro) + expiração.
- `EntitlementQrToken` separado (rota de rotação/revogação).
- Endpoints de scanner com rate limit + detecção de abuso.
- Refund/chargeback/cancelamento → evento interno que move Entitlement para `REVOKED` ou `SUSPENDED` (job idempotente).
- Logs mínimos (sem PII) + auditoria forte para ações admin/scanner.

7.7 Claim automático (guest → user) (FECHADO)
Quando um utilizador cria conta e **verifica o email**:
- Job/flow idempotente:
  - encontra `Identity(GUEST_EMAIL)` daquele email
  - move (claim) todos os entitlements elegíveis para `Identity(USER)`
  - escreve `AuditLog` + `EventLog` (idempotencyKey = `emailHash+userId+batchVersion`)
- Regra: o claim nunca altera o ledger; apenas ownership lógico de acesso.

7.8 Matriz de verdade (Payment × Ticket × Entitlement) — **FECHADO**
Nota (escopo):
	•	Aplica-se a `sourceType=TICKET_ORDER` (Ticket). Para `BOOKING` e `PADEL_REGISTRATION`, substituir “Ticket” pelo registo de origem equivalente (Booking/PadelRegistration) com estados canónicos correspondentes.
Regras canónicas (evitar drift entre módulos):
	•	Payment=SUCCEEDED ⇒ Ticket=ACTIVE ⇒ Entitlement=ACTIVE
	•	Payment=REFUNDED ⇒ Ticket=REFUNDED ⇒ Entitlement=REVOKED
	•	Payment=PARTIAL_REFUND ⇒ Ticket=ACTIVE (itens refundados como REFUNDED) ⇒ Entitlement=REVOKED apenas nos itens refundados
	•	Payment=DISPUTED ⇒ Ticket=DISPUTED ⇒ Entitlement=SUSPENDED
	•	Payment=CHARGEBACK_LOST ⇒ Ticket=CHARGEBACK_LOST ⇒ Entitlement=REVOKED
	•	Payment=CHARGEBACK_WON ⇒ Ticket=ACTIVE ⇒ Entitlement=ACTIVE (se ainda fizer sentido temporalmente)
	•	Payment=FAILED/CANCELLED ⇒ Ticket não emitido (ou CANCELLED) ⇒ Entitlement não emitido

⸻


8) Check‑in (QR) — SSOT e quando NÃO usar (definição final)

> **FECHADO (SSOT):** `EventAccessPolicy` é a única fonte de verdade da política de acesso **e** de check‑in.  
> Campos legacy `Event.checkinPolicy` e `EventSessionAccessPolicyOverride (tabela futura; não é campo legado)` são **removidos** do write‑path e não podem ser usados como norma.

8.1 Onde vive (write model)
- `EventAccessPolicy` contém um bloco `checkin` (ou tabela normalizada equivalente):
  - `requiresEntitlementForEntry: boolean`

> Compatibilidade: quaisquer campos legacy/clients que ainda usem `requiresTicketForEntry` devem mapear 1:1 para `requiresEntitlementForEntry` (ticket = entitlement), até serem removidos.
  - `methods: QR_TICKET | QR_REGISTRATION | QR_BOOKING | MANUAL` (array/enum)
  - `scannerRequired: boolean` (se precisares de obrigar device)
  - `allowReentry: boolean`
  - `reentryWindowMinutes: number`
  - `maxEntries: number`
  - `undoWindowMinutes: number`
  - `policyVersion` (versão da policy)
- Se no futuro for necessário override por sessão:
  - criar `EventSessionAccessPolicyOverride` (tabela explícita)
  - **nunca** reintroduzir `EventSessionAccessPolicyOverride (tabela futura; não é campo legado)` como campo solto.

8.2 Onde é obrigatório (v9)
- Bilhetes de eventos (entrada)
- Torneios Padel (validação de inscrição / entrada, conforme regra do torneio)

8.3 Onde pode ser opcional (v9)
- Reservas de serviços (ex.: cabeleireiro) **não precisam** de QR/check‑in.
- Alternativas “simples”:
  - “Marcar como concluída” (organização)
  - “Confirmar presença” (utilizador)
- QR opcional pode existir como camada extra (fase 2), mas não é requisito do core.

8.4 Defaults recomendados (norma)
- Eventos com bilhete: `requiresEntitlementForEntry=true`, `methods=[QR_TICKET]`
- Torneios Padel:
  - se tiverem “entrada controlada”: `requiresEntitlementForEntry=true`, `methods=[QR_REGISTRATION]`
  - se não tiverem controlo de entrada: `requiresEntitlementForEntry=false` (mas mantém entitlement para histórico)
- Reservas:
  - default: `methods=[MANUAL]`
  - opcional: `methods=[QR_BOOKING]` apenas para organizações que activem “check‑in em serviços”

8.5 Regra principal (idempotência e SSOT)
- Check‑in nunca decide “tem direito” por campos do Ticket/Booking.
- Check‑in resolve sempre:
  1) `Entitlement` por QR token
 2) valida `status==ACTIVE` e janela temporal
 3) valida compatibilidade com `EventAccessPolicy.checkin` (método permitido)
 4) grava consumo (metadata) + `EventLog` + `AuditLog` (quando aplicável)

8.5.1 Contrato de consumo (mundo real) — **FECHADO v1**
- Default v1: **1 check-in por Entitlement** (consumo único).
- Um segundo scan (mesmo QR) resulta em:
  - `allow=false`
  - `reasonCode=ALREADY_CONSUMED`
  - emitir `checkin.duplicate` no Ops Feed
- **Reentrada (excepção por policy):**
  - `EventAccessPolicy.checkin.allowReentry=true`
  - `reentryWindowMinutes` (default: 15)
  - `maxEntries` (default: 1; se >1, incrementa contador e audita sempre)
- **Undo (erro humano):**
  - permitido **apenas** para roles `CHECKIN_RW` (ou superior) + motivo obrigatório
  - janela curta `undoWindowMinutes` (default: 10)
  - escreve `AuditLog` + `EventLog` (`checkin.undo`) + mantém histórico (append-only)
- A “verdade” do acesso continua a ser `Entitlement.status` + metadata (`consumedAt`, `consumedByDeviceId`, contadores).

8.5.2 Multi‑sessão / multi‑day (FECHADO v1)
- Em eventos com sessões, a regra v1 é **1 Entitlement por sessão**.
- O check‑in valida sempre contra a sessão (sessionId) ou janela temporal da sessão.
- `allowReentry/maxEntries` **não** dão acesso a sessões futuras; só controlam reentrada dentro da **mesma sessão**.

8.6 Modo “Recinto” (rede fraca) — **FECHADO**
- Scanner pode fazer prefetch de uma allow‑list (hashes) por evento/sessão com TTL curto.
- Se não houver rede:
  - valida contra allow‑list (TTL) + regista como `offline_pending_sync`
  - sincroniza assim que voltar rede e gera EventLog normalizado
- Não substitui “offline signed QR” (Fase 3). É apenas fallback operacional.

⸻


9) PRDs por Ferramenta (produto + técnico, com limites)

9.1 Eventos

Faz
	•	criar eventos, sessões, tickets/lotes, página pública base (SEO)
	•	exports
	•	comunicação pré/pós-evento via Notificações (Fase 2)
	•	waitlist (Fase 2)
	•	eventos recorrentes/séries (Fase 2)
	•	widgets incorporáveis (Fase 2)

Integra
	•	Finanças, Check-in, Promoções, CRM, Formulários, Perfil público, Pesquisa

Não faz
	•	competição, ledger, RBAC

Revenda de bilhetes (v1) — State Machine + atomicidade

Estados mínimos do Ticket:
	•	ACTIVE
	•	LISTED_FOR_RESALE
	•	TRANSFERRED (ou ACTIVE com owner actualizado)
	•	REFUNDED
	•	CHARGEBACK_LOST
	•	CANCELLED
	•	DISPUTED (hold por dispute/chargeback; entrada bloqueada até resolução)

Regra (FECHADO):
	•	Enquanto `DISPUTED`: Entitlement fica `SUSPENDED` e check-in bloqueado.

Regras:
	•	Listar revenda: Ticket.status → LISTED_FOR_RESALE + cria ResaleListing (activo)
	•	Comprar revenda (transação única):
		1)	Payment SUCCEEDED (Finanças)
		2)	Ticket.currentOwnerIdentityId actualizado (owner canónico)
		3)	Entitlements revogados do owner antigo e emitidos para o novo owner
		4)	ResaleListing fechado
	•	Se falhar em qualquer passo: rollback + estado consistente

Guardrails:
	•	Não pode haver listing activo com Ticket.status != LISTED_FOR_RESALE.
	•	Reconciliação diária (12.4.x) detecta e corrige inconsistências (listings órfãos, owners divergentes, etc.).	
	Guardrails “mundo real” (v1) — obrigatório
	A) Não revender se o ticket já teve “uso”
		•	Ticket com check-in registado (Entitlement com `consumedAt != null`) não pode ir para LISTED_FOR_RESALE.
		•	Se for multi-sessão: apenas entitlements não consumidos podem ser transferidos; caso contrário, revenda é bloqueada no v1.

	B) Lock e anti-double-sell explícito
		•	Compra de revenda usa lock transaccional: SELECT ... FOR UPDATE no Ticket e no ResaleListing.
		•	Constraint: ResaleListing tem unique(active) por ticketId (ex.: unique(ticketId) WHERE status=ACTIVE).

	C) Sem TRANSFER_PENDING no v1 (atómico ou nada)
		•	A revenda finaliza numa única transação: payment SUCCEEDED → update owner → reemitir/revogar entitlements → fechar listing.
		•	Timeouts e estados intermédios só entram numa fase futura se existir assíncrono inevitável.

	D) Regras de preço / anti-scalping (v1 simples)
		•	maxResalePrice por event/ticketType (default: preço original).
		•	resaleFeePolicyVersion congelada no Payment (mesma filosofia de feePolicyVersion).

	E) Chargebacks e refunds em revenda — **FECHADO v1 (sem bifurcações)**
		•	Chargeback/refund do comprador da revenda → marcar **Entitlements do novo owner como SUSPENDED** (imediato via job).
		•	Ticket.status → **DISPUTED** (imediato via job) e **entrada bloqueada** enquanto DISPUTED.
		•	**Regra v1:** **não existe reversão automática de owner** (evita “tribunal automático” e bugs operacionais).
		•	Resolução (v1):
			1) dispute ganha pelo comprador → reactivar entitlement (ACTIVE) + Ticket volta a ACTIVE
			2) dispute perdido → Ticket CHARGEBACK_LOST + Entitlement REVOKED
			3) refund confirmado (sem disputa) → Ticket REFUNDED + Entitlement REVOKED
		•	**Qualquer reversão de owner é apenas manual/admin** (Admin tooling + AuditLog), e só entra como “policy v2”.
		•	Integra com jobs existentes: `entitlements.suspend_on_dispute_opened` + `ticket.mark_disputed`.

	F) Cancelamento do evento
		•	Se o evento for cancelado: fechar listings activos.
		•	Refund é atribuído a quem é o owner (Entitlement/Identity) no momento do cancelamento.
		•	**Guardrail:** evento com pagamentos/participações não pode ser apagado. Só pode mudar para estado **CANCELLED** (soft‑cancel) e seguir o fluxo de refunds.

Detalhes premium v2
	•	páginas públicas com branding org, partilha, CTA claro
	•	bilhete multi-sessão (via entitlements e políticas)
	•	“chat do evento” (Fase 3): canal do evento para participantes (moderação)

⸻

9.2 Reservas

Faz
	•	agenda engine, bookings, recursos, profissionais, disponibilidade
	•	políticas: cancelamento, no-show, penalizações (configurável)
	•	janelas de reserva e preços diferenciados por segmento (via CRM+Promoções, mas suportado em regras)

	Booking Policy — snapshot obrigatório

Regra:
	•	No momento de confirmar booking, gravar snapshot imutável da política aplicada:
		–	booking.policySnapshotId (ou JSON snapshot versionado)
	•	Cálculo de cancelamento/refund/no-show usa SEMPRE o snapshot do booking.
	•	Mudar a política do serviço só afecta bookings futuros.
	
	BookingConfirmationSnapshot (obrigatório v1)
	•	No momento de CONFIRMAR a reserva, gravar snapshot imutável (JSON versionado) com:
		•	policySnapshot
		•	pricingSnapshot (base + discount + fee + tax)
		•	currency
		•	createdAt
	•	Refund/no-show e qualquer cálculo posterior usam SEMPRE este snapshot.


UX (Fase 1) — obrigatório
	•	calendário dia/semana
	•	drag & drop com RBAC + auditoria
	•	camadas/filters: reservas, matchSlots, aulas, bloqueios
	•	overrides com logs (quem mexeu, quando, porquê)

Integrações (Fase 1)
	•	“Adicionar ao Calendário” (ICS) para utilizador
	•	links directos para Google/Outlook quando possível

Fase 2
	•	waitlist
	•	recorrência
	•	open matches
	•	multi-dia (base alojamentos)

Fase 3
	•	recomendações e optimização (yield): sugerir horários, aumentar ocupação, alocação inteligente

⸻

9.3 Padel — Clube

Faz
	•	hub operacional, KPIs, atalhos, metadados Padel
	•	visão do calendário e operação do clube

Fase 2/3
	•	conteúdo/comunidade local (news do clube)
	•	integrações federações (opcional, fase tardia)

⸻

9.4 Padel — Torneios

Faz (MVP forte)
	•	wizard, inscrições, formatos, geração
	•	live ops, bracket/standings, widgets
	•	integração obrigatória com Event (D1)
	•	matchSlots em Reservas (D3/D3.1)

Formatos suportados
	•	MVP/Fase 1: eliminação simples, grupos+eliminação, round-robin
	•	Fase 2: double elimination, suíço
	•	Fase 3: ligas por equipas/interclubes

RuleSet versionado (novo)
	•	TournamentRuleSetVersion congela regras por torneio
	•	alterações criam nova versão (com validações e auditoria)
	•	evita “torneio rebenta a meio”

Split payment + parceiro sem conta (definitivo v3: 48/24)

Princípios:
	•	dupla só confirma quando ambos pagam
	•	pendente até T-24h
	•	matchmaking opera apenas em T-48h → T-24h
	•	sem buracos para a organização: sempre há resolução determinística aos T-24h

Fluxo (UX):
	1)	Jogador A cria inscrição e escolhe:
		•	Convidar parceiro (email / conta)
		•	Entrar em matchmaking (apenas recomendado a partir de T-48h)
	2)	Se parceiro for por email:
		•	email com link + CTA claro
		•	pagamento fica “pendente” associado ao email
		•	ao criar conta com esse email, a cobrança aparece automaticamente
	3)	Até T-24h, A tem sempre 3 saídas:
		•	Trocar parceiro
		•	Pagar também pelo parceiro (confirmar já)
		•	Entrar/sair do matchmaking (se estiver em janela)

Estados + regras:
	•	PENDING_PARTNER / PENDING_PAYMENT / MATCHMAKING → sempre resolvidos até T-24h
	•	CONFIRMED bloqueia vaga e cria MatchSlots/planeamento com segurança
	•	EXPIRED liberta vaga e ativa refund automático (menos refund fee) quando aplicável

Matchmaking:
	•	executado por job(s) periódicos e/ou trigger baseado em eventos (inscrições pendentes)
	•	regras mínimas MVP:
		•	compatibilidade por categoria/nivel do torneio
		•	primeiro “fit” válido que garanta confirmação antes do cutoff
	•	regras futuras:
		•	match score por ELO/nivel, preferências, histórico (F2/F3)

Reminders (jobs):
	•	T-48h, T-36h, T-24h, T-23h (ver D12)

Refund fee:
	•	policy versionada e transparente no checkout
	•	nunca “surpresa” pós-expiração

Operação no dashboard (pendentes):
	•	cada inscrição pendente mostra countdown até cutoff
	•	estado canónico (PENDING/MATCHMAKING/etc.)
	•	ações rápidas (trocar parceiro / pagar ambos / forçar matchmaking / cancelar) com RBAC
	•	audit log sempre visível

Operação premium
	•	atribuição automática de campos sem conflitos
	•	UI para mover jogos manualmente (drag & drop) com:
	•	validação de conflitos em tempo real
	•	auditoria
	•	“why” (motivo da alteração)
	•	árbitros, WO, penalizações (Fase 2)
	•	estatísticas pós-evento + exports (Fase 2)
	•	live stream embed (Fase 3)

⸻

9.5 Check-in

Faz
	•	scanner QR + lista manual
	•	logs, presença/no-show, idempotência

Fase 2
	•	self check-in antifraude
	•	devices + gestão
	•	gates/integrações

⸻

9.6 Finanças

Faz
	•	checkout, fees ORYA, ledger, refunds/chargebacks, invoices, payouts
	•	multi-moeda (Fase 2)
	•	métodos locais (ex.: MB Way via Stripe) (Fase 2)

MVP obrigatório
	•	nenhum checkout fora de Finanças
	•	ledger com dimensões para macro/micro analytics
	•	exports contabilísticos (CSV/PDF) (Fase 1/2)

	Hardening obrigatório (v3) — Finanças “Stripe-level”

1) Payment State Machine (explícita)
Estados canónicos do Payment:
	•	CREATED
	•	REQUIRES_ACTION (3DS / confirmação / autenticação)
	•	PROCESSING (métodos assíncronos)
	•	SUCCEEDED
	•	FAILED
	•	CANCELLED (user abort / timeout)
	•	PARTIAL_REFUND
	•	REFUNDED
	•	DISPUTED
	•	CHARGEBACK_WON / CHARGEBACK_LOST

Regra: UI e API nunca assumem “pago” sem SUCCEEDED.

2) Idempotência end-to-end (não só createCheckout)
Para cada Payment:
	•	criar entitlement
	•	escrever ledger entries (GROSS/PLATFORM_FEE/PROCESSOR_FEES_FINAL)
	•	disparar notificações
…tudo com idempotencyKey e “fulfillment lock” para impedir duplicação em retries/webhooks.

3) Finance Failover UX (premium)
Estados e mensagens claras quando:
	•	o user fecha o checkout
	•	o método fica pendente (PROCESSING)
	•	o Stripe está lento / timeout
	•	há falha intermitente de webhook
UX mínima:
	•	“Estamos a confirmar o teu pagamento” (PROCESSING) + polling/backoff controlado
	•	CTA “Voltar ao pagamento” se REQUIRES_ACTION
	•	“Não confirmámos ainda — não te preocupes” + notificação quando fechar

4) Disputes/Chargebacks como produto (B2B)
	•	visão central de disputas por organização (status, prazo, evidências)
	•	eventos no Ops Feed + alertas para FINANCE roles
	•	revogação/suspensão de entitlements por job quando dispute abre (policy)


Assinaturas/memberships
	•	Fase 2 com Stripe Billing
	•	cobrança recorrente, falhas, retries, update de método

•	Dunning como contrato (retensão):
	•	retries + backoff + grace period definidos por política
	•	notificações automáticas de falha (email/push)
	•	flow rápido de “update payment method”
	•	suspensão/revogação determinística de entitlements após X falhas
	•	audit log de alterações de plano e tentativas de cobrança	

Segurança
	•	2FA para admins financeiros (Fase 1)
	•	logs de sessão/actividade (Fase 1)

⸻

9.7 Equipa (RBAC)

Faz
	•	membros, convites, roles/scopes, packs, auditoria
	•	suporte a multi-org (mãe vs filial)

Fase 2
	•	roles personalizadas (dentro de limites)
	•	UI de permissões clara (quem vê o quê)

Segurança
	•	2FA para admins/owner (Fase 1)
	•	audit log completo (quem alterou preços, reservas, regras, etc.)
	•	Step-up obrigatório (acções irreversíveis) — **FECHADO v1**
		•	exige reautenticação/2FA recente (ex.: últimos 10 min) + `reasonCode` obrigatório para:
			–	refunds
			–	cancelamento de evento/torneio (soft-cancel)
			–	alteração de fee policy / overrides
			–	exportação com PII
		•	todas estas acções escrevem `AuditLog` com before/after (payload minimizado RGPD).

⸻

9.8 CRM

Faz
	•	base unificada, consentimentos, timeline, segmentos

CRM — contadores como read model

Regra:
	•	CrmCustomer counters são read models derivados de CrmInteraction.
	•	Qualquer “increment” tem de ser idempotente e reprodutível.
	•	Existe job diário de rebuild completo + drift report.
	•	Dedupe obrigatório: CrmInteraction tem idempotencyKey e/ou externalId (para evitar contagens duplicadas por retries/webhooks).
	•	RGPD: rebuild diário respeita entidades apagadas/anónimas (não re-hidratar nem recontar PII removida).

Seguidores vs Clientes (não confundir)

Entidades
	•	OrgFollower: relação social (follow/unfollow) + preferências/interesses (opt-in).
	•	Customer: relação transacional (compras, reservas, invoices).
	•	CRMContact (read model): “vista unificada” opcional para campanhas, mas mantém sempre a origem:
		–	contactType: FOLLOWER | CUSTOMER | LEAD | STAFF
		–	consentFlags: marketingEmailOptIn, marketingPushOptIn, gdprLegalBasis

Eventos que alimentam o CRM (EventLog → CRM read model)
	•	ORG_FOLLOWED / ORG_UNFOLLOWED
	•	PUBLIC_PROFILE_VIEWED
	•	EVENT_VIEWED / EVENT_SAVED
	•	TICKET_PURCHASED / BOOKING_CONFIRMED
	•	FORM_SUBMITTED (com consentimento)

Segmentação (v1)
	•	“Seguidores ativos” (últimos 14 dias) vs “inativos”
	•	“Seguidores perto do local” (geo do user + evento) — só se tiver consentimento de localização
	•	Conversão: follower→customer (primeira compra) com funil e métricas.

RGPD (guardrails)
	•	Dedupe por idempotencyKey/externalId.
	•	Delete/anonymize: qualquer rebuild diário do read model respeita estados apagado/anónimo.

Fase 2
	•	leads e conversão (prospects)
	•	campanhas: email/push segmentado, templates, tracking
	•	loyalty integrado (pontos por actividade)
	•	campos personalizados de perfil (ex.: nº federado, nível)

⸻

9.9 Perfil público

Notas de UX (importante)
	•	Este “Perfil público” é o que qualquer pessoa vê (incl. donos/admins em modo Utilizador). Ferramentas internas ficam no /org/*.
	•	A ordem padrão: HERO → ABOUT → EVENTS_AGENDA (próximos) → TOURNAMENTS (como evento) → STORE (se existir) → FORMS (se existir) → CONTACT.
	•	Visibilidade por módulo: cada bloco só aparece se o módulo estiver ativo e se o resolvedState permitir.

Implementação (page builder)
	•	Schema JSON versionado (OrgPublicProfileLayout) com blocks + settings.
	•	Block registry no frontend (render por tipo).
	•	Permitir “reordenar” blocos (drag/drop) apenas no painel da organização.

Faz
	•	páginas públicas (org/jogador), seguidores, stats e share
	•	agrega dados de owners (CRM/Padel/Eventos)

Fase 2
	•	marketplace: pesquisa por clubes/serviços/eventos próximos

⸻

9.10 Definições

Faz
	•	branding, políticas, templates, integrações, RGPD
	•	políticas refinadas (cancelamento, conduta, horários)
	•	export/backup (portabilidade)

Fase 2
	•	multi-idioma e localização (pt/en/es)
	•	domínios e emails “white-label” (parcial)

⸻

9.11 Formulários

Faz
	•	campos extra e waivers por contexto
	•	exports
	•	aceite legal com timestamp
	•	(Fase 2) análise básica de respostas

⸻

9.12 Promoções

Faz
	•	códigos, regras, bundles, tracking, anti-abuso
	•	elegibilidade avançada (1ª compra, VIP, off-peak, etc.)
	•	relatórios de eficácia/ROI
	•	integração com segmentos CRM
	•	“0€ tickets” não podem existir “por acidente”.
	•	Anti-abuso é central em Finanças (rate limits, 1 por user por event, etc.).

Fase 2
	•	gift cards/vales (modelo por promoção ou catálogo)

⸻

9.13 Loja

Faz
	•	catálogo, stock, POS, checkout via Finanças
	•	inventário centralizado (saídas por venda e por eventos)
	•	KPIs: vendas, margem, stock parado

Regras canónicas v1 (anti-estados contraditórios)

Loja — Estado resolvido (SSOT de disponibilidade)

Regra:
	•	A UI pública e o checkout usam apenas resolvedStoreState (função canónica).
	•	Os flags internos podem existir, mas NÃO podem ser interpretados em múltiplos sítios.

resolvedStoreState (enum):
	•	DISABLED (status != ACTIVE)
	•	HIDDEN (showOnProfile=false)
	•	LOCKED (catalogLocked=true)
	•	CHECKOUT_DISABLED (checkoutEnabled=false)
	•	ACTIVE (caso contrário)

Precedência (ordem canónica):
	•	DISABLED > HIDDEN > LOCKED > CHECKOUT_DISABLED > ACTIVE

Cache/materialização (se existir):
	•	resolvedStoreState pode ser calculado on-read.
	•	Se for materializado/cached, qualquer alteração a status/showOnProfile/catalogLocked/checkoutEnabled invalida imediatamente o cache.

Pesquisa & Discovery:
	•	Qualquer listagem pública (Pesquisa/Discovery) filtra pelo mesmo resolvedStoreState (não mostrar lojas que falham no checkout).

Guardrail:
	•	storeAccess.ts (ou equivalente) é o único sítio onde isto é decidido.
	•	Architecture test falha se endpoints públicos reimplementarem lógica de flags.

Migração:
	•	criar função canónica + substituir todas as leituras directas.

Loja — ownership consistente (FECHADO v1–v3)

Regra:
	•	Na ORYA v1–v3, **apenas ORGANIZAÇÕES** podem ser donas de Store/Produtos/Checkout.
	•	Logo, Store é sempre ORG-owned.

DB constraint obrigatória (CHECK):
	•	ownerOrganizationId NOT NULL
	•	ownerUserId NULL

Nota (futuro):
	•	Se algum dia existir “user store”, isso é uma decisão de produto nova (v4+), não entra no core nem no MVP.

Produtos/Bundles — Visibilidade unificada

Regra:
	•	Substituir (status + isVisible) por 1 campo canónico:
		–	visibility = PUBLIC | HIDDEN | ARCHIVED
	•	APIs públicas filtram apenas por visibility=PUBLIC.

Migração:
	•	mapear combinações antigas para visibility.
	•	proibir updates parciais que criem estados incoerentes.

Shipping — SSOT único

Regra:
	•	SSOT de shipping mode é StoreShippingMethod.mode (por método).
	•	Store.shippingMode (global) fica deprecated e não é usado no cálculo.
	•	Digital goods ignoram shipping (não pode existir shipping “fantasma” no checkout). 
	•	Proteção (DRM “leve”): entregar ficheiros/vídeos via **URLs assinadas e expiradas** (S3 + CloudFront signed URLs/cookies), acesso só para o buyer/entitled user; opcional watermark em vídeo/ficheiro e bloqueio de hotlink.
	•	“Cursos” como produto digital: tratar como **DigitalProduct** com módulos (vídeo + texto) e progress do utilizador. Começar simples (Fase 3): vídeos servidos por streaming e conteúdos descarregáveis bloqueados; escalar depois (transcoding/chapters/quizzes) quando houver tração.


Guardrail:
	•	teste unit “shipping compute” cobre casos com múltiplos métodos.

Fase 2/3
	•	produtos digitais/cursos com entitlements digitais

⸻

9.14 Chat interno

Faz
	•	canais por contexto, pesquisa, mentions
	•	canal “Ops” (Activity Feed) com alertas automáticos (ver Secção 12)

Fase 1
	•	histórico + pesquisa obrigatórios
	•	push/mobile para alertas críticos (via Notificações)

⸻

10) Sub-navegação TO-BE (rotas canónicas)

Regra: todas as rotas B2B são **/org/:orgId/*** (orgId explícito).  
Alias PT (legado/UX): /organizacao/:orgId/* faz redirect 301 para /org/:orgId/*.

10.1 Serviços

/org/:orgId/servicos
	•	?tab=overview
	•	?tab=disponibilidade
		•	?tab=precos (tarifários e regras)
	•	?tab=profissionais
	•	?tab=recursos
	•	?tab=politicas
	•	?tab=integracoes

Alias:
/organizacao/:orgId/servicos → /org/:orgId/servicos

10.2 Seguidores

/org/:orgId/perfil/seguidores
	•	?tab=followers
	•	?tab=pedidos

Alias:
/organizacao/:orgId/perfil/seguidores → /org/:orgId/perfil/seguidores

10.3 Check-in

/org/:orgId/checkin
	•	?tab=scanner
	•	?tab=lista
	•	?tab=sessoes
	•	?tab=logs
	•	?tab=dispositivos (fase 2)

Alias:
	•	AS-IS /organizacao/:orgId/scan → /org/:orgId/checkin?tab=scanner

10.4 Finanças (macro/micro)

/org/:orgId/financas
	•	?tab=overview (bolo)
	•	?tab=ledger (movimentos)
	•	?tab=dimensoes (recurso/profissional/cliente/produto/filial)
	•	?tab=payouts
	•	?tab=refunds_disputes
	•	?tab=assinaturas (fase 2)

Alias:
/organizacao/:orgId/financas → /org/:orgId/financas

10.5 Analytics

/org/:orgId/analytics
	•	?tab=dashboard
	•	?tab=ocupacao
	•	?tab=conversao
	•	?tab=no_show
	•	?tab=coortes (fase 3)

Alias:
/organizacao/:orgId/analytics → /org/:orgId/analytics

⸻

11) RBAC v2 — packs, roles e scopes

11.1 Roles “reais”

OWNER, CO_OWNER, ADMIN, STAFF, TRAINER, PROMOTER, VIEWER

11.2 Scopes (mapeados ao repo)
	•	EVENTS_* → EVENTOS
	•	PADEL_* → TORNEIOS
	•	RESERVAS_* → RESERVAS
	•	FINANCE_* → FINANCEIRO
	•	CRM_* → CRM
	•	SHOP_* → LOJA
	•	TEAM_* → STAFF
	•	SETTINGS_* → DEFINICOES
	•	CHECKIN_* → EVENTOS/TORNEIOS (até existir módulo próprio)

11.3 Role Packs (presets)
	•	CLUB_MANAGER → ADMIN + PADEL_*, RESERVAS_*, CHECKIN_*, CRM_RW, TEAM_R, SETTINGS_R
	•	TOURNAMENT_DIRECTOR → STAFF + PADEL_*, EVENTS_RW, CHECKIN_RW, RESERVAS_R
	•	FRONT_DESK → STAFF + CHECKIN_*, RESERVAS_RW, EVENTS_R, CRM_R
	•	COACH → TRAINER + RESERVAS_RW, PADEL_R, CRM_R
	•	REFEREE → STAFF + PADEL_RW (matches/live), EVENTS_R, CHECKIN_R

11.4 Multi-Organizações (mãe/filiais)
	•	permissões podem existir:
	•	ao nível do OrganizationGroup (mãe)
	•	ao nível de cada Organization (filial)
	•	UI mostra claramente “estás na mãe” vs “estás na filial X”
	•	auditoria separa por entidade e por âmbito

11.5 Roadmap CHECKIN module
	•	v1.x/v2: CHECKIN_* mapeado a módulos existentes
	•	v3: CHECKIN torna-se módulo próprio

⸻

12) Infra do Produto (EventBus, EventLog, Idempotência, Auditoria, Jobs)

12.1 EventBus (pub/sub)
	•	publish/subscribe interno
	•	idempotência por evento
	•	consumers tolerantes a replays

12.2 EventLog (obrigatório)
	•	log técnico do bus
	•	trilho de auditoria do sistema
	•	base para ingest no CRM, Activity Feed, troubleshooting

PII e retenção:
	•	IDs e metadados mínimos
	•	retenção 90–180 dias (config)
	•	auditoria RBAC pode reter mais com payload reduzido

12.2.1 Retenção RGPD (defaults v1) — **FECHADO**
	•	EventLog: 180 dias
	•	OutboxEvent: 30 dias após `publishedAt`
	•	NotificationDeliveryLog: 180 dias
	•	Job/JobAttempt/DLQ: 30–90 dias (depende de debug/ops)
	•	AuditLog: 5 anos (payload minimizado; sem PII desnecessária)

Unicidade:
	•	(organizationId, eventType, idempotencyKey)

12.3 Idempotência transversal

Obrigatório em:
	•	checkout/refunds
	•	check-in
	•	live updates (padel)
	•	criação/alteração crítica (reservas/eventos)
	•	split-payment reminders/expirations

---

## Tenancy & Isolation Enforcement (FECHADO)

This section defines the mandatory enforcement rules for multi-tenant
isolation across the ORYA platform.

Any violation of these rules is considered a critical security defect.

---

### T1 — Explicit Organization Scoping (MANDATORY)
All domain entities MUST be scoped to an organization via:
- a direct `orgId` field, or
- an immutable reference to an entity that contains `orgId`

No entity that represents customer, operational, or financial data may
exist without an organization context.

---

### T2 — Query Enforcement
All read and write queries MUST:
- include `orgId` as a mandatory filter, OR
- derive `orgId` from a parent entity already scoped

Queries without explicit organization scoping are forbidden.

---

### T3 — Global Tables (Explicit Exceptions)
Only the following categories MAY exist without `orgId`:
- identity registries (e.g., username, email uniqueness)
- configuration metadata explicitly marked as GLOBAL

Global tables MUST:
- never contain customer-sensitive data
- be read-only in customer flows
- be explicitly documented as GLOBAL

---

### T4 — Background Jobs & Async Processing
All background jobs, workers, and outbox processors MUST:
- execute within a resolved `orgId` context
- include `orgId` in logs, metrics, and traces

Jobs operating across multiple organizations MUST process one
organization at a time.

---

### T5 — Webhooks & External Callbacks
Inbound webhooks MUST:
- be resolved to an internal entity
- derive the owning `orgId`
- fail if organization context cannot be resolved

Webhook handling without organization resolution is forbidden.

---

### T6 — Authorization Is Org-Bound
Authorization checks MUST always evaluate:
- actor identity
- organization membership
- role / permission within that organization

Cross-organization access is forbidden unless explicitly designed
and documented as such.

---

### T7 — Service Roles & Elevated Access
Service roles MAY bypass user-level RBAC but MUST NOT bypass
organization isolation.

All service-role access MUST:
- be auditable
- be logged with `orgId`
- have a documented justification

---

### T8 — Testing & Verification
The platform MUST include automated tests that:
- attempt cross-org access
- verify hard failure on isolation violations
- cover API, jobs, and webhook paths

Tenancy enforcement MUST be continuously tested.

---

### T9 — Failure Mode
On any ambiguity or missing organization context:
- the operation MUST fail
- no partial data may be returned
- no side effects may be executed

The system always fails closed.

---

## Threat Model & Data Classification (NÃO-NORMATIVO)

### Data Classes
- **Public**: conteúdo público, páginas, metadados de eventos.
- **PII**: email, nome, identificadores de utilizador.
- **Finance/Audit**: ledger, payments, refunds, payouts, invoices.
- **Security-sensitive**: tokens, secrets, audit logs, access policies.

### Top Threats (V1)
- ATO / credential stuffing
- Webhook spoofing, replay e out‑of‑order
- Privilege escalation em RBAC
- Leakage via logs/analytics
- Cross‑org data access

### Mitigações Mapeadas
- **I1/I2/I3/I6**: SSOT + ledger append‑only + idempotência → evita duplicações e inconsistências.
- **I5/T1–T9**: isolamento por orgId + fail‑closed → bloqueia cross‑org.
- **I7/I8**: outbox + reconciliação → tolera duplicados/out‑of‑order.
- **O3**: logs com correlationId/orgId → auditoria/trace.
- **RGPD**: retenções e minimização → reduz risco de leakage.

12.4 Jobs & Queues (obrigatório)
	•	queue (AWS SQS recomendado) + retries + backoff + DLQ
	•	observabilidade por job (status, tentativas, payload mínimo)
	•	usos:
	•	emails/push
	•	ingest CRM
	•	geração de PDF/exports
	•	sync Stripe
	•	indexação Search
	•	split-payment deadlines
	•	revogação de entitlements em disputes

	12.4.x Jobs de Reconciliação (obrigatório v1)

Princípio:
	•	Contadores incrementais (soldQuantity, métricas CRM, materializações/aggregates) são READ MODELS.
	•	A “verdade” está nos registos base (Tickets/Orders/Ledger/Interactions).

Jobs mínimos:
	1) ticketing.reconcile_sold_quantities (hourly/daily)
		•	recalcula vendidos por TicketType a partir de ordens pagas e entitlements válidos:
			–	base: Payments SUCCEEDED por sourceType=TICKET_ORDER (Finanças SSOT)
			–	excluir: entitlements REVOKED/REFUNDED/SUSPENDED quando aplicável (policy)
			–	sem depender de “estados inventados” no Ticket
		•	se drift > threshold → corrigir + emitir evento ops.alert + log de auditoria
	2) crm.rebuild_customer_counters (daily)
		•	rebuild determinístico a partir de CrmInteraction
	

Outputs:
	•	tabela de “drifts” + dashboard no Admin (14.1) com alerts e links.

12.5 Activity Feed + Canal “Ops” (alertas automáticos)

Eventos mínimos recomendados (MVP):
	•	booking.created, booking.cancelled, booking.no_show
	•	payment.succeeded, payment.failed
	•	subscription.failed (fase 2)
	•	ticket.order.created
	•	padel.registration.created, padel.registration.expired
	•	checkin.success, checkin.denied, checkin.duplicate
	•	refund.created, refund.succeeded, chargeback.opened
	•	review.negative / report.created (fase 2/3 com moderação)
	•	inventory.low_stock (fase 2)

12.6 Guardrails de Arquitetura (obrigatório v1)
	•	Architecture Tests
	•	falhar build se alguém importar Stripe fora de Finanças
	•	falhar build se alguém escrever entidades fora do “owner” (podes fazer via wrappers ou lint rules)
	•	Contract Tests
	•	cada contrato em domain/contracts/* tem testes unit e “golden tests”
	•	Anti-drift migrations
	•	pipeline que falha se schema Prisma divergir do DB (staging)

12.6.2 Isolamento multi-tenant (DB) — **FECHADO**
Objetivo: garantir que falhas na camada API não criam fuga de dados entre organizações.
- Todas as tabelas B2B têm `organizationId` obrigatório.
- Queries na API são sempre filtradas por `organizationId` (orgContext + RBAC).
- Base de segurança (quando aplicável):
  - RLS no Supabase para tabelas críticas multi‑tenant (Finanças, Reservas, RBAC, CRM, Check‑in),
  - policies mínimas: “só lê/escreve se organizationId ∈ memberships do user”.
- Logs e exports respeitam minimização de PII (12.2/19.4).

12.6.1 Contract Signatures (MVP) (FECHADO)
Objetivo: reduzir drift FE/BE e entre módulos. Assinaturas mínimas (shape), sem impor transporte (REST/GRPC).

- Finanças.createCheckout(input)
  - input: {sourceType, sourceId, buyerIdentityRef?, pricingSnapshotHash?, idempotencyKey}
  - output: {paymentId, status, clientSecret?, pricingSnapshotHash}

- Finanças.getPayment(paymentId)
  - output: {paymentId, status, amounts, currency, pricingSnapshotHash, processorFeesStatus, processorFeesActual?}

- Eventos.validateInviteToken(input)
  - input: {eventId, inviteToken, identityRef?}
  - output: {allow, reasonCode?, constraints:{expiresAt, requiresIdentityMatch}}

- UsernameRegistry.resolveUsername(username)
  - output: {ownerType, ownerId, canonicalUsername}

- Checkin.consume(input)
  - input: {qrPayload, scannerIdentityRef, eventId, deviceId?}
  - output: {allow, reasonCode?, entitlementId?, consumedAt?, policyVersionApplied, duplicate?:{duplicateOfConsumedAt, duplicateCount?}}

- Address.searchAutocomplete(query, context?)
  - output: {items:[{placeId, label, lat?, lng?}]}

- Address.resolvePlace(placeId)
  - output: {placeId, label, lat, lng, components?}

⸻

C2.x) Stripe Onboarding (Standard) — **FECHADO**
- Activação de vendas/payouts exige Organization completar onboarding KYC no Stripe.
- Implementação: Finanças gera `account_link` (Stripe-hosted) e guarda estado:
  - `onboardingStatus = PENDING | COMPLETE | RESTRICTED`
- Guardrail:
  - se status != COMPLETE → bloquear criação de checkouts pagos (permitir apenas rascunhos/testes).

⸻

12.7 Timezone canónica (FECHADO)
- Todas as janelas temporais e jobs com T‑X (reminders, locks, expirations) são calculadas na **timezone do evento** (IANA, ex.: `Europe/Lisbon`).
- Em Reservas (sem evento), usa‑se a timezone da **organização/recurso** (também IANA).
- Regra: guardar timestamps canónicos em UTC + timezone original; UI apenas converte para visualização.

⸻

13) Pesquisa & Discovery (infra sem overkill) — **FECHADO**

v1 (Fase 1)
	•	Postgres full-text + trigram + filtros por tipo
	•	index unificado derivado (owners continuam Eventos/Padel/Reservas/Serviços)
	•	rebuild por jobs + replay a partir de EventLog (idempotente)

v2 (quando houver volume)
	•	Typesense/Meilisearch alimentado por jobs a partir de EventLog

13.1 Ranking (v1) — **FECHADO**
ADITAMENTO FECHADO: ranking mínimo e observabilidade para produção v1.
- Sinais mínimos (ordenados por impacto):
  - relevância textual (match exato + trigram)
  - proximidade (geo) quando aplicável
  - janela temporal (a acontecer / hoje / esta semana)
  - popularidade (views, likes, going)
  - qualidade (org score + `risk.flagged`)
  - penalizações por spam de keywords
- Observabilidade mínima:
  - CTR por posição
  - zero‑result rate
  - top queries (sem PII)
- Anti‑abuso:
  - keyword stuffing → downrank com `reasonCode=RANKING_SPAM_KEYWORDS`
  - org com `risk.flagged` → downrank com `reasonCode=RANKING_RISK_FLAGGED`

⸻

14) Governança & Ferramentas Internas (Admin, Billing, Support, Analytics)

14.1 Admin global (admin.orya.pt)
	•	gestão de organizações (KYC leve, settings globais)
	•	fee policies globais + overrides
	•	feature flags
	•	health/ops dashboard (jobs, DLQ, falhas)
	•	dispute tooling (visibilidade e trilhos)
	•	gestão de templates de notificações

14.1.1 SLIs mínimos (MVP) — **FECHADO**
Finanças
	•	webhook failure rate (5 min) + retries/DLQ count
	•	tempo até `processorFeesStatus=FINAL` (p50/p95 por dia)
Check-in
	•	latência do `Checkin.consume` (p50/p95)
	•	rácio `checkin.denied` e `checkin.duplicate` por evento
Jobs/Queues
	•	DLQ size + oldest message age
	•	retry rate por jobType (top N)
Read Models / Anti-drift
	•	drift count diário (crm + sold_quantities) + severidade (threshold)
Alertas (Ops)
	•	alerta automático quando qualquer SLI ultrapassa threshold, com link directo para logs + entidade (eventId/paymentId/orgId)

---

## Operational SLIs, SLOs & Alerting (NORMATIVE)

This section defines the minimum observability and alerting standards
required for production operation of the ORYA platform.

Dashboards without actionable thresholds are insufficient.

---

### O1 — Alert Classification
Alerts are classified as:
- **PAGER:** requires immediate human intervention
- **TICKET:** requires investigation but not immediate action

---

### O2 — Core Domain SLIs & Thresholds

#### Payments & Ledger
| SLI | Threshold | Window | Alert |
|----|----|----|----|
| Payment webhook failure rate | >2% | 5 min | PAGER |
| Ledger reconciliation lag | >15 min | 1 h | TICKET |
| Processor fee unresolved | >30 min | rolling | TICKET |
| Duplicate payment detection | >0 | immediate | PAGER |

---

#### Entitlements & Access
| SLI | Threshold | Window | Alert |
|----|----|----|----|
| Entitlement issuance failure | >1% | 5 min | PAGER |
| Check-in validation latency (p95) | >300 ms | 10 min | TICKET |
| Duplicate check-in attempts | spike | rolling | TICKET |

---

#### Async Jobs & Outbox
| SLI | Threshold | Window | Alert |
|----|----|----|----|
| DLQ depth | >0 | 10 min | PAGER |
| Job retry exhaustion | >0 | immediate | PAGER |
| Job processing latency (p95) | >5 min | 15 min | TICKET |

---

### O3 — Logging & Correlation
All logs MUST include:
- `correlationId`
- `orgId`
- domain entity identifiers

Logs without correlation context are non-compliant.

---

### O4 — Incident Readiness
For each PAGER alert, the following MUST exist:
- documented runbook
- clear ownership
- rollback or mitigation steps

Production without runbooks is forbidden.

---

14.2 Billing & planos ORYA (SaaS)
	•	Fase 1: simples (plano base + limites)
	•	Fase 2: billing avançado por módulos/uso (se fizer sentido)

14.3 Suporte
	•	help center + base de conhecimento (Fase 1/2)
	•	tickets (interno ou integração com ferramenta externa)
	•	tooling de “impersonate” com auditoria (Fase 2)

14.4 Analytics
	•	dashboards macro/micro (Secção 15)
	•	materializações por job (sem pesar DB transaccional)

15.1) Bolo (overview)
	•	bruto, fee ORYA, fees processador, líquido para organização
	•	receitas por módulo (eventos/reservas/loja/padel)
	•	taxas e tendência

15.2 Dimensões (drill-down)
	•	filial/unidade (sub-org)
	•	recurso (campo/sala)
	•	profissional/treinador
	•	cliente
	•	produto (loja)
	•	serviço
	•	campanha/promoção
	•	evento/torneio

15.3 Regras
	•	tudo deriva do ledger + referências (sourceType/sourceId)
	•	qualquer “agregação” tem auditoria de como foi calculada (reprodutível)

⸻

16) Plano Executável — 3 Fases (cada fase: A / B / C, por módulos, só avança quando perfeito)

Regra de passagem: não se avança para o módulo seguinte se o anterior não estiver “perfeito” segundo DoD e testes E2E.

⸻

FASE 1 — MVP “Robusto” (higienização + base certa + operação premium essencial)

Objetivo: eliminar verdades duplicadas, fechar contratos, ter Reservas/Finanças/Padel/Check-in a funcionar como relógio, com UX premium e custos controlados.

F1-A) Base técnica e contratos (ordem por módulos)
	1.	EventBus + EventLog + Idempotência
	•	implementar pub/sub interno + idempotência por evento
	•	EventLog com constraints
	•	guidelines de PII + retenção
	•	consumers tolerantes a replay
	2.	Jobs/Queue + DLQ (AWS-first já na Fase 1)
	•	SQS + DLQ (obrigatório) + retries/backoff + observabilidade mínima
	•	Worker(s) na AWS para jobs e consumers (processamento assíncrono + EventLog consumers)
	•	Arquitetura “AWS-first” já na Fase 1:
		•	Supabase mantém-se como DB/Auth (única peça fora AWS por agora)
		•	Tudo o resto corre em AWS desde o início:
			•	compute para API/worker(s) (ex.: ECS/Fargate, App Runner ou equivalente)
			•	SQS + DLQ
			•	SES (emails transacionais) e/ou provider equivalente
			•	CloudWatch logs/alarms
			•	Secrets (SSM Parameter Store ou Secrets Manager) para chaves e webhooks
			•	S3 para uploads e artefactos (exports PDF/CSV, imagens, anexos)
	•	Objetivo: preparar migração total para AWS sem re-arquitetar depois

	3.	Contratos versionados
	•	domain/contracts/reservas.ts
	•	domain/contracts/financas.ts
	•	domain/contracts/checkin.ts
	•	domain/contracts/crm.ts
	•	domain/contracts/notifications.ts
	•	domain/contracts/address.ts
	•	testes de contrato (unit + integração)
	4.	Refactors estruturais (higiene)
	•	Agenda: deprecar PadelCourtBlock/PadelAvailability → centralizar em Reservas
	•	Pagamentos: remover checkout Stripe directo fora de Finanças
	•	CRM: ingest via EventLog, não ponto-a-ponto
	•	Check-in: suportar bookings + inscrições via entitlement unificado
	•	Moradas: migrar para Address Service (uma verdade)
	5.	Finanças determinística
	•	feePolicyVersion + ledger entries explícitas
	•	idempotencyKey obrigatório em checkout/refund
	•	exports mínimos
	6.	RBAC + auditoria
	•	middleware orgRbacGuard
	•	packs v2 activos
	•	audit log em operações críticas
	7. Guardrails: architecture tests + anti-drift + contract tests

Exit Criteria F1-A
	•	nenhum checkout fora de Finanças
	•	owners respeitados (D2)
	•	eventlog + jobs activos
	•	address SoT activo
	•	E2E tests básicos a passar (booking → payment → entitlement → check-in)

⸻

F1-B) Produto + governança (ordem por módulos)
	1.	Padel Torneios — core + formatos base
	•	templates de formato (eliminação simples, grupos+eliminação, round-robin)
	•	ruleset versionado
	•	matchSlots via Reservas
	•	live ops estável
	2.	Split payment Padel (definitivo) — regra 48/24 + matchmaking + resolução determinística
	•	convite por email (parceiro pode não ter conta)
	•	pagamento pendente associado ao email (aparece ao criar conta com o mesmo email)
	•	inscrição em dupla só CONFIRMA quando ambos pagam

	•	janelas fixas (default global):
	•	MATCHMAKING WINDOW: T-48h → T-24h (só aqui há matchmaking)
	•	LOCK/RESOLVE: T-24h (fecha tudo e resolve estados)

	•	comportamento até T-24h (PENDING):
	•	trocar parceiro (re-invite, com novo email)
	•	“pagar pelo parceiro” (capitão cobre a parte em falta)
	•	entrar em matchmaking (se não tiver parceiro ou quiser substituir)

	•	matchmaking engine (T-48h → T-24h):
	•	só pareia utilizadores elegíveis (mesmo nível/categoria/regras do torneio)
	•	faz “soft match” + notificação; confirma match quando o 2º pagamento fica regularizado
	•	auditável e reversível até T-24h

	•	T-24h (LOCK/RESOLVE determinístico):
	•	se dupla não estiver confirmada (ambos pagos) → inscrição EXPIRED (auto-timeout determinístico aos T-24h)
	•	reembolso automático de qualquer valor pago (menos fees inevitáveis do processador/reembolso), para nunca prejudicar a organização
	•	slot é libertado imediatamente e o torneio segue sem buracos

	•	reminders automáticos:
	•	T-72h (se aplicável), T-48h (abrir matchmaking), T-36h, T-24h (último aviso + lock)
	•	auditoria completa (quem convidou, quem trocou, quem pagou pelo parceiro, decisões do matchmaking, lock final)
	3.	Reservas — políticas + segmentos
	•	regras para membros vs não-membros (via CRM segmentos + políticas)
	•	no-show + penalizações configuráveis
	4.	Check-in completo
	•	QR ticket + QR inscrição + QR booking
	•	logs + presença/no-show
	•	rate limit + idempotência
	5.	Ops Feed (Activity Feed)
	•	consumer EventLog → feed UI + canal “Ops”
	•	lista base de alertas (Secção 12.5)
	6.	Admin mínimo
	•	fee policies
	•	feature flags
	•	health de jobs/DLQ
	•	Finanças hardening (state machine + fulfillment idempotente + failover UX)
	•	visão de disputes/refunds (tooling)

Exit Criteria F1-B
	•	torneio end-to-end (criar → inscrições → schedule → pagamentos → check-in → resultados)
	•	split payment sem buracos
	•	feed Ops fiável e útil
	•	RBAC impede acções indevidas (UI + API)

⸻

F1-C) UX/UI/Design + operação (ordem por módulos)
•	Padrões UX Globais (B2B): Unified Search + Context Drawer + Command Palette + Ops mode
•	Objetivo: reduzir cliques e tempo de resolução operacional (nível Linear/Stripe)

	1.	Design System / Componentização
	•	componentes consistentes
	•	estados (loading/empty/error/success)
	•	acessibilidade (WCAG base)
	2.	Agenda premium
	•	dia/semana
	•	drag & drop com validação de conflitos
	•	camadas (reservas/matchslots/aulas/bloqueios)
	•	auditoria visível (quem alterou)
	3.	Padel Wizard premium
	•	templates rápidos
	•	validações claras
	•	import CSV básico (se necessário)
	4.	Performance percebida
	•	paginação
	•	cache de configs
	•	placeholders skeleton
	5.	“Adicionar ao calendário” (ICS)
	•	para reservas/eventos no utilizador

Exit Criteria F1-C
	•	UX da agenda e do wizard “nível grande”
	•	zero fricção óbvia nos fluxos core
	•	desempenho aceitável em mobile (responsivo)

Custo alvo Fase 1
	•	manter Supabase Pro (25€/mês)
	•	AWS: App Runner/ECS pequeno + SQS + worker + emails → configurado para pagar pelo uso
	•	meta: ≤ ~100€/mês em operação normal (sem tráfego alto)

⸻

FASE 2 — Expansão (monetização avançada, memberships, campanhas, marketplace)

Objetivo: elevar a ORYA de “muito boa” para “dominante” em retenção, monetização e escalabilidade funcional.

F2-A) Base técnica
	1.	Search Index Service (se necessário)
	2.	Materializações de Analytics por job
	3.	Observabilidade (logs/metrics/tracing)
	4.	F2-A.x) Roadmap Infra (Supabase → AWS) — FECHADO
	•	Fase 1: Supabase (Postgres/Auth) + compute/queues/storage/observabilidade em AWS (AWS-first).
	•	Fase 2: migrar Postgres para AWS (RDS/Aurora) com cutover planeado.
	•	Fase 2/3: migrar Auth para AWS (Cognito ou serviço próprio), mantendo `Identity` como SSOT estável.
	•	Objetivo final: 100% AWS (DB/Auth/Workers/Storage/Observabilidade), Supabase descontinuado.
	5.	2FA obrigatório para admins/financeiro
	6.	Backups e exports avançados

F2-B) Produto + governança
	1.	Stripe Billing (subscrições/memberships)
	•	planos de sócio
	•	autopay + falhas + retries
	•	janelas de reserva antecipada para membros
	2.	Multi-moeda + métodos locais
	3.	Gift cards
	4.	CRM: leads + campanhas
	•	email/push segmentado
	•	tracking de campanha/ROI
	5.	Promoções avançadas
	6.	Loja: inventário centralizado + KPIs
	7.	Eventos: recorrência, séries, waitlist, pre/post comms
	8.	Marketplace básico
	•	procurar clubes/serviços/eventos por localização

F2-C) UX/UI/Design
	1.	Dashboard personalizável (widgets)
	2.	UI de permissões (granular)
	3.	App/PWA staff (opcional)
	•	scanner + operação rápida
	4.	Localização/i18n (pt/en/es)

Custo alvo Fase 2
	•	subir gradual conforme uso: ~200–400€/mês quando já houver tração real
	•	activar apenas serviços necessários (sem “plataforma enterprise vazia”)

⸻

FASE 3 — Completar (globalização, optimização inteligente, integrações enterprise)

Objetivo: tornar a ORYA referência “best-in-class” internacional.

F3-A) Base técnica
	1.	Optimização/yield + recomendações
	2.	Escala horizontal por módulos (se necessário)
	3.	Integrações IoT/portas/gates
	4.	Data warehouse (se fizer sentido)

F3-B) Produto
	1.	Padel interclubes/equipas
	2.	ELO/Glicko
	3.	Streaming + widgets avançados
	4.	Eventos com chat do evento + moderação
	5.	Digital goods completo
	6.	White-label avançado
	7.	Integrações federações/partners

F3-C) UX/UI/Design
	1.	Experiências “live” topo
	•	brackets ao vivo
	•	live stream embed
	•	notificações por momento do evento
	2.	Comunidade ORYA
	3.	Analytics preditivo

⸻

17) Métricas e Definition of Done (DoD)

KPIs prioritários
	•	tempo para criar torneio completo (end-to-end)
	•	% auto-schedule sem conflitos hard
	•	conversão página pública → compra
	•	ocupação de recursos (por recurso e por profissional)
	•	no-show rate (reservas e eventos)

DoD (qualidade)
	•	logs e auditoria em ações críticas
	•	mensagens de erro previsíveis e úteis
	•	idempotência em checkout/check-in/live updates
	•	UI gating consistente com scopes
	•	nenhum módulo escreve fora do owner (D2)
	•	nenhum checkout fora de Finanças (D4)
	•	Address SoT activo (uma verdade)
	•	custos controlados por fase

17.1 Escopo de Produção (Cut Line v1.x) — **FECHADO**
ADITAMENTO FECHADO: delimita o que entra em produção v1.0 e o que fica bloqueado.

A) IN (obrigatório para v1.0)
	•	Eventos: criar/publicar/listar + gestão básica
	•	Tickets: compra + emissão/entitlement
	•	Finanças: checkout + webhooks + ledger append‑only + reconciliação
	•	Entitlements: criação + revogação
	•	Check‑in: scanner + consumo + logs
	•	Org onboarding Stripe Connect Standard (KYC) — C2.x
	•	RBAC mínimo (org scopes críticos)
	•	Notificações essenciais (transaccionais + operacionais)
	•	DSAR básico operativo (19.4)
	•	Trust & Safety mínimo operativo (19.2)
	•	Observabilidade mínima (SLIs + alertas críticos 14.1.1)

B) OUT (existe no blueprint, mas fica bloqueado/feature‑flagged em v1.0)
	•	QR offline assinado (S2) e validação offline
	•	Discovery/ranking avançado (personalização, recomendações, modelos)
	•	Automações CRM complexas e campanhas
	•	Funcionalidades sociais não essenciais (chat do evento, reviews, comunidade)
	•	Marketplace avançado e integrações enterprise

C) Regra de execução (hard)
	•	Tudo o que está OUT: UI escondida + endpoints protegidos + feature flag obrigatória + **403 por defeito**.
	•	Qualquer activação exige aprovação explícita + `SafetyCase` quando aplicável (19.2).

D) Definição de Done para Go‑Live v1.0
	•	Todos os itens IN operacionais **e** 19.0 Go‑Live Gate cumprido.
	•	Cut‑line aplicado e verificado por testes (19.6).

⸻

18) Nota final (regra de ouro)

Se uma decisão não estiver aqui, não está decidida.
Se uma implementação contradizer D2/D4/D3, é bug de arquitectura, não é “trade-off”.

⸻

19) Production Readiness — **FECHADO**

Objetivo: tornar a ORYA “produção real” (Portugal, Web + iOS + Android) — resiliente, auditável, compatível (RGPD + lojas), e operável em dias de pico (pagamentos, check‑in, revenda).

19.0 Go‑Live Gate (Fase 1) — **FECHADO**
Pré‑requisitos mínimos antes de abrir produção real:
- Documentos legais publicados e linkados (19.1).
- Onboarding B2B para payouts completo (KYC + aceites).
- DSAR básico ativo (19.4).
- Trust & Safety mínimo (19.2).
- Runbooks de suporte + escalação definidos (19.3).
- Alertas críticos ativos (SLIs 14.1.1) + dashboards básicos.
- Backups configurados + **1º teste de restore** executado (19.3).
- Release gates ativos (19.6) + guardrails 12.6.

19.1 Legal & Compliance (Portugal + App Stores) — **FECHADO**
- Documentos obrigatórios (publicados e versionados):
  - Termos de Utilização (Utilizadores)
  - Termos para Organizações (B2B)
  - Política de Privacidade (RGPD)
  - Política de Cookies / Tracking (web)
  - Política de Conteúdo/Conduta + Política de Denúncias (Trust & Safety)
- Links obrigatórios na app e website:
  - Privacy Policy + Terms **sempre acessíveis sem login** (iOS/Android/Web).
- Organizações com vendas/payouts (pré‑requisito para activar pagamentos):
  - Identificação legal e fiscal (NIF, representante, morada, dados da empresa).
  - Aceitação explícita:
    - Organização é responsável pelo evento/serviço (conteúdo, segurança, cumprimento legal, IVA/faturação).
    - ORYA é plataforma (fee) e pode suspender funcionalidades e vendas (bloquear checkouts) por risco/abuso.
  - Disputes/chargebacks:
    - Processo formalizado de evidência e resposta (SLA interno) + auditoria.
- Cookies (web):
  - Consentimento por categoria (essenciais / analytics / marketing) + gestão de preferências.
  - Tracking de marketing **apenas com opt‑in** (salvo base legal documentada).

Legal Sign-off e Versionamento (FECHADO)
- Todos os documentos legais (Termos, Privacidade, Cookies) são versionados:
  - `legalDocsVersion` (ex.: 1.0.0) + `effectiveAt`
- Go‑Live Gate:
  - não se lança produção sem `legalDocsVersion` aprovado/revisto e links publicados no produto (web/app).
- Alterações legais:
  - criam nova versão + changelog + data de entrada em vigor
  - utilizadores são notificados quando aplicável (Notificações + registo de aceitação)
- Ownership:
  - responsável interno: Owner/Legal (nome/role no repositório de decisão) + registo de aprovação.

19.2 Trust & Safety (abuso inevitável) — **FECHADO**
- Sistema de denúncias (in‑app + web):
  - Categorias normativas: fraude/pagamentos, evento falso, spam, assédio, conteúdo ilegal, risco físico, menores, violação de direitos, revenda abusiva.
  - SLA normativo:
    - triagem ≤ 24h
    - decisão inicial ≤ 72h (ou “investigação” com estado + motivo)
  - Registo obrigatório: `SafetyCase` (caseId, entidade alvo, motivo, evidência, decisão, auditoria).

19.2.1 Políticas de Conteúdo & Idade — **FECHADO**
- Proibido:
  - fraude, eventos falsos, venda de bens/serviços ilegais, doxxing, assédio grave, incitação ao ódio/violência.
- Eventos sensíveis (ex.: álcool/noite):
  - exigem sinalização e age-gate quando aplicável.
- Responsabilidade:
  - a Organização é responsável por licenças/segurança/conduta no local.
  - ORYA pode suspender o evento e bloquear novas vendas/checkouts por risco/abuso (com `SafetyCase`).
- Medidas (escalonadas e auditáveis):
  - Aviso → Limitação (shadow‑limit) → Suspensão temporária → Ban
  - Cancelamento de evento (soft‑cancel) + refunds idempotentes quando aplicável

19.2.2 Thresholds & Ações Automáticas — **FECHADO**
ADITAMENTO FECHADO: thresholds mínimos (valores default; ajustáveis por política).
- Chargeback rate por Organização (janela móvel 30d, mínimo 100 pagamentos):
  - **Sinaliza** > 0.8% → `SafetyCase` + `reasonCode=RISK_CHARGEBACK_RATE_ORG_HIGH`
  - **Bloqueia** > 1.5% → bloquear novos checkouts da org até revisão + `reasonCode=RISK_CHARGEBACK_RATE_ORG_BLOCK`
- Chargeback rate por Evento (janela móvel 30d desde 1ª venda até 30d pós‑evento, mínimo 30 pagamentos):
  - **Sinaliza** > 1.0% **e** ≥ 2 disputes → `reasonCode=RISK_CHARGEBACK_RATE_EVENT_HIGH`
  - **Bloqueia** > 2.0% **e** ≥ 3 disputes → bloquear novos checkouts do evento + `reasonCode=RISK_CHARGEBACK_RATE_EVENT_BLOCK`
- Picos anómalos de vendas (org/event, baseline 7d):
  - **Sinaliza** ≥ 3× baseline **e** ≥ 20 compras/min por ≥ 3 min → step‑up/captcha + rate‑limit + `reasonCode=RISK_SALES_SPIKE`
  - **Bloqueia** ≥ 6× baseline **e** ≥ 50 compras/min por ≥ 3 min → bloquear novos checkouts + `reasonCode=RISK_SALES_SPIKE_BLOCK`
- Revenda suspeita (por identidade):
  - **Sinaliza** ≥ 5 falhas de transfer/claim por 1h **ou** ≥ 8 transferências/24h → step‑up + rate‑limit + `reasonCode=RISK_RESALE_SUSPECTED`
  - **Bloqueia** ≥ 10 falhas/1h **ou** ≥ 12 transferências/24h → bloquear transferências/claims + `reasonCode=RISK_RESALE_BLOCK`
- Check‑in anómalo (por evento/scanner):
  - **Sinaliza** (`checkin.denied` + `checkin.duplicate`) ≥ 10% em 10 min com ≥ 30 scans → aviso + modo recinto + `reasonCode=RISK_CHECKIN_ANOMALY`
  - **Bloqueia** ≥ 20% em 10 min com ≥ 30 scans → bloquear novos scans desse scanner + fallback + `reasonCode=RISK_CHECKIN_ANOMALY_BLOCK`

19.2.3 Tooling mínimo de moderação — **FECHADO**
ADITAMENTO FECHADO: estado e campos mínimos do `SafetyCase`.
- Queue / estados: `NEW → TRIAGED → INVESTIGATING → DECIDED → (APPEALED) → CLOSED`
- Campos mínimos:
  - `decision = ALLOW | LIMIT | SUSPEND | BAN | SOFT_CANCEL_EVENT`
  - `scope = USER | ORG | EVENT`
  - `duration`/`expiresAt` (quando aplicável)
  - `decidedBy` (userId/role)
  - `evidenceLinks[]`
  - timestamps: `createdAt`, `triagedAt`, `decidedAt`, `closedAt`
- Safety Inbox (Backoffice):
  - lista + pesquisa + filtros por severidade/estado/entidade
  - SLA timers (triagem/decisão)
  - templates de decisão (com reasonCode)
  - audit log completo por caso

19.2.4 Kill Switches — **FECHADO**
ADITAMENTO FECHADO: switches operacionais compatíveis com Stripe Connect Standard.
- A) Kill switch por **EVENTO**
  - aplica: bloquear novos checkouts + ocultar da descoberta
  - mantém: suporte + gestão de refunds
  - guardrail: API `createCheckout` + discovery gated
  - reversão: decisão em `SafetyCase` + expiração definida
  - audit: EventLog `safety.kill_switch.event` + `reasonCode=KILL_SWITCH_EVENT`
- B) Kill switch por **ORG**
  - aplica: bloquear criação/publicação + bloquear checkouts + travar revenda
  - guardrail: API org/event + checkout + transfer
  - reversão: decisão em `SafetyCase` + expiração definida
  - audit: EventLog `safety.kill_switch.org` + `reasonCode=KILL_SWITCH_ORG`
- C) Kill switch por **IDENTITY**
  - aplica: bloquear compras/transferências, exigir step‑up, suspender sessão
  - guardrail: auth + createCheckout + transfer
  - reversão: decisão em `SafetyCase` + expiração definida
  - audit: EventLog `safety.kill_switch.identity` + `reasonCode=KILL_SWITCH_IDENTITY`

Nota (FECHADO): em Stripe Connect Standard, a ORYA não controla directamente payouts do Connected Account.
As medidas de mitigação são operacionais: bloquear novas vendas/checkouts, desactivar eventos, aplicar step‑up,
limitar acções de risco e, quando aplicável, iniciar refunds/chargeback workflows.
Qualquer controlo fino de transferências/payout holds é fora do v1.x e requer revisão do funds flow/account type.

- Risk flags automáticos (motor mínimo v1):
  - Chargeback rate acima de threshold (por organização e por evento)
  - Padrões anómalos de venda (picos, múltiplas compras por identidades correlacionadas, repetição de IP/device)
  - Revenda suspeita (tentativas repetidas, padrões de scalping, abuso de 0€)
  - Check‑in anómalo (múltiplos denies/duplicates por scanner/evento)
- Integração com Finanças:
  - `risk.flagged` pode activar: step‑up, limits, bloqueio temporário de criação de eventos/checkouts e revisão manual (D4/D9).

19.3 Suporte & Operação (quando falha às 02:00) — **FECHADO**
19.3.0 Kill Switches & Degraded Modes (NORMATIVE)
The platform MUST support operational kill switches to limit blast radius.

Examples include:
- disabling new checkouts while allowing check-in
- pausing payouts while preserving ledger integrity
- freezing promotions or codes during abuse spikes

Kill switches MUST:
- be reversible
- be auditable
- not violate SSOT or ledger invariants

Degraded operation is preferred over full outage.

- Support Playbook (runbooks) obrigatório:
  - Pagamento preso (PROCESSING / REQUIRES_ACTION)
  - Webhook falhou / DLQ a crescer
  - Check‑in lento / rede instável no recinto
  - Erro em refunds/chargebacks
  - Incidente de segurança (conta comprometida / fraude)
- Modos operacionais:
  - “Recinto” (check‑in): prioridade operacional, UX de fallback e mensagens claras.
  - “Finance ops”: triagem de disputes/refunds com logs e trilho de auditoria.
- Escalação (SLA interno):
  - L1 suporte → L2 operações → engenharia on‑call → decisão (admin).
- Observabilidade mínima (sempre ligada):
  - Logs, métricas, tracing onde possível; dashboards por domínio (Finanças, Jobs, Check‑in, Address).
  - Alertas críticos (pagers) quando:
    - DLQ > 0 por mais de X min
    - webhook failure rate acima de threshold
    - taxa de `payment.processing` > threshold
    - `processorFeesStatus` não fecha dentro de janela (p95)
    - drift jobs acusam inconsistências acima de threshold
- Backups & Restore (targets internos):
  - RPO/RTO normativos (targets operacionais):
    - DB transaccional: RPO ≤ 1h, RTO ≤ 4h
    - Config/policies (fee policies, access policies): RPO ≤ 15m, RTO ≤ 2h
    - Logs/EventLog (auditoria): RPO ≤ 24h, RTO ≤ 12h
  - Backups automáticos + retenção por política.
  - **Teste de restore inicial** obrigatório no Go‑Live.

19.3.1 Backups reais (Supabase → AWS) — **FECHADO**
Como o DB está em Supabase na Fase 1, a estratégia de backup é:
- Primário: PITR/Backups geridos pelo Supabase (conforme plano).
- Secundário (AWS): export automatizado para S3 (diário) + retenção por policy:
  - dumps encriptados (KMS) + versioning + lifecycle (ex.: 30/90/365 dias conforme classe).
- Restore:
  - runbook para restore via Supabase + validação pós‑restore (smoke tests).
  - 1º restore test obrigatório antes do Go‑Live (19.0).

19.4 Governança de Dados (RGPD / DSAR) — **FECHADO**
19.4.0 Data Classification & Purpose Binding (NORMATIVE)
All data within the ORYA platform is classified and handled according to its sensitivity and purpose.

### Data Classes
- **PII:** personal identifiers (email, name, phone)
- **FINANCIAL:** ledger entries, payouts, fees, invoices
- **AUDIT:** immutable logs, access trails, reconciliation records
- **OPERATIONAL:** configs, schedules, availability
- **PUBLIC:** content explicitly marked as public

### Purpose Binding
Each data class MUST:
- be collected for an explicit purpose
- not be reused for unrelated purposes
- respect least-retention necessary for that purpose

Access outside declared purpose is forbidden.

- Direitos do titular (DSAR) — fluxos obrigatórios:
  - Exportar dados (“download my data”) em formato portátil.
  - Eliminar conta (“delete account”) com:
    - apagamento/anonymize de PII onde permitido
    - preservação legal do que for obrigatório (ex.: registos contabilísticos/financeiros)
  - Prazos e tracking:
    - pedidos registados com `dsarCaseId`, status, datas, evidência de cumprimento.
- Retenção por categoria:
  - Ledger/finanças/auditoria: retenção legal (Portugal) + minimização de PII.
  - EventLog técnico e logs: conforme 12.2.1 (sem PII directa).
  - PII: apenas enquanto necessário para prestação do serviço + base legal documentada.
- Minimização / pseudonimização:
  - IDs/pseudónimos em logs; emails/telefones apenas em sistemas próprios e protegidos.
  - Hashes para dedupe e anti‑abuso (sem reidentificação indevida).
- Segurança:
  - Encryption at rest e in transit.
  - Segredos em Secrets Manager/SSM; rotação; acesso mínimo.

19.4.1 Tabela de Retenção (normativa) — **FECHADO**
ADITAMENTO FECHADO: valores default e tratamento no delete account.

| Categoria de dados | Exemplos (entidades/tabelas) | Retenção | Base legal | Tratamento no delete account |
|---|---|---|---|---|
| Ledger/financeiro | `LedgerEntry`, `Payment`, `Refund`, `Dispute`, `Invoice` | 10 anos | obrigação contabilística/fiscal | **Preservar**; remover PII directa + `identityRef` → pseudónimo |
| Aceites legais/consentimentos | `LegalAcceptance`, `PrivacyConsent` | 10 anos | obrigação legal / defesa jurídica | **Preservar** pseudonimizado |
| Identidade & perfil | `Identity`, `UserProfile`, `OrganizationMember` | duração da conta + 30 dias | contrato / consentimento | **Anonymize** (remover PII) |
| Tickets/Entitlements/Check‑in | `Ticket`, `Entitlement`, `CheckinLog` | 2 anos após evento | contrato / legítimo interesse | **Anonymize** `identityRef`, manter integridade |
| Safety/Abuso | `SafetyCase`, `risk.flag` | 5 anos | legítimo interesse / defesa jurídica | **Preservar** pseudonimizado |
| EventLog/Audit | `EventLog`, `AuditLog` | 2 anos | legítimo interesse / segurança | **Preservar** pseudonimizado |
| Notificações/Support | `NotificationLog`, `SupportTicket` | 12 meses | contrato / legítimo interesse | **Anonymize** PII |
| Logs técnicos | access logs, IP/device | 90 dias | segurança | **Preservar** apenas hashes |
| Ficheiros/uploads | anexos, imagens | até fim do evento + 30 dias | contrato | **Apagar** |

Regra: se existir **legal hold** (dispute/obrigação legal), o delete account **não** remove dados bloqueados; apenas minimiza PII e regista motivo no `dsarCaseId`.

19.4.2 Regras de Anonymize / Detach — **FECHADO**
ADITAMENTO FECHADO: procedimento técnico mínimo.
- Remover/limpar PII directa: `email`, `phone`, `fullName`, `address`, `dob`, `documentId`, `avatarUrl`.
- Detach de referências externas: remover `stripeCustomerId` quando permitido; manter apenas referências financeiras legalmente obrigatórias.
- Pseudónimos e hashes:
  - `emailHash`/`phoneHash` via HMAC com segredo rotativo; uso exclusivo para dedupe/anti‑abuso.
  - hashes **não** são reidentificáveis sem segredo; acesso restrito.
- Integridade referencial:
  - substituir `identityRef` por `anonymizedIdentityRef` em `LedgerEntry`, `Ticket`, `Entitlement`, `CheckinLog`, `EventLog`.
  - manter `subjectType`/`subjectId` para auditoria sem PII.
- DSAR export (“download my data”) **inclui**:
  - perfil/conta, memberships, compras, tickets/entitlements, refunds, histórico de check‑in, consentimentos, notificações enviadas, pedidos de suporte.
- DSAR export **exclui**:
  - segredos, chaves, regras internas de risco, notas internas de moderação, evidência sensível de terceiros.

19.5 Account Security (ATO / Account Takeover) — **FECHADO**
19.5.0 Threat Model (NORMATIVE)
The platform explicitly defends against the following primary threats:
- Account Takeover (ATO)
- Cross-organization data leakage
- Replay and duplicate execution
- Webhook spoofing
- Privilege escalation via RBAC
- Financial double-spend or reconciliation drift

Mitigations include:
- strict org isolation
- idempotency at all side-effect boundaries
- append-only ledger
- fail-closed authorization
- audit trails for all sensitive actions

Any new feature MUST be evaluated against this threat model.

- Email verificado obrigatório para acções de risco:
  - comprar, revender/transferir, alterar email, alterar payout settings (org), aceder a Finanças (org).
- Rate limit global por IP/device/identity em:
  - login, reset password, magic links, invite token, QR token, createCheckout.
- Sessões:
  - refresh tokens rotativos + revogação em logout e mudança de password.
- Step‑up de segurança:
  - comportamento suspeito → captcha/turnstile + re‑auth obrigatório.
- Auditoria:
  - `security.alert` (EventLog) para logins suspeitos e acções de risco.

19.6 Qualidade & Release Gates (DoD “produção”) — **FECHADO**
- Nenhum release sem:
  - Contract tests a passar (golden tests) — ver 12.6
  - Architecture tests a passar (owners, Stripe só em Finanças, etc.) — ver 12.6
  - Idempotência verificada nos fluxos críticos (checkout/refund/fulfillment/check‑in)
  - SLIs/alertas actualizados e dashboards válidos (14.1.1)
  - Runbooks actualizados para mudanças de comportamento
- Golden Set (obrigatório) — **FECHADO** (ADITAMENTO)
  - `createCheckout` idempotente: replay com o mesmo `idempotencyKey` **não** duplica `Payment`/`LedgerEntry`
  - Webhooks fora de ordem não corrompem estados (`Payment`/`Refund`/`Dispute`)
  - Refund parcial revoga **apenas** os entitlements correctos
  - `dispute.created` suspende entitlement + bloqueia entrada (se aplicável) + cria `SafetyCase` com `reasonCode=RISK_DISPUTE_CREATED`
  - Claim guest → user não duplica ownership nem tickets
  - Check‑in duplicate gera `reasonCode=CHECKIN_DUPLICATE` + audit em `EventLog`
  - Reconciliação ledger vs processor detecta divergência e gera alerta crítico
- Regressões automáticas (alertas):
  - divergência ledger vs processor (reconciliação)
  - pagamentos presos acima do normal
  - falhas em jobs críticos / DLQ
  - spikes de `checkin.denied`/`duplicate`
  - spikes de `free_checkout.denied` (anti‑abuso)

19.7 Hardening (Fase 2/3) — **FECHADO**
- DR “game days” (semestral):
  - simular indisponibilidade de componentes críticos (fila/jobs, storage, compute)
  - validar recuperação e impacto em RPO/RTO
- Restore tests recorrentes + relatórios assinados.
- Observabilidade avançada (tracing end‑to‑end, SLOs por domínio).
- Risk engine mais sofisticado (modelos e regras dinâmicas).
- Automação de DSAR e auditorias internas periódicas.


ANEXO A — Padel (Plano de Excelência)

**Nota de integração:** este anexo detalha o vertical Padel. Tudo o que for pagamento, identidade, entitlements, refunds, RBAC, endereços e notificações **obedece** às decisões e SSOTs do blueprint principal (v9). Se houver conflito, vence o blueprint.

# ORYA — Padel (TO-BE) — Plano de Excelência

**Estrutura obrigatoria:** Ferramenta A (Padel Clube) / Ferramenta B (Padel Torneios) / Integracoes (contratos).  
Nao colocar infra de Reservas/Financas/CRM dentro de Padel.

**Regra de hierarquia (obrigatória):** este anexo é subordinado ao **ORYA — Blueprint Final v9 (SSOT)**.
Em caso de conflito, vence o **v9**.
O Padel define apenas domínio/UX; owners e contratos permanecem os do v9.


---

## 0) Objetivo e Princípios

**Objetivo:** elevar o ecossistema ORYA de Padel ao nível das melhores plataformas globais (Padel Manager, Playtomic Manager, Tournament Software, PadelTeams), criando **duas ferramentas distintas e integradas**:
1. **Gestão de Clube de Padel**
2. **Gestão de Torneios de Padel**

**Princípios (TO-BE):**
- **Simples e automático:** defaults fortes, pouco atrito.
- **Operacional e robusto:** tudo funciona em tempo real, com logs e controlo.
- **Experiência premium:** organizadores e jogadores com UX limpa e previsível.
- **Integração total:** clube, torneio, CRM, perfis e estatísticas em sintonia.
- **SSOT v9:** Financas/Reservas/Check-in/CRM/RBAC/Address seguem o v9; Padel nunca duplica logica.

---

## 1) Base AS-IS (resumo)


**Estado atual relevante (resumo):**
- Padel existe como preset de torneio, com Wizard e Hub Padel.
- Há clubes, courts, staff, categorias, regras, matches, standings e live via SSE.
- Páginas públicas + widgets + exports existem.
- Algumas areas-chave estão **parciais** (ex.: cancelamentos, check-in, acessibilidade).

---

## 2) Ferramenta A — Gestão de Clube de Padel (TO-BE)

### 2.1 Reservas e Agenda Inteligente
- **SSOT em Reservas (v9):** Padel consome a Agenda Engine via contrato, nao cria agenda propria.
- **Pagamentos via Financas:** reservas chamam `createCheckout` (Financas); nenhum modulo cria intents Stripe.
- Multi-clube e multi-court com agendas independentes.
- Otimização de ocupação (open matches, listas de espera) conforme regras de Reservas (Fase 2).
- Integração com torneios via **MatchSlot hard-block** e CalendarBlock (D3/D3.1).
- Agenda com visões dia/semana e drag & drop (UI), respeitando prioridades: HardBlock > MatchSlot > Booking > SoftBlock.

### 2.2 Sócios, Jogadores e Comunicação
- **CRM e Perfil unificado (owner: CRM/Perfil publico)** com tags/segmentos de Padel.
- **Credits/loyalty** apenas via Servicos/Financas/CRM (Fase 2), sem carteira paralela em Padel.
- Planos e passes (assinaturas/pacotes) via Stripe Billing (Fase 2).
- Comunicação via Notificações/Chat interno (owners core), com triggers a partir do EventLog.
- Matchmaking e comunidade (dominio Padel).

### 2.3 Aulas, Treinos e Academia
- **Owner: Servicos/Reservas.** Padel nao duplica logica de aulas.
- Gestão de treinadores com perfis públicos (via Servicos).
- Agenda de aulas (particulares e cursos) em Reservas.
- Pagamentos via Financas (createCheckout).
- Histórico e feedback via Servicos/CRM.
- Atalho direto ao módulo existente de serviços/aulas (UI).

### 2.4 Eventos Sociais e Ligas Internas
- Mix rápidos (Americano/Mexicano) — Fase 2.
- Ligas internas, ladders e rankings internos.
- Eventos personalizados e formatos flexíveis.

### 2.5 Pagamentos, Faturação e Relatórios
- **Checkout unificado via Financas** (gateway unico; D4).
- Ledger/fees/payouts/refunds como SSOT (Financas); Padel apenas consulta.
- Faturacao **nao obrigatoria** dentro da ORYA (D9.1); exports e trilho contabilistico sao obrigatorios.
- Dashboard financeiro com KPIs (derivado de Ledger + EventLog).
- Exportacoes (CSV/PDF) e integracoes contabilisticas (Fase 2).

### 2.6 Staff e Permissões
- RBAC centralizado (v9) com **Role Packs**: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE.
- Agenda de staff/treinadores via Reservas.
- Escalas e comunicação interna via Equipa/Chat interno.

### 2.7 Experiência do Jogador (Clube)
- Portal/app do jogador.
- Perfil unificado com estatísticas e reservas.
- Gamificação local (badges/objetivos).

---

## 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE)

### 3.1 Criação de Torneios (Wizard)
- Wizard dedicado a Padel (separado do wizard geral).
- Presets e templates de torneio (clonar e reutilizar).
- **MVP (v9):** eliminacao simples, grupos+eliminacao, round-robin.
- **Fase 2+:** Americano/Mexicano, ligas por equipas, double elimination.
- Circuitos e etapas com ranking cumulativo (Fase 2/3).
- Validações inteligentes e sugestões operacionais.
**Regra D1 (v9):** todo torneio Padel tem **eventId obrigatorio** (Eventos e owner da base).

### 3.2 Inscrições, Convites e Pagamentos
- Onboarding competitivo obrigatório.
- Convite de parceiro simplificado + status claro (alinhado com **EventAccessPolicy**).
- Pagamento full/split **via Financas** com regra 48/24 (D12): confirmacao so com ambos pagos.
- Waitlist com promocao automatica (Fase 2).
- Comunicacao pre-torneio via Notificacoes/Chat interno (owners core).
- Multilinguagem nas paginas publicas (Fase 2).

### 3.3 Formatos, Chaves e Geração de Jogos
- Geração automática + ajustes manuais.
- Suporte robusto aos formatos **MVP** (KO, grupos+KO, round-robin).
- Formatos adicionais (A/B, consolacoes, double elimination, Americano/Mexicano) em Fase 2+.
- Seeding explícito + regras de desempate visíveis e aplicadas.
- Calendarização premium com drag & drop.
- Respeito de bloqueios e disponibilidades.
- Gestão de atrasos com impacto no cronograma.

### 3.4 Operação Live
- Check-in de equipas/duplas via **Entitlement + Check-in Policy** (owner: Check-in).
- Manual no painel; self check-in apenas Fase 2 (com guardrails).
- Interface de árbitro/mobile para score.
- Live score robusto com status/tempo.
- Streaming integrado (por court/jogo).
- Monitor/TV com dashboards ricos.
- Notificações de chamada de jogo e progresso.
- WO, disputa e logs visíveis.

### 3.5 Páginas Públicas e Widgets
- Páginas ricas (Calendário, Chaves, Resultados, Classificações).
- Widgets embedáveis adicionais (placar live por jogo) — Fase 2.
- Partilha/SEO e URLs por jogo.
- Galeria e multimédia (Fase 2).

### 3.6 Rankings, Histórico e Perfis
- Rankings internos e por circuito.
- Integração opcional com federações.
- Perfis competitivos avançados (stats + conquistas).
- Relatórios pós-evento para organizadores.

### 3.7 Governança e Qualidade
- Logs e auditoria centralizados.
- Permissões multi-admin (árbitros/co-organizadores).
- Plano de contingência (exports PDF/backup).
- Ajuda in-app e suporte rápido.
- Políticas de cancelamento/reembolso claras.
- Acessibilidade e UX premium.

---

## 4) Integração entre as Duas Ferramentas

- Criação de torneio a partir do clube (atalho com pré-preenchimento).
- Seleção de clube no torneio com courts e staff herdados.
- Perfil do jogador unificado entre reservas, aulas e torneios.
- Cross-promotions (reservas → torneios; torneios → aulas).
- Módulos distintos, experiência unificada no frontend.
- **Pagamentos e refunds** sempre via Financas (D4).
- **Acesso/convites** sempre via EventAccessPolicy (D8).
- **Check-in** sempre via Entitlements (Sec. 7).
- **Moradas** via Address Service (D11).
- **Inscricoes vs bilhetes:** Padel cria inscricoes; Eventos cria bilhetes; pagamentos via Financas; check-in respeita policy.

---

## 5) Fundamentos Operacionais (para ficar “perfeito”)

### 5.1 Agenda Engine (Single Source of Truth)
- **CalendarResource:** `clubId`, `courtId`, `trainerId` (recursos).
- **CalendarBlock:** bloqueios hard/soft.
- **Booking:** reserva paga.
- **EventMatchSlot:** slot de match.
- **ServiceSession:** aula/treino do módulo de serviços.
- **Availability:** opcional para staff/jogadores.

**Regra central:** tudo o que ocupa um court vira um item na Agenda Engine. Reservas, aulas e matches são apenas tipos diferentes.
**Prioridade v9 (D3/D3.1):** HardBlock > MatchSlot > Booking > SoftBlock, e **MatchSlot e sempre hard-block**.

**Mapeamento AS-IS (repo):** `PadelCourtBlock` → CalendarBlock, `PadelAvailability` → Availability, `PadelMatch` → EventMatchSlot, Serviços/Aulas → ServiceSession.

### 5.2 RBAC + Scopes por Ferramenta
**Roles base (v9):**
- OWNER, CO_OWNER, ADMIN, STAFF, TRAINER, PROMOTER, VIEWER

**Role Packs (v9):**
- CLUB_MANAGER → ADMIN + PADEL_*, RESERVAS_*, CHECKIN_*, CRM_RW, TEAM_R, SETTINGS_R
- TOURNAMENT_DIRECTOR → STAFF + PADEL_*, EVENTS_RW, CHECKIN_RW, RESERVAS_R
- FRONT_DESK → STAFF + CHECKIN_*, RESERVAS_RW, EVENTS_R, CRM_R
- COACH → TRAINER + RESERVAS_RW, PADEL_R, CRM_R
- REFEREE → STAFF + PADEL_RW, EVENTS_R, CHECKIN_R

**Scopes canonicos (v9):**
- EVENTS_*, PADEL_*, RESERVAS_*, FINANCE_*, CRM_*, SHOP_*, TEAM_*, SETTINGS_*, CHECKIN_*

**Regra:** Padel nao inventa scopes novos; usa os canónicos.

### 5.3 Fluxos de Dinheiro (Money Flows)
- **Stripe Connect obrigatorio por organizacao** (D4) e **MoR = Organizacao** (D9).
- **Financas como gateway unico:** createCheckout, refunds, disputes e ledger.
- **Fee policy versionada** + pricing snapshot (D4.2/D4.3).
- Split de receitas por sourceType (TICKET_ORDER / BOOKING / PADEL_REGISTRATION / STORE_ORDER), com payout timing por politica (PendingPayout).
- Faturacao **nao obrigatoria** na ORYA (D9.1); exports e trilho no ledger sao obrigatorios.

### 5.4 Booking Policy Presets
**Owner:** Reservas. Politicas sao aplicadas via Reservas e **snapshot imutavel** por booking (v9).

**Presets:**
- **Standard:** pagamento total online.
- **Flex:** depósito online + restante no clube.
- **Clube tradicional:** sem pagamento online (apenas bloqueia slot).

**Regras mínimas:**
- Reserva por utilizador ORYA ou guest booking (quando permitido por policy).
- Pagamento obrigatório vs “pagar no clube”.
- Depósito vs pagamento total.
- No-show fee configurável.

### 5.5 Ciclo de Vida do Torneio
- **Draft:** edição total.
- **Published:** inscrições abertas.
- **Locked:** quadro fechado, regras de refund mudam.
- **Live:** scores ativos e operação.
- **Completed:** exports finais + relatório.

**Regra v9:** transicoes publicam EventLog e aplicam politica de refund versionada (Financas).

---

## 6) Gap Analysis (AS-IS vs TO-BE)

**Definições de prioridade:**
- **Obrigatório:** entra no MVP/Fase 1.
- **Ideal:** fase de escala, não bloqueia MVP.

| Área | AS-IS | TO-BE | Notas |
|---|---|---|---|
| Reservas de courts | **Em falta** | F1 (Obrigatório) | Owner: Reservas/Agenda. |
| Agenda com drag & drop | Parcial | F1-C (Premium) | UI; respeitar prioridades D3. |
| Pagamentos em reservas | **Em falta** | F1 (Obrigatório) | Via Financas; sem Stripe direto. |
| CRM de sócios | Parcial | F2 | Owner: CRM. |
| Aulas integradas | Parcial | F1 (atalho) / F2 (integração) | Owner: Servicos. |
| Mix rápidos (Americano/Mexicano) | Parcial | F2 | Formatos adicionais. |
| Wizard dedicado Padel | Parcial | F1-B/C | Padel separado do wizard geral. |
| Formatos Americano/Mexicano | **Em falta** | F2 | Não bloqueia F1. |
| Circuitos/etapas | **Em falta** | F2/3 | Requer maturidade operacional. |
| Waitlist auto-promoção | Parcial | F2 | Em v9, waitlist é Fase 2. |
| Check-in | **Em falta** | F1 (Obrigatório) | Via Check-in + Entitlements. |
| Streaming integrado | **Em falta** | F3 | Link/iframe no MVP. |
| Monitor/TV enriquecido | Parcial | F2 | Monitor existe; elevar UX. |
| Exports premium (poster/PDF) | Parcial | F1 | Qualidade a elevar. |
| Acessibilidade formal | **Em falta** | F1-C | UX premium obrigatória. |

---

## 7) Roadmap Proposto (alto nível)

**Pre-requisito (v9 F1-A):** EventBus/EventLog, Financas como gateway, Address Service, RBAC v2, contratos base concluídos.

**Fase 0 — Alinhamento e Fundação**
- **Confirmar e fixar implementação do que já está FECHADO no v9** (sem reabrir decisões).
- Definir taxonomias e SSOT (clubes, courts, staff, categorias).
- Padrões de UX, acessibilidade e logs alinhados com v9.
- **DoD da Fase 0:** contratos (12.6.1) com tests “golden”, owners enforce (lint/architecture tests), e checklist operacional (jobs/DLQ/ops) pronto.

**Fase 1 — MVP Premium (Padel alinhado com v9 F1-B/C)**
- **Clube:** cadastro completo, moradas normalizadas (Address Service), courts, staff, hub.
- **Reservas:** slots configuráveis + pagamentos via Financas (createCheckout).
- **Torneios:** wizard dedicado, seleção de clube (own/partner), categorias, regras e geração de jogos (KO/grupos+KO/round-robin).
- **Split payment:** regra 48/24 + matchslots hard-block + resolução determinística.
- **Check-in:** Entitlements + policy (manual; self check-in F2).
- **Operação:** auto-schedule, live score, páginas públicas e exports básicos.

**Fase 2 — Upgrade Core**
- **Clube:** CRM/planos, aulas integradas, relatórios financeiros base.
- **Torneios:** presets/templates, waitlist automática, Americano/Mexicano, double elimination.
- **UX:** multilinguagem base e monitor/TV melhorado.

**Fase 3 — Premium + Escala**
- Streaming avançado + widgets live.
- Circuitos/etapas, rankings avançados, integrações com federações.
- Acessibilidade formal e auditoria completa (se ainda houver gaps).

---

## 8) Fase 1 — 10 Features Irrenunciáveis (MVP)

1. Club CRUD + courts + staff (Address Service).
2. Agenda engine + bloqueios hard/soft (MatchSlot sempre hard).
3. Reservas com slots + pagamento via Financas (1 metodo).
4. Wizard Padel dedicado (core).
5. Evento base + categorias + inscricoes alinhadas com **EventAccessPolicy**.
6. Generate matches (formatos base: KO, grupos+KO, round-robin).
7. Calendarizacao (auto-schedule + manual assign).
8. Split payment 48/24 + resolucao deterministica.
9. Live score + monitor + check-in via Entitlements.
10. Public page + standings + bracket + exports basicos.

**Tudo o resto entra explicitamente em Fase 2+.**

---

## 9) Checklist por Sprint (executável)

- [ ] **Sprint 0 — Fundação**
  - [ ] **Congelar implementação do FECHADO**: EventAccessPolicy, split 48/24, refund policy, check-in via Entitlements (sem reabrir decisões).
  - [ ] **Contract tests** (12.6.1) + “golden tests” para cada contrato.
  - [ ] **Architecture tests**: falhar build se alguém importar Stripe fora de Finanças; falhar build se alguém escrever fora do owner.
  - [ ] Definir padrões de dados e nomenclaturas.
  - [ ] Mapear fluxos críticos (clube → torneio → público).
- [ ] **Sprint 1 — Club Core**
  - [ ] CRUD de clubes + moradas normalizadas (Address Service).
  - [ ] Courts e staff completos.
  - [ ] Agenda base com bloqueios.
- [ ] **Sprint 2 — Reservas + Pagamentos**
  - [ ] Reserva de courts com slots configuráveis.
  - [ ] Pagamento online via Financas (createCheckout) + ledger.
  - [ ] Regras de cancelamento/no-show (waitlist em Fase 2).
- [ ] **Sprint 3 — Torneio Core**
  - [ ] Wizard dedicado Padel.
  - [ ] Seleção de clube own/partner + EventAccessPolicy.
  - [ ] Categorias, formatos base e geração automática.
- [ ] **Sprint 4 — Operação & Público**
  - [ ] Auto-schedule + drag & drop (se aplicável).
  - [ ] Live score estável + monitor.
  - [ ] Check-in via Entitlements + paginas publicas + exports basicos.
- [ ] **Sprint 5 — Escala**
  - [ ] Presets/templates, Americano/Mexicano, circuitos e rankings (F2/3).
  - [ ] Streaming e widgets avançados (F3).
  - [ ] Acessibilidade e auditoria completa (F1-C se ainda houver gaps).

---

## 10) Decisões Fechadas (versão final)

### 10.1 Reservas de courts
**Decisão:** Slots configuráveis com bloqueios (base), com duas vistas: slots fixos e janelas flexíveis.
**Regra v9:** owner = Reservas; MatchSlot e sempre hard-block (D3/D3.1).

**Standard (Ferramenta A):**
- Duração base (ex: 60/90 min), buffer (ex: 10 min), horários do clube, regras por court.
- Templates de slots por dia da semana (ex: 08:00–23:00 em blocos).
- Bloqueios por torneio/treino/manutenção/eventos privados.
- Bloqueios “soft” (preferência) vs “hard” (indisponível).

**Quando usar janelas flexíveis (Ferramenta B):**
- Torneios e operação com duração estimada + buffer.
- Motor de agenda único com dois modos de visualização.

**Porquê:** slots fixos são o padrão mental do clube; janelas flexíveis são essenciais para torneios.

### 10.2 Aulas
**Decisão:** Atalhos já no MVP; integração total na Fase 2.

**MVP:**
- Bloco “Aulas” na Ferramenta A com KPIs rápidos.
- Botão “Gerir Aulas” → Serviços > Aulas.
- Toggle “Ativar Aulas no Clube” (visibilidade, sem lógica duplicada).

**Fase 2:**
- Aulas geram bloqueios automáticos de courts.
- Instrutores como staff com permissões.

**Porquê:** evita duplicação de lógica e dívida técnica no MVP.

### 10.3 Formatos prioritários
**Decisão (alinhada com v9):** MVP com formatos base; Americano/Mexicano entra em Fase 2.

**Ordem recomendada:**
1. KO + Grupos+KO + Round-robin (MVP/F1)
2. Americano/Mexicano + Double elimination (F2)
3. Liga/Circuito (F3)

**Porquê:** formatos base estabilizam operacao; Americano/Mexicano e ligas exigem maturidade.

### 10.4 Cancelamento / reembolso
**Decisão:** Defaults globais com overrides por evento.
**Owner:** Financas. Politicas versionadas + aplicadas via ledger/refund (D4.2/D4.3).

**Modelo:**
- Política global (org/plataforma) com regras base.
- Override por evento com presets: Flexível / Standard / Rígido.
- Ajuste máximo de 2–3 parâmetros (ex: horas limite, taxa, bloqueio após draw).

**Porquê:** evita caos operacional e mantém flexibilidade comercial.

### 10.5 Check-in
**Decisão:** Check-in via **Entitlement + Check-in Policy** (v9).

**MVP:**
- Staff marca presença no painel.
- QR do **Entitlement** (ticket/booking/inscricao) para validação rápida.
- Respeitar `EventAccessPolicy.checkin` (ver Secção 8).

**Fase seguinte (opcional):**
- Self check-in com geofencing/limites (Fase 2).

**Porquê:** mantém controlo em torneios reais com menos fricção.

### 10.6 Streaming
**Decisão:** Link/iframe no MVP; integração avançada depois.

**MVP:**
- Link de stream por torneio.
- Opcional: link por court/match.
- Embed simples (YouTube/Twitch).

**Depois:**
- Overlays, scoreboard sincronizado, patrocinadores, replay.

**Porquê:** valor imediato sem custo alto de integração.

### 10.7 Federações
**Decisão:** Export como base; API em fase de escala.

**MVP/V1:**
- Exports de inscritos, quadro, resultados, ranking, calendário.
- PDFs “federation-ready” + CSV padrão.

**Escala:**
- API direta quando houver tração e APIs estáveis.

**Porquê:** export resolve a maior parte do valor com custo menor.

---

## 11) Métricas de Sucesso (exemplos)

- Tempo médio para criar torneio completo (minutos).
- % de torneios com calendário auto-schedule bem-sucedido.
- Taxa de preenchimento de categorias (inscrição → confirmada).
- Ocupação média de courts (clubes).
- Engajamento do público (visitas públicas + partilhas).

---

## 12) Saída Esperada

- Duas ferramentas separadas (Clube / Torneio) integradas entre si.
- Fluxos simples, automáticos e robustos.
- Experiência pública premium e “shareable”.
- Plataforma ao nível PadelTeams (ou superior) em robustez e clareza.

---

## 13) Plano de Execução por Equipa

**Produto/UX**
- Definir IA final dos dois módulos (Club/Tournament).
- Especificar wizard dedicado e padrões de copy/validação.
- Desenhar páginas públicas premium + monitor/TV.
- Garantir acessibilidade e UX consistente entre módulos.

**Frontend**
- Implementar wizard dedicado Padel.
- Implementar reservas e agenda (slots + drag & drop).
- Integrar calendário avançado + auto-schedule UI.
- Páginas públicas premium + widgets avançados.

**Backend**
- Engine de reservas com regras e pagamentos via Financas.
- Endpoints para check-in, waitlist (Fase 2) e formatos extra.
- Logs/auditoria centralizados e exports premium.
- Integrações com pagamentos, streaming e federações (fase 3).

**Dados/DevOps**
- Observabilidade e métricas (SSE, jobs, pagamentos).
- Rotinas de backup/export e validações de consistência.
- Performance para 64+ equipas, multi-categoria.

---

## 14) Backlog Inicial (Epics)

1. **Clube Core**
   - CRUD clubes + moradas normalizadas.
   - Courts e staff completos.
   - Agenda base com bloqueios.
2. **Reservas**
   - Slots configuráveis + pagamentos.
   - Waitlist e cancelamentos.
   - Relatórios base.
3. **Torneio Core**
   - Wizard dedicado + seleção de clube own/partner.
   - Categorias + regras + geração automática.
4. **Operação Live**
   - Auto-schedule + calendário premium.
   - Live score + monitor.
5. **Experiência Pública**
   - Página pública premium.
   - Widgets e exports premium.

---

## 15) Tarefas por Epic (com critérios de aceitação)

### 15.1 Clube Core
- **Tarefa:** CRUD de clubes com morada normalizada.
  - **AC:** criação/edição exige seleção de sugestão; endereço normalizado guardado + lat/long.
- **Tarefa:** Courts com metadados (indoor/outdoor, piso, ordem).
  - **AC:** criar/editar/desativar courts; ordenação persistente; validações básicas.
- **Tarefa:** Staff com roles e herança para eventos.
  - **AC:** adicionar/remover staff; flag `inheritToEvents` refletido no torneio.
- **Tarefa:** Agenda base com bloqueios.
  - **AC:** criar bloqueios por court/dia; refletir indisponibilidade em reservas.

### 15.2 Reservas
- **Tarefa:** Slots configuráveis por clube (duração e janela).
  - **AC:** agenda diária respeita horários; slots gerados automaticamente.
- **Tarefa:** Checkout de reserva com pagamento online.
  - **AC:** pagamento via Financas cria reserva confirmada; falha não bloqueia agenda; ledger escrito.
- **Tarefa:** Waitlist e cancelamentos.
  - **AC:** cancelamento promove próximo da fila; notificação enviada.
- **Tarefa:** Regras de no-show e cancelamento tardio.
  - **AC:** política aplicada conforme configuração; logs auditáveis.

### 15.3 Torneio Core
- **Tarefa:** Wizard dedicado Padel.
  - **AC:** fluxo em passos; validações claras; checklist completo.
- **Tarefa:** Seleção de clube own/partner com courts/staff.
  - **AC:** own carrega courts/staff; partner restringe edição e exige staff local.
- **Tarefa:** Formatos base + geração automática.
  - **AC:** gera grupos/KO corretos; validações de capacidade.
- **Tarefa:** Seeding e publicação de chaves.
  - **AC:** seeds configuráveis por categoria; visíveis no UI; respeitados na geração.
- **Tarefa:** Regras e desempates configuráveis.
  - **AC:** regras por categoria; desempates aplicados e auditáveis.

### 15.4 Operação Live
- **Tarefa:** Auto-schedule + calendário premium.
  - **AC:** agenda automática sem conflitos óbvios; drag & drop atualiza slots.
- **Tarefa:** Live score estável.
  - **AC:** update em tempo real; estados consistentes; logs por alteração.
- **Tarefa:** Monitor/TV melhorado.
  - **AC:** mostra próximos jogos, resultados recentes, destaque live.
- **Tarefa:** Check-in de equipas.
  - **AC:** check-in manual + QR de Entitlement; bloqueia no-show conforme regra/policy.

### 15.5 Experiência Pública
- **Tarefa:** Página pública premium.
  - **AC:** tabs claras; regras do match visíveis; partilha fácil.
- **Tarefa:** Widgets avançados.
  - **AC:** bracket + calendário + próximos jogos embedáveis; responsivo (Fase 2).
- **Tarefa:** Exports premium (poster/PDF).
  - **AC:** export com layout consistente; pronto para imprimir.
- **Tarefa:** Multilinguagem base.
  - **AC:** PT/EN/ES para páginas públicas essenciais (Fase 2).

---

## 16) Análise do Plano ORYA — Excelência e Comparativo Global

### 16.1 Visão Geral e Objetivo de Excelência
O plano posiciona a ORYA ao nível das plataformas globais de referência (Playtomic Manager, Padel Manager, Tournament Software, PadelTeams) ao combinar duas ferramentas integradas: **Gestão de Clube** e **Gestão de Torneios**. A orientação para simplicidade, operação robusta em tempo real, UX premium e integração total reduz fricção entre módulos e entrega um ecossistema completo de padel.

### 16.2 Gestão de Clube (Ferramenta A) — análise comparativa
- **Reservas e agenda inteligente:** disponibilidade em tempo real, agenda multi-court, drag & drop, listas de espera e open matches (F2). Alinha-se com líderes como Playtomic, com a vantagem da agenda unificada com torneios.
- **Pagamentos integrados:** checkout unificado **via Financas** e políticas flexíveis (total, depósito ou offline). Esta flexibilidade supera modelos rígidos de marketplace.
- **CRM e comunidade:** perfil único do jogador, comunicação direta e matchmaking. Espaço claro para evoluir com rating de nível e evolução estatística.
- **Aulas e academia:** gestão de treinadores, agenda e pagamentos; integração faseada evita dívida técnica no MVP.
- **Eventos sociais e ligas internas:** Americano/Mexicano (F2), ladders e ranking interno, reforçando engajamento semanal.
- **Relatórios e analytics:** dashboards financeiros e operacionais alinhados com práticas internacionais.
- **Staff e permissões:** RBAC granular para operação segura e escalável.

**Conclusão (Clube):** o escopo cobre o estado da arte e adiciona integração e flexibilidade que muitas plataformas não oferecem.

### 16.3 Gestão de Torneios (Ferramenta B) — análise comparativa
- **Wizard dedicado:** presets, templates e validações inteligentes reduzem atrito e tempo de configuração.
- **Inscrições e pagamentos:** convite de dupla simplificado, split payment guiado **via Financas**; waitlist automática (F2).
- **Formatação e chaves:** formatos base (MVP) com extensões F2; seeding explícito, desempates visíveis e geração automática robusta.
- **Operação live:** check-in, score em tempo real, monitor/TV, notificações e logs de disputa.
- **Páginas públicas e widgets:** páginas ricas e embedáveis com foco em partilha e visibilidade.
- **Rankings e histórico:** evolução do jogador, rankings e exports “federation-ready”.

**Conclusão (Torneios):** cobre o state of the art e acrescenta recursos que muitas plataformas ainda não integram no mesmo ecossistema.

### 16.4 Integração Clube–Torneio (diferencial)
- Pré-preenchimento de dados do clube ao criar torneios.
- Agenda única para reservas, aulas e matches.
- Perfil unificado do jogador com histórico completo.
- Cross-promotion entre reservas e torneios.

**Conclusão:** integração orgânica é um diferencial claro face a soluções fragmentadas.

### 16.5 Fundamentos Operacionais e Qualidade Técnica
- **Agenda Engine única** evita conflitos e garante consistência.
- **RBAC + scopes** permitem delegação segura por função.
- **Money flows** explícitos (Stripe Connect, refunds, payouts, ledger).
- **Booking presets** garantem flexibilidade sem caos operacional.
- **Tournament lifecycle** organiza políticas e operação por estado.

**Conclusão:** base técnica sólida para operação em escala.

### 16.6 Comparativo com plataformas líderes
- **Playtomic:** ORYA empata em reservas/comunidade e supera em profundidade de torneios e flexibilidade de políticas.
- **Padel Manager:** ORYA cobre o mesmo escopo e tende a superar em UX, live ops e integração total.
- **Tournament Software/Tournify:** ORYA iguala robustez de chaves e supera com pagamentos e operação integrada.
- **PadelTeams:** ORYA cobre ligas e torneios e acrescenta reservas, aulas e agenda única.

### 16.7 Recomendações e aprimoramentos
- Considerar **rating de nível** (Elo/Glicko) para matchmaking e evolução do jogador.
- Expandir gamificação com metas e conquistas ligadas a reservas e torneios.
- Garantir UX mobile de referência e suporte in-app rápido.

### 16.8 Conclusão
Em escopo e arquitetura, o plano é **equivalente ou superior** às referências globais. O fator decisivo para liderança será execução rigorosa, UX impecável e estabilidade operacional.

### 16.9 Referências (a inserir)
- Playtomic Manager, Padel Manager, Tournament Software, PadelTeams, Tournify e apps de padel com foco em comunidade e ranking.

---

## 17) Integração com Ferramentas ORYA (para distribuição correta de escopo)

### 17.1 O que **não** deve viver nas ferramentas de Padel
Estas áreas devem ser **donas** noutras ferramentas e apenas integradas:
- **CRM:** perfis, segmentação, comunicação, histórico do cliente.
- **Finanças:** pagamentos, reembolsos, comissões, ledger, payouts.
- **Equipa:** gestão de colaboradores, roles e permissões globais.
- **Check-in:** processo único de credenciamento/presença.
- **Formulários:** campos customizados, termos e consentimentos.
- **Promoções:** descontos, cupons e campanhas.
- **Loja:** produtos, pagamentos e fulfillment.
- **Chat interno:** comunicação operacional da equipa.
- **Definições:** políticas, branding, idiomas e configuração global.

**Regra:** as Ferramentas de Padel **consomem** estas capacidades via integração e deep links, sem duplicar lógica.

### 17.2 O que fica **dentro** das ferramentas de Padel
- **Ferramenta A (Clube):** clubs/courts/staff local, agenda operacional, bloqueios, vista de reservas, insights do clube.
- **Ferramenta B (Torneios):** formatos, categorias, seeds, matches, bracket, live ops, páginas públicas.

### 17.3 Matriz de responsabilidade (owner vs integração)

| Capacidade | Dono (Ferramenta) | Uso em Padel |
|---|---|---|
| Reservas | Reservas | Padel A/B consome agenda e bloqueios. |
| Check-in | Check-in | Padel B usa status e valida presença. |
| CRM | CRM | Padel A/B lista participantes e comunica. |
| Finanças | Finanças | Padel A/B envia cobranças e consulta ledger. |
| Equipa | Equipa | Padel A/B respeita RBAC e roles globais. |
| Formulários | Formulários | Padel B usa para inscrição e waivers. |
| Promoções | Promoções | Padel A/B aplica cupons em reservas/inscrições. |
| Loja | Loja | Padel A/B pode vender extras (opcional). |
| Chat interno | Chat interno | Padel A/B abre canais de operação. |
| Perfil público | Perfil público | Padel usa pages e perfis unificados. |
| Eventos | Eventos | Torneio Padel herda base de evento. |

### 17.4 Integrações mínimas obrigatórias
- **Agenda Engine única** consumida por Reservas/Padel/Aulas.
- **RBAC centralizado** com scopes globais.
- **Pagamentos unificados** via Finanças (Stripe/ledger).
- **Single Profile** (CRM/Perfil público) para jogadores e clubes.
- **Deep links** entre ferramentas para evitar duplicação.

### 17.5 Ajustes recomendados ao plano
- Mover “comunicação com jogadores” para CRM e Chat interno.
- Mover “checkout unificado” para Finanças (Padel apenas chama).
- Mover “check-in” para a Ferramenta Check-in, mantendo UI de acesso no Padel.
- Mover “formulários/waivers” para Formulários, com embed no Padel.
- Manter Padel focado em **competição e operação**, não em infraestrutura.

---

## 18) Padel não monólito — redistribuição final e integração profunda

### 18.1 Regra de ouro
Padel não é um produto isolado; é uma **camada de domínio**. As ferramentas core (Reservas, Check-in, Finanças, Equipa, CRM, Eventos, Formulários, Chat interno, Promoções, Loja) são **donas** das suas capacidades. Padel integra e orquestra.

### 18.2 Redistribuição ideal (por ferramenta)

**Reservas (tool Reservas)**
- **Dono de:** slots, janelas, buffers, bloqueios hard/soft, waitlist, open matches, drag & drop.
- **Regra:** MatchSlot e sempre hard-block (D3/D3.1).
- **Padel:** templates/horários recomendados, vista filtrada por courts Padel, atalhos “criar bloqueio”.

**Finanças**
- **Dono de:** Stripe Connect obrigatorio, payouts (estado/visibilidade), refunds/chargebacks, fees, ledger e exports.
- **Padel:** KPIs por evento/clube + ações contextuais (deep link para reembolsos, payouts, exports).

**Equipa**
- **Dono de:** RBAC, roles globais, staff e escalas.
- **Padel:** atribuições específicas do torneio (ex.: árbitro do court, diretor do evento).

**Check-in**
- **Dono de:** QR, presença, no-show, penalizações.
- **Padel:** lista de participantes + regras de janela e penalizações.

**CRM**
- **Dono de:** membros, segmentos, comunicação e histórico.
- **Padel:** eventos/tags (ex.: “participou M4”, “no-show”, “2x/semana”).

**Eventos**
- **Dono de:** catálogo global, SEO, tickets, páginas base.
- **Padel:** wizard dedicado + estrutura competitiva (bracket/matches/rulesets).

**Formulários**
- **Dono de:** waivers, dados extra, imports e validação.
- **Padel:** exige formulário X para completar inscrição.

**Chat interno**
- **Dono de:** canais operacionais e mensagens internas.
- **Padel:** dispara eventos/alertas (atrasos, WO, mudanças de horário).

**Promoções + Loja**
- **Dono de:** vouchers, campanhas, bundles, produtos.
- **Padel:** habilita códigos e add-ons por torneio.

### 18.3 O que fica obrigatoriamente dentro de Padel (core)

**Padel – Torneios (dono):**
- Formatos base (KO, grupos+KO, round-robin). Americano/Mexicano + double elimination em Fase 2; ligas/circuitos em Fase 3.
- Seeding, rulesets, desempates, geração de jogos.
- Slots competitivos (gravados na Agenda Engine comum).
- Operação live: scoreboard, WO, dispute, undo, match states.
- Brackets, standings, widgets e páginas públicas específicas.
- Exports competitivos (bracket/resultados/ranking/calendário).

**Padel – Clube (dono):**
- Cadastro do clube de padel e metadados específicos.
- Courts com metadados padel (indoor/outdoor, piso, ordem).
- Regras operacionais específicas (buffers recomendados, templates Padel).
- Hub com KPIs e atalhos (sem duplicar Reservas/Finanças/CRM).

### 18.4 Buracos que vão bater em produção
- **Fronteiras e source of truth:** contrato explícito (Agenda/Finanças/Check-in/CRM).
- **Operação offline:** “imprimir e operar” + reconciliação pós-evento.
- **Lock states:** quem pode mexer no quê em estado Live.
- **Dispute flow:** resolução e auditoria com UX clara.
- **Modelo de negócio:** guest booking, depósito, regras de cancelamento por janela.
- **No-show:** lembretes automáticos e penalizações.
- **Métricas operacionais:** funil de reservas, funil split-pay, tempo até publicar, atrasos por court.

### 18.5 Recomendações cirúrgicas (sem rebentar scope)
1. **Rebatizar Ferramenta A** para “Configuração Padel + Atalhos”.
2. **Criar camada de integração (event bus interno)** com eventos:
   - `tournament.published`, `match.delayed`, `pairing.confirmed`,
     `booking.cancelled`, `refund.issued`.
3. **Hub Padel** com KPIs e atalhos: “Abrir Reservas”, “Abrir Check-in”, “Abrir Finanças”, “Abrir CRM”.

⸻

Apêndice A — Policy Defaults v1 (FECHADO)

A1) Rate Limits (segurança/anti‑abuso) — FECHADO
- Login:
  - 10 tentativas / 10 min por IP
  - 5 tentativas / 10 min por emailHash/identity
  - cooldown progressivo: 15 min → 60 min em falhas repetidas
- Reset password / magic link:
  - 3 pedidos / 30 min por emailHash
- createCheckout (Finanças):
  - 10 tentativas / 5 min por identityId + sourceId
  - 30 tentativas / 5 min por IP (hard cap)
- InviteToken validate/claim:
  - 10 tentativas / 10 min por IP/device
- Check‑in (scanner API):
  - 120 scans/min por deviceId (burst), média 60/min
  - 10 “denied” consecutivos → step‑up (re‑auth do staff) + throttle 5 min

A2) TTLs e janelas — FECHADO
- InviteToken TTL default: 7 dias (salvo override em EventAccessPolicy)
- EntitlementQrToken TTL default: 24h (rotacionável por job) + revogação imediata em disputa/refund
- Allow‑list “Modo Recinto” TTL: 2h (prefetch) + validade máxima offline: 30 min sem sync
- Username cooldown (rename): 15 dias (já definido; reafirmar FECHADO)
- Retenção de “offline_pending_sync” (check‑in): 7 dias

A3) FREE_CHECKOUT guardrails — FECHADO
- Default max por Identity e por (eventId + ticketTypeId): 1
- Rate limit FREE_CHECKOUT: 5 tentativas / 10 min por identityId; 10 / 10 min por IP
- Step‑up obrigatório (captcha/turnstile) quando:
  - ≥3 falhas em 10 min, ou
  - padrão suspeito (múltiplos identities no mesmo device/IP)

A4) SLIs/SLOs e Alert Thresholds — FECHADO
- API (p95):
  - leitura: p95 < 400ms
  - escrita crítica (checkout/checkin): p95 < 800ms
- Taxa de erro (5xx):
  - alerta amarelo: >1% em 5 min
  - alerta vermelho: >3% em 5 min
- Jobs:
  - fila crítica (payments/entitlements): atraso > 2 min → alerta
  - DLQ > 0 em jobs críticos → alerta imediato
- Webhooks Stripe:
  - eventos não reconciliados > 15 min → alerta

A5) SLA Suporte e Trust & Safety — FECHADO
- Pagamentos/Check‑in (P0): triagem ≤ 1h, mitigação ≤ 4h
- Fraude/Chargeback (P1): triagem ≤ 24h, acção ≤ 72h
- Denúncias conteúdo/comportamento (P2): triagem ≤ 24h, resolução ≤ 7 dias
- Comunicação incidentes:
  - P0/P1: status page + aviso às orgs afectadas em ≤ 2h

A6) Retenção por classe (RGPD by design) — FECHADO
- EventLog técnico (sem PII): 180 dias
- Audit logs (acções críticas): 2 anos (payload minimizado)
- Logs de delivery de notificações: 90 dias
- Dados financeiros/ledger/invoices: 10 anos (obrigação fiscal/contabilística)
- PII não essencial: apagar/anonimizar após 24 meses de inactividade (salvo obrigação legal)

A7) Risk Flags (heurísticas base) — FECHADO
- Chargeback rate por org:
  - >1% em 30 dias → flag amarela
  - >2% em 30 dias → flag vermelha + step‑up + suspensão de vendas até revisão
- Anomalia de vendas:
  - >3× média diária (7 dias) em <2h → alerta + revisão
- QR abuse:
  - ≥20 denied em 10 min no mesmo evento/device → throttle + re‑auth do staff


---

## Critical Flow Sequences (REFERENCE)

This appendix documents the authoritative interpretation of the most
critical system flows. It does not introduce new behavior but clarifies
expected execution order.

---

### F1 — Checkout → Payment → Ledger → Entitlement
1. Checkout intent is created
2. Payment is initialized (state machine)
3. Processor confirmation received (possibly async)
4. Ledger entries appended
5. Entitlement issued only after ledger truth
6. User access derives exclusively from entitlement

---

### F2 — Webhook Out-of-Order Handling
1. Webhook received
2. Event validated and deduplicated
3. Ledger reconciliation applied
4. Payment state updated if applicable
5. No mutation of historical ledger entries

---

### F3 — Check-In Validation
1. QR or identifier scanned
2. Entitlement resolved
3. Org context validated
4. Duplicate check-in detected or denied
5. Audit log appended

---

### F4 — Guest Purchase → Claim Flow
1. Guest checkout completed
2. Entitlement issued to GUEST_EMAIL identity
3. Verification link sent
4. Identity upgraded to USER
5. Entitlement re-bound without mutation

---
