# ORYA SSOT Registry

Atualizado: 2026-02-22

## 00 Authority

### 00.1 Metadata
- `effectiveDate`: 2026-02-12
- `owner`: Nuno (repo owner)
- `languagePolicy`: PT (inglês apenas para termos técnicos/rotas/identificadores)

### 00.2 Autoridade e Governação (NORMATIVO)
- Este é o **único** documento normativo da ORYA para arquitetura, regras, contratos e decisões fechadas.
- Este SSOT substitui **todas** as versões anteriores, incluindo drafts.
- Em caso de conflito entre documentos, prevalece este SSOT.
- Dentro deste SSOT, a ordem de precedência é: secções/regras **FECHADO** e, se persistir ambiguidade, a secção mais específica do domínio.
- Aprovação de alterações: **Nuno (owner do repositório)**.
- Sem aprovação explícita do owner, alterações ao SSOT são proibidas.
- Este documento não contém estado de implementação/runtime; contém apenas norma.

### 00.3 Escopo (NORMATIVO)
- Inclui invariantes globais, decisões fechadas, contratos C-G e C01..C18, tenancy, segurança, observabilidade, cut-line e produção.
- Todos os módulos (app, repo, server, jobs, DB) devem conformar-se a este SSOT.
- Planeamento, backlog e itens “a fazer” vivem em `docs/planning_registry_v1.md` (**NÃO-NORMATIVO**).

### 00.4 Ambiente & DB Única (NORMATIVO)
- ORYA opera com **uma única DB** quando `SINGLE_DB_MODE=1`.
- Nesse modo, `APP_ENV` é **forçado a `prod`** (sem “duplas verdades” na DB).
- Stripe pode ser **forçado localmente para teste** via `STRIPE_MODE=test` e `NEXT_PUBLIC_STRIPE_MODE=test` **sem alterar o ambiente da DB**.
- Em produção, **não** definir `STRIPE_MODE`; usa sempre chaves e webhooks **LIVE**.

### 00.5 Changelog Normativo Consolidado
- Check‑in: normalizado para `requiresEntitlementForEntry` (ticket = entitlement) e removida ambiguidade em torneios (QR_REGISTRATION).
- QR offline assinado: fechado como Fase 3 . PassKit na V1.5 mantém validação **online** (lookup por tokenHash).
- PricingSnapshot/fees: **estimates proibidas** (qualquer estimate é legado e não canónico); `processorFeesStatus=PENDING|FINAL` + `processorFeesActual` nullable até reconciliação. Net final deriva sempre do Ledger (append‑only).
- Ledger append‑only: tipos explícitos `PROCESSOR_FEES_FINAL` e `PROCESSOR_FEES_ADJUSTMENT`; net final = soma de entries por payment.
- Entitlements: `policyVersionApplied` alinhado e obrigatório para entitlements ligados a eventos.
- Contratos: Finanças passa a usar `customerIdentityId` (Identity SSOT) e snapshot fields alinhados.
- Address: removido conflito D11 vs D17 (Apple Maps como provider único).
- Domínio: mapa declarado “não exaustivo” + entidades mínimas adicionadas (Promoções/Notificações/Perfil/Pesquisa).
- Revenda: removidas referências a estado `USED`; consumo é metadata (`consumedAt`).
- Ticket: adicionado estado `DISPUTED` ao enum mínimo para consistência com chargebacks.
- Editorial: numeração 15.1 corrigida + referências SSOT alinhadas.
- Production Readiness: gate de go‑live + compliance/ops/DSAR/retention/release gates (Secção 19).
- Stripe: mapeamento por `orgType` FECHADO (`EXTERNAL`=Connect; `PLATFORM`=conta Stripe ORYA não-Connect) + onboarding Standard para `EXTERNAL` (D04.00.01 / C02.X01).
- Infra (PROD_FUTURA): estratégia de backup/restore para operação em produção + isolamento multi‑tenant (12.6.2 / 19.3.1).
- Check‑in: modo recinto (8.6) para fallback operacional sem offline QR.
- Policy Defaults v1 FECHADO (Apêndice A).
- Legal: sign‑off/versionamento FECHADO (19.1).
- Stripe Standard: mitigação operacional clarificada (sem controlo directo de payouts).
- Retenção: unificada com autoridade legal única em 19.4.1; janelas de 12.2.1/A6 passam a operacionais (hot/warm).
- Risk thresholds: autoridade única em 19.2.2; A7 fica apenas como resumo informativo sem números vinculativos.
- Naming contratual: `orgId` + `customerIdentityId` como shape canónico único (sem aliases externos).
- C01 (Agenda/Reservas): contrato atualizado para `resourceKey` global (`resourceType:authorityOrgId:resourceId`) e payload canónico cross-org.
- Arbitragem cross-org: algoritmo explícito com prioridade `HARD_BLOCK > CLASS_SESSION > MATCH(reasonCode=MATCH_SLOT) > BOOKING > SOFT_BLOCK`, `priorityRuleVersion` e fail-closed para tipo fora da versão ativa.
- Split: contrato antigo D12 (48/24) revogado para norma ativa `SPLIT_GARANTIDO` (`S01..S09`), com `deadlineAt`, `SettlementSnapshot` imutável, rails monotónicos e validação Stripe sandbox.
- Danger zone org: `suspend` owner-only com step-up obrigatório, auditoria before/after e reversão controlada na janela de 30 dias.
- Suspensão organização v2: reativação self-service do `OWNER` no dashboard/settings dentro da janela de 30 dias; eliminação definitiva só após fim dessa janela.
- Address autocomplete UX v1: dropdown canónico em overlay (sem reflow), relevância visual por secções e confirmação estrita por seleção normalizada (`addressId`).
- Criação de torneio Padel v1: entrada canónica fechada em `POST /api/org/[orgId]/tournaments/create`; `POST /api/org/[orgId]/events/create` rejeita payload Padel com `410 PADEL_CREATE_MOVED` e `target` explícito.
- Entrada de UI Padel: `/org/[orgId]/events/new?preset=padel` redireciona para `/org/[orgId]/padel/tournaments/create`.
- Lifecycle Padel: criação mantém `DRAFT` por contrato e publicação continua exclusiva em `/api/padel/tournaments/lifecycle`.

### 00.6 Registo de Decisão Normativa (NORMATIVO)
- Decisões FECHADO NÃO dependem de drafts/ficheiros temporários para serem válidas.
- Regra `forward-only` (ciclo ativo): o requisito de metadados obrigatórios aplica-se a:
  - novas decisões FECHADO;
  - decisões FECHADO alteradas a partir de `2026-02-12`.
- Cada decisão FECHADO nova/alterada DEVE incluir no SSOT (na secção correspondente):
  - `decisionId`
  - `owner`
  - `approvedAt`
  - `scope`
  - `rationale`
  - `migrationImpact`
- Decisões FECHADO históricas sem metadados completos não bloqueiam este ciclo, desde que:
  - constem no ledger de transição abaixo; e
  - não sejam alteradas sem receber metadados completos.
- `docs/planning_registry_v1.md` pode manter contexto e backlog, mas nunca é pré‑requisito de validade normativa.

#### 00.6.1 Ledger de transição (forward-only)
| decisionId | owner | approvedAt | scope | status | rationale | migrationImpact |
| --- | --- | --- | --- | --- | --- | --- |
| SSOT-2026-02-12-ORG-ROUTING | Nuno | 2026-02-12 | routing web/api org namespaces | FECHADO | eliminar ambiguidade entre alias e canónico | hard-cut estrito: web/API legacy passam a `410`; `/org/<non-numeric>` passa a `410`; consumo frontend/mobile fica apenas em `/org/:orgId/*` e `/api/org*` |
| SSOT-2026-02-13-ORG-HARDCUT-SUBNAV | Nuno | 2026-02-13 | hard-cut de legacy web + subnav dedicada por ferramenta | FECHADO | remover superfície legacy `/organizacao/*` e eliminar subnav partilhada no dashboard | `/organizacao/*` passa a `410`; slugs PT legacy em `/org/:orgId/*` passam a `410`; topbar resolve `toolKey -> subnav` 1:1; padel dividido em club/tournaments |
| SSOT-2026-02-14-MULTIORG-GOVERNANCE | Nuno | 2026-02-14 | Group governance, onboarding atómico e owner transfer por Group | FECHADO | fechar contratos multi-org sem dupla verdade e com enforcement transacional | `Group.ownerUserId` vira fonte única; join/exit/transfer por `/api/org-hub/groups/*`; `/api/org-hub/become` e owner transfer por org ficam `410` |
| SSOT-2026-02-14-SUPPORT-V1 | Nuno | 2026-02-14 | suporte v1 (form público + consola admin) | FECHADO | padronizar operação de suporte e trilha auditável | `POST /api/support/tickets`; admin em `/admin/suporte`; assunto canónico `[TICKET-<numero>] ...`; inbound email direto não abre ticket |
| SSOT-2026-02-14-LEGACY-HARDCUT-GLOBAL | Nuno | 2026-02-14 | hard-cut físico global de namespaces legacy org | FECHADO | eliminar convivência física legacy e fechar canonicidade end-to-end | remover `app/api/organizacao/**` e `app/organizacao/**`; consumo interno só em `/api/org*`, `/api/org-hub/*`, `/api/org-system/*`, `/org/*`, `/org-hub/*` |
| SSOT-2026-02-15-DASH-TOOLS-SETTINGS | Nuno | 2026-02-15 | dashboard ferramentas (visibilidade UI) + settings/nav + papéis PT | FECHADO | unificar linguagem de produto e separar capacidade de domínio vs visibilidade do dashboard | dashboard passa a "Ferramentas"; ocultar é só UI (não desativa backend) com preferência persistida por organização; `Settings` subnav remove `verify`; gestão de email oficial fica em `general`; rótulos de papel em PT (`Dono`, `Co-dono`) |
| SSOT-2026-02-15-FECHO-UNIFICADO-PROPAGACAO | Nuno | 2026-02-15 | C01 payload/resourceKey, Arbitration Service, Split V2 (`SPLIT_GARANTIDO`), HP-11 operacional | FECHADO | consolidar contratos finais desta ronda no SSOT e eliminar drift documental | `C01` passa a `resourceKey+authorityOrgId`; arbitragem cross-org ganha prioridade explícita versionada; D12 (48/24) fica revogado para norma ativa `S01..S09`; `suspend` owner-only com step-up/auditoria/reversão 30 dias |
| SSOT-2026-02-15-OFFICIAL-EMAIL-ROTATION-V2 | Nuno | 2026-02-15 | CAUTH.01 rotação de email oficial (ativo verificado + alteração pendente) | FECHADO | impedir regressão de estado verificado durante troca de email e formalizar cancelamento explícito do pendente | `Organization.officialEmail`/`officialEmailVerifiedAt` passam a representar apenas email ativo; pendente vive em `OrganizationOfficialEmailRequest`; contratos canónicos incluem `GET/POST/DELETE /api/org-hub/organizations/settings/official-email` + `POST /confirm`; UI separa ativo vs pendente |
| SSOT-2026-02-15-ORG-SUSPENSION-REACTIVATION-V2 | Nuno | 2026-02-15 | HP-11 suspensão/reativação owner-only + delete pós-janela | FECHADO | corrigir lacuna operacional de reativação e garantir lifecycle consistente sem perda de estado | contrato canónico passa a `GET/POST/DELETE /api/org-hub/organizations/:id/suspend`; `DELETE /api/org-hub/organizations/:id` só após `SUSPENDED` + janela 30d expirada; reativação exclusiva de `OWNER`; username mantém reserva durante suspensão; org suspensa deixa de expor superfícies públicas por `organizationId` |
| SSOT-2026-02-15-ADDRESS-AUTOCOMPLETE-UX-V1 | Nuno | 2026-02-15 | D11 UX operacional de procura de moradas (Address Service) | FECHADO | fechar consistência UX de topo sem quebrar invariantes canónicos de morada | dropdown passa a overlay em portal (sem empurrar layout), ranking visual em secções, confirmação obrigatória por seleção normalizada (`addressId`); texto livre sem seleção não pode virar morada canónica |
| SSOT-2026-02-21-RESERVAS-AULAS-TORNEIOS-HARDCUT | Nuno | 2026-02-21 | Fecho canónico de reservas de campos, aulas, torneios e serviços associados | FECHADO | eliminar ambiguidade de produto e execução, com regras únicas para grid, duração, modelação, conflitos, calendário e cutover | hard-cut sem feature flags; migrações forward-only; `CLASS_SESSION` canónico na agenda; validação server-side de grid por organização; sync 1:1 treinador-profissional obrigatório |
| SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING | Nuno | 2026-02-22 | Política de duração e preço por duração em reservas de campos (web+mobile+API) | FECHADO | remover ambiguidade final de pricing/duração em campos e garantir paridade operacional | catálogo fixo `30/60/90/120` com subset ativo por organização; preço por duração em `ServiceDurationPrice`; `allowCustomDuration=true` inválido para campos; `ServicePackage` deixa de ser fonte de preço em booking público de `COURT` |
---


## 00.7 Organização Canónica (12 Grupos)
- Estado: **FECHADO**.
- Fonte de reconstrução: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md`.
- Hash fonte (SHA-256): `a97773f4b85d780c20f89a81fe772fd1725d6e91a96ae86d2539630c3604d68e`.
- Mapping: `docs/ssot_canonical_groups_mapping_v1.json` (SHA-256: `e1ea184bc82774b89ce4878b17e72314a356ee6bcc7195f371179889267b3bb7`).
- Integridade: `4170/4170` linhas cobertas.
- IDs normativos mapeados: `139` (blocos extraídos: `138`).
- Gerado em: `2026-02-14T22:22:01.474Z`.

### 00.7.1 Ordem Canónica
- G01: Governação SSOT e Invariantes (`22` itens)
- G02: Segurança, Tenancy, Compliance e Legal (`10` itens)
- G03: Identidade, Auth, Sessao/Cookies e Mobile Access (`6` itens)
- G04: Organizacoes, Multi-org, RBAC e Equipa (`11` itens)
- G05: Financas, Fees, Pricing, Payouts e Refunds (`23` itens)
- G06: Eventos, Bilhetes, Acesso e Check-in (`8` itens)
- G07: Reservas, Agenda e Calendario Operacional (`6` itens)
- G08: Padel e Torneios (`22` itens)
- G09: CRM, Notificacoes e Suporte (`4` itens)
- G10: Loja, Promocoes e Loyalty (`3` itens)
- G11: Discovery, Search, Analytics e Ops Feed (`4` itens)
- G12: Infra, Jobs, Outbox, Observabilidade e Release Gates (`20` itens)

### 00.8 Autossuficiência do SSOT (NORMATIVO)
- O SSOT deve ser lido como documento autossuficiente de regra e decisão final.
- Referências a outros ficheiros existem apenas para rastreabilidade editorial/auditoria.
- Nenhum contrato normativo depende da leitura de outro documento para ser válido.
- Em conflito entre SSOT e documento auxiliar, prevalece sempre o SSOT.

### 00.9 Mapa Canónico de Higienização DB (2026-02-17)
- Estado: **FECHADO** para o escopo autorizado nesta ronda.
- Ambiente: DB única de desenvolvimento (workflow `developer`).
- Fonte de evidência operacional:
  - `reports/schema_baseline_2026-02-17.md`
  - `reports/schema_diff_matrix_2026-02-17.csv`
  - `reports/auth_schema_audit_2026-02-17.md`
  - `reports/schema_hygiene_closeout_2026-02-17.md`

#### 00.9.1 Canónico Mantido (`app_v3`)
- Mensagens modernas:
  - `chat_conversations`
  - `chat_conversation_members`
  - `chat_conversation_messages`
  - `chat_conversation_attachments`
  - `chat_message_reactions`
  - `chat_message_pins`
  - `chat_message_reports`
  - `chat_user_blocks`
  - `chat_user_presence`
  - `chat_access_grants`

#### 00.9.2 Legado Removido (`app_v3`)
- Tabelas:
  - `chat_threads`
  - `chat_members`
  - `chat_messages`
  - `chat_read_state`
  - `chat_moderation_log`
  - `chat_invites`
  - `chat_event_invites`
  - `chat_conversation_requests`
  - `chat_channel_requests`
- Triggers/Funções legacy `chat_*` de sincronização de threads v1.
- Colunas legacy removidas em:
  - `events`
  - `search_index_items`
  - `organizations`
  - `profiles`
  - `padel_clubs`
  - `services`

#### 00.9.3 Fecho de Tabelas Críticas (resolvido)
- `app_v3.padel_tournament_roles`: materializada e alinhada ao contrato Prisma.
- `app_v3.refund_policy_versions`: materializada e alinhada ao contrato Prisma.
- Resultado: eliminação do drift runtime `P2021` nestes dois delegates.

#### 00.9.4 Exceções Intencionais de Modelação
- `app_v3.cron_job_locks` permanece fora do Prisma por desenho (uso SQL raw em lock de cron).
- `auth.*` é tratado como inventário read-only nesta ronda (sem DDL), com classificação de risco no relatório dedicado.

### 00.10 Fecho Reservas+Aulas+Torneios (NORMATIVO)
- `decisionId`: `SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING`
- `owner`: Nuno
- `approvedAt`: 2026-02-22
- `scope`: Reservas de campos, aulas, torneios e serviços associados (API, UI web/mobile, schema, migrações, testes, runbook e observabilidade)
- `rationale`: fechar contratos e eliminar superfície ambígua/legada em fluxo operacional crítico, incluindo pricing por duração em campos
- `migrationImpact`: migrações forward-only, com rollback de aplicação (não de schema), backfills idempotentes com `dry-run/apply`

#### 00.10.1 Tempo, Grid e Duração (FECHADO)
- UI de reserva de campo usa grelha de início em `:00` e `:30` por defeito (`gridMinutes=30`).
- Motor interno de disponibilidade e conflito mantém resolução de `5` minutos (`SLOT_STEP_MINUTES=5`) sem exceções.
- Validação server-side de `startsAt` é obrigatória em todos os write-paths de reserva e remarcação.
- Regra canónica de validação:
  - `minutesOfDay(startsAt, timezoneOrg) % gridMinutes === 0` é obrigatório.
  - `gridMinutes` é configuração por organização; default `30`.
  - erro normativo: `INVALID_START_GRID` com mensagem `Horário fora da grelha configurada.`.
- Catálogo canónico de durações para campos: `[30, 60, 90, 120]`.
- Cada organização define `activeDurations` como subconjunto não vazio do catálogo (default para org sem configuração explícita: `[60, 90]`).
- Em reservas de campos, `allowCustomDuration=true` é inválido e deve ser recusado com `INVALID_BOOKING_CONFIG`.
- Duração fora de `activeDurations` devolve `INVALID_DURATION_POLICY`.
- Preço por duração é obrigatório por serviço `COURT` em `ServiceDurationPrice`.
- Reserva de campo sem preço configurado para a duração pedida devolve `DURATION_NOT_PRICED`.
- `ServicePackage` deixa de ser fonte de preço no booking público de `COURT`.
- A formulação histórica de rigidez “presets 60/90” e “custom por opt-in” para campos fica invalidada por `SUPERSEDED_BY_SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING`.

#### 00.10.2 Modelação de Aulas e Instrutores (FECHADO)
- Aulas recorrentes são sempre modeladas como:
  - `Service.kind = CLASS`
  - `ClassSeries`
  - `ClassSession`
- `Service.kind = GENERAL` com `categoryTag=AULAS` fica proibido para criação nova de aulas recorrentes.
- `Service.instructorId` é suportado e obrigatório quando aula tem instrutor identificado no fluxo.
- `ClassSeries.startMinute` deve respeitar `bookingGridMinutes` da organização; valores fora da grelha devolvem `INVALID_START_GRID`.
- No fluxo PadelHub, se o treinador não tiver `ReservationProfessional` ativo, a ação canónica é `Criar em reservas` (upsert) antes de criar a aula recorrente.
- Migração de legado obrigatória:
  - converter `Service.kind=GENERAL` + `categoryTag=AULAS` para `CLASS` quando serviço for recorrente ou claramente aula.
  - backfill é idempotente, paginado e com flags `--dry-run` e `--apply`.

#### 00.10.3 Identidade Canónica de Treinador (FECHADO)
- Vinculação 1:1 por organização:
  - `TrainerProfile.userId` <-> `ReservationProfessional.userId`.
- Constraint canónico obrigatório: unicidade em `ReservationProfessional(organizationId,userId)` para `userId` não nulo.
- Publicar/aprovar treinador executa upsert automático de `ReservationProfessional` (ativo).
- Erros normativos:
  - `INSTRUCTOR_NOT_TRAINER`
  - `INSTRUCTOR_NOT_PROFESSIONAL`
  - `INSTRUCTOR_PROFESSIONAL_INACTIVE`

#### 00.10.4 Agenda/Calendário (FECHADO)
- `CLASS_SESSION` é fonte legítima obrigatória em `/api/org/[orgId]/agenda`.
- UI de calendário org (day/week) mostra `CLASS_SESSION` como item de bloqueio operacional.
- Filtro por tipo obrigatório: `Reserva`, `Aula`, `Evento`, `Torneio`.
- Overlap de reserva com `ClassSession` deve ser recusado no write-path com `SLOT_TAKEN`.

#### 00.10.5 Recursos e Torneios (FECHADO)
- `ReservationResource` com `courtId != null` continua gerido exclusivamente pelo módulo de campos.
- Endpoint genérico de recursos mantém bloqueio de edição/remoção com erro `COURT_RESOURCE_MANAGED_BY_COURT`.
- Torneios suportam bulk-block de courts.
- Arbitragem canónica de torneios inclui `CLASS_SESSION` como candidato de calendário de 1.ª classe.
- Prioridade de arbitragem fechada: `HARD_BLOCK=5`, `CLASS_SESSION=4`, `MATCH=3`, `BOOKING=2`, `SOFT_BLOCK=1`.
- `SourceType.CLASS_SESSION` é mapeado para tipo de arbitragem `CLASS_SESSION` (nunca para `MATCH`).
- Política default de conflito em bulk-block de torneio: `CASCADE_SAME_COURT`.
- Overrides operacionais exigem `reasonCode` auditável (regex canónica: `^[A-Z0-9_]{3,64}$`).

#### 00.10.6 Concorrência, Hard-Cut e Migração (FECHADO)
- Confirmação de reserva mantém lock transacional por organização:
  - `pg_advisory_xact_lock(hashtext('booking:<orgId>'))`.
- Rollout sem feature flags; qualquer caminho legado é removido/cortado na release de cutover.
- Migrações são forward-only.
- Rollback permitido apenas na aplicação (backend/frontend/jobs), nunca em schema.

#### 00.10.7 Testes e Smoke (FECHADO)
- Antes de cutover:
  - `npm run typecheck`
  - `npx vitest run tests/**/*.test.ts`
- Suites obrigatórias:
  - enforcement de grid (`:00/:30` aceites; `:15` recusado com `gridMinutes=30`)
  - catálogo de duração de campos (`30/60/90/120`) com subset ativo (UI + API)
  - recusa de `allowCustomDuration=true` para campos
  - recusa de reserva `COURT` sem preço por duração (`DURATION_NOT_PRICED`)
  - conflitos com `ClassSession` e bulk-block de torneio
  - corrida de duas confirmações concorrentes para o mesmo court (lock advisory)
  - migrações/backfills (idempotência + dry-run/apply)
  - smoke e2e do ciclo treinador->aula->calendar->reserva recusada por overlap

#### 00.10.8 Observabilidade e Alertas (FECHADO)
- KPIs operacionais obrigatórios:
  - `pendingSplitCount`
  - `waitlistCount`
  - `liveMatchesCount`
  - `delayedMatchesCount`
  - `conflictsClaimsCount`
  - `overridesCount`
- Métricas obrigatórias aulas+treinadores:
  - ocupação por coach
  - taxa de no-show por coach
  - conversão por aula
- Alertas operacionais obrigatórios:
  - `SLOT_OVERRUN_ALERT`: disparar quando `delayedMatchesCount >= 8` ou `delayedMatchesCount/liveMatchesCount > 0.25` numa janela contínua de 10 minutos.
  - `MASS_CONFLICT_ALERT`: disparar quando `conflictsClaimsCount` cresce `>= 10` em 5 minutos.
  - `OVERRIDE_SPIKE_ALERT`: disparar quando `overridesCount` em 1 hora `>= max(5, 3x baseline média-horária de 7 dias)`.

## 01 Global Invariants (I*)

Esta secção define os invariantes imutáveis da plataforma ORYA.
Estas regras DEVEM ser cumpridas em todos os momentos. Qualquer implementação
que viole um ou mais invariantes é considerada incorreta, mesmo que funcional.


## G01) Governação SSOT e Invariantes

### Escopo estrutural
- 00 Authority
- 03 Canonical Vocabulary

### Blocos normativos (conteúdo integral, ordem estável)

#### G01.001 (origem: I01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:88`.

### I01 — Fonte Única de Verdade (SSOT)
Cada domínio tem exatamente uma fonte autoritativa de verdade:
- Payments & money state → `Payment` + `LedgerEntry`
- Access rights → `Entitlement`
- Identity → `Identity` (conceito canónico externo), com persistência MVP em `EmailIdentity` e sem enum externo `USER/GUEST_EMAIL`
- Organization context → `Organization`

Dados derivados, caches, projeções e estado de UI NÃO PODEM ser
tratados como autoritativos.

---


#### G01.002 (origem: I02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:100`.

### I02 — Ledger é Append-Only e Determinístico
Registos `LedgerEntry` são imutáveis e append-only.
DEVEM:
- nunca ser atualizados ou apagados
- referenciar sempre um evento causador
- ser suficientes para recomputar integralmente saldos e montantes líquidos

Qualquer correção é expressa por entries compensatórias, nunca por mutação.

---


#### G01.003 (origem: I03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:111`.

### I03 — Payments são Máquinas de Estado, não Saldos
`Payment` representa ciclo de vida e intenção, não a verdade monetária.
A verdade financeira final deriva exclusivamente do ledger.

Fees do processor PODEM ser desconhecidas na criação e DEVEM ser reconciliadas
depois, sem mutar entries históricas.

---


#### G01.004 (origem: I04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:120`.

### I04 — Entitlement é a Prova Canónica de Acesso
Um `Entitlement` é a única prova de que um utilizador (ou guest) tem acesso
a um recurso (evento, bilhete, lugar, experiência).

Estado de UI, QR codes, logs de check-in ou ecrãs de sucesso de pagamento NÃO
são prova de acesso.

---


#### G01.005 (origem: I05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:129`.

### I05 — Contexto Explícito de Organização (Multi-Tenancy)
Todos os dados de domínio DEVEM estar scoped a um `orgId` explícito, por:
- via direta (row-level), ou
- via indireta por entidade dona

Nenhuma query, job, webhook ou tarefa assíncrona pode operar sem contexto
explícito de organização.

---


#### G01.006 (origem: I06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:139`.

### I06 — Idempotência é Obrigatória para Operações com Side Effects
Qualquer operação que:
- cria movimento de dinheiro
- emite entitlements
- envia emails ou webhooks
- altera estado irreversível

DEVE ser idempotente e segura para retry.

---


#### G01.007 (origem: I07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:150`.

### I07 — Assíncrono é Explícito e Observável
Todo o trabalho assíncrono DEVE:
- ser acionado via outbox ou queue durável
- ser observável por metrics e logs
- ser retryable sem side effects

Execução fire-and-forget é proibida.

---


#### G01.008 (origem: I08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:160`.

### I08 — Sistemas Externos Não São Confiáveis
Sistemas externos (payment processors, providers de email, scanners,
integrações) são tratados como:
- não confiáveis
- duplicativos
- out-of-order

Todos os sinais de entrada DEVEM ser validados, deduplicados e reconciliados
contra a verdade interna.

---


#### G01.009 (origem: I09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:172`.

### I09 — Fail Closed em Autorização e Acesso
Em caso de incerteza, falta de dados ou lag de reconciliação:
- acesso é negado
- payouts são atrasados
- ações irreversíveis são bloqueadas

O sistema falha sempre em fail-closed, nunca em fail-open.

---


#### G01.010 (origem: I10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:182`.

### I10 — Decisões FECHADO São Vinculativas
Qualquer secção ou regra marcada como FECHADO é final.
As escolhas de implementação DEVEM adaptar-se a este SSOT, nunca o inverso.

Qualquer desvio exige revisão explícita do SSOT.

---

⸻

## 02 Security / Tenancy / Compliance (T*, Threat Model, RGPD)

### 02.1 Tenancy & Isolation Enforcement
This section defines the mandatory enforcement rules for multi-tenant
isolation across the ORYA platform.

Any violation of these rules is considered a critical security defect.

---


#### G01.015 (origem: C-G05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:558`.

### C-G05 — Padrão de Envelope de Erro
Todos os contratos DEVEM usar uma estrutura de erro consistente contendo:
- errorCode (stable, machine-readable)
- message (human-readable)
- retryable (boolean)
- correlationId

Erros sem classificação são proibidos.

---

### 03.2 sourceType Canónico e Separação de Enums
Resumo normativo:
- `sourceType` canónico e separação de enums são definidos em **7.5** (ver 7.5; bloco canónico único).
- Nesta secção não se duplicam enums/listas; apenas referência de vocabulário.

### 03.3 Estados Canónicos de Entitlement
Resumo normativo:
- Estados canónicos de entitlement e regra de consumo como metadata são definidos em **7.2** e **7.3** (ver 7.2 e 7.3; blocos canónicos únicos).
- Nesta secção não se duplicam enums/listas; apenas referência de vocabulário.

### 03.4 Contract Signatures (shape canónico)
12.6.1 Contract Signatures (MVP) (FECHADO)
Objetivo: reduzir drift FE/BE e entre módulos. Assinaturas mínimas (shape), sem impor transporte (REST/GRPC).

- Finanças.createCheckout(input)
  - input: {orgId, sourceType, sourceId, customerIdentityId?, pricingSnapshotHash?, idempotencyKey}
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

### 03.5 Naming Canónico de Contratos (FECHADO)
- Em contratos/API/EventLog/Outbox, os nomes canónicos são:
  - `orgId`
  - `customerIdentityId`
- Semântica de domínio para "reserva":
  - UI pode usar "Reserva" como categoria de produto.
  - Domínio técnico mantém separação explícita entre `Booking` (serviço) e `TicketReservation` (bilhete/evento).
- Em persistência DB, `organizationId` é permitido como detalhe físico de storage.
- Payload externo aceita apenas shape canónico (`orgId` + `customerIdentityId`).
- Código de domínio novo NÃO deve introduzir aliases sem revisão normativa.

### 03.6 Auth `errorCode` Canonical Set (legacy auth spec migrated)
Conjunto canónico mínimo para endpoints de autenticação:
- `FORBIDDEN`
- `INVALID_EMAIL`
- `RATE_LIMITED`
- `UNAUTHENTICATED`
- `EMAIL_NOT_VERIFIED`
- `AUTH_UNAVAILABLE`
- `MISSING_CREDENTIALS`
- `INVALID_CREDENTIALS`
- `EMAIL_NOT_CONFIRMED`
- `EMAIL_EXISTS`
- `WEAK_PASSWORD`
- `USERNAME_INVALID`
- `USERNAME_TAKEN`
- `OTP_GENERATION_FAILED`
- `RESET_LINK_FAILED`
- `EMAIL_SEND_FAILED`
- `MISSING_TOKENS`
- `INVALID_SESSION`
- `APPLE_IDENTITY_MISSING`
- `APPLE_IDENTITY_INVALID`
- `ALREADY_LINKED`
- `LOGOUT_FAILED`
- `CLEAR_FAILED`
- `SERVER_ERROR`

Regra:
- Producers MAY acrescentar novos `errorCode` sem breaking change (minor), desde que mantenham backward compatibility.
- Consumers MUST tolerar códigos desconhecidos e usar fallback de UX seguro.
- Mapeamentos canónicos obrigatórios no escopo auth:
  - `THROTTLED` e `RATE_LIMIT_ERROR` => `RATE_LIMITED`
  - `INTERNAL_ERROR` => `SERVER_ERROR`
  - sessão existente com email por verificar => `EMAIL_NOT_VERIFIED` (`HTTP 403`)

⸻

## 04 Contracts (C-G*, C01..C18, CAUTH.01, C02 addons)

6) Contratos de Integração v3.0 (mínimos obrigatórios)

Regra: módulos verticais consomem horizontais via contratos. Contratos são tratados como APIs internas versionadas.

---

## Regras de Execução de Contratos (GLOBAL, NORMATIVE)

Esta secção define as regras de execução e compatibilidade que se aplicam
a todos os contratos internos e externos (C01–C18, CAUTH.01, C02.X01 e futuras adições).

Estas regras são obrigatórias e sobrepõem preferências locais de implementação.

---


#### G01.011 (origem: C-G01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:666`.

### C-G01 — Ownership Explícito de Contrato
Todo contrato DEVE definir:
- um único domínio/equipa owner
- um ou mais consumers conhecidos

O owner é responsável por compatibilidade, versionamento e ciclo de vida.

---


#### G01.012 (origem: C-G02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:675`.

### C-G02 — Versionamento de Contrato
Contratos usam versionamento semântico:

- MAJOR: breaking change
- MINOR: alteração aditiva backward-compatible
- PATCH: clarificação não comportamental ou bug fix

A versão é explícita e nunca inferida.

---


#### G01.013 (origem: C-G03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:686`.

### C-G03 — Compatibilidade Retroativa é Obrigatória
Consumers DEVEM:
- tolerar unknown fields
- não depender da ordem dos fields
- não assumir default values sem documentação explícita

Producers NÃO PODEM:
- remover fields em versões minor
- alterar semântica de field sem major version

---


#### G01.014 (origem: C-G04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:698`.

### C-G04 — Semântica de Idempotência
Se um contrato aciona side effects, DEVE definir:
- a idempotency key
- o comportamento de retry
- as garantias de tratamento de duplicados

Idempotência aplica-se a retries, crashes e falhas de rede.

---

### C-G05 — Padrão de Envelope de Erro
Todos os contratos DEVEM usar uma estrutura de erro consistente contendo:
- errorCode (stable, machine-readable)
- message (human-readable)
- retryable (boolean)
- correlationId

Erros sem classificação são proibidos.

---


#### G01.016 (origem: C-G06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:719`.

### C-G06 — Premissas de Tempo e Ordenação
Contratos NÃO PODEM assumir:
- entrega in-order
- single delivery
- clocks sincronizados

Se ordenação importar, o contrato DEVE definir explicitamente chaves de
ordenação ou lógica de reconciliação.

---


#### G01.017 (origem: C-G07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:730`.

### C-G07 — Obrigações de Observabilidade
Cada contrato DEVE emitir:
- metrics de sucesso/falha
- metrics de latência (p50, p95)
- logs estruturados com correlationId

Falha silenciosa é proibida.

---


#### G01.018 (origem: C-G08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:740`.

### C-G08 — Testes de Compatibilidade
Qualquer alteração de contrato DEVE incluir:
- testes de backward compatibility
- replay de pelo menos um payload histórico
- validação explícita do comportamento de idempotência

---


#### G01.019 (origem: C-G09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:748`.

### C-G09 — Documentação é Executável
Cada contrato DEVE incluir:
- payloads de exemplo
- casos de erro de exemplo
- transições de estado explícitas (quando aplicável)

Contratos ambíguos são considerados incompletos.

---


#### G01.020 (origem: D00)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2347`.

D00) Fora de scope (v1–v3): API pública (terceiros)
	•	Não vamos expor API pública/SDK para terceiros nesta fase.
	•	Endpoint(s) públicos **first‑party** (ex.: páginas públicas/agenda) são permitidos, read‑only e rate‑limited.
		•	Qualquer “Public API” com chaves/SDK é **futuro**: fora de escopo nesta fase DEV, sem documentação externa, sem onboarding de parceiros, sem implementação/deploy até revisão normativa explícita.
	•	Integrações externas só via exports e integrações pontuais configuráveis (Fase 2+), sem “public API” aberta.


#### G01.021 (origem: D02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2397`.

D02) Owners (fontes de verdade) — semântica blindada
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


#### G01.022 (origem: D09.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2873`.

D09.02) UX Operacional Global (B2B)
	•	Blueprint de UX global (Unified Search, Context Drawer, Command Palette, Ops mode e padrões visuais) é **não‑normativo** e vive em `docs/planning_registry_v1.md` (P7.2).


## G02) Segurança, Tenancy, Compliance e Legal

### Escopo estrutural
- 02 Security / Tenancy / Compliance
- 19.1 Legal & Compliance
- 19.2 Trust & Safety
- 19.4 Governanca de Dados
- 19.5 Account Security

### Blocos normativos (conteúdo integral, ordem estável)

#### G02.001 (origem: T01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:202`.

### T01 — Explicit Organization Scoping (MANDATORY)
All domain entities MUST be scoped to an organization via:
- a direct `orgId` field, or
- an immutable reference to an entity that contains `orgId`

No entity that represents customer, operational, or financial data may
exist without an organization context.

---


#### G02.002 (origem: T02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:212`.

### T02 — Query Enforcement
All read and write queries MUST:
- include `orgId` as a mandatory filter, OR
- derive `orgId` from a parent entity already scoped

Queries without explicit organization scoping are forbidden.

---


#### G02.003 (origem: T03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:221`.

### T03 — Global Tables (Explicit Exceptions)
Only the following categories MAY exist without `orgId`:
- identity registries (e.g., username, email uniqueness)
- configuration metadata explicitly marked as GLOBAL

Global tables MUST:
- never contain customer-sensitive data
- be read-only in customer flows
- be explicitly documented as GLOBAL

---


#### G02.004 (origem: T04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:233`.

### T04 — Background Jobs & Async Processing
All background jobs, workers, and outbox processors MUST:
- execute within a resolved `orgId` context
- include `orgId` in logs, metrics, and traces

Jobs operating across multiple organizations MUST process one
organization at a time.

---


#### G02.005 (origem: T05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:243`.

### T05 — Webhooks & External Callbacks
Inbound webhooks MUST:
- be resolved to an internal entity
- derive the owning `orgId`
- fail if organization context cannot be resolved

Webhook handling without organization resolution is forbidden.

---


#### G02.006 (origem: T06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:253`.

### T06 — Authorization Is Org-Bound
Authorization checks MUST always evaluate:
- actor identity
- organization membership
- role / permission within that organization

Cross-organization access is forbidden unless explicitly designed
and documented as such.

---


#### G02.007 (origem: T07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:264`.

### T07 — Service Roles & Elevated Access
Service roles MAY bypass user-level RBAC but MUST NOT bypass
organization isolation.

All service-role access MUST:
- be auditable
- be logged with `orgId`
- have a documented justification

---


#### G02.008 (origem: T08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:275`.

### T08 — Testing & Verification
The platform MUST include automated tests that:
- attempt cross-org access
- verify hard failure on isolation violations
- cover API, jobs, and webhook paths

Tenancy enforcement MUST be continuously tested.

---


#### G02.009 (origem: T09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:285`.

### T09 — Failure Mode
On any ambiguity or missing organization context:
- the operation MUST fail
- no partial data may be returned
- no side effects may be executed

The system always fails closed.

---

### 02.1.1 Authentication Security Controls (legacy auth spec migrated)
These controls are normative and apply to public authentication flows.

- Public auth endpoints MUST avoid account enumeration:
  - responses for existence-sensitive flows (signup/check-email/reset) MUST be generic.
  - endpoint behavior MAY branch internally (`signup` -> `magiclink`), but external disclosure is forbidden.
- Mutable auth requests MUST enforce origin protections:
  - browser cross-site mutable requests are blocked by default.
  - signed internal requests (`Authorization`, `ORYA_APP_SECRET`, `ORYA_CRON_SECRET`) are exempt when explicitly trusted by policy.
- Canonical auth/session reads and writes:
  - `GET /api/auth/me` is the canonical read of auth/profile session state.
  - `POST /api/auth/refresh` is the canonical token->HttpOnly cookie synchronization path.
- Política de sessão verificada (strict total):
  - em rotas autenticadas, se existir sessão e o email não estiver confirmado, a resposta canónica é `403 EMAIL_NOT_VERIFIED`.
  - em rotas públicas com auth opcional, sessão ausente mantém comportamento público; sessão existente mas pendente NÃO pode cair em fallback guest.
- Auth errors exposed to clients MUST comply with `errorCode` envelope rules in `03 Canonical Vocabulary`.

---

### 02.2 RGPD Retention e Isolamento DB
12.2.1 Retenção Operacional (hot/warm) — **FECHADO**
	•	EventLog (hot index): 180 dias
	•	OutboxEvent: 30 dias após `publishedAt`
	•	NotificationDeliveryLog (hot index): 180 dias
	•	Job/JobAttempt/DLQ: 30–90 dias (depende de debug/ops)
	•	AuditLog (hot index): 180 dias

Regra de precedência:
	•	12.2.1 define apenas retenção operacional (hot/warm) para custo/performance.
	•	Retenção legal por classe (arquivo e prazos obrigatórios) é definida exclusivamente em 19.4.1.

Unicidade:
	•	(organizationId, eventType, idempotencyKey)

12.6.2 Isolamento multi-tenant (DB) — **FECHADO**
Objetivo: garantir que falhas na camada API não criam fuga de dados entre organizações.
- Todas as tabelas B2B têm `organizationId` obrigatório.
- Queries na API são sempre filtradas por `organizationId` (orgContext + RBAC).
- Base de segurança (quando aplicável):
  - RLS no Supabase para tabelas críticas multi‑tenant (Finanças, Reservas, RBAC, CRM, Check‑in),
  - policies mínimas: “só lê/escreve se organizationId ∈ memberships do user”.
- Logs e exports respeitam minimização de PII (12.2/19.4).

### 02.3 Legal, Trust & Safety, Data Governance, Account Security
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
- Gate de abertura de produção (PROD_FUTURA, fora do escopo DEV atual):
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
- Autoridade: esta secção é a única fonte de verdade para thresholds automáticos de risco.
- Apêndices não podem introduzir thresholds numéricos divergentes; apenas referência/resumo.
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
ADITAMENTO FECHADO: switches operacionais compatíveis com Stripe Connect (Standard nesta fase).
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

Nota (FECHADO): em Stripe Connect (Standard nesta fase), a ORYA não controla directamente payouts do Connected Account.
As medidas de mitigação são operacionais: bloquear novas vendas/checkouts, desactivar eventos, aplicar step‑up,
limitar acções de risco e, quando aplicável, iniciar refunds/chargeback workflows.
Qualquer controlo fino de transferências/payout holds é fora do v1.x e requer revisão do funds flow/account type.

- Risk flags automáticos (motor mínimo v1):
  - Chargeback rate acima de threshold (por organização e por evento)
  - Padrões anómalos de venda (picos, múltiplas compras por identidades correlacionadas, repetição de IP/device)
  - Revenda suspeita (tentativas repetidas, padrões de scalping, abuso de 0€)
  - Check‑in anómalo (múltiplos denies/duplicates por scanner/evento)
- Integração com Finanças:
  - `risk.flagged` pode activar: step‑up, limits, bloqueio temporário de criação de eventos/checkouts e revisão manual (D04/D09).

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
- Autoridade: esta secção é a única fonte de verdade legal para retenção por classe.

| Categoria de dados | Exemplos (entidades/tabelas) | Retenção | Base legal | Tratamento no delete account |
|---|---|---|---|---|
| Ledger/financeiro | `LedgerEntry`, `Payment`, `Refund`, `Dispute`, `Invoice` | 10 anos | obrigação contabilística/fiscal | **Preservar**; remover PII directa + `identityRef` → pseudónimo |
| Aceites legais/consentimentos | `LegalAcceptance`, `PrivacyConsent` | 10 anos | obrigação legal / defesa jurídica | **Preservar** pseudonimizado |
| Identidade & perfil | `Identity`, `UserProfile`, `OrganizationGroupMember` | duração da conta + 30 dias | contrato / consentimento | **Anonymize** (remover PII) |
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

## 03 Canonical Vocabulary (termos, enums, sourceType, error envelope)

### 03.1 Error Envelope Canónico

#### G02.010 (origem: CAUTH.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2122`.

CAUTH.01) Official Email Gate (organização) — **FECHADO**

Regras:
	•	`CAUTH.01` é o contrato canónico do gate de email oficial verificado para ações sensíveis da organização.
	•	Escopo: validação de acesso em mutações B2B sensíveis (ex.: payouts, exports financeiros, settings críticos).
	•	Condição canónica de verificação:
		–	`normalize(officialEmail)` existe;
		–	`officialEmailVerifiedAt != null`.
	•	Normalização canónica:
		–	`trim + NFKC + lowercase`;
		–	valor persistido em `Organization.officialEmail` já normalizado.
	•	Códigos canónicos de erro:
		–	`OFFICIAL_EMAIL_REQUIRED`
		–	`OFFICIAL_EMAIL_NOT_VERIFIED`
	•	Envelope externo de erro usa `errorCode` (nunca `error`).
	•	Fail mode: fail-closed (403) sem side effects.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** CAUTH.01  
**Contract Name:** Official Email Gate (organização)  
**Current Version:** v1.0.0  
**Owner:** Domain: Security/RBAC + Organization Settings  
**Primary Consumers:** APIs `/org/*`, Finance ops, RBAC write paths

---

#### Purpose
Definir o gate canónico de email oficial verificado para ações sensíveis de organização.

---

#### Idempotency
- **Idempotency Key:** N/A (validação sem side effects)
- **Scope:** per request
- **Guarantee:** validações repetidas com o mesmo input devolvem o mesmo resultado lógico.

---

#### Input Payload (Example)
```json
{
  "organizationId": 123,
  "officialEmail": "finance@org.pt",
  "officialEmailVerifiedAt": "2026-01-27T10:00:00Z",
  "reasonCode": "PAYOUTS_SETTINGS",
  "requestId": "req_abc",
  "correlationId": "corr_abc"
}
```

#### Output / Response (Example)
```json
{
  "ok": true
}
```

#### Error Cases
```json
{
  "ok": false,
  "requestId": "req_abc",
  "correlationId": "corr_abc",
  "errorCode": "OFFICIAL_EMAIL_NOT_VERIFIED",
  "message": "Email oficial por verificar para esta ação.",
  "email": "finance@org.pt",
  "verifyUrl": "/org/:orgId/settings?tab=official-email",
  "nextStepUrl": "/org/:orgId/settings?tab=official-email",
  "reasonCode": "PAYOUTS_SETTINGS",
  "retryable": false
}
```

---

#### Ordering & Duplication
Este contrato tolera chamadas duplicadas.
Ordering não é aplicável para validação do gate.

---

#### Side Effects
☐ ledger entries  
☐ entitlement issuance  
☐ emails / notifications  
☐ downstream async jobs

---

#### Observability
Obrigatório em logs e métricas:
- `requestId`
- `correlationId`
- `organizationId`
- `reasonCode`

---

#### Compatibility Rules
- Erros externos DEVEM usar `errorCode` canónico.
- Campos novos podem ser aditivos (minor), sem quebrar consumers.

---

#### Failure Mode
Sem email oficial válido/verificado: bloquear ação (403), sem side effects.

### CAUTH.01 Addendum v2 - Official Email Rotation (NORMATIVO)
- decisionId: `SSOT-2026-02-15-OFFICIAL-EMAIL-ROTATION-V2`
- owner: `Nuno`
- approvedAt: `2026-02-15`
- scope: rotação de `officialEmail` com estado ativo + pendente, sem dupla verdade no gate.
- rationale: pedido de alteração pendente nunca pode degradar um estado já verificado.
- migrationImpact:
  - `POST /api/org-hub/organizations/settings/official-email` deixa de mutar `Organization.officialEmail`/`officialEmailVerifiedAt`.
  - `DELETE /api/org-hub/organizations/settings/official-email` torna-se contrato canónico para cancelar pendente.
  - `GET /api/org-hub/organizations/settings/official-email` expõe estado canónico (`active + pending`).
  - confirmação mantém swap atómico no token (`POST /api/org-hub/organizations/settings/official-email/confirm`).

Máquina de estados canónica:
- `ACTIVE_VERIFIED`: `normalize(Organization.officialEmail)` existe e `officialEmailVerifiedAt != null`.
- `PENDING_CHANGE`: existe `OrganizationOfficialEmailRequest(status=PENDING)` para a organização.
- Estado permitido: `ACTIVE_VERIFIED` pode coexistir com `PENDING_CHANGE`.

Invariantes obrigatórios:
- `Organization.officialEmail` e `Organization.officialEmailVerifiedAt` representam apenas o estado ativo.
- Pedido pendente não invalida o estado ativo verificado.
- Cancelar pedido pendente não altera o estado ativo.
- Confirmar token válido executa swap atómico para o novo email e marca verificado.
- Regra de segurança: nunca piorar estado (`never degrade verified state`).

Permissões:
- `request`, `cancel`, `resend`: apenas `OWNER` e `CO_OWNER`.
- `confirm`: `OWNER` e `CO_OWNER` (consistência operacional).

Compatibilidade e migração legacy:
- Runtime anterior violava esta regra ao sobrescrever `Organization.officialEmail` antes da confirmação.
- v2 corrige o contrato para manter ativo+pendente em superfícies separadas.
- Pendentes legados devem ser reconciliados em modo fail-safe: restaurar ativo verificável quando possível; caso contrário, resolução manual auditada.


## G03) Identidade, Auth, Sessao/Cookies e Mobile Access

### Escopo estrutural
- 02.1.1 Authentication Security Controls
- Auth API Baseline
- Mobile-only constraints

### Blocos normativos (conteúdo integral, ordem estável)

#### G03.001 (origem: C12)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1955`.

C12) Identity/Auth (SSOT + claim/merge) — **FECHADO**

Regras:
	•	A criação de conta (`email+password`) exige validação por e-mail; a conta só fica ativa para operar depois de `email_verified = true`.
	•	Exceção: ao criar organização, `officialEmail` nasce com o e-mail do criador e vem automaticamente verificado; alterações posteriores seguem rotação v2 (pedido pendente + swap atómico na confirmação), sem invalidar o email ativo até confirmação.
	•	Conta de profissional só é efetiva após verificação do respetivo e-mail; profissional sem conta é apenas registo histórico/visibilidade e não recebe permissões operacionais.
	•	Quando um e-mail associado a profissional cria conta verificada, o histórico é mergeado automaticamente para a conta verificada e o evento é auditado em `IdentityMergeLog`.
	•	Conceito canónico externo: `Identity` (para `customerIdentityId`, `ownerIdentityId`).
	•	Persistência canónica MVP: `EmailIdentity`.
	•	`USER/GUEST_EMAIL` deixam de ser enum normativo externo; passam a semântica de identidade por email com estado.
	•	Email normalizado: `trim + NFKC + lowercase`; hash HMAC para dedupe.
	•	`rawEmail` é preservado para display/auditoria; `emailNormalized` é usado para lookup/dedupe.
	•	Regras provider-specific (`remove dots`, `remove +tag`) são proibidas como normalização global.
	•	Email verificado forte = confirmação do IdP (`email_confirmed_at`) validada server-side.
	•	Guest checkout cria/usa identidade por email em estado guest.
	•	Email verificado -> claim automático para identidade associada ao utilizador verificado:
		–	mover Entitlements para a identidade alvo canónica
		–	criar registo de merge (auditável)
		–	**não** alterar LedgerEntry nem Payment histórico
		•	Merge é idempotente e nunca destrói histórico; identidade antiga fica como tombstone.
		•	`IdentityMergeLog` e tombstone explícito são obrigatórios no contrato de identidade para auditoria pós-merge.
		•	Campos mínimos obrigatórios de `IdentityMergeLog`: `mergeId`, `fromIdentityId`, `toIdentityId`, `reason`, `emailNormalized`, `emailHashHmac`, `triggerSource`, `idempotencyKey`, `mergedAt`, `mergedBy`, `artifactsMoved`, `status`, `failureCode?`.
		•	Enums canónicos fechados de merge:
			–	`reason = EMAIL_VERIFIED_CLAIM | PROFESSIONAL_AUTO_MERGE | MANUAL_SYSTEM_FIX`
			–	`triggerSource = AUTH_VERIFY | PROFESSIONAL_LINK | SYSTEM_JOB`
			–	`status = SUCCEEDED | NOOP_ALREADY_MERGED | FAILED`
			•	Tombstone explícito obrigatório na identidade subsumida:
				–	`IdentityTombstone` dedicado **ou** campo equivalente explícito de tombstone;
				–	qualquer leitura de identidade tombstoned resolve para `toIdentityId`;
				–	reativação silenciosa de identidade tombstoned é proibida.
			•	Leitura de identidade tombstoned deve resolver para `toIdentityId` e impedir reativação silenciosa.
	•	`ownerIdentityId` é o ownership canónico; `ownerUserId` é apenas auxiliar não-autoritativo.
	•	`ownerKey` canónico de escrita: `identity:<ownerIdentityId>`.
	•	`ownerKey` legacy (`user:`/`email:`) fica restrito a compatibilidade de leitura temporária até hard-cut final.
	•	Gestão de segredo HMAC: `email_hmac = HMAC(key_vN, emailNormalized)` com `keyVersion` e janela de rotação (`vN` + `vN-1`).
	•	A regra canónica de merge/tombstone está integralmente definida neste SSOT; `docs/identity_merge_log_spec.md` é apenas referência de rastreabilidade técnica.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C12  
**Contract Name:** Identity/Auth (SSOT + claim/merge)  
**Current Version:** v1.0.0  
**Owner:** Domain: Identity/Auth  
**Primary Consumers:** Finanças, Entitlements, CRM, Check‑in, Org/RBAC

#### Idempotency
- **Idempotency Key:** `emailHash + userId` (claim)  
- **Scope:** global

#### Failure Mode
Sem email verificado → claim bloqueado (fail‑closed).

---


#### G03.002 (origem: CAUTH.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2232`.

CAUTH.02) Public Auth API Contract Baseline (legacy auth spec migrated) — **FECHADO**

Regras:
	•	Endpoints públicos de autenticação abrangidos:
		–	`POST /api/auth/login`
		–	`POST /api/auth/send-otp`
		–	`POST /api/auth/password/reset-request`
		–	`POST /api/auth/refresh`
		–	`POST /api/auth/apple/link`
		–	`GET /api/auth/me`
		–	`POST /api/auth/logout`
		–	`POST /api/auth/clear`
		–	`GET|POST /api/auth/check-email`
	•	Split canónico de consumo:
		–	Web/server usam baseline `/api/auth/*`.
		–	Mobile app usa autenticação direta no Supabase SDK e não depende do baseline `/api/auth/*`.
	•	Todos os erros externos usam envelope canónico (`errorCode`, `message`, `retryable`, `correlationId`).
	•	`send-otp` e `check-email` seguem política anti-enumeração (resposta genérica, sem leak de existência de conta).
	•	`/api/auth/refresh` é o único contrato canónico para sincronizar sessão com cookies HttpOnly.
	•	`/api/auth/me` é o read-model canónico de estado de autenticação no server.
	•	`/api/auth/me` é estritamente read-only (sem side effects síncronos); side effects vão para workers/eventos.
		•	`/api/auth/me` em erro devolve erro canónico (`errorCode`, `httpStatus`, `message`, `details`) com semântica uniforme para cliente.
		•	AuthModal segue fluxo canónico de recuperação:
			–	em erro de auth existe no máximo 1 tentativa automática silenciosa de auto-recovery (auto-heal).
			–	erro temporário (`network/timeout/5xx`) => retry simples (`Tentar novamente`), sem reset/logout automático.
			–	sessão inválida/desincronizada (`401`, refresh falhado, token inválido) => após falha do auto-heal, mostrar apenas CTAs canónicos: `Tentar novamente` (`/api/auth/me`), `Entrar` (login normal), `Sair` (logout canónico) como secundário.
			–	ação `limpar sessão local`/`reset` não aparece como ação primária/visível no fluxo normal; se existir, fica restrita a troubleshooting avançado (suporte/dev) com aviso explícito.
			–	`/api/auth/clear` limpa apenas cookies/estado de autenticação por allowlist; é proibido apagar cookies não-auth (ex.: `orya_organization`, carrinho, preferências).
			–	logout canónico limpa também cookies de contexto UI (Q38).
			–	`factory reset local` é fluxo separado com step-up (Q39), fora do caminho normal do modal.
		•	Matriz canónica de flags de cookies por ambiente (`dev/stage/prod`):
			–	cookies de autenticação: `HttpOnly=true`, `Secure=true` em `stage/prod`, `SameSite=Lax` (ou mais restritivo por superfície);
			–	cookies de contexto UI (`orya_organization`, `lastUsedOrg`): `HttpOnly=false`, `Secure=true` em `stage/prod`, nunca usados para autorização;
			–	cookies de carrinho/preferências: `HttpOnly=false`, `Secure=true` em `stage/prod`, sem acesso a decisões de authz;
			–	qualquer divergência da matriz por ambiente é drift normativo e bloqueia release.
			•	Mapeamentos canónicos obrigatórios em auth scope:
				–	`THROTTLED`/`RATE_LIMIT_ERROR` -> `RATE_LIMITED`
				–	`INTERNAL_ERROR` -> `SERVER_ERROR`
				–	rotas autenticadas com sessão pendente -> `EMAIL_NOT_VERIFIED` (`403`)
				–	indisponibilidade do provider auth -> `AUTH_UNAVAILABLE` (`503`)
		•	Tabela oficial endpoint -> status -> errorCode canónico:
			–	`POST /api/auth/login`: `200/400/401/403/429/500` | `MISSING_CREDENTIALS`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `FORBIDDEN`, `RATE_LIMITED`, `SERVER_ERROR`
			–	`POST /api/auth/send-otp`: `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `OTP_GENERATION_FAILED`, `EMAIL_SEND_FAILED`, `SERVER_ERROR`
			–	`POST /api/auth/password/reset-request`: `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `RESET_LINK_FAILED`, `EMAIL_SEND_FAILED`, `SERVER_ERROR`
			–	`POST /api/auth/refresh`: `200/401/403/500` | `MISSING_TOKENS`, `INVALID_SESSION`, `UNAUTHENTICATED`, `FORBIDDEN`, `SERVER_ERROR`
			–	`POST /api/auth/apple/link`: `200/400/401/409/500` | `APPLE_IDENTITY_MISSING`, `APPLE_IDENTITY_INVALID`, `UNAUTHENTICATED`, `ALREADY_LINKED`, `SERVER_ERROR`
			–	`GET /api/auth/me`: `200/401/500` | `UNAUTHENTICATED`, `INVALID_SESSION`, `SERVER_ERROR`
			–	`POST /api/auth/logout`: `200/401/500` | `UNAUTHENTICATED`, `LOGOUT_FAILED`, `SERVER_ERROR`
			–	`POST /api/auth/clear`: `200/401/500` | `UNAUTHENTICATED`, `CLEAR_FAILED`, `SERVER_ERROR`
			–	`GET|POST /api/auth/check-email`: `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `SERVER_ERROR`
		•	Não há contrato público novo de idempotência para `/send-otp` e `/reset-request`; internamente deve existir dedupe por janela + retry seguro.
		•	SLOs mínimos G03 obrigatórios: `auth.login_success`, `auth.refresh_success`, `ws.connect_success`.
		•	Painel de observabilidade G03 por `errorCode` canónico é obrigatório.
		•	Runbook único de incidente G03 (`auth outage`, `session drift`, `claim backlog`, `ws gate`) é obrigatório.
		•	Release gate deve bloquear deploy se houver drift SSOT x runtime em `C12`, `CAUTH.02`, `DORG.08`.
		•	No AuthModal, o comportamento de recuperação/CTAs acima é normativo; detalhe visual de UI (layout/estilo/cópia secundária) permanece não-normativo e pode evoluir em `docs/planning_registry_v1.md`.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** CAUTH.02
**Contract Name:** Public Auth API Contract Baseline
**Current Version:** v1.0.0
**Owner:** Domain: Identity/Auth
**Primary Consumers:** WebApp auth UI, internal session middlewares, mobile session consumers (auth direta via Supabase SDK)

#### Purpose
Definir baseline contratual dos endpoints públicos de autenticação, com anti-enumeração e envelope canónico.

#### Idempotency
- **Idempotency Key:** N/A (operações de sessão/auth sem side-effects financeiros)
- **Scope:** per request

#### Failure Mode
Em dúvida de autorização/origem/sessão: fail-closed, sem side effects irreversíveis.


#### G03.005 (origem: DORG.08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2320`.

DORG.08) Username Registry — normalização e anti-spoof (FECHADO)
	•	Normalização canónica obrigatória:
		–	lowercase + trim + colapsar espaços + Unicode NFC.
	•	Regras de username após normalização:
		–	mínimo 4 caracteres, máximo 15.
		–	lista de reserved words + blacklist obrigatória.
		–	hold de 15 dias após rename/release.
	•	Confusables/homoglyphs:
		–	fora do MVP para resolução avançada;
		–	no MVP: charset permitido + bloquear mistura de scripts.
	•	Qualquer escrita de username deve passar por `UsernameRegistry` (sem bypass direto em tabelas de profile/org).


#### G03.006 (origem: DORG.09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2332`.

DORG.09) Perfil Mobile — UI/UX baseline (EM_REVIEW_SEPARADA)
	•	Estado normativo: revisão UX separada (Q57/Q58); este bloco não bloqueia os contratos arquiteturais fechados.
	•	Escopo: perfil de Utilizador (view pública/própria) + perfil público de Organização (view pública).
	•	Padrão comum:
		–	App Bar sticky, Hero com avatar/badges, CTA primário visível, Stats row, secções sticky, estados loading/empty/error.
		–	acessibilidade mínima: touch targets >= 44pt, contraste AA, dynamic type.
	•	Utilizador:
		–	stats `Seguidores` + `A seguir`.
		–	CTA `Follow/Unfollow` (outro user) e `Editar Perfil` (próprio).
	•	Organização:
		–	stats apenas `Seguidores`.
		–	CTA primário derivado da ferramenta ativa (`Ver eventos`/`Reservar`/`Ver loja`/`Contactar`).
	•	Ordem canónica de blocos org:
		–	`AGENDA_PUBLICA -> RESERVAS -> FORMULARIOS -> LOJA`.
	•	Perfil público de organização é fixo (sem editor de layout/blocos customizáveis).
	•	`Hero`, `Sobre`, `Galeria`, `FAQ`, `Contacto`, `PADEL oficial` e `Treinadores` não são blocos públicos renderizáveis.
	•	`Loja` é condicional: só aparece quando `status=ACTIVE`, `showOnProfile=true` e existe `>=1` produto `PUBLIC`.


#### G03.003 (origem: D01.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2380`.

D01.02) Mensagens & Chat — decisões de produto (FECHADO)
	•	Na UI web existe chat apenas em contexto de organização; não existem chats pessoais/web DMs fora do contexto da org.
	•	No mobile coexistem chats pessoais (DMs entre utilizadores) e chats de organização.
	•	Contrato explícito de acesso b2c: mobile login-only para rotas atuais e futuras.
			•	Escopo `b2c` mantém gate de plataforma/versão (`MOBILE_APP_REQUIRED` / `UPGRADE_REQUIRED`) com semântica paritária entre HTTP e WebSocket.
			•	`MIN_SUPPORTED_MOBILE_VERSION` é obrigatório por ambiente (sem default permissivo em produção).
			•	Semver inválido em `app_version` bloqueia fail-closed com `UPGRADE_REQUIRED` + reason `APP_VERSION_INVALID`.
			•	Kill switch de versão é separado por plataforma (`ios`/`android`).
			•	`orya_organization` é cookie de contexto UI e nunca é aceite como autorização.
			•	WS handshake web exige `context.type='org'` e `context.id`; se faltar contexto ou token não autorizar o contexto, handshake é rejeitado (fail-closed).
			•	Handshake WS obrigatório usa payload JSON com `auth`, `app_version`, `context` e `device_attestation` opcional; falta de `auth|app_version|context` implica rejeição imediata.
			•	Autenticação WS por token em subprotocol deixa de ser caminho canónico.
			•	JWT claims WS mínimas: `sub`, `exp`, `org_ids` (ou `org_id` em single-tenancy), `roles/permissions/channel_permissions` quando aplicável e `context_bind` opcional.
			•	Servidor deve validar explicitamente autorização do token para o `context.id`; token revogado implica encerramento ativo do socket.
		•	Namespaces canónicos WS: `org:{org_id}:channel:{channel_id}`, `dm:user:{u1}:{u2}`, `public:global:{id}`, `cross-org:{authority_org_id}:{channel_id}`.
		•	Códigos WS mínimos (paridade HTTP): `ORG_CONTEXT_REQUIRED`, `FORBIDDEN`, `UNAUTHORIZED`, `UPGRADE_REQUIRED`, `MOBILE_APP_REQUIRED`, `RATE_LIMITED`.
		•	Observabilidade WS mínima obrigatória:
			–	`ws.handshake.success_count` e `ws.handshake.failure_count`;
			–	`ws.handshake.latency_ms` (`p50`, `p95`);
			–	`ws.handshake.rejected.missing_context_count`;
			–	`ws.handshake.rejected.version_gate_count`;
			–	`ws.socket.closed.revoked_token_count`.
		•	Log estruturado obrigatório para handshake, decisão de authz, rejeição e revogação, com `correlationId`.
		•	O contrato canónico de handshake/claims/namespacing está integralmente definido neste SSOT; `docs/ws_handshake_and_jwt_claims.md` é referência de rastreabilidade.
	•	Chat de reserva/serviço não é criado automaticamente; o canal nasce na primeira mensagem ou quando o utilizador abre explicitamente “falar com a organização”.
	•	Chat interno da organização mantém modelo por canais.
	•	Notificações: push por defeito com possibilidade de silenciar por conversa.
	•	Anexos e links são permitidos em org-chat e em DMs pessoais mobile.
	•	Antes de permitir acesso/abertura de anexo, o sistema impõe `virus scan + DLP + quotas`; estados via WS: `pending_scan -> ready | rejected`.
	•	“Anular envio”: janela de **2 minutos**.
	•	Retenção: mensagens guardadas e chats de evento/reserva read-only após fecho.
	•	Implementação deve incluir gates de CI e testes automáticos (unit/integration/E2E) para handshake, authz, anexos e logout/socket lifecycle.
	•	E2E de gate mobile obrigatório:
		–	web -> `MOBILE_APP_REQUIRED`
		–	mobile antiga -> `UPGRADE_REQUIRED`
		–	mobile suportada -> `200`


#### G03.004 (origem: D17)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3069`.

D17) Integrações Apple — guardrails normativos (FECHADO)
	•	Sign in with Apple é método suportado e obrigatório em iOS quando existirem logins de terceiros.
	•	Push iOS usa APNs com token-based auth.
	•	Universal links e share sheet iOS são suportados para superfícies públicas relevantes.
	•	Fecho operacional de universal links exige evidência de entitlements iOS + teste em device real.
	•	Apple Wallet/PassKit em v1.x mantém validação **online** por `EntitlementQrToken` (`tokenHash`), com updates/revogação por jobs idempotentes.
	•	Offline signed QR permanece fora de v1.x e só pode entrar com payload assinado/versionado, rotação de chaves e revocation list sincronizada.
	•	Address provider canónico continua em D11 (Apple Maps via Address Service).
	•	Certificados/keys Apple vivem em AWS Secrets Manager com rotação e mínimo privilégio.
	•	Detalhe de roadmap/fases Apple fica em `docs/planning_registry_v1.md` (P7.4).


## G04) Organizacoes, Multi-org, RBAC e Equipa

### Escopo estrutural
- 10.1 Multi-Organizacoes & Group Governance
- 11 RBAC v2

### Blocos normativos (conteúdo integral, ordem estável)

#### G04.001 (origem: C13)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1986`.

C13) Org Context + RBAC (resolução e step‑up) — **FECHADO**

Regras:
	•	Em superfícies canónicas org-scoped (`/org/:orgId/*` e `/api/org/:orgId/*`), `orgId` é obrigatório no path.
	•	`X-ORYA-ORG-ID` só pode ser usado em superfícies sem `orgId` no path e apenas quando o contrato da rota o declarar.
	•	Cookies/lastUsedOrg **só** para redirect de UI (nunca para autorização).
	•	Qualquer operação sem `orgId` resolve para **403** com `ORG_CONTEXT_REQUIRED`.
	•	Step‑up obrigatório em ações críticas (refunds, alterações de fee policy, export PII, cancelamentos).
	•	Service roles não podem bypassar isolamento de org.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C13  
**Contract Name:** Org Context + RBAC (resolução e step‑up)  
**Current Version:** v1.0.0  
**Owner:** Domain: Security/RBAC  
**Primary Consumers:** Todos os módulos B2B

#### Failure Mode
Ambiguidade de org → fail‑closed (403) + audit log.

---


#### G04.006 (origem: DORG.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2285`.

DORG.01) Membership de Organização — fonte única de verdade (FECHADO)
	•	Fonte única canónica: `OrganizationGroupMember` + `OrganizationGroupMemberOrganizationOverride`.
	•	`OrganizationMember` é legado e não pode ser usado por código de runtime.
	•	Leituras/escritas de membership (listar, promover, remover, contar owners, resolver permissões) devem passar pelo modelo de grupo.
	•	DB hygiene: tabela legacy `organization_members` removida por migração de cut-line.


#### G04.007 (origem: DORG.03A)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2291`.

DORG.03A) Ferramentas da Organização — fonte única + fail-closed (FECHADO)
	•	Fonte única canónica de capacidade por ferramenta: `OrganizationModuleEntry.enabled=true`.
	•	`RBAC` e `tool enabled` são validações separadas e cumulativas:
		–	sem membership/permissão => negar;
		–	ferramenta desativada => negar, mesmo que o utilizador tenha role.
	•	No perfil público da organização, uma ferramenta só aparece se:
		–	estiver ativa, e
		–	tiver conteúdo publicável.
	•	Visibilidade no dashboard (mostrar/ocultar cards) é preferência de UI e NÃO altera capacidade de domínio.
	•	Escopo da preferência de visibilidade no dashboard é por organização (não por utilizador).
	•	Alteração da visibilidade no dashboard é permitida apenas a `OWNER`, `CO_OWNER` e `ADMIN`.
	•	Toggle canónico de ferramenta (enabled/disabled) afeta domínio e perfil público de forma determinística (sem bypass por URL direta).
		•	Ferramentas estruturais no dashboard (não ocultáveis): `Definições`, `Finanças`, `Equipa`.


#### G04.008 + G04.009 (origem: DORG.04A + DORG.05A)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2301`.

DORG.04A + DORG.05A) Contexto de organização explícito e header canónico (FECHADO)
	•	APIs org-scoped (`/api/org/:id/*`) aceitam `organizationId` apenas por path.
	•	APIs fora de `/api/org/:id/*` podem aceitar `organizationId` por query ou `x-orya-org-id` quando o contrato da rota o declarar explicitamente.
	•	Cookie não é fonte de verdade para mutações API (apenas fallback UI quando explicitamente permitido).
	•	Header legado `x-org-id` está descontinuado; único header válido é `x-orya-org-id`.


#### G04.010 (origem: DORG.06A)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2309`.

DORG.06A) Notificações Stripe Status — dedupe por organização + estado (FECHADO)
	•	Notificações `STRIPE_STATUS` usam dedupe key com fingerprint de estado:
		–	`accountId`, `charges_enabled`, `payouts_enabled`, `requirements_due`.
	•	Dedupe é por utilizador + organização + fingerprint; retries não podem gerar spam.


#### G04.011 (origem: DORG.07A)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2314`.

DORG.07A) Webhook Stripe Connect — fail-closed por mapeamento org (FECHADO)
	•	`account.updated` só atualiza organização se o mapeamento for inequívoco.
	•	Se não houver organização mapeada, ou houver mismatch `organizationId` ↔ `stripeAccountId`, a resposta é erro (não-200).
	•	Atualização parcial/silenciosa é proibida; `update_count != 1` é erro operacional.
	•	Webhook externo nunca é tratado como verdade sem reconciliação com estado interno.


#### G04.002 (origem: D05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2717`.

D05) RBAC mínimo viável + Role Packs

Introduzir já: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE
Com mapa fixo para roles/scopes (Secção 11).


#### G04.003 (origem: D05.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2722`.

D05.01) Resolução de organização é determinística
	•	Em B2B, organizationId vem da rota (/org/:orgId/...) como fonte primária.
	•	Cookie pode existir apenas como conveniência (redirect inicial), não como base de autorização.
	•	RBAC avalia sempre com orgId explícito.
	•	Qualquer fallback (cookie/lastUsedAt) é permitido apenas para redirect/UI. Nunca para autorização.
	•	Alias legado web removido (hard-cut): `/organizacao/*` → `410 LEGACY_ROUTE_REMOVED`.
	•	Namespace legado API: `/api/organizacao/*` → `410 LEGACY_ROUTE_REMOVED`.


#### G04.004 (origem: D05.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2730`.

D05.02) Step-up obrigatório em ações irreversíveis (FECHADO v1)
	•	Exige reautenticação/2FA recente + `reasonCode` obrigatório para:
		–	refunds;
		–	cancelamento de evento/torneio (soft-cancel);
		–	alteração de fee policy/overrides;
		–	exportação com PII.
	•	Todas as ações acima geram `AuditLog` com before/after (payload minimizado RGPD).


#### G04.005 (origem: D14)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3053`.

D14) Multi-Organizações (empresa mãe → filiais)
		•	OrganizationGroup (mãe) agrega Organizations (filiais)
		•	RBAC suporta: permissões na mãe, permissões por filial, e papéis herdáveis/limitados (Secção 11)
		•	A mãe atua como control plane administrativo apenas para governança de membership (entrada/saída de organizações do group).
		•	Não existe autoridade operacional da mãe sobre agenda/reservas das filiais; sem hard blocks globais pela mãe.
		•	Papéis da mãe não são auto-propagados para filiais; operação em filial exige papel local nessa organização.


## G05) Financas, Fees, Pricing, Payouts e Refunds

### Escopo estrutural
- P0 endpoints financeiros
- F1/F2 flows

### Blocos normativos (conteúdo integral, ordem estável)

#### G05.001 (origem: C02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:880`.

C02) Finanças ↔ Todos (checkout/refunds) — gateway único

Todos criam checkout via Finanças; estado pago/refund/chargeback/payout vem sempre de Finanças.

Obrigatório:
	•	orgId
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

Compatibilidade:
	•	No domínio canónico, o shape é `orgId` + `customerIdentityId`.
	•	Aliases legados em payload externo são proibidos (hard-cut).


#### G05.002 (origem: C02.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:902`.

C02.01) Eventos ↔ Finanças (convites) — resolução determinística
• Objetivo: evitar UI/backend drift em convites e tornar o checkout por convite 100% contratual.
• Entrada: { eventId, inviteToken?, email?, username? }
• Saída: { allowCheckout, constraints: { guestCheckoutAllowed, inviteIdentityMatch, ticketTypeScope? }, resolvedIdentity }
• Regra: Eventos define a policy e Finanças valida/impõe as constraints no createCheckout.


#### G05.003 (origem: C02.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:908`.

C02.02) Checkout API Hard-Cut (sem adapters legacy) — **FECHADO**
- Endpoints canónicos:
  - `POST /api/payments/intent`
  - `GET /api/checkout/status`
- Endpoints legados e adapters foram removidos do runtime.
- Campos de resposta de compatibilidade (`checkoutId`, `statusV1`, `freeCheckout`, `final`) não são normativos.
- Verdade financeira canónica continua no state machine de `Payment` (`SUCCEEDED`, etc.) e no ledger append-only.
- Regras de free checkout:
  - `amountCents=0` não cria Stripe intent;
  - finalização deve ser determinística, idempotente, auditável.
- Mobile guardrail:
  - checkout mobile é login-only (sem guest checkout).

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C02  
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
Entitlements são emitidos após `Payment=SUCCEEDED` e persistência do ledger base do pagamento; não dependem de `processorFeesStatus=FINAL`.

#### G05.005 (origem: C10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1818`.

C10) Stripe Webhooks ↔ Finanças (ingestão e reconciliação) — **FECHADO**
Regras:
	•	Endpoint canónico: `/api/stripe/webhook` (alias `/api/webhooks/stripe` deve apontar para o mesmo handler).
	•	Assinatura Stripe obrigatória; rejeitar se `livemode` não corresponder ao modo esperado.
	•	Dedupe obrigatório por `stripeEventId` (idempotencyKey global).
	•	Resolver `orgId` por `stripeAccountId` (Connect) ou metadata `orgId` no PaymentIntent/Charge.
	•	Se `orgId` não for resolvido → guardar evento + DLQ + alerta (sem side‑effects).
	•	Persistir evento bruto (`StripeEvent`) com: `stripeEventId`, `type`, `account`, `created`, `livemode`, `requestId?`, `correlationId`.
	•	Canonicalização obrigatória:
		–	eventos externos de disputa do processor são normalizados para eventos internos `payment.dispute_opened` e `payment.dispute_closed`
		–	só eventos internos canónicos podem mutar `Payment`/`Entitlement`/`Ticket`
	•	Mapeamento mínimo (SSOT):
		–	`payment_intent.succeeded` → Payment.SUCCEEDED + ledger + entitlements
		–	`payment_intent.processing` → Payment.PROCESSING
		–	`payment_intent.payment_failed` → Payment.FAILED
		–	`payment_intent.canceled` → Payment.CANCELLED
		–	`charge.refunded` → Payment.REFUNDED/PARTIAL_REFUND + reversões de ledger
		–	`charge.dispute.created` → Payment.DISPUTED + Entitlement.SUSPENDED
		–	`charge.dispute.closed` → CHARGEBACK_WON/LOST + entitlement update + ledger
		–	`balance.available` → trigger reconciliação (fees finais)
		–	`payout.paid` / `payout.failed` → atualizar read‑model de Payout (não controla payout)
	•	Estados terminais não regredem; apenas transições permitidas pelo state machine (D04.09).

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C10  
**Contract Name:** Stripe Webhooks ↔ Finanças (ingestão e reconciliação)  
**Current Version:** v1.0.0  
**Owner:** Domain: Finanças  
**Primary Consumers:** Webhook handler, Finance workers, Entitlement issuance, Ledger

#### Purpose
Garantir ingestão idempotente de eventos Stripe e reconciliação determinística do estado financeiro.

#### Idempotency
- **Idempotency Key:** stripeEventId  
- **Scope:** global  
- **Guarantee:** replays não duplicam side‑effects.

#### Input Payload (Example)
```json
{
  "id": "evt_123",
  "type": "payment_intent.succeeded",
  "livemode": true,
  "data": {"object": {"id": "pi_456"}},
  "created": 1769900000
}
```

#### Output / Response (Example)
```json
{"status":"ACK","stripeEventId":"evt_123"}
```

#### Error Cases
- `INVALID_SIGNATURE`
- `LIVEMODE_MISMATCH`
- `ORG_UNRESOLVED` (armazenar + DLQ + alerta; **sem side‑effects**)

#### Ordering & Duplication
Tolerar duplicados e out‑of‑order.  
Eventos antigos não podem reverter estados terminais.

#### Side Effects
☑ ledger entries  
☑ entitlement issuance  
☑ downstream async jobs  
☑ notifications (quando aplicável)

#### Observability
Logs e métricas com `stripeEventId`, `stripeAccountId`, `orgId`, `paymentId`, `correlationId`.

#### Failure Mode
Assinatura inválida → 400.  
Org não resolvida → 200 (ACK) + DLQ + alerta; nenhum side‑effect.

---


#### G05.006 (origem: C14)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2010`.

C14) Payout Release + Risk Holds (ops) — **FECHADO**

Regras:
	•	ORYA **não** controla payouts em Stripe Standard; controla **gating operacional**.
	•	Release interno é **read‑model** + alerta; não altera Stripe.
	•	Pré‑requisitos para “allow new checkouts”:
		–	`onboardingStatus=COMPLETE`
		–	sem `risk.hold=true`
		–	thresholds 19.2.2 não excedidos
	•	Se bloqueado: `payoutsBlocked=true`, emitir `risk.flagged` + Ops alert.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C14  
**Contract Name:** Payout Release + Risk Holds  
**Current Version:** v1.0.0  
**Owner:** Domain: Ops/Finanças  
**Primary Consumers:** Admin Ops UI

#### Idempotency
- **Idempotency Key:** payoutId ou balance_transaction.id  
- **Scope:** por org

---


#### G05.007 (origem: C15)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2037`.

C15) Money & Rounding (pricing determinístico) — **FECHADO**

Regras:
	•	Fee modes permitidos em v1: `ADDED | INCLUDED`.
	•	`ABSORBED` é fora de scope v1 (não permitido em runtime).
	•	Todos os montantes são **inteiros** em minor units (sem floats).
	•	Rounding: `round_half_up` em cada passo relevante.
	•	Ordem canónica:
		1) `gross = sum(lineItems)`
		2) `discounts` → `subtotal`
		3) `taxes` (se aplicável) sobre `subtotal`
		4) `platformFee` (base: `subtotal` por default; override via FeePolicyVersion)
		5) `total = subtotal + taxes + fee` (se `feeMode=ADDED`)
	•	`pricingSnapshot` é imutável; qualquer cálculo posterior deriva do snapshot + Ledger.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C15  
**Contract Name:** Money & Rounding (pricing determinístico)  
**Current Version:** v1.0.0  
**Owner:** Domain: Finanças  
**Primary Consumers:** Finanças, Events, Store, Reservations, Padel

---


#### G05.004 (origem: C02.X01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2271`.

### C02.X01 Addon — Stripe Onboarding (Standard)
C02.X01) Stripe Onboarding (Standard) — **FECHADO**
- Activação de vendas/payouts exige Organization completar onboarding KYC no Stripe.
- Implementação: Finanças gera `account_link` (Stripe-hosted) e guarda estado:
  - `onboardingStatus = PENDING | COMPLETE | RESTRICTED`
- Guardrail:
  - se status != COMPLETE → bloquear criação de checkouts pagos (permitir apenas rascunhos/testes).

⸻

## 05 Domain Decisions (D*)

4) Decisions Locked (não avançar sem isto)


#### G05.008 (origem: D04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2500`.

D04) Finanças determinística (Stripe Connect + Fees ORYA) — decisão única

> **FECHADO (SSOT):** SSOT financeiro = `Payment` (state machine) + `LedgerEntry` (linhas imutáveis).  
> Tudo o resto (SaleSummary, dashboards, exports) é **derivado**.

Princípios
- Mapeamento financeiro por `orgType` é obrigatório:
  - `orgType=EXTERNAL` usa Stripe Connect (tipo Standard por defeito nesta fase) com `Organization.stripeAccountId`.
  - `orgType=PLATFORM` usa conta Stripe da ORYA (não-Connect / sem `transfer_data.destination`); `stripeAccountId` é opcional e apenas de referência.
- **Finanças é o único gateway lógico**: nenhum módulo cria PaymentIntents/CheckoutSessions diretamente no Stripe.
  Endpoints especializados de checkout são permitidos **apenas** se delegarem ao domínio Finanças e respeitarem idempotência/policies canónicas.
- Idempotência obrigatória em todas as operações: `idempotencyKey` por createCheckout/refund/reconcile.
- “Pago” só existe quando `Payment.status == SUCCEEDED`.


#### G05.009 (origem: D04.00)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2512`.

D04.00) Stripe Connect — Account Type (FECHADO)
- Para `orgType=EXTERNAL`, ORYA usa **Stripe Connect (Standard nesta fase)** como tipo de conta por defeito.
- Para `orgType=PLATFORM`, checkout/capture/liquidação ocorrem na conta Stripe da ORYA (não-Connect).
- Em `orgType=EXTERNAL`, a conta Stripe é do organizador (autonomia e responsabilidade fiscal/operacional).
- A ORYA não cria nem gere contas Custom nesta fase.
- Qualquer excepção (Express/Custom) só por decisão de produto + contrato (fora v1.x).


#### G05.010 (origem: D04.00.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2518`.

D04.00.01) Stripe Funds Flow (FECHADO)
Objetivo: definir de forma única como o dinheiro flui e onde a ORYA consegue (ou não) aplicar “risk holds”.

Decisão (v1.x):
- `orgType=EXTERNAL`:
  - Modelo: **Destination Charges + Application Fee** em Stripe Connect (Standard nesta fase).
  - A cobrança ao cliente é criada pela ORYA (Finanças) para o evento/serviço (`sourceType/sourceId`), com:
    - `application_fee_amount` = fee ORYA (conforme FeePolicyVersion)
    - `transfer_data.destination` = `Organization.stripeAccountId`
- `orgType=PLATFORM`:
  - Checkout/capture/liquidação na conta Stripe da ORYA (não-Connect / sem destination transfer).
  - `stripeAccountId` não participa em transferências neste modo.

Implicações (normativas):
- Refunds são iniciados pela ORYA (Finanças) e são idempotentes.
- Disputes/chargebacks afectam `Payment/Entitlements` conforme D04.09 e Secções 7/8.
- “Risk hold” em v1.x é **operacional** (step‑up, limits, bloqueio temporário de criação de eventos/checkout); não assume controlo directo de payouts.
- Se for necessário controlo fino de payouts/transferências (hold real de fundos), isso é **fora v1.x** e requer revisão do flow (ou mudança de account type/contrato).

Regra: nenhum módulo assume “payout control” fora do que este flow permite.


#### G05.011 (origem: D04.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2535`.

D04.01 Política de Fee (Admin) (FECHADO)
- Config por organização (default) + overrides por `sourceType` (e opcionalmente por `sourceId`).
- Limites opcionais: min/max, arredondamentos, feeMode (`INCLUDED | ADDED` em v1).
- `ABSORBED` é fora de scope v1 e exige decisão normativa futura para activação.
- Qualquer alteração gera nova versão (`feePolicyVersion`), nunca edita retroativamente.


#### G05.012 (origem: D04.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2541`.

D04.02 PricingSnapshot (obrigatório) (FECHADO)
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
- **Proibição de estimativas:** campos do tipo `*Estimate*` são legados e **não** podem ser usados como verdade nem para decisões.  
  Só `processorFeesActual` (quando FINAL) e o Ledger são canónicos.


#### G05.013 (origem: D04.03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2555`.

D04.03 Fee determinística + versionamento (obrigatório) (FECHADO)
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


#### G05.014 (origem: D04.04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2588`.

D04.04 Ledger SSOT (imutável) + reconciliação (FECHADO)
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


#### G05.015 (origem: D04.05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2605`.

D04.05 SaleSummary (se existir) — read model derivado
- Pode existir para performance/UX, mas:
  - nunca decide estados (pago/reembolsado)
  - é re‑gerável a partir de Ledger + Payment
  - falhas são reparáveis por replay (EventLog/Jobs)
- Definição (read‑model):
  - `SaleSummary`: resumo por compra (`purchaseId`/`paymentIntentId`), totais/fees (`subtotal/discount/platformFee/cardFee/stripeFee/total/net`), `status`, owner (`ownerUserId`/`ownerIdentityId`), modo/teste (`mode`/`isTest`) e snapshots de promo (`promoCodeSnapshot/label/type/value`).
  - `SaleLine`: linhas por ticketType (`ticketTypeId`), `quantity`, `unitPrice`, `gross/net/platformFee` + snapshots de promo.
- Owner: apenas o consumer de finanças (domain/finance read‑model consumer) escreve; resto é read‑only.


#### G05.016 (origem: D04.06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2615`.

D04.06 FeeMode e pricing têm um resolvedor único (FECHADO)
- `computePricing()` (Finanças) decide de forma determinística e versionada:
  - platform default
  - org default
  - override por `sourceType`
  - override por `sourceId` (opcional)
- Regra: nenhum módulo força feeMode “por fora”. Se Eventos quiserem “INCLUDED sempre”, isso é configurado como override por `sourceType=TICKET_ORDER` e fica escrito em policy versionada.


#### G05.017 (origem: D04.07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2623`.

D04.07 Regras de FREE_CHECKOUT (FECHADO)
- Um checkout é “free” se:
  - `totalAmount == 0` (após promos/fees) **ou**
  - `scenario == FREE_CHECKOUT` (explicitamente resolvido por Finanças)
- Limites e anti‑abuso aplicam-se ao free checkout independentemente de qualquer flag no evento.
- Bilhetes 0€ só existem por decisão explícita:
  - `Event.allowZeroPriceTickets` (default false) **ou** policy por TicketType (recomendado).


#### G05.018 (origem: D04.07.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2631`.

D04.07.01 Guardrails de FREE_CHECKOUT (FECHADO)
- Anti‑abuso é **normativo** e vive em Finanças (não em Eventos):
  - Limite por `Identity` e por `eventId+ticketTypeId`: default `max=1` (configurável por policy, com guardrails globais).
  - Rate limit por IP/device + janela (ex.: 10 tentativas/5 min) + cooldown progressivo em falhas.
  - Step‑up em casos suspeitos: captcha/turnstile, obrigar login, ou bloquear por 15–60 min (policy).
  - Dedupe por idempotencyKey e por `Identity+sourceId` (não existe “free checkout repetido”).
  - Audit + EventLog obrigatórios: `free_checkout.denied` com reasonCode (sem PII).
- Regra: o mesmo conjunto de guardrails aplica-se a `totalAmount==0` e a `scenario==FREE_CHECKOUT`.
- Precedência de guardrails:
  - FREE_CHECKOUT só é permitido se cumprir simultaneamente A1, A3 e D04.07.01.
  - Em conflito de limites, aplica-se sempre o limite mais restritivo.


#### G05.019 (origem: D04.08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2643`.

D04.08 Deprecação de `Event.isFree` (anti‑desync) (FECHADO)
Regra:
- `Event.isFree` deixa de existir como “fonte de decisão”.
- A única regra de “free” é a de D04.07.
- Para UI (“evento grátis”) é sempre derivado:
  - `derivedIsFree = (min(TicketType.price) == 0 AND não existe TicketType.price > 0)` **ou**
  - `Event.pricingMode = FREE_ONLY` (flag explícita, se precisares)
- Qualquer gating (checkout/login/anti‑abuso) **nunca** usa `Event.isFree`.

Implementação:
- Remover leituras do flag em UI/checkout.
- Se o campo ainda existir por compatibilidade, marcá-lo como deprecated e preenchê-lo apenas como read model.
- Assert em Finanças: se `totalAmount > 0` então `scenario != FREE_CHECKOUT`.


#### G05.020 (origem: D04.09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2657`.

D04.09 Refunds, cancelamentos e chargebacks (FECHADO)
Cancelamento de evento:
- Ao cancelar um evento: **refund automático** para todas as compras elegíveis.
- Stripe Connect (Standard nesta fase):
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


#### G05.021 (origem: D04.10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2687`.

D04.10) Revenda — state machine e atomicidade (FECHADO)
- Estado canónico:
  - `TicketStatus`: `ACTIVE | RESALE_LISTED | TRANSFERRED | REFUNDED | DISPUTED | CHARGEBACK_LOST | CANCELLED`
  - `ResaleStatus`: `LISTED | SOLD | CANCELLED`
- Pré-condições de listagem:
  - só tickets `ACTIVE`;
  - ticket com `consumedAt != null` não pode entrar em revenda;
  - para multi-sessão, revenda só é permitida quando todos os entitlements transferíveis ainda não foram consumidos.
- Atomicidade de compra:
  - compra de revenda é transação única: `payment succeeded` -> `owner` canónico atualizado -> entitlements do owner antigo revogados/reemitidos para o novo owner -> listing fechado.
  - falha em qualquer passo implica rollback total.
- Locks e constraints:
  - lock transacional obrigatório (`SELECT ... FOR UPDATE`) no `Ticket` e no `TicketResale`;
  - máximo 1 listing ativo por ticket (constraint única para status ativo).
- Preço e anti-scalping:
  - `maxResalePrice` por evento/ticketType (default: preço original);
  - `resaleFeePolicyVersion` congelada no `Payment`.
- Disputes/refunds (sem reversão automática):
  - chargeback/refund do comprador da revenda -> entitlement do novo owner `SUSPENDED` + `Ticket.status=DISPUTED`;
  - não existe reversão automática de owner;
  - qualquer reversão de owner é apenas manual/admin com `AuditLog`.
- Resolução:
  - `dispute.won` -> entitlement `ACTIVE` + ticket `ACTIVE` (se temporalmente válido);
  - `dispute.lost` -> `Ticket=CHARGEBACK_LOST` + entitlement `REVOKED`;
  - refund confirmado -> `Ticket=REFUNDED` + entitlement `REVOKED`.
- Integração operacional:
  - jobs idempotentes obrigatórios para `entitlements.suspend_on_dispute_opened` e `ticket.mark_disputed`.

⸻


#### G05.022 (origem: D09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2824`.

D09) Merchant of Record + fiscalidade (decisão “top”)
	•	MoR por defeito é a Organização (Connected Account)
	•	Organização é responsável por IVA / fatura ao consumidor final
	•	ORYA cobra fee de plataforma e emite fatura B2B da fee à Organização (ou documento equivalente)
	•	Excepção futura (enterprise): ORYA como MoR só por contrato/config explícita (fora v1.x)


#### G05.023 (origem: D09.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2830`.

D09.01) Faturação “não obrigatória” (posição v3) — sem risco para a ORYA

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
	•	Integrações opcionais PT são fora de escopo atual e só entram por decisão explícita no planning.

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
	2) Rollout controlado:
		•	Passo 1: ler ambos, comparar e alertar divergências sem alterar UX.
		•	Passo 2: UI/API lê apenas policy canónica; legacy apenas para export/debug.
		•	Passo 3: remover fallback e remover campos legacy do schema.

Guardrail:
	•	Architecture test falha se algum módulo importar/ler os campos legacy.


## G06) Eventos, Bilhetes, Acesso e Check-in

### Escopo estrutural
- Section 7 Entitlements e sourceType
- Section 8 Check-in

### Blocos normativos (conteúdo integral, ordem estável)

#### G06.001 (origem: C03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1030`.

C03) Check-in ↔ Eventos/Reservas/Padel — via Entitlement unificado

Check-in valida QR e resolve origem:
	•	ticket (Eventos) ou booking (Reservas) ou inscrição Padel (Padel)

E grava:
	•	EntitlementCheckin + EventLog(checkin.*) + presença/no-show conforme política

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C03  
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

#### G06.002 (origem: D01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2353`.

D01) Evento base obrigatório para torneios

Todo torneio de Padel tem eventId obrigatório.
	•	Eventos: tickets, SEO, página pública base, sessões, entitlements
	•	Padel Torneios: competição, matches, bracket/standings, live ops


#### G06.003 (origem: D01.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2359`.

D01.01) Schedule de Evento — invariantes de tempo (FECHADO)
	•	`endsAt` é **obrigatório** em toda a stack (criação, edição, ingestão, seed).  
	•	Regra: `endsAt` **tem de ser depois** de `startsAt` (nunca antes).  
	•	Não existe fallback runtime para `endsAt`; payload inválido falha e deve ser corrigido na origem.  
	•	Evento publicado **nunca** pode regressar a `DRAFT`. `DRAFT` nunca é público.  
	•	Chat de evento: `open_at = startsAt`, `read_only_at = endsAt + 24h`, `close_at = endsAt + 24h`.  
	•	Chat de evento (acesso) — **presença** obrigatória: **Entitlement + check-in consumido**.  
	•	Definição: **check‑in consumido = entitlement consumido** (`CheckinResultCode.OK` ou `ALREADY_USED`).  
	•	Entitlement mantém-se como prova única de acesso ao evento; o chat é uma feature de presença.  
	•	Entrada no chat é por **convite com aceitação explícita**; convite emitido após entitlement consumido (check‑in/claim) se dentro da janela.  
	•	Convites de chat **expiram** e **não podem ser aceites** após `endsAt + 24h` (janela de participantes).  
	•	Chat de evento aparece em “Mensagens” **apenas após** convite aceite.  
	•	CTA “Entrar no chat” na página do evento **e** no bilhete/carteira, apenas após entitlement consumido.  
	•	Notificação do chat enviada após entitlement consumido (respeita preferências do utilizador).  
	•	Chat de evento é **exclusivo da app** (não existe chat de evento na web para users).  
	•	Até `endsAt + 24h` mantém escrita para participantes com acesso; após isso fica **read‑only**.  
	•	Discovery: eventos `PAST`/`CANCELLED` **não** entram em listas públicas.  
	•	Mobile checkout: CTA **bloqueado** se `status != ACTIVE` **ou** `endsAt < now`.  
	•	Wallet: separação “Ativos/Histórico” **baseada em `endsAt`** (ou janela de check‑in).
	•	Higiene legacy: migração one-shot corrige `endsAt` inválido e aplica constraint DB `endsAt > startsAt`.


#### G06.004 (origem: D07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2742`.

D07) sourceType canónico (Finanças/ledger/check-in)

Todos os checkouts e entitlements usam sourceType canónico e unificado (Secção 7).


#### G06.005 (origem: D08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2746`.

D08) EventAccessPolicy (acesso + convites + identidade + claim entitlements) — definição final

> **FECHADO (SSOT):** `EventAccessPolicy` é a única fonte de verdade para:
> 1) modo de acesso (public/invite/unlisted), 2) checkout como convidado, 3) convites por token, 4) compatibilidade de identidade, e 5) check‑in (ver Secção 8).


#### G06.006 (origem: D08.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2751`.

D08.01) EventAccessPolicy é a única verdade de acesso (FECHADO)
- Substitui qualquer combo de flags legacy (`public_access_mode`, `invite_only`, etc.).
- Modelo canónico (mínimo):
  - `mode: PUBLIC | INVITE_ONLY | UNLISTED`
  - `guestCheckoutAllowed: boolean`
  - `inviteTokenAllowed: boolean`
  - `inviteIdentityMatch: EMAIL | USERNAME | BOTH`
  - `inviteTokenTTL: duration` (obrigatório se `inviteTokenAllowed=true`)
  - `checkin: { requiresEntitlementForEntry, methods[...] }` (ver Secção 8)
- **Restrição:** `inviteTokenAllowed=true` exige `inviteIdentityMatch=EMAIL|BOTH`.  
  `inviteIdentityMatch=USERNAME` **não** suporta tokens (apenas convites por username existente).
- **Regra de integridade:** convites por username só podem ser emitidos para utilizadores existentes.  
  Para pessoas sem conta, usar convite por email.
- **Sem fallback** entre campos. Migração/backfill obrigatório no write‑path (não na leitura).


#### G06.007 (origem: D08.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2766`.

D08.02) Convites por token (guest checkout) — versão final (FECHADO)

Convites permitem checkout como convidado via token **na WebApp e no site público**.  
A app mobile é **login‑only** (sem guest checkout).

Regras fechadas
1) InviteToken one‑time + expira
- guardar `tokenHash` (nunca token em claro)
- `expiresAt` (ex.: 7 dias; ou conforme `inviteTokenTTL`)
- `usedAt` + `usedByIdentityId`

2) Match obrigatório de identidade
- o token fica associado a `emailNormalizado` (e opcionalmente username, se usares BOTH)
- no checkout guest, o email tem de bater certo (case‑insensitive, normalizado)
- se `inviteIdentityMatch=USERNAME`, `inviteTokenAllowed` tem de ser **false** (sem tokens)

3) Scope do token
- token é válido só para 1 evento e (opcional) 1 `ticketTypeId` (controlo fino)

4) Rate limit + anti‑enumeração
- limitar tentativas por IP/device
- respostas indistinguíveis (“token inválido” sem detalhes)

5) Entitlement final (SSOT) + claim posterior (FECHADO)
- compra guest gera `Entitlement` com `ownerIdentityId` de identidade por email em estado guest
- quando o user criar conta e verificar o mesmo email → claim automático (Secção 7.7)
- **Propriedade do acesso nunca é OR entre campos.** Resolver sempre via `Entitlement.ownerIdentityId`.

6) Eventos VIP (login obrigatório)
- Para eventos que exijam login: `guestCheckoutAllowed=false` e `mode=INVITE_ONLY` (sem exceções).
- App mobile é sempre login obrigatório (independente de `guestCheckoutAllowed`).

7) Guest Ticket Link (acesso sem conta) — FECHADO
- Após compra guest, emitir `GuestTicketAccessToken` (guardar **apenas** `tokenHash`).
- Email de compra deve incluir link `/guest/tickets/[token]`.
- Expiração: `expiresAt = fim da janela de check‑in` (default: abre `startsAt - 6h`, fecha `endsAt + 6h`; se `endsAt` faltar, fecha `startsAt + 24h`).
- Segurança: token único + hash, sem PII no link; rate limit em rotas de QR.
- Se falhar emissão do token, usar fallback seguro (`/`).

UX operacional detalhada de convite/checkout guest é **não‑normativa** e vive em `docs/planning_registry_v1.md` (P7.1).

⸻


#### G06.008 (origem: D08.03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2809`.

D08.03 Imutabilidade temporal (depois de haver vendas) (FECHADO)
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


## G07) Reservas, Agenda e Calendario Operacional

### Escopo estrutural
- D03 Agenda Engine
- D11 Address Service

### Blocos normativos (conteúdo integral, ordem estável)

#### G07.001 (origem: C01)
- Fonte: consolidação 2026-02-15 (`docs/calendario_motor_unico.md`, `docs/reservas.md`, `docs/arbitration_service_spec.md`).

C01) Reservas ↔ Padel (agenda e slots)

Contrato canónico ativo:
	•	Todo write-path de ocupação passa pelo motor único de agenda (sem bypass por módulo).
	•	`resourceKey` global é obrigatório no formato `resourceType:authorityOrgId:resourceId`.
	•	`sourceType` mantém-se canónico (`MATCH`, `BOOKING`, `CLASS_SESSION`, `HARD_BLOCK`, `SOFT_BLOCK` reservado); `MATCH_SLOT` é `reasonCode`.
	•	Qualquer redação histórica neste bloco que trate `CLASS_SESSION` como “futuro” é inválida por `SUPERSEDED_BY_SSOT-2026-02-21-RESERVAS-AULAS-TORNEIOS-HARDCUT`.
	•	Em ocupação multi-recurso, a confirmação existe apenas com commit atómico de `slot + claims + locks`.
	•	Conflito canónico devolve explicação estruturada: quem bloqueou, origem e regra aplicada.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C01  
**Contract Name:** Reservas ↔ Padel (agenda e slots)  
**Current Version:** v3.1.0  
**Owner:** Domain: Reservas (Agenda Engine)  
**Primary Consumers:** Padel (Torneios), ORYA-WebApp (org dashboard), internal workers

---

#### Purpose
Definir a interface canónica para criação/atualização de ocupação na agenda, com conflito determinístico e suporte cross-org por autoridade de recurso.

---

#### Idempotency
- **Idempotency Key:** idempotencyKey
- **Scope:** per `orgId + resourceKey + sourceType + sourceId`
- **Guarantee:** repeated requests with the same key MUST NOT produce
  duplicate side effects.

If idempotency cannot be guaranteed, the contract is considered invalid.

---

#### Input Payload (Example)
```json
{
  "orgId": "org_123",
  "authorityOrgId": "org_999",
  "resourceKey": "COURT:org_999:court_45",
  "resourceType": "COURT",
  "resourceId": "court_45",
  "startAt": "2026-02-01T10:00:00Z",
  "endAt": "2026-02-01T11:30:00Z",
  "sourceType": "MATCH",
  "sourceId": "match_789",
  "reasonCode": "MATCH_SLOT",
  "priorityRuleVersion": "v1",
  "idempotencyKey": "claim:match_789:court_45:2026-02-01T10:00:00Z"
}
```

#### Output / Response (Example)
```json
{
  "accepted": true,
  "conflicts": [],
  "ruleApplied": "FIRST_CONFIRMED_WINS",
  "correlationId": "corr_abc"
}
```

#### Error Cases
All errors follow the global error envelope.
Example:
```json
{
  "errorCode": "AGENDA_CONFLICT",
  "message": "Requested slot conflicts with existing claim",
  "blockedBy": {
    "sourceType": "HARD_BLOCK",
    "sourceId": "hb_456",
    "resourceKey": "COURT:org_999:court_45"
  },
  "ruleApplied": "HARD_BLOCK_PRIORITY",
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
`confirmedAt` (fallback `createdAt`)

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
- `MATCH_SLOT` é `reasonCode` operacional/contextual e não `AgendaSourceType` autónomo.
- Disputas cross-org deste contrato seguem arbitragem canónica por `resourceKey` (ver `G07.007`).

#### G07.002 (origem: C07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1482`.

C07) Address Service ↔ Todos (moradas e localizações)
	•	criação/normalização de moradas passa pelo Address Service
	•	módulos guardam apenas addressId (ou placeId) e nunca strings “soltas” como fonte de verdade
	•	migração: adapters para eliminar “várias verdades” existentes

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C07  
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

#### G07.003 (origem: D03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2413`.

D03) Agenda Engine e conflitos (FECHADO)

Regra base: **quem marca primeiro ocupa**. Nada sobrepõe automaticamente.  
Conflitos ficam bloqueados; quem chega depois tem de se adaptar.

Aditamento normativo (2026-02-14):
		•	Regra de conflito em camadas:
			–	hard constraints (segurança/compliance/manutenção/hard block) prevalecem sempre;
			–	fora hard constraints, aplica-se `first_confirmed_wins`;
			–	em empate técnico no mesmo instante/lote, aplicar prioridade: `HARD_BLOCK > CLASS_SESSION > MATCH (reasonCode=MATCH_SLOT) > BOOKING > SOFT_BLOCK`;
			–	tie-break final determinístico: `confirmedAt` asc e depois `claimId` asc (fallback `createdAt` quando necessário).
	•	`SOFT_BLOCK` fica reservado na taxonomia e não participa no write-path operacional de Reservas no v1.
	•	Unidade temporal canónica do motor: blocos de **5 minutos**.
	•	Projeção UI pode usar grelha de 15 minutos por default, sem alterar a regra canónica do motor.
	•	Buffer técnico global não é obrigatório por defeito; aplica-se por política/configuração de contexto.
	•	Capacidade canónica por modo: `SINGLE`, `FIXED_N`, `UNBOUNDED`; `UNBOUNDED` só em tipos de recurso autorizados por policy (allow-list).
	•	Assignment canónico por serviço:
		–	`PROFESSIONAL_ONLY`,
		–	`RESOURCE_ONLY`,
		–	`PROFESSIONAL_AND_RESOURCE`.
		•	Auto-seleção de recurso (quando aplicável): menor capacidade válida, depois menor prioridade, depois menor `id`.
		•	Prioridade operacional é opcional por configuração (`serviço`/`recurso`/`profissional`) e tem default neutro.
		•	Overbooking: proibido por default nesta fase.
			•	O core de scheduling/agenda não depende de mecanismo runtime de ativação de funcionalidades (kill switches operacionais continuam permitidos).
		•	Limite de pré-reserva pendente por identidade (`user` autenticado ou `guestEmail`): 1 ativa de cada vez.
		•	Criação manual de reservas por backoffice não faz parte do contrato canónico v1; ocupação offline deve ser modelada por `HARD_BLOCK` auditável.
		•	Hard block operacional:
		–	escopos permitidos: `GLOBAL_ORG`, `RESOURCE`, `PROFESSIONAL`;
		–	ao criar hard block, novas confirmações ficam bloqueadas imediatamente na janela afetada;
		–	ao remover hard block, a janela reabre automaticamente para novas confirmações.
	•	Hard block com impacto em reservas confirmadas:
		–	abre pendências operacionais obrigatórias (troca aceite ou cancelamento + reembolso total imediato);
		–	só fecha quando todas as pendências associadas estiverem resolvidas.
	•	Hard block exige `reasonCode` obrigatório e texto livre opcional.
	•	Catálogo de `reasonCode` é extensível por organização, com fallback genérico.
		•	Toda ação de hard block é auditável (`createdBy/updatedBy`, timestamps, before/after).

Namespace canónico de decisões desta ronda (2026-02-15):
- Para evitar colisão de IDs globais `D*`, as decisões do pacote Calendário/Reservas desta ronda usam `DCAL-01..DCAL-36`.
- Todos os `DCAL-*` mapeiam para este bloco canónico (`G07.003`) e para a matriz de fecho C01..C04.

Override **só manual** por Owner/Co-owner/Admin, com auditoria e notificações.  
Se o override mexer numa reserva de utilizador, existem duas vias válidas:
- **pedido + aceitação** do cliente; ou
- **cancelamento com reembolso total imediato** por decisão da organização.


#### G07.004 (origem: D03.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2455`.

D03.01 MatchSlot (Padel)
MatchSlot bloqueia novas marcações no mesmo horário/campo.  
Se já existir reserva/aula, MatchSlot **não** sobrepõe automaticamente; requer override explícito.


#### G07.005 (origem: D03.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2459`.

D03.02) Operação de Calendário do Clube/Reservas (FECHADO)
			•	Calendário único de clube:
				–	reservas, aulas e torneios partilham o mesmo calendário operacional.
				–	tudo o que ocupa recurso/campo bloqueia esse recurso no horário.
				–	auto-schedule de torneio em modo `ALLOW_PARTIAL` não aborta o lote por conflito de domínio; devolve `200` com `skippedByMatch` e `unscheduledByReason`.
				–	modo `REQUIRE_FULL` mantém fail-fast com `409 AUTO_SCHEDULE_INFEASIBLE`.
		•	Agenda pessoal (utilizador):
			–	é timeline unificada (projeção), não write-model de ocupação.
			–	inclui `Booking` de serviço e itens de bilhete/evento em tipos separados.
			–	labels canónicas: `RESERVA_SERVICO` e `BILHETE_EVENTO`.
		•	Visibilidade de calendário:
			–	Utilizador: mês atual + 3 meses; passado oculto.
		–	Organização: até fim do ano + 2 anos; passado em leitura.
	•	Permissões:
			–	Owner/Co-owner/Admin: tudo.
		–	Staff: apenas recursos atribuídos.
		–	Trainer: aulas próprias em recursos atribuídos.
		•	Override/mudança de reserva:
			–	org pede mudança com default T-4h.
			–	a janela da org pode ser parametrizada por policy versionada, com guardrails canónicos.
			–	user responde até 24h ou T-2h (o que ocorrer primeiro).
			–	sem resposta = recusado; reserva mantém-se.
			–	cancelamento pelo org = refund total automático.
		•	Aplicação de hard block:
			–	bloqueia novas confirmações imediatamente;
			–	se houver impacto em clientes confirmados, exige resolução de pendências antes do fecho do bloqueio.
			•	Guest booking e aulas recorrentes:
				–	guest booking permitido apenas por policy e cria Entitlement canónico.
				–	telefone é opcional; identidade guest canónica por email.
				–	OTP por telemóvel não é obrigatório nesta fase.
				–	`ClassSeries + ClassSession` fica fora do v1 operacional de Reservas nesta fase.
		•	Snapshot e remediação operacional:
			–	ações que dependem de snapshot seguem fail-closed.
			–	backfill automático é obrigatório com SLO definido por operação.
			–	casos não recuperados automaticamente seguem runbook auditável de remediação.
		•	No-show:
			–	marcado apenas após início;
			–	sem fee financeiro por default nesta fase (foco operacional/CRM);
			–	reversão permitida até `T+24h` por `OWNER/CO_OWNER/ADMIN`, sem motivo obrigatório, com auditoria.
		•	Disponibilidade pública:
			–	contrato público canónico de disponibilidade de serviço: `GET /api/servicos/:id/calendario`.
			–	rotas legadas de disponibilidade (`GET /api/servicos/:id/slots` e `GET /api/servicos/:id/disponibilidade`) devolvem `410 LEGACY_ROUTE_REMOVED`.


#### G07.006 (origem: D11)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2933`.

D11) Moradas — Address Service (SSOT) + Apple Maps como provider único

> **FECHADO (SSOT):** Todos os módulos consomem e escrevem moradas **apenas** via Address Service. Nunca há “moradas por módulo”.

Regra
- Todos os módulos (Eventos / Reservas / Loja / Serviços / Padel) consomem e escrevem moradas APENAS via Address Service (SSOT).
- O SSOT guarda SEMPRE:
  - `addressId`
  - `formattedAddress` (para UI)
  - `canonical` (estruturado: `countryCode` ISO‑3166‑1, region, locality, postalCode, street, number, etc.)
  - `geo` (lat, lng)
  - `sourceProvider` (canónico nesta fase: `APPLE_MAPS`)
  - `sourceProviderPlaceId` (quando existir)
  - `confidenceScore` + `validationStatus` (`RAW | NORMALIZED | VERIFIED`)
- Nunca há “moradas locais” por módulo. Só referências a `addressId`.

Provider (decisão FECHADO)
- **Provider único:** Apple Maps (autocomplete + geocode/reverse) via server token.
- Regra: o client **não** usa providers como fonte de verdade; tudo passa pelo Address Service (protege keys, rate limits e consistência).
- `IP geolocation` pode ser usado apenas como sinal auxiliar (país/cidade aproximada, ranking e defaults), nunca como morada canónica.
- Sem multi-provider e sem provider manual de localização nesta fase.
- Exceção permitida: reverse geocode **no device** apenas como hint de UX (não é SSOT). A normalização e persistência continuam no backend.
- Objetivo de UX: qualidade de sugestão "best-in-class", equivalente a apps de referência.
- Ranking de sugestões deve ser multi-sinal (ordem de prioridade):
  1) intenção textual da query (match semântico/tipográfico),
  2) proximidade ao contexto da organização (país/cidade/região),
  3) contexto local do utilizador (locale/fuso e sinais de sessão),
  4) geosinal aproximado (IP) apenas como desempate.
- É proibido usar IP como override rígido do resultado; IP só melhora ordenação.

D11.1) UX operacional de autocomplete (FECHADO)
- `decisionId`: `SSOT-2026-02-15-ADDRESS-AUTOCOMPLETE-UX-V1`
- `owner`: `Nuno`
- `approvedAt`: `2026-02-15`
- `scope`: `Superfícies operacionais de procura de morada (dashboard/settings/eventos/reservas)`
- `rationale`: `Eliminar UX fraca/inconsistente e garantir padrão de topo sem dupla verdade de morada.`
- `migrationImpact`: `UI migra para combobox canónico com dropdown em overlay; estados legados inline devem ser removidos.`

Regras normativas:
- O dropdown de sugestões deve abrir em **overlay por cima da página** (portal/anchor), nunca aumentar altura do formulário nem deslocar blocos.
- A persistência canónica depende sempre de seleção validada (`addressId` vindo de `details/normalize`); texto digitado sem seleção é apenas rascunho de input.
- Recents, geolocation e contexto de sessão são sinais de UX/ranking; não substituem validação canónica e não produzem morada SSOT por si só.
- O ranking visual deve expor pelo menos:
  - secção de melhores sugestões;
  - secção de resultados adicionais quando aplicável;
  - separação explícita de resultados fora do país efetivo (expansível).
- A interação por teclado é obrigatória (`ArrowUp/ArrowDown/Enter/Escape/Tab`) com foco e `aria-*` de combobox/listbox.
- O provider continua único (`APPLE_MAPS`) via Address Service; client-side pode apenas refinar ordenação visual, sem reescrever a verdade canónica.

Proteções (obrigatório)
- Rate limiting por IP/user/org + quotas por módulo (para não estourar limites Apple).
- Cache em 2 níveis:
  - Redis (TTL curto) por query (autocomplete) e por placeId/geo (geocode)
  - cache persistente por `addressId` (TTL longo) e dedupe por canonical+geo
- Circuit breaker do provider Apple:
  - se Apple falhar acima de `errorRateThreshold` (ex.: 20% em 2 min) → entrar em `cooldownMinutes` (ex.: 10)
  - durante cooldown, re-test Apple em background (probe) e só volta quando estabilizar
- Quotas “hard” por organização e por módulo:
  - ao exceder quota → degrade gracioso (só `resolvePlace` por placeId já em cache; sem autocomplete novo)
  - emitir `ops.alert` com orgId + módulo + métrica de consumo
- Em falha de geocode Apple:
  - write-path dependente de morada fica em `PENDING_GEOCODE` (estado do domínio consumidor) e entra em retry automático idempotente;
  - é proibido promover IP a coordenada/morada canónica.
- Em conflito entre sinais Apple/IP, prevalece Apple.

Detalhe de implementação/execução do Address Service é **não‑normativo** e vive em `docs/planning_registry_v1.md` (P7.3).

#### G07.007 (origem: ARB.01)
- Fonte: `docs/arbitration_service_spec.md` (consolidação normativa 2026-02-15).

ARB.01) Arbitration Service Cross-Org (FECHADO)

Escopo:
	•	Definir autoridade única para disputas de ocupação cross-org.
	•	Eliminar decisões ad-hoc entre organização dona e organizações parceiras.

Regras canónicas:
	•	Autoridade final da decisão é sempre da `authorityOrgId` do `resourceKey`.
	•	Lock técnico obrigatório por `resourceKey + janela temporal`; sem lock, write rejeitado.
	•	Persistência atómica obrigatória de `slot + claims + decisão de arbitragem`.
	•	Algoritmo obrigatório:
		1) validar tenancy/autoridade;
		2) aplicar hard constraints;
		3) aplicar `first_confirmed_wins`;
		4) em empate técnico no mesmo instante/lote, aplicar prioridade explícita:
		   `HARD_BLOCK > CLASS_SESSION > MATCH(reasonCode=MATCH_SLOT) > BOOKING > SOFT_BLOCK`;
		5) tipo de claim fora da `priorityRuleVersion` ativa => `fail-closed`;
		6) tie-break determinístico: `confirmedAt -> claimId -> createdAt`;
		7) persistir decisão + evidência da regra aplicada.
	•	Override da org dona exige `reasonCode`, cálculo de impacto e compensação automática.
		•	Estados mínimos de compensação: `PENDING_COMPENSATION`, `COMPENSATED_REBOOK`, `COMPENSATED_REFUND`, `COMPENSATION_FAILED`.
		•	`COMPENSATION_FAILED` bloqueia conclusão do override.
		•	Audit trail obrigatório: `arbitrationId`, `inputHash`, `priorityRuleVersion`, regra aplicada, decisão final, ator/org, timestamps e vínculo de compensação.
		•	Observabilidade mínima obrigatória de arbitragem:
			–	`arbitration.decision.latency_ms` (`p50`, `p95`);
			–	`arbitration.override.rate`;
			–	`arbitration.compensation.failed_rate`;
			–	`arbitration.conflicts.by_resourceKey`.
		•	Log estruturado obrigatório para decisão e override com `arbitrationId`, `resourceKey`, `authorityOrgId`, `priorityRuleVersion`, `reasonCode`, `correlationId`.
		•	SLA/SLI de arbitragem é obrigatório por ambiente (`dev/stage/prod`) e deve estar ligado a runbook único de incidente cross-org.

---

⸻


## G08) Padel e Torneios

### Escopo estrutural
- Padel Tournament Core
- Split `SPLIT_GARANTIDO` (contrato financeiro canónico)

### Blocos normativos (conteúdo integral, ordem estável)

#### G08.001 (origem: C06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1366`.

C06) Inscrições Padel vs Bilhetes (coexistência simples e eficaz)
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

**Contract ID:** C06  
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

#### G08.002 (origem: S01..S09)
- Fonte: `docs/SPLIT_V2.md` + `docs/split_v2_ssot.md` (consolidação normativa 2026-02-15).

SPLIT_GARANTIDO (FECHADO)

Escopo:
	•	Contrato financeiro canónico de split para entidades transacionais (`targetType/targetId`: reservas, inscrições, eventos e equivalentes).
	•	`SplitBundleStatus=OPEN` bloqueia alterações de `totalCents`/`targetEndAt` e bloqueia checkout principal enquanto existir split aberto.

Invariantes obrigatórios:
	•	Nome canónico único: `SPLIT_GARANTIDO`.
	•	`sum(sharesCents) == totalCents`.
	•	`deadlineAt` obrigatório.
	•	`SettlementSnapshot` imutável para settle/retry/refund.
	•	Idempotência forte em todos os comandos financeiros.
	•	Rails monotónicos obrigatórios: `HOLD_CAPTURE -> OFFSESSION_PI -> DEBT`.
	•	É proibido recalcular fees após snapshot.

Modelo operacional:
	•	Fluxo de split é offline/server-side para fecho e recovery.
	•	Garantia temporal do hold deve cobrir `deadlineAt + SAFETY_BUFFER`.
	•	`replaceHold` é obrigatório quando a cobertura deixa de garantir o prazo.
	•	Guards obrigatórios: `T-6h` e `T-2h`.
	•	No deadline, settle com lock transacional e reconciliação no gateway antes do snapshot.
	•	`paymentConfirmedAt` usa timestamp canónico do gateway (não timestamp de webhook).
	•	Late payment após settle => refund automático idempotente (sem recalcular `outstanding`).

	Cobrança de fallback e dívida:
		•	Se capture do hold falhar de forma não recuperável, migrar para `OFFSESSION_PI`.
		•	Se retries esgotarem até `retryUntilAt`, abrir `DEBT` e manter bloqueio por identidade conforme contrato.
		•	Pagamentos manuais fora do contrato são proibidos.
		•	`captureBeforeSource` obrigatório: `GATEWAY_EXPLICIT | CANONICAL_COMPUTED_TABLE`.
		•	Precedência obrigatória: usar `GATEWAY_EXPLICIT` sempre que o gateway expuser `capture_before`; `CANONICAL_COMPUTED_TABLE` só quando não existir timestamp explícito.

	SettlementSnapshot canónico (campos mínimos):
		•	`snapshotId`, `splitBundleId`, `targetType`, `targetId`, `computedAt`, `deadlineAt`, `settlingAt`.
		•	`totalCents`, `paidShareIds[]`, `outstandingCents`, `currency`.
		•	`feePolicyVersionApplied`, `feeModeApplied`, `platformFeeCentsTotal`, `sharesFeeBreakdown[]`, `payoutModeApplied`.
		•	`orgId`, `destinationAccountRef?`, `captureBeforeSource`.

	Mapeamento financeiro por `orgType`:
		•	`EXTERNAL` => Stripe Connect (tipo Standard nesta fase).
		•	`PLATFORM` => conta Stripe da ORYA (não-Connect / sem `transfer_data.destination`).
		•	Validação obrigatória em Stripe sandbox (`test mode`) sem cobranças reais.

	Observabilidade e correlação operacionais mínimas:
		•	Log estruturado obrigatório com correlação por `splitBundleId`, `paymentId`, `snapshotId`, `orgId`, `correlationId`.
		•	Métricas mínimas: `split_settled_rate`, `split_charge_failed_recovered_rate`, `split_debt_open_rate`, `split_late_refund_count`, `split_fee_drift_count`.
		•	Alertas mínimos: `settle_job_missed_deadlineAt`, `capture_attempt_after_captureBefore`, `late_refund_failed`, `fee_drift_detected`, `debt_open_rate_spike`.

Nota de precedência:
	•	O texto histórico D12 (janela 48/24 para split Padel) fica revogado como norma ativa.
	•	A norma ativa de split neste SSOT é o contrato `S01..S09` descrito neste bloco.


#### G08.003 (origem: D12.05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3038`.

D12.05) Ops — Prisma env auto-load (FECHADO)
	•	Prisma CLI deve ler variáveis automaticamente do `.env` (root), sem `set -a`, `source` ou inline envs.
	•	Nota operacional: DATABASE_URL via pooler (6543) + DIRECT_URL direto (5432) e ambos com `sslmode=require`.


#### G08.004 (origem: D18)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3079`.

D18) Padel Tournament Core Unification (FECHADO)

Escopo v1.x (fechado):
	•	Neste momento, a plataforma opera torneios apenas de Padel.
	•	As regras abaixo são normativas e de aplicação obrigatória.


#### G08.005 (origem: D18.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3085`.

D18.01) Verdade única de jogo Padel (FECHADO)
	•	Para eventos Padel, a verdade operacional de jogo é `EventMatchSlot`.
	•	`TournamentMatch` não é write-model de operação de jogo Padel em v1.x.


#### G08.006 (origem: D18.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3089`.

D18.02) Agenda sem conflitos entre módulos (FECHADO)
	•	Reservas, aulas, jogos e bloqueios partilham o mesmo motor de conflito.
	•	Nenhuma rota que ocupa recurso/campo pode contornar a Agenda Engine.
	•	Em ocupação multi-recurso, `first-confirmed` só é válido com commit atómico de `slot + resourceClaims[] + locks` na mesma transação.
	•	Se qualquer claim falhar (conflito/validação), a operação deve fazer rollback total (sem estado parcial).
	•	Write-path concorrente para o mesmo recurso/janela deve aplicar lock técnico obrigatório.


#### G08.007 (origem: D18.03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3096`.

D18.03) Agendamento por `tournamentMatch` em Padel (FECHADO)
	•	Em `templateType=PADEL`, alterações de horário/campo por write direto em `TournamentMatch` são proibidas.
	•	Todo o agendamento de jogo Padel deve passar pelo fluxo canónico de agenda.
	•	Implementação fora desta regra deve falhar fechado.


#### G08.008 (origem: D18.04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3101`.

D18.04) C01 com enforcement obrigatório (FECHADO)
	•	A regra "Padel nunca escreve no calendário diretamente" é obrigatória no write-path.
	•	Se existir caminho paralelo sem validação de conflito, é bug arquitetural.


#### G08.009 (origem: D18.05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3105`.

D18.05) sourceType e AgendaSourceType unificados (FECHADO)
			•	Separação Finance/Agenda mantém-se obrigatória.
			•	Taxonomia `AgendaSourceType` para ocupação mantém `MATCH`, `BOOKING`, `SOFT_BLOCK`, `HARD_BLOCK`, com `SOFT_BLOCK` reservado fora do write-path operacional de Reservas v1.
			•	`CLASS_SESSION` é canónico na agenda org e na arbitragem de torneios.
			•	Qualquer texto histórico que indique `CLASS_SESSION` como “reservado/futuro” fica explicitamente invalidado por `SUPERSEDED_BY_SSOT-2026-02-21-RESERVAS-AULAS-TORNEIOS-HARDCUT`.
			•	`MATCH_SLOT` é `reasonCode` de bloqueio/contexto operacional e não um `AgendaSourceType` autónomo.
			•	`EVENT` e `TOURNAMENT` podem existir para timeline/visibilidade, sem substituir ocupação real de recurso.


#### G08.010 (origem: D18.06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3112`.

D18.06) Verdade transacional de inscrição Padel (FECHADO)
	•	`PadelRegistration` é a única verdade transacional de inscrição Padel.
	•	Estados canónicos de inscrição devem ser resolvidos a partir desta entidade.


#### G08.011 (origem: D18.07)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3116`.

D18.07) `TournamentEntry` em Padel é derivado (FECHADO)
	•	Para Padel, `TournamentEntry` é read-model/projeção.
	•	`TournamentEntry` não pode ser fonte primária de estado transacional.
	•	Em superfícies Padel (ex.: live/acesso), elegibilidade de participante deve usar `PadelRegistration` + entitlement, não `TournamentEntry`.


#### G08.012 (origem: D18.08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3121`.

D18.08) Perfil de jogador canónico (FECHADO)
	•	`PadelPlayerProfile` é a fonte canónica única de perfil operacional para Padel (jogo, elegibilidade, pairing, agenda e live).
	•	`Profile/users` mantém identidade global de conta (ex.: `userId`, email, username), mas não redefine campos operacionais de jogo Padel.
	•	`CRM Contact` é projeção comercial/marketing e não pode sobrepor campos operacionais de jogador Padel.
	•	Leitura em superfícies Padel deve usar `PadelPlayerProfile` como primário; fallback para `Profile/users` só é permitido quando o campo canónico estiver vazio.
	•	Escrita em fluxos Padel deve atualizar primeiro `PadelPlayerProfile`; sincronizações para CRM/outros módulos devem ser assíncronas e idempotentes.
	•	Em conflito entre fontes, prevalece sempre `PadelPlayerProfile`.


#### G08.013 (origem: D18.09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3129`.

D18.09) Papel operacional de staff unificado (FECHADO)
	•	Autorização canónica (quem pode executar ação) é definida por RBAC organizacional (`OrganizationMemberRole` + `RolePack` + permissões de ferramenta/capability).
	•	Papel operacional Padel (quem está escalado para função) é uma camada separada, com catálogo canónico e escopo explícito.
	•	Escopo `CLUB`: valores canónicos obrigatórios `ADMIN_CLUBE`, `DIRETOR_PROVA`, `STAFF` em enum de persistência.
	•	Escopo `TOURNAMENT`: valores canónicos obrigatórios `DIRETOR_PROVA`, `REFEREE`, `SCOREKEEPER`, `STREAMER` em enum de persistência.
	•	`TOURNAMENT_DIRECTOR` mantém-se apenas como `rolePack` global RBAC (não como papel operacional Padel de torneio).
	•	Atribuição de papel operacional nunca substitui RBAC; ação crítica exige papel operacional compatível + permissão RBAC.
	•	Roles livres sem controlo semântico não podem ser norma de autorização e devem falhar fechado.
	•	Incidentes operacionais (`WALKOVER`, `RETIREMENT`, `INJURY`) exigem metadados canónicos `confirmedByRole` e `confirmationSource`.
	•	Quando incidente/resolução é confirmado por `REFEREE`, a plataforma deve notificar automaticamente perfis `DIRETOR_PROVA` do torneio (trilho auditável).
	•	Em rondas críticas KO (meias/final), confirmação operacional exige direção (`DIRETOR_PROVA` ou `Owner/Co-owner/Admin`).


#### G08.014 (origem: D18.10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3141`.

D18.10) Interclub por equipas (FECHADO)
	•	Quando `isInterclub=true`, geração e operação de jogos devem ser por equipas.
	•	Motor baseado em pairing não é válido como motor principal em interclub.
	•	Se o motor por equipas não estiver disponível, geração automática interclub deve ser bloqueada.


#### G08.015 (origem: D18.11)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3146`.

D18.11) Catálogo de formatos unificado (FECHADO)
			•	Formatos de torneio devem seguir um catálogo canónico único, versionado.
			•	Não pode existir taxonomia funcional duplicada a decidir regras de forma divergente.
			•	Listas locais duplicadas em rotas são proibidas; validação deve usar catálogo único de domínio.
		•	Formato oficial canónico inclui: `TODOS_CONTRA_TODOS`, `GRUPOS_ELIMINATORIAS`, `QUADRO_ELIMINATORIO`, `QUADRO_AB`, `DUPLA_ELIMINACAO`, `CAMPEONATO_LIGA`, `NON_STOP`, `AMERICANO`, `MEXICANO`.
		•	`QUADRO_AB` e `DUPLA_ELIMINACAO` são formatos avançados oficiais (não experimentais) no catálogo canónico.
		•	`AMERICANO` e `MEXICANO` entram no catálogo canónico oficial e devem ser tratados como formatos de primeira classe no roadmap de produto.
		•	Contrato operacional canónico `AMERICANO`: individual rotativo, ranking individual, com prioridade a combinações inéditas antes de repetição.
		•	Contrato operacional canónico `MEXICANO`: individual com mecânica `sobe/desce` por ronda e recomposição automática de quartetos.
		•	Em `AMERICANO`/`MEXICANO`, unidade de jogo oficial é por tempo (`default=20` min, configurável `15..22`) com fecho sincronizado de ronda.
			•	Pontuação oficial `AMERICANO`/`MEXICANO`: vitória `3`, empate `1`, derrota `0`; desempate por diferença de games, depois games ganhos, depois confronto direto.
			•	`BYE` em `AMERICANO`/`MEXICANO` é neutro por norma: `1` ponto, `0` diferença de games (`gamesFor=0`, `gamesAgainst=0`) e sem vantagem em confronto direto.
			•	Regras de desempate devem existir em matriz canónica por formato (ordem `1..n`), incluindo tratamento de `BYE` e definição explícita de confronto direto em formatos rotativos/individuais.
			•	Quando torneio entra em `LOCKED`, formato e regras aplicadas ficam congelados até ao fim da operação.
			•	Enquanto um formato oficial não estiver operacional numa superfície específica, o sistema deve falhar fechado com erro explícito (sem fallback silencioso para outro formato).


#### G08.016 (origem: D18.12)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3162`.

D18.12) Snapshot de regras por torneio/jogo (FECHADO)
	•	Tie-break, pontuação e regras de resultado devem ter versão aplicada e auditável.
	•	Alteração de regra não pode produzir ambiguidade histórica em jogos já operados.
	•	Separação obrigatória:
		•	`snapshot operacional` (resiliência/sync com `ttl/version`);
		•	`snapshot de torneio` imutável após publish/`LOCKED`.
	•	Alterações no clube fonte após `LOCKED` não podem alterar condições do torneio em curso.
	•	Nos writes de resultado/disputa de match, o `score` deve transportar `ruleSnapshot` com `ruleSetId` e `ruleSetVersionId`.
	•	Resolução de disputa exige `resolutionStatus` explícito (`CONFIRMED`, `CORRECTED`, `VOIDED`) e `confirmationSource`.


#### G08.021 (origem: D18.17)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3172`.

D18.17) Gate de direção operacional na publicação (FECHADO)
	•	Um torneio Padel não pode transitar para `PUBLISHED` sem pelo menos 1 atribuição operacional `DIRETOR_PROVA` no torneio.
	•	O create Padel deve auto-atribuir o criador como `DIRETOR_PROVA` (idempotente), garantindo operação sem vazio de governança.
	•	Writes genéricos de match (`POST /matches`) não podem fechar incidentes especiais (`WALKOVER`, `RETIREMENT`, `INJURY`); nesses casos o sistema deve falhar fechado e exigir endpoint dedicado de incidente.
	•	Override de parceria exige `reasonCode` obrigatório, trilho auditável e compensação determinística.
	•	Sem slot alternativo de compensação, o caso deve entrar em `PENDING_COMPENSATION` com alerta operacional prioritário.


#### G08.022 (origem: D18.18)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3179`.

D18.18) Ranking global Padel com contrato matemático versionado (FECHADO)
	•	O motor oficial de ranking é `Glicko-2` adaptado, com contrato matemático explícito e versionado.
	•	A conversão `rating -> nível` (escala visual) é logarítmica e parametrizada no `RankingPolicyContract`.
	•	Coeficientes de `carry` e `underdog` são parâmetros de contrato (não heurística ad-hoc).
	•	Qualquer alteração de fórmula/parâmetros exige nova versão de contrato (`v2+`) sem mutação retroativa de histórico.
	•	Contagem canónica de jogos para rating é estritamente: `OFFICIAL | WALKOVER | RETIRED`.
	•	Atualização de ranking por mutação de resultado é assíncrona e obrigatória via outbox:
		- evento interno: `PADEL_RATING_REBUILD_REQUESTED`;
		- payload mínimo: `{ eventId, organizationId, matchId, actorUserId, beforeStatus, reasonCode, requestedAt }`;
		- handler executa `rebuildPadelRatingsForEvent` em transação.
	•	Mutações de resultado que DEVEM disparar rebuild:
		- transição para/desde estado contado (`OFFICIAL|WALKOVER|RETIRED`);
		- correção de score/winner em match já contado.
	•	Eventos de resultado `submit|confirm|reject|override|reset_pending|pending_expired` devem convergir no mesmo caminho de projeção de `match_updated` (sem lacunas de runtime).
	•	Contrato de rastreabilidade de `GET /api/padel/rankings` inclui:
		- `meta.countedStatuses=["OFFICIAL","WALKOVER","RETIRED"]`;
		- `meta.generatedAt` obrigatório.
	•	Backfill canónico de fecho:
		- endpoint interno suporta `rebuildAllRatings=true` para recalcular todos os eventos elegíveis com paginação/cursor;
		- execução deve produzir relatório auditável (`processedEvents`, `rebuiltEvents`, `rankingRowsRebuilt`, `errors[]`, `nextCursor`).
	•	Propagação UI obrigatória do ranking:
		- Hub de jogadores (`/api/padel/players`) devolve bloco `ranking` por jogador;
		- resumo do utilizador (`/api/padel/me/summary`) devolve `ranking` com posição global/org;
		- perfil público `/<username>/padel` e `/me` expõem rating/posição/jogos com ligação para `/padel/rankings`.
	•	Unicidade canónica de perfil competitivo por utilizador na organização:
		- constraint DB obrigatória em `(organization_id, user_id)` (tolerando `NULL` de `user_id` para perfis não vinculados);
		- dedupe operacional prévio usa merge determinístico e preserva histórico competitivo.


#### G08.017 (origem: D18.13)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3185`.

D18.13) Live unificado (FECHADO)
	•	Superfícies live (interna e pública) devem ler do mesmo modelo canónico de estado.
	•	Ramificações de modelo que geram resultados divergentes não são aceitáveis.
	•	Para Padel, o estado live de jogo vem de `EventMatchSlot` e o estado de participação vem de entitlement/`PadelRegistration`.
	•	Write-path de live só pode ocorrer por comandos canónicos de domínio; bypass direto é proibido.
	•	Read-path de live deve sair de projeções canónicas; query operacional ad-hoc em produção é proibida.
	•	Read-models canónicos obrigatórios:
		- `live_now_by_court`
		- `upcoming_matches_by_player`
		- `latest_results_feed`
		- `standings_with_tiebreak_explain`
	•	Estados oficiais de resultado live:
		- `IN_PROGRESS`
		- `RESULT_SUBMITTED`
		- `PENDING_CONFIRMATION`
		- `PENDING_REVIEW_EXPIRED`
		- `OFFICIAL`
		- `DISPUTED`
		- `CANCELLED`
		- `WALKOVER`
		- `RETIRED`
	•	Modos canónicos de validação de resultado:
		- `IMMEDIATE_OFFICIAL`
		- `IMMEDIATE_PENDING_THEN_OFFICIAL`
	•	Matriz canónica de permissões:
		- `IMMEDIATE_OFFICIAL`: submissão por `DIRETOR_PROVA|REFEREE|SCOREKEEPER|OWNER|CO_OWNER|ADMIN`.
		- `IMMEDIATE_PENDING_THEN_OFFICIAL`: submissão por staff; submissão por jogador só com `playerResultSubmissionEnabled=true`.
		- Jogador nunca oficializa resultado diretamente.
	•	Expiração de pendente:
		- `PENDING_CONFIRMATION` expirado transita para `PENDING_REVIEW_EXPIRED`.
		- Auto-oficialização após expiração é proibida.
		- Progressão dependente de standings permanece bloqueada até resolução humana.
		- Alerta operacional `HIGH` deve surgir no dashboard em até `30s`; primeira ação humana esperada em até `5 min`.
	•	Contrato de `reset_pending_result`:
		- permitido apenas em `PENDING_REVIEW_EXPIRED`;
		- perfis: `DIRETOR_PROVA|REFEREE|OWNER|CO_OWNER|ADMIN`;
		- exige `reasonCode`, `reasonText` e `targetState` (`IN_PROGRESS|RESULT_SUBMITTED`);
		- encerra pendente expirado com trilho auditável e reabre submissão.
	•	Contrato de `override_result`:
		- permitido apenas em `DISPUTED` ou `PENDING_REVIEW_EXPIRED`;
		- exige `reasonCode`, `reasonText`, `evidenceAttachments[]` (mínimo 1);
		- finaliza em `OFFICIAL` com `resolutionType=OVERRIDE` e auditoria obrigatória.
	•	Idempotência obrigatória por comando:
		- comandos: `submit_result|confirm_result|reject_result|dispute_result|walkover|retired|cancel_match`;
		- scope canónico da chave: `tournamentId + matchId + action + actorId + clientRequestId`;
		- chave repetida no mesmo scope devolve o mesmo resultado lógico.
	•	Idempotência de domínio por transição:
		- `confirm_result` em `OFFICIAL` = `NOOP` auditado;
		- transição inválida nunca pode produzir duplo efeito competitivo;
		- concorrência `confirm` vs `reject` exige lock transacional + versionamento de estado.
	•	Gating de progressão por `affectsStandings`:
		- `affectsStandings` é obrigatório no snapshot do match;
		- progressão de fase é bloqueada com `PENDING_CONFIRMATION|PENDING_REVIEW_EXPIRED|DISPUTED` quando `affectsStandings=true`;
		- `BEST_SECOND` só fecha quando todos os jogos relevantes estiverem concluídos/oficiais.
	•	Contrato de standings para exceções:
		- `CANCELLED`: `VOID` competitivo (`playedForStandings=false`, sem `head_to_head`, sem mínimo para `BEST_SECOND`);
		- `WALKOVER`: exige `technicalWinScore` no `MatchScoringProfile` ativo; sem isso, write falha fechado;
		- `RETIRED`: exige `retirementScoreRule` no `MatchScoringProfile` ativo; sem isso, write falha fechado.
	•	Regras de desempate:
		- cada fase define `tiebreakOrder[1..n]` versionado no snapshot;
		- `tiebreakExplanation` é obrigatório por linha no read-model de standings;
		- ordem aplicada no cálculo deve ser a mesma exibida em UI pública/interna.
	•	UX/live obrigatório:
		- página pública inclui hero + KPIs + `Agora por campo` + tabs (`Calendario`, `Grupos`, `Quadro`, `Resultados`, `Participantes`);
		- `TV_MODE` é superfície obrigatória;
		- visual de monitor deve privilegiar score/tempo/estado com alto contraste.
	•	Visibilidade e dados públicos:
		- web público pode consultar live sem login;
		- app móvel exige login;
		- público sem login só pode expor nome próprio + inicial, dupla/equipa, categoria/fase, score, estado, horário e campo;
		- é proibido expor email, telefone, morada, identificadores civis, notas internas e metadados de disputa.
	•	Notificações live:
		- canal canónico: app móvel autenticada (sem push web/público);
		- dedupe obrigatório: `userId + matchId + eventType + scheduledAt`;
		- rate-limit: `CRITICAL` máx 3 por match/utilizador em 30 min (cancelamento não é suprimido); `NON_CRITICAL` máx 5 em 90 min;
		- `quietHours` opcional adia apenas notificações não críticas.
	•	Exceção controlada ao princípio `projection-only`:
		- `dev/staging`: endpoint raw técnico permitido;
		- `prod`: apenas endpoint admin protegido com step-up + auditoria;
		- endpoint raw nunca pode ser consumido por UI pública/app.


#### G08.018 (origem: D18.14)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3190`.

D18.14) Pagamentos no gateway canónico (FECHADO)
	•	Criação financeira deve convergir no domínio canónico de Finanças.
	•	Pré-validações por módulo são permitidas; criação transacional financeira paralela não é norma.


#### G08.019 (origem: D18.15)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3194`.

D18.15) Check-in/Acesso mantém lock e versionamento (FECHADO)
	•	Padrão de lock após venda/entitlement mantém-se obrigatório.
	•	Qualquer evolução em agenda/torneios deve preservar guardrails equivalentes de imutabilidade temporal.


#### G08.020 (origem: D18.16)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3198`.

D18.16) Roadmap obrigatório em 3 ondas com gate técnico em dev (FECHADO)
	•	Onda 1 — Higienização: remover bypasses e dupla verdade operacional.
	•	Onda 2 — Unificação: consolidar inscrição/agenda/sourceType e projeções idempotentes.
	•	Onda 3 — Avançado: interclub por equipas, formatos avançados e live totalmente unificado, incluindo operação live avançada obrigatória (árbitro mobile, monitor/TV enriquecido e streaming integrado avançado).
	•	Cada onda exige gates técnicos obrigatórios antes de avançar: contratos API, paridade API/UI, typecheck e guardrails estáticos.
	•	Regra de passagem de onda (dev): qualquer falha de gate técnico bloqueia avanço de onda.
	•	Aprovação final em dev exige evidência auditável de execução limpa em ambiente limpo (fresh clone + seed) e suites verdes consecutivas.
	•	KPIs de produção podem ser acompanhados como observabilidade, mas não são bloqueantes de aprovação em desenvolvimento sem tráfego real.
	•	Norma de desenvolvimento: em `APP_ENV=dev`, aplicar observabilidade mínima essencial (logs de erro + auditoria de ações críticas), sem obrigatoriedade de alertas operacionais ativos e sem gate por SLO/SLA de produção.

⸻

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
	•	OrganizationGroupMember, OrganizationGroupMemberOrganizationOverride, OrganizationMemberPermission, OrganizationAuditLog
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
	•	OrganizationGroup, OrganizationGroupMember (obrigatório)

Analytics (derivado)
	•	AnalyticsMaterializedView (opcional, derivado)
	•	“fact tables” geradas por job (opcional; não owner)

⸻

7) Entitlements e sourceType (canónico e unificado)

> **FECHADO (SSOT):** Entitlement + Identity são a única fonte de verdade de “quem tem direito a quê”. Tickets/Bookings/Registos são *origens* (source), não “provas” de acesso.

7.1 Modelo de Identidade (FECHADO)
- `Identity` é o “dono” canónico de coisas (tickets, bookings, etc.).
- Persistência MVP canónica em `EmailIdentity` com estado por email.
- `USER/GUEST_EMAIL` não são enum externo canónico; representam apenas estado operacional de identidade por email.
- Permite:
  - compras como convidado (guest checkout) quando permitido pela `EventAccessPolicy` **na WebApp e no site** (app mobile é login‑only)
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
- `policyVersionApplied` (regra FECHADA):
  - se `eventId != null`: obrigatório e `> 0`
  - se `eventId == null`: obrigatório `null`
  - valor `0` é inválido

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

Separação de enums (SSOT D07):
- `FinanceSourceType` = lista acima (SSOT para Finanças/ledger/check‑in).
- `AgendaSourceType` = `EVENT`, `TOURNAMENT`, `MATCH`, `BOOKING`, `CLASS_SESSION`, `SOFT_BLOCK`, `HARD_BLOCK` (agenda/check‑in).
- `CLASS_SESSION` está ativo no modelo canónico de agenda e conflitos.
- Qualquer formulação histórica em sentido contrário (ex.: `CLASS_SESSION` “reservado para futuro”) está invalidada por `SUPERSEDED_BY_SSOT-2026-02-21-RESERVAS-AULAS-TORNEIOS-HARDCUT`.
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
  - encontra a identidade por email em estado guest daquele email
  - move (claim) todos os entitlements elegíveis para a identidade alvo canónica do utilizador
  - escreve `AuditLog` + `EventLog` (idempotencyKey = `emailHash+userId+batchVersion`)
- Regra: o claim nunca altera o ledger; apenas ownership lógico de acesso.
- O trigger canónico de claim é server-side (worker/evento); callback/useUser não é caminho normativo de mutação.
- Mobile (app): mantém login-only e não executa claim automático client-side.

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

8.2 Onde é obrigatório
- Bilhetes de eventos (entrada)
- Torneios Padel (validação de inscrição / entrada, conforme regra do torneio)

8.3 Onde pode ser opcional
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

10) Sub-navegação TO-BE (rotas canónicas)

Regra de canonicidade (FECHADO):
- Web org-scoped: **`/org/:orgId/*`**
- API org-scoped: **`/api/org/:orgId/*`**
- API hub/sistema: **`/api/org-hub/*`** e **`/api/org-system/*`**
- Alias web legado removido: **`/organizacao/*`** responde com **`410 LEGACY_ROUTE_REMOVED`**.
- Namespace API legado: **`/api/organizacao/*`** responde com **`410 LEGACY_ROUTE_REMOVED`**.
- Hard-cut adicional obrigatório: **`/org/<non-numeric>`** responde com **`410 LEGACY_ROUTE_REMOVED`** (sem rewrite/redirect de compatibilidade).
- Implementação física canónica:
  - handlers ativos devem residir em namespace canónico;
  - re-export de handlers legacy para write-path canónico não é estado final aceitável.

Regra de subnav (FECHADO):
- Topbar principal resolve apenas **`toolKey -> ToolSubnav`** (1:1).
- **Proibido fallback partilhado** de conteúdo de subnavegação entre ferramentas.
- Partilha permitida apenas na shell visual (estilo/render).

Matriz canónica final (web):
- Dashboard: `/org/:orgId/overview` (sem subnav obrigatória)
- Events: `/org/:orgId/events` (`list`, `new`, `live` contextual)
- Bookings: `/org/:orgId/bookings` (`services`, `availability`, `prices`, `professionals`, `resources`, `policies`, `integrations`, `customers`)
- Calendar: `/org/:orgId/calendar` (`week`, `day`) como superfície read-first de ocupação operacional
- Check-in: `/org/:orgId/check-in` (`scanner`, `list`, `sessions`, `logs`, `devices`)
- Finance: `/org/:orgId/finance` (`overview`, `ledger`, `dimensions`, `payouts`, `refunds_disputes`, `subscriptions`)
- Analytics: `/org/:orgId/analytics` (`overview`, `occupancy`, `conversion`, `no_show`, `cohorts`)
- CRM: `/org/:orgId/crm/*` (`customers`, `segments`, `campaigns`, `journeys`, `reports`, `loyalty`)
- Store: `/org/:orgId/store` (`overview`, `catalog`, `orders`, `shipping`, `marketing`, `settings`)
- Forms: `/org/:orgId/forms` (`forms`, `responses`, `settings`)
- Chat: `/org/:orgId/chat` (`inbox`, `preview`)
- Team: `/org/:orgId/team` (`members`, `trainers`)
- Trainers canónico final: `/org/:orgId/team/trainers` (qualquer alias `treinadores` é legacy hard-cut).
- Padel Club: `/org/:orgId/padel/clubs` (`clubs`, `courts`, `players`, `community`, `trainers`, `lessons`)
- Padel Tournaments: `/org/:orgId/padel/tournaments` (`tournaments`, `create`, `calendar`, `categories`, `teams`, `players`)
- Marketing: `/org/:orgId/marketing` (`overview`, `promos`, `promoters`, `content`)
- Profile legacy: `/org/:orgId/profile*` removido com `410 LEGACY_ROUTE_REMOVED` (sem redirect)
- Settings: `/org/:orgId/settings` (`general`)
- Settings verify route: `/org/:orgId/settings/verify` existe para confirmação por token, sem item dedicado na subnav.
- Official email em settings: gestão em `general`; ação permitida a `OWNER` e `CO_OWNER`.
- Contratos canónicos de official email (settings):
  - `GET /api/org-hub/organizations/settings/official-email`: devolve estado `active + pending`.
  - `POST /api/org-hub/organizations/settings/official-email`: cria/substitui pedido pendente (sem mutar estado ativo).
  - `DELETE /api/org-hub/organizations/settings/official-email`: cancela pendente (sem mutar estado ativo).
  - `POST /api/org-hub/organizations/settings/official-email/confirm`: confirma token e aplica swap atómico.
- Dashboard tools visibility:
  - preferência de UI é por organização;
  - persistência canónica em `GET/PATCH /api/org/:orgId/dashboard/tools/visibility`;
  - alteração permitida apenas a `OWNER`, `CO_OWNER` e `ADMIN`.
  - `calendar` é estrutural e não ocultável.
- Danger zone em settings:
  - `suspend` é ação exclusiva de `OWNER`;
  - execução/reversão exigem step-up obrigatório;
  - exige auditoria before/after com `reasonCode` obrigatório;
  - reversão só é permitida dentro da janela de 30 dias;
  - `delete` mantém fluxo definitivo separado e mais restrito.
  - contratos canónicos:
    - `GET /api/org-hub/organizations/:id/suspend` devolve estado de suspensão (inclui janela restante e elegibilidade de reativação);
    - `POST /api/org-hub/organizations/:id/suspend` aplica suspensão (owner-only);
    - `DELETE /api/org-hub/organizations/:id/suspend` reativa (owner-only) apenas se a janela de 30 dias estiver aberta.
  - invariantes operacionais:
    - durante suspensão, `username` da organização continua reservado (não reutilizável por outra entidade);
    - durante suspensão, a organização não pode expor resultados públicos por `organizationId`;
    - eliminação definitiva (`DELETE /api/org-hub/organizations/:id`) só pode ocorrer após suspensão e com janela de reativação encerrada.

Hard-cut de slugs legacy em `/org/:orgId/*`:
- Slugs PT/legacy (ex.: `financas`, `loja`, `checkin`, `eventos`, `reservas`, `treinadores`, `crm/clientes`, `manage`, `promote`, `tournaments`, `padel/clube`, `padel/torneios`) respondem com **`410 LEGACY_ROUTE_REMOVED`**.
- Sem redirects internos para slugs legacy (política single-route-only).
- Hard-cut de bookings legacy:
  - `/org/:orgId/bookings/services` responde com **`410 LEGACY_ROUTE_REMOVED`**.
  - `/org/:orgId/bookings?tab=availability` responde com **`410 LEGACY_ROUTE_REMOVED`**.
  - `/org/:orgId/bookings?bookings=availability|prices|integrations` responde com **`410 LEGACY_ROUTE_REMOVED`**.

10.1 Multi-Organizações & Group Governance (FECHADO v1)
- O contrato normativo deste domínio está integralmente neste SSOT.
- `docs/organizacoes_multiorg.md` é referência de rastreabilidade e histórico editorial.
- Modelo canónico:
  - `Group` (mãe) é superfície de agregação read-only, com exceção de governança de membership.
  - `Group` tem owner explícito (`OrganizationGroup.ownerUserId`) e único.
  - Invariante: owner do `Group` é owner efetivo de todas as orgs do `Group` após qualquer commit.
- Operações canónicas:
  - criação final de org: `POST /api/org-hub/organizations` (commit atómico);
  - entrada de org em group: `/api/org-hub/groups/join-requests/*`;
  - saída de org de group: `/api/org-hub/groups/exit-requests/*`;
  - transferência de owner: apenas ao nível Group em `/api/org-hub/groups/:groupId/owner/transfer/*`.
- Regras fechadas de saída com troca de owner:
  - confirmação forte por código+email de 2 partes: owner antigo + novo owner;
  - owner do group aprova a operação ao iniciar a saída (sem etapa forte adicional).
- Onboarding/official email:
  - no commit de criação, `officialEmail` nasce com o email verificado do user criador;
  - `officialEmailVerifiedAt` nasce preenchido;
  - troca posterior de official email mantém fluxo de confirmação dedicado.
- Deprecações/hard-cut deste escopo:
  - `/api/org-hub/become` -> `410`;
  - owner transfer por organização (`/organizations/owner/*`) -> `410` com endpoint canónico de Group.
- D-MO-10 (chave global de recurso partilhado cross-org):
  - `resourceKey` canónica obrigatória no formato `resourceType:authorityOrgId:resourceId`.
  - claims, locks e arbitragem de conflitos usam `resourceKey` como fonte única (não `organizationId` local).
  - integridade de write-path: não é permitido commit de claim sem `resourceKey` e `authorityOrgId`.
- D-MO-11 (parceria híbrida):
  - base transversal obrigatória em `PadelPartnershipAgreement`.
  - extensões modulares (windows, policy, grants, overrides, compensation) são válidas apenas se ligadas por `agreementId`.
  - fail-closed no write-path: extensão sem acordo-base válido é bloqueada.
- Mapa normativo D-MO (propagação 1:1):
  - D-MO-01: Group como entidade canónica de agregação.
  - D-MO-02: criação canónica em `POST /api/org-hub/organizations`.
  - D-MO-03: default single-org em 1 group; multi-org quando >= 2 orgs.
  - D-MO-04: entrada no group com duplo código + email bilateral.
  - D-MO-05: saída com aprovação do owner do group.
  - D-MO-06: contrato de org-context por superfície.
  - D-MO-07: hard-cut legacy total.
  - D-MO-08: hard-cut físico global e imediato.
  - D-MO-09: group read-only de domínio, com exceção de governança de membership.
  - D-MO-10: chave global de recurso partilhado cross-org.
  - D-MO-11: parcerias híbridas (base + extensões).
  - D-MO-12: onboarding com criação atómica no clique final.
  - D-MO-13: RBAC final group/organization.
  - D-MO-14: lista final de ações exclusivas de owner.
  - D-MO-15: política final de códigos (TTL/tentativas/lockout/anti-replay).
  - D-MO-16: política final de confirmação por email (TTL/reenvio/expiração).
  - D-MO-17: support/recovery por ticket na consola admin.
  - D-MO-18: cutover global único com rollback por release.
  - D-MO-19: runbook e observabilidade canónica sem legacy.
  - D-MO-20: saída de org com manter/trocar owner e dupla confirmação na troca.

10.2 Support v1 (FECHADO)
- Abertura de ticket apenas por formulário público: `POST /api/support/tickets`.
- Campos mandatórios: email, categoria, assunto, descrição.
- Assunto persistido no formato canónico: `[TICKET-<numero>] <assunto_user>`.
- Estados permitidos v1: `OPEN`, `IN_PROGRESS`, `CLOSED`.
- Operação administrativa:
  - lista: `GET /api/admin/support/tickets/list`
  - detalhe: `GET /api/admin/support/tickets/:id`
  - estado: `POST /api/admin/support/tickets/:id/status`
  - eventos/notas: `POST /api/admin/support/tickets/:id/events`
  - UI: `/admin/suporte` e `/admin/suporte/:id`
- Email direto para `admin@orya.pt` não cria ticket automaticamente.

10.3 Nota de Higienização (global)
- O hard-cut runtime global de legacy mantém-se no edge (`410 LEGACY_ROUTE_REMOVED`).
- O hard-cut físico é global e imediato para namespaces legacy org:
  - remover `app/api/organizacao/**`;
  - remover `app/organizacao/**`;
  - manter apenas superfícies canónicas (`/api/org*`, `/api/org-hub/*`, `/api/org-system/*`, `/org/*`, `/org-hub/*`).

10.4 Políticas de Organização (FECHADO)
- Política hard obrigatória (HP):
  - `HP-01`: gate de email oficial verificado para mutações sensíveis.
  - `HP-02`: kill-switch por `Organization.status=SUSPENDED`.
  - `HP-03`: invariante `orgType -> payoutMode`.
  - `HP-04`: payments readiness gate para vendas pagas.
  - `HP-05`: ferramenta ativa + RBAC para qualquer ação de domínio.
  - `HP-06`: snapshot obrigatório para ações em reserva `CONFIRMED`.
  - `HP-07`: lock de policy de acesso após uso/pagamento.
  - `HP-08`: check-in protegido por janela temporal.
  - `HP-09`: endereço canónico obrigatório em fluxos críticos.
  - `HP-10`: mutações de parceria Padel com ownership estrito.
  - `HP-11`: lifecycle de suspensão é owner-only e fail-closed:
    - `suspend` em danger zone é exclusivo de `OWNER`, com step-up obrigatório e auditoria before/after;
    - reativação (`DELETE /api/org-hub/organizations/:id/suspend`) é exclusiva de `OWNER` e só dentro da janela de 30 dias;
    - eliminação definitiva (`DELETE /api/org-hub/organizations/:id`) só após janela de reativação expirada;
    - `username` fica reservado durante suspensão;
    - organização suspensa não pode aparecer em superfícies públicas por `organizationId`.
- Assignment canónico da organização/serviço:
  - `PROFESSIONAL_ONLY`, `RESOURCE_ONLY`, `PROFESSIONAL_AND_RESOURCE`.
  - Valores legacy (`PROFESSIONAL|RESOURCE`) não são válidos como contrato final.
- Defaults/clamps normativos de políticas personalizáveis:
  - Reservas (`OrganizationPolicy`):
    - `policyType`: `FLEXIBLE|MODERATE|RIGID|CUSTOM`.
    - defaults bootstrap: `FLEXIBLE=1440`, `MODERATE=2880`, `RIGID=4320` minutos.
    - `cancellationPenaltyBps` é operacionalmente fixo em `0` (não configurável).
    - `guestBookingAllowed` default `false`.
    - `noShowFeeCents` fica fora de customização de policy nesta versão e é lockado em `0` na API pública de políticas.
  - CRM (`CrmOrganizationPolicy`):
    - `timezone` default `Europe/Lisbon`.
    - quiet hours clamp `[0..1439]`.
    - caps: day `[0..100]`, week `[capDay..500]`, month `[capWeek..3000]`.
  - Loyalty:
    - `points` `[1..5000]`, `maxPointsPerDay <= 20000`, `maxPointsPerUser <= 200000`.
    - `pointsCost` `[100..500000]`.
  - Event access:
    - `mode` default `UNLISTED`; invite TTL default `7 dias` quando aplicável.
    - em padel, `requiresEntitlementForEntry=true` é forçado.
  - Store:
    - defaults: `status=CLOSED`, `catalogLocked=true`, `checkoutEnabled=false`, `showOnProfile=false`, `currency=EUR`.
    - surface legal pública canónica por organização: `/{username}/legal`.
  - Fee organizacional:
    - campos: `feeMode`, `platformFeeBps`, `platformFeeFixedCents`.
    - `platformFeeBps` clamp `[0..5000]`, `platformFeeFixedCents` clamp `[0..5000]`.
    - `feeMode` permanece lockado em `INCLUDED` nesta fase.
- Regra temporal canónica:
  - motor de agenda/reservas em blocos de 5 minutos;
  - UI pode projetar grelha 15/30 min sem alterar cálculo canónico.
- Estes contratos são fonte normativa direta no SSOT; documentação auxiliar não é pré-requisito de validade.

⸻

11) RBAC v2 — roles, scopes e role packs

11.1 Roles “reais”

OWNER, CO_OWNER, ADMIN, STAFF, PROMOTER

11.1.1 Contrato canónico `role` + `rolePack` (FECHADO)
- `role` define hierarquia e poder de decisão.
- `rolePack` define o perfil operacional do dia a dia.
- Regras obrigatórias:
  - OWNER, CO_OWNER, ADMIN e PROMOTER: `rolePack = null` (sem pack).
  - STAFF: `rolePack` obrigatório e compatível com:
    - CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE
- A mesma validação aplica-se em:
  - convite de membro
  - alteração de papel de membro
  - aceitação de convite
- Convites legacy sem pack são normalizados ao aceitar:
  - STAFF → FRONT_DESK
- `TRAINER` é role legado removido; qualquer fluxo novo com `TRAINER` é inválido.

11.1.2 Matriz hierárquica canónica (convite + mudança de papel)
- `OWNER` pode atribuir: `OWNER`, `CO_OWNER`, `ADMIN`, `STAFF`, `PROMOTER`.
- `CO_OWNER` pode atribuir: `CO_OWNER`, `ADMIN`, `STAFF`, `PROMOTER`.
- `ADMIN` pode atribuir: `ADMIN`, `STAFF`, `PROMOTER`.
- `STAFF` e `PROMOTER` não podem convidar nem promover.
- Regra global: sem auto-promoção fora da matriz acima.

11.1.3 Perfis profissionais
- Conteúdo do perfil profissional é criado/editado apenas pela própria pessoa.
- Organização não cria perfil de profissional por username/email no contexto de equipa.
- Operação organizacional mantém-se via convite e gestão de permissões, não por criação de perfil.

11.2 Scopes (mapeados ao repo)
	•	EVENTS_* → EVENTOS
	•	PADEL_* → TORNEIOS
	•	RESERVAS_* → RESERVAS
	•	FINANCE_* → FINANCEIRO
	•	CRM_* → CRM
	•	SHOP_* → LOJA
	•	TEAM_* → STAFF
	•	SETTINGS_* → DEFINICOES
	•	CHECKIN_* → EVENTOS/TORNEIOS (até existir ferramenta própria)

11.3 Role Packs (presets)
	•	CLUB_MANAGER → STAFF + PADEL_*, RESERVAS_*, CHECKIN_*, CRM_RW, TEAM_R, SETTINGS_R
	•	TOURNAMENT_DIRECTOR → STAFF + PADEL_*, EVENTS_RW, CHECKIN_RW, RESERVAS_R
	•	FRONT_DESK → STAFF + CHECKIN_*, RESERVAS_RW, EVENTS_R, CRM_R
	•	COACH → STAFF + RESERVAS_RW, PADEL_R, CRM_R
	•	REFEREE → STAFF + PADEL_RW (matches/live), EVENTS_R, CHECKIN_R

11.4 Multi-Organizações (mãe/filiais)
	•	permissões podem existir:
	•	ao nível do OrganizationGroup (mãe)
	•	ao nível de cada Organization (filial)
	•	UI mostra claramente “estás na mãe” vs “estás na filial X”
	•	auditoria separa por entidade e por âmbito

11.5 Roadmap CHECKIN module
	•	Conteúdo movido para `docs/planning_registry_v1.md` (bloco de roadmap/check-in, não-normativo).

11.6 Auditoria organizacional
- Auditoria de equipa deve apresentar sempre o autor real da ação quando `actorUserId` existir.
- `Sistema` só é usado quando a ação não tem ator humano associado.
- Auditoria organizacional deve suportar secções por domínio (equipa, permissões, settings, operações).

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
	•	retenção e classes seguem 02.2, 19.4 e Apêndice A6
	•	auditoria RBAC pode reter mais com payload reduzido, respeitando minimização

12.3 Idempotência transversal

Obrigatório em:
	•	checkout/refunds
	•	check-in
	•	live updates (padel)
	•	criação/alteração crítica (reservas/eventos)
	•	split-payment reminders/expirations

---

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
			–	excluir: entitlements REVOKED/SUSPENDED quando aplicável (policy)
			–	sem depender de “estados inventados” no Ticket
		•	se drift > threshold → corrigir + emitir evento ops.alert + log de auditoria
	2) crm.rebuild_customer_counters (daily)
		•	rebuild determinístico a partir de CrmInteraction
	

Outputs:
	•	tabela de “drifts” + dashboard no Admin (14.1) com alerts e links.

12.5 Activity Feed + Canal “Ops” (alertas automáticos)
	•	O catálogo operacional de eventos do feed (playbooks/listas de monitorização) é **não‑normativo** e vive em `docs/planning_registry_v1.md` (P7.5).

12.6 Guardrails de Arquitetura (obrigatório v1)
	•	Architecture Tests
	•	falhar build se alguém importar Stripe fora de Finanças
	•	falhar build se alguém escrever entidades fora do “owner” (podes fazer via wrappers ou lint rules)
	•	Contract Tests
	•	cada contrato tem testes unit e “golden tests” nos módulos `domain/*` (perto do owner)
	•	Anti-drift migrations
	•	pipeline que falha se schema Prisma divergir do DB (staging)

12.7 Timezone canónica (FECHADO)
- Todas as janelas temporais e jobs com T‑X (reminders, locks, expirations) são calculadas na **timezone do evento** (IANA, ex.: `Europe/Lisbon`).
- Em Reservas (sem evento), usa‑se a timezone da **organização/recurso** (também IANA).
- Regra: guardar timestamps canónicos em UTC + timezone original; UI apenas converte para visualização.

⸻

13) Pesquisa & Discovery (infra sem overkill) — **FECHADO**

Stack canónica para produção futura (fora do escopo do ciclo DEV atual):
	•	Postgres full-text + trigram + filtros por tipo.
	•	Index unificado derivado (owners continuam Eventos/Padel/Reservas/Serviços).
	•	Rebuild por jobs + replay a partir de EventLog (idempotente).

13.1 Ranking (v1) — **FECHADO**
ADITAMENTO FECHADO (PROD_FUTURA): ranking mínimo e observabilidade para produção v1.
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

Ranking Unificado v2 (personalização avançada) está fora do cut-line da abertura de produção e vive em `docs/planning_registry_v1.md` (planeamento não normativo).

⸻

14) Governança & Ferramentas Internas (Admin, Billing, Support, Analytics)

14.1 Admin global (admin.orya.pt)
	•	gestão de organizações (KYC leve, settings globais)
	•	fee policies globais + overrides
	•	kill switches operacionais (não ativação de funcionalidades)
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

18) Nota final (regra de ouro)

Se uma decisão não estiver aqui, não está decidida.
Se uma implementação contradizer D02/D04/D03, é bug de arquitectura, não é “trade-off”.

⸻

## 06 Production Gates (SLI/SLO, go-live, release gates)
- Estado deste bloco: `PROD_FUTURA` (não bloqueia o ciclo DEV atual).

### 06.0 P0 endpoints (guardrails)
Lista canónica de rotas P0 usada pelos gates de envelope/erro.
Este bloco é gerado automaticamente a partir de `scripts/manifests/p0_endpoints.json` via `npm run ssot:p0:sync` (não editar manualmente).
Classificação canónica:
- É P0 qualquer endpoint que crie/mute `Payment`, `Refund`, `Dispute`, `LedgerEntry` ou gating de checkout.
- Endpoints sem side-effects financeiros (read/export/prefill) são P1 por defeito, mantendo guardrails de auth/audit.
- O manifesto P0 deve ser validado em CI e sincronizado com este bloco.

<!-- P0_ENDPOINTS_START -->
- `app/api/payments/intent/route.ts`
- `app/api/checkout/status/route.ts`
- `app/api/checkout/resale/route.ts`
- `app/api/convites/[token]/checkout/route.ts`
- `app/api/cobrancas/[token]/checkout/route.ts`
- `app/api/servicos/[id]/checkout/route.ts`
- `app/api/servicos/[id]/creditos/checkout/route.ts`
- `app/api/org/[orgId]/reservas/[id]/checkout/route.ts`
- `app/api/padel/pairings/[id]/checkout/route.ts`
- `app/api/public/store/checkout/route.ts`
- `app/api/admin/payments/refund/route.ts`
- `app/api/admin/payments/dispute/route.ts`
- `app/api/admin/payments/reprocess/route.ts`
- `app/api/admin/refunds/list/route.ts`
- `app/api/admin/refunds/retry/route.ts`
- `app/api/org/[orgId]/refunds/list/route.ts`
- `app/api/org/[orgId]/events/[id]/refund/route.ts`
- `app/api/padel/matches/[id]/dispute/route.ts`
- `app/api/org/[orgId]/finance/payouts/status/route.ts`
- `app/api/org/[orgId]/finance/payouts/list/route.ts`
- `app/api/org/[orgId]/finance/payouts/summary/route.ts`
- `app/api/org/[orgId]/finance/payouts/settings/route.ts`
- `app/api/org/[orgId]/finance/payouts/connect/route.ts`
- `app/api/org-system/payouts/webhook/route.ts`
- `app/api/internal/reconcile/route.ts`
- `app/api/internal/outbox/dlq/route.ts`
- `app/api/internal/outbox/replay/route.ts`
- `app/api/internal/worker/operations/route.ts`
- `app/api/internal/reprocess/purchase/route.ts`
- `app/api/internal/reprocess/payment-intent/route.ts`
- `app/api/internal/reprocess/stripe-event/route.ts`
- `app/api/internal/checkout/timeline/route.ts`
- `app/api/internal/checkin/consume/route.ts`
- `app/api/cron/operations/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/webhooks/stripe/route.ts`
<!-- P0_ENDPOINTS_END -->

## Operational SLIs, SLOs & Alerting (NORMATIVE)

This section defines the minimum observability and alerting standards
required for production operation of the ORYA platform.

Scope note: este bloco aplica-se a pre-prod/prod. Em `APP_ENV=dev`, vigora a norma mínima de observabilidade definida em D18.16.

Dashboards without actionable thresholds are insufficient.

---


## G09) CRM, Notificacoes e Suporte

### Escopo estrutural
- 10.2 Support v1

### Blocos normativos (conteúdo integral, ordem estável)

#### G09.001 (origem: C04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1145`.

C04) CRM ↔ Todos (timeline)

CRM recebe eventos a partir do EventLog (não ponto-a-ponto).

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C04  
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

#### G09.002 (origem: C05)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1254`.

C05) Notificações ↔ Todos

Triggers por eventos do sistema + templates + opt-in + logs.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C05  
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

#### G09.003 (origem: C17)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2084`.

C17) CRM Ingest + Dedupe (read‑model) — **FECHADO**

Regras:
	•	CRM ingere **apenas** a partir do EventLog.
	•	Idempotência por `eventId`; se existir `externalId`, dedupe por `(orgId, externalId)`.
	•	Rebuild diário reprodutível; nunca confiar em contadores incrementais sem replay.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C17  
**Contract Name:** CRM Ingest + Dedupe  
**Current Version:** v1.0.0  
**Owner:** Domain: CRM  
**Primary Consumers:** CRM UI, Analytics, Ops

---


#### G09.004 (origem: D06)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2738`.

D06) Notificações como serviço (com logs e opt-in)

Templates, consentimento RGPD, logs de delivery, outbox e preferências.


## G10) Loja, Promocoes e Loyalty

### Escopo estrutural
- Store canonical block
- Promotions and loyalty boundaries

### Blocos normativos (conteúdo integral, ordem estável)

#### G10.001 (origem: C08)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1592`.

C08) Loyalty ↔ CRM/Finanças/Promoções
	•	pontos gerados por eventos (compra, presença, actividade)
	•	redemptions obedecem a guardrails globais + política da organização
	•	pontos não alteram ledger financeiro (não é dinheiro) — mas podem gerar descontos via Promoções

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C08  
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

#### G10.002 (origem: D09.03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2876`.

D09.03) Loja — bloco canónico FECHADO (3 pilares)
- Pilar 1 — Disponibilidade resolvida (SSOT único):
  - UI pública e checkout usam apenas `resolvedStoreState`.
  - Enum canónico: `DISABLED | HIDDEN | LOCKED | CHECKOUT_DISABLED | ACTIVE`.
  - Precedência obrigatória: `DISABLED > HIDDEN > LOCKED > CHECKOUT_DISABLED > ACTIVE`.
  - Guardrail: só `lib/storeAccess.ts` pode resolver estado; duplicação de lógica é proibida.
- Pilar 2 — Ownership org-only:
  - apenas ORGANIZAÇÕES podem ser owner de Store/Produtos/Checkout;
  - constraints canónicas: `ownerOrganizationId NOT NULL` e `ownerUserId NULL`;
  - qualquer hipótese de user-store é fora de escopo desta versão normativa.
- Pilar 3 — Contratos unificados de catálogo/envio/digital:
  - visibilidade canónica de produto/bundle: `visibility = PUBLIC | HIDDEN | ARCHIVED`;
  - cálculo de shipping usa exclusivamente `StoreShippingMethod.mode`;
  - `Store.shippingMode` global é legado/deprecado e não decide checkout;
  - digital goods ignoram shipping e usam acesso por entitlement + URL assinada expirada.


#### G10.003 (origem: D13)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3042`.

D13) Loyalty Points (pontos) — semi-normalizado + guardrails globais
	•	sem wallet monetária nesta fase
	•	pontos por organização (e opcional por sub-organização)
	•	taxa semi-normalizada: 100 pontos ≈ 1€ de “valor percebido” (config global)
	•	guardrails globais (caps e ranges) para evitar discrepâncias abusivas
	•	Implementação (atual):
		–	state change → outbox → worker idempotente (events: LOYALTY_EARNED / LOYALTY_SPENT)
		–	payload mínimo: { ledgerId }
		–	idempotencyKey: eventId (único por ledgerId+eventType)
		–	guardrails globais: pontos/regra 1–5000; max/dia 20000; max/user 200000; custo reward 100–500000


## G11) Discovery, Search, Analytics e Ops Feed

### Escopo estrutural
- 13 Pesquisa & Discovery
- 14.1 Admin analytics

### Blocos normativos (conteúdo integral, ordem estável)

#### G11.001 (origem: C09)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1705`.

C09) Activity Feed ↔ EventLog/Chat
	•	consumer do EventLog transforma eventos seleccionados em:
	•	ActivityItem (UI)
	•	mensagem automática no canal “Ops” (Chat interno)

⸻

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C09  
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


#### G11.002 (origem: C16)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2064`.

C16) Search Index (read‑model derivado) — **FECHADO**

Regras:
	•	Index é read‑model derivado do EventLog (não é owner).
	•	Jobs idempotentes por `sourceType+sourceId+version`.
	•	Unpublish/disable → remoção/soft‑delete no index.
	•	Rebuild completo por job (reprodutível).

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C16  
**Contract Name:** Search Index (read‑model derivado)  
**Current Version:** v1.0.0  
**Owner:** Domain: Search/Discovery  
**Primary Consumers:** Discover UI, Public Search

---


#### G11.003 (origem: D15)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3059`.

D15) Macro + Micro Analytics (obrigatório)
	•	dashboards financeiros e operacionais com drill-down por dimensões
	•	sempre derivados do Ledger + dimensões (sem duplicar estado “financeiro” fora de Finanças)


#### G11.004 (origem: D16)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3063`.

D16) Ops Feed (Activity Feed) é first-class
	•	eventos operacionais são publicados no EventBus e gravados no EventLog
	•	um consumer gera Activity Feed + posts automáticos no canal “Ops” do chat interno

⸻


## G12) Infra, Jobs, Outbox, Observabilidade e Release Gates

### Escopo estrutural
- 06 Production Gates
- 07 Normative Appendices
- Critical Flow Sequences

### Blocos normativos (conteúdo integral, ordem estável)

#### G12.001 (origem: C11)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:1899`.

C11) EventLog + Outbox (schema canónico e versionamento) — **FECHADO**

Regras:
	•	`eventType` em formato `domain.action` (lowercase, sem espaços).
	•	`eventVersion` obrigatório (semver).
	•	Campos mínimos do EventLog:
		–	`eventId` (UUID), `eventType`, `eventVersion`, `orgId`
		–	`subjectType`, `subjectId`
		–	`actorIdentityId?`, `causationId`, `correlationId`
		–	`payload` (PII minimizado), `createdAt`
	•	PII: sem email/telefone em claro; usar `identityId`/hash.
	•	Qualquer mutação com side‑effects escreve **EventLog + Outbox** na mesma transação.
	•	Outbox é append‑only e garante at‑least‑once; consumers são idempotentes.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C11  
**Contract Name:** EventLog + Outbox (schema e versionamento)  
**Current Version:** v1.0.0  
**Owner:** Domain: Ops/Platform  
**Primary Consumers:** Workers, CRM, Activity Feed, Search, Analytics

#### Purpose
Garantir trilho auditável, versionado e compatível para todos os eventos internos.

#### Idempotency
- **Idempotency Key:** eventId  
- **Scope:** global

#### Input Payload (Example)
```json
{
  "eventId": "evt_abc",
  "eventType": "payment.succeeded",
  "eventVersion": "1.0.0",
  "orgId": "org_123",
  "subjectType": "PAYMENT",
  "subjectId": "pay_456",
  "correlationId": "corr_789"
}
```

#### Ordering & Duplication
At‑least‑once; consumidores idempotentes; ordering não garantido.

#### Side Effects
☑ downstream async jobs  
☑ materializações (read‑models)

#### Observability
EventLog é fonte para métricas e auditoria; payload com PII minimizado.

---


#### G12.002 (origem: C18)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2103`.

C18) Media/Uploads (SSOT de ficheiros) — **FECHADO**

Regras:
	•	Todo upload cria `MediaAsset` com owner, orgId, checksum e metadata.
	•	Acesso por URLs assinadas com TTL (sem public‑by‑default).
	•	Apagar asset remove acesso e invalida URLs; logs/audit obrigatórios.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** C18  
**Contract Name:** Media/Uploads (SSOT de ficheiros)  
**Current Version:** v1.0.0  
**Owner:** Domain: Platform/Storage  
**Primary Consumers:** Events, Store, Org Profile, Mobile/Web

---


#### G12.003 (origem: D10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2892`.

D10) Jobs/Queues + Outbox (motor enterprise sem overkill) — definição final

> **FECHADO:** Tudo o que é assíncrono, re‑tentável, ou depende de webhooks externos passa por Jobs/Queues.  
> A entrega de eventos internos é garantida por Outbox + idempotência (evita “eventos perdidos”).


#### G12.004 (origem: D10.01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2897`.

D10.01 Jobs/Queues (obrigatório)
- Sistema de jobs com:
  - queue, retries, backoff, e DLQ
  - prioridades (ex.: pagamentos/entitlements > notificações)
  - dedupe por `idempotencyKey`
- Tudo assíncrono passa por jobs:
  - notificações, exports, ingest CRM, sync Stripe, indexação/search
  - replays do EventLog, reminders (ex.: split payment T‑48/36/24), reconciliations
- Estado efémero com TTL (holds, locks, rate‑limits) vive em Redis; DB guarda apenas estado final/auditável.


#### G12.005 (origem: D10.02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2907`.

D10.02 Outbox (obrigatório)
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


#### G12.006 (origem: D10.03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:2920`.

D10.03 EventBus na AWS — introdução faseada (sem overkill)
Fase 1:
- EventLog + Outbox + consumers no worker + SQS para jobs críticos
- simplicidade e custo baixo
- **Higienização:** remover legacy (tabelas/colunas/flags antigas), sem fallback; só fica o modelo final do SSOT.

Fase 2/3 (fan‑out real / múltiplos serviços):
- Introduzir EventBridge para routing serverless
- Regras/targets por tipo de evento
- Mantém EventLog como trilho e base de auditoria

⸻


#### G12.007 (origem: O01)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3801`.

### O01 — Alert Classification
Alerts are classified as:
- **PAGER:** requires immediate human intervention
- **TICKET:** requires investigation but not immediate action

---


#### G12.008 (origem: O02)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3808`.

### O02 — Core Domain SLIs & Thresholds

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


#### G12.009 (origem: O03)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3838`.

### O03 — Logging & Correlation
All logs MUST include:
- `correlationId`
- `orgId`
- domain entity identifiers

Logs without correlation context are non-compliant.

---


#### G12.010 (origem: O04)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3848`.

### O04 — Incident Readiness
For each PAGER alert, the following MUST exist:
- documented runbook
- clear ownership
- rollback or mitigation steps

Production without runbooks is forbidden.

---

17.1 Escopo de Produção (Cut Line v1.x) — **PROD_FUTURA**
ADITAMENTO FECHADO (PROD_FUTURA): delimita o que entra numa abertura de produção v1.0.

A) IN (obrigatório para v1.0)
	•	Eventos: criar/publicar/listar + gestão básica
	•	Tickets: compra + emissão/entitlement
	•	Finanças: checkout + webhooks + ledger append‑only + reconciliação
	•	Entitlements: criação + revogação
	•	Check‑in: scanner + consumo + logs
	•	Org onboarding Stripe Connect (Standard nesta fase) (KYC) para `orgType=EXTERNAL` — C02.X01
	•	RBAC mínimo (org scopes críticos)
	•	Notificações essenciais (transaccionais + operacionais)
	•	DSAR básico operativo (19.4)
	•	Trust & Safety mínimo operativo (19.2)
	•	Observabilidade mínima (SLIs + alertas críticos 14.1.1)

B) OUT (fora de escopo nesta fase DEV; não implementado/não deployado)
	•	QR offline assinado (S2) e validação offline
	•	Ranking Unificado v2 (personalização avançada; detalhes em `docs/planning_registry_v1.md`)
	•	Automações CRM complexas e campanhas
	•	Funcionalidades sociais não essenciais (comunidade)
	•	Marketplace avançado e integrações enterprise

B.1) Matriz canónica por `sourceType` (v1.0)
	•	`TICKET_ORDER`: IN (checkout paid/free, refund/dispute, entitlement, check‑in).
	•	`BOOKING`: IN (checkout paid/free, refund/dispute, entitlement; check‑in conforme policy).
	•	`PADEL_REGISTRATION`: IN (checkout paid/split, refund/dispute, entitlement, check‑in conforme policy).
	•	`STORE_ORDER`: IN (checkout paid/free, refund/dispute, entitlement quando aplicável).
	•	`SUBSCRIPTION` e `MEMBERSHIP`: OUT.

C) Regra de execução (hard)
	•	Tudo o que está OUT é tratado como fora de escopo: não implementar e não fazer deploy nesta fase DEV.
	•	Não usar mecanismos runtime de ativação de funcionalidades.
	•	Quando existir rota/superfície legada correspondente, responder com `410 LEGACY_ROUTE_REMOVED` (não `403` por gating de ativação).
	•	Qualquer inclusão futura no escopo exige revisão normativa explícita + aprovação do owner.

D) Critério para futura abertura de produção v1.0
	•	Todos os itens IN operacionais **e** 19.0 Gate de abertura de produção cumprido.
	•	Cut‑line aplicado e verificado por testes (19.6), apenas no ciclo pre-prod/prod.

⸻

19.0 Go‑Live Gate (Fase 1) — **PROD_FUTURA**
Pré‑requisitos mínimos antes de abrir produção real (não aplicável ao ciclo DEV atual):
- Documentos legais publicados e linkados (19.1).
- Onboarding B2B para payouts completo (KYC + aceites).
- DSAR básico ativo (19.4).
- Trust & Safety mínimo (19.2).
- Runbooks de suporte + escalação definidos (19.3).
- Alertas críticos ativos (SLIs 14.1.1) + dashboards básicos.
- Backups configurados + **1º teste de restore** executado (19.3) [PROD_FUTURA].
- Release gates ativos (19.6) + guardrails 12.6.

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
- Backups & Restore (targets internos) [PROD_FUTURA]:
  - RPO/RTO normativos (targets operacionais):
    - DB transaccional: RPO ≤ 1h, RTO ≤ 4h
    - Config/policies (fee policies, access policies): RPO ≤ 15m, RTO ≤ 2h
    - Logs/EventLog (auditoria): RPO ≤ 24h, RTO ≤ 12h
  - Backups automáticos + retenção por política.
  - **Teste de restore inicial** obrigatório apenas na abertura de produção.

19.3.1 Backups reais (Supabase → AWS) — **PROD_FUTURA**
Este bloco aplica-se a pre-prod/prod e está fora do escopo do ciclo DEV atual.
Como o DB está em Supabase na Fase 1, a estratégia de backup para produção é:
- Primário: PITR/Backups geridos pelo Supabase (conforme plano).
- Secundário (AWS): export automatizado para S3 (diário) + retenção por policy:
  - dumps encriptados (KMS) + versioning + lifecycle (ex.: 30/90/365 dias conforme classe).
- Restore:
  - runbook para restore via Supabase + validação pós‑restore (smoke tests).
  - 1º restore test obrigatório antes do Go‑Live (19.0), apenas para abertura de produção.

19.6 Qualidade & Release Gates (DoD “produção”) — **PROD_FUTURA**
- Nenhum release para produção sem:
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
- Restore tests recorrentes + exports assinados.
- Observabilidade avançada (tracing end‑to‑end, SLOs por domínio).
- Risk engine mais sofisticado (modelos e regras dinâmicas).
- Automação de DSAR e auditorias internas periódicas.

## 07 Normative Appendices (só referência normativa)

Apêndice A — Policy Defaults v1 (FECHADO)


#### G12.011 (origem: A1)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:3996`.

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


#### G12.012 (origem: A2)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4012`.

A2) TTLs e janelas — FECHADO
- InviteToken TTL default: 7 dias (salvo override em EventAccessPolicy)
- EntitlementQrToken TTL default: 24h (rotacionável por job) + revogação imediata em disputa/refund
- Allow‑list “Modo Recinto” TTL: 2h (prefetch) + validade máxima offline: 30 min sem sync
- Username cooldown (rename): 15 dias (já definido; reafirmar FECHADO)
- Retenção de “offline_pending_sync” (check‑in): 7 dias


#### G12.013 (origem: A3)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4019`.

A3) FREE_CHECKOUT guardrails — FECHADO
- Default max por Identity e por (eventId + ticketTypeId): 1
- Rate limit FREE_CHECKOUT: 5 tentativas / 10 min por identityId; 10 / 10 min por IP
- Step‑up obrigatório (captcha/turnstile) quando:
  - ≥3 falhas em 10 min, ou
  - padrão suspeito (múltiplos identities no mesmo device/IP)
- Regra de precedência: FREE_CHECKOUT deve cumprir cumulativamente A1 + A3 + D04.07.01; em conflito, vence o limite mais restritivo.


#### G12.014 (origem: A4)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4027`.

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


#### G12.015 (origem: A5)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4040`.

A5) SLA Suporte e Trust & Safety — FECHADO
- Pagamentos/Check‑in (P0): triagem ≤ 1h, mitigação ≤ 4h
- Fraude/Chargeback (P1): triagem ≤ 24h, acção ≤ 72h
- Denúncias conteúdo/comportamento (P2): triagem ≤ 24h, resolução ≤ 7 dias
- Comunicação incidentes:
  - P0/P1: status page + aviso às orgs afectadas em ≤ 2h


#### G12.016 (origem: A6)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4047`.

A6) Retenção Operacional por classe (hot/warm) — FECHADO
- Esta secção define apenas janelas operacionais de acesso/search/custo.
- A retenção legal por classe é exclusivamente 19.4.1.
- EventLog técnico (hot): 180 dias
- Audit logs (hot/warm): 180 dias (hot) + 2 anos (warm/search)
- Logs de delivery de notificações (hot): 90 dias
- Read-models e caches financeiros: até 24 meses (arquivo legal segue 19.4.1)
- PII não essencial em camadas operacionais: apagar/anonimizar após 24 meses de inactividade (salvo obrigação legal)


#### G12.017 (origem: A7)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4056`.

A7) Risk Flags (resumo informativo, sem thresholds) — FECHADO
- Esta secção é apenas resumo operacional de sinais.
- Thresholds numéricos e ações automáticas vinculativas vivem exclusivamente em 19.2.2.
- Sinais base:
  - chargeback rate
  - anomalia de vendas
  - abuso de check‑in/QR


#### G12.018 (origem: A8)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4064`.

A8) Environment Baseline (prod + CI) — FECHADO
Fonte normativa consolidada de envs críticos (origem: especificação legacy migrada):
- Core runtime:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `QR_SECRET_KEY`
  - `ORYA_CRON_SECRET`
  - `REDIS_URL` (produção)
- Supabase:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Stripe:
  - `STRIPE_SECRET_KEY_LIVE`, `STRIPE_SECRET_KEY_TEST`
  - `STRIPE_WEBHOOK_SECRET_LIVE`, `STRIPE_WEBHOOK_SECRET_TEST`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`
- Apple Sign-In / APNS / Maps:
  - `APPLE_SIGNIN_*`
  - `APNS_*`
  - `APPLE_MAPS_*`

Guardrails:
- Secrets MUST stay out of git and be managed via Secrets Manager/SSM in produção.
- `*_PRIVATE_KEY_BASE64` MUST be single-line base64.
- `SINGLE_DB_MODE=1` força runtime de DB para `APP_ENV=prod`.
- Paid checkout sem publishable key deve falhar explicitamente com `CONFIG_STRIPE_KEY_MISSING`.
- Snapshot operacional PROD/LOCAL e runbooks de custo ficam em `docs/planning_registry_v1.md` (não-normativo).


#### G12.019 (origem: A9)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4094`.

A9) Cutover Guardrails (Store Big-Bang compatibility) — FECHADO
Guardrails normativos mínimos para cutovers destrutivos de domínio:
- Aplicação: cutovers destrutivos em pre-prod/prod (PROD_FUTURA). Em `APP_ENV=dev`, rollback/recovery canónico usa branches + histórico Git.
- Pré-condições obrigatórias:
  - janela de manutenção ativa
  - deploy freeze aplicado
  - backup/restore validados (apenas pre-prod/prod)
- Gates obrigatórios pré-change:
  - `npm run gate:api-contract`
  - `npm run gate:api-ui-coverage`
  - `npm run typecheck`
  - `npm run test`
  - `npm --prefix apps/mobile test -- --runInBand`
- Fail-hard policy:
  - qualquer guardrail/gate falhado bloqueia reabertura.
- Rollback:
  - pre-prod/prod: restore integral + redeploy da versão anterior + verificação de consistência pós-restore.
  - dev: rollback por branch/revert, sem dependência de backup operacional dedicado.


#### G12.020 (origem: A10)
- Fonte: `docs/ssot_registry_v1_source_snapshot_2026-02-14.md:4111`.

A10) Roadmap Infra Supabase -> AWS (decisão de direção) — FECHADO
- Fase 1:
  - Supabase mantém DB/Auth.
  - Compute/queues/storage/observabilidade correm em AWS.
- Fase 2:
  - migração de Postgres para AWS (RDS/Aurora) com cutover planeado.
- Fase 2/3:
  - migração de Auth para AWS (Cognito ou serviço próprio), preservando `Identity` como SSOT.
- Objetivo final:
  - operação 100% AWS com descontinuação controlada de dependências legadas.

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
2. Entitlement issued to identity in guest email state
3. Verification link sent
4. Identity resolved to verified user-linked state
5. Entitlement re-bound without mutation

---

---


## 99) Índice ID de Origem -> ID Canónico
| ID de Origem | ID Canónico | Grupo |
| --- | --- | --- |
| `DCAL-01..DCAL-36` | `G07.003` | `G07` |
| `A1` | `G12.011` | `G12` |
| `A10` | `G12.020` | `G12` |
| `A2` | `G12.012` | `G12` |
| `A3` | `G12.013` | `G12` |
| `A4` | `G12.014` | `G12` |
| `A5` | `G12.015` | `G12` |
| `A6` | `G12.016` | `G12` |
| `A7` | `G12.017` | `G12` |
| `A8` | `G12.018` | `G12` |
| `A9` | `G12.019` | `G12` |
| `ARB.01` | `G07.007` | `G07` |
| `C-G01` | `G01.011` | `G01` |
| `C-G02` | `G01.012` | `G01` |
| `C-G03` | `G01.013` | `G01` |
| `C-G04` | `G01.014` | `G01` |
| `C-G05` | `G01.015` | `G01` |
| `C-G06` | `G01.016` | `G01` |
| `C-G07` | `G01.017` | `G01` |
| `C-G08` | `G01.018` | `G01` |
| `C-G09` | `G01.019` | `G01` |
| `C01` | `G07.001` | `G07` |
| `C02` | `G05.001` | `G05` |
| `C02.01` | `G05.002` | `G05` |
| `C02.02` | `G05.003` | `G05` |
| `C02.X01` | `G05.004` | `G05` |
| `C03` | `G06.001` | `G06` |
| `C04` | `G09.001` | `G09` |
| `C05` | `G09.002` | `G09` |
| `C06` | `G08.001` | `G08` |
| `C07` | `G07.002` | `G07` |
| `C08` | `G10.001` | `G10` |
| `C09` | `G11.001` | `G11` |
| `C10` | `G05.005` | `G05` |
| `C11` | `G12.001` | `G12` |
| `C12` | `G03.001` | `G03` |
| `C13` | `G04.001` | `G04` |
| `C14` | `G05.006` | `G05` |
| `C15` | `G05.007` | `G05` |
| `C16` | `G11.002` | `G11` |
| `C17` | `G09.003` | `G09` |
| `C18` | `G12.002` | `G12` |
| `CAUTH.01` | `G02.010` | `G02` |
| `CAUTH.02` | `G03.002` | `G03` |
| `D00` | `G01.020` | `G01` |
| `D01` | `G06.002` | `G06` |
| `D01.01` | `G06.003` | `G06` |
| `D01.02` | `G03.003` | `G03` |
| `D02` | `G01.021` | `G01` |
| `D03` | `G07.003` | `G07` |
| `D03.01` | `G07.004` | `G07` |
| `D03.02` | `G07.005` | `G07` |
| `D04` | `G05.008` | `G05` |
| `D04.00` | `G05.009` | `G05` |
| `D04.00.01` | `G05.010` | `G05` |
| `D04.01` | `G05.011` | `G05` |
| `D04.02` | `G05.012` | `G05` |
| `D04.03` | `G05.013` | `G05` |
| `D04.04` | `G05.014` | `G05` |
| `D04.05` | `G05.015` | `G05` |
| `D04.06` | `G05.016` | `G05` |
| `D04.07` | `G05.017` | `G05` |
| `D04.07.01` | `G05.018` | `G05` |
| `D04.08` | `G05.019` | `G05` |
| `D04.09` | `G05.020` | `G05` |
| `D04.10` | `G05.021` | `G05` |
| `D05` | `G04.002` | `G04` |
| `D05.01` | `G04.003` | `G04` |
| `D05.02` | `G04.004` | `G04` |
| `D06` | `G09.004` | `G09` |
| `D07` | `G06.004` | `G06` |
| `D08` | `G06.005` | `G06` |
| `D08.01` | `G06.006` | `G06` |
| `D08.02` | `G06.007` | `G06` |
| `D08.03` | `G06.008` | `G06` |
| `D09` | `G05.022` | `G05` |
| `D09.01` | `G05.023` | `G05` |
| `D09.02` | `G01.022` | `G01` |
| `D09.03` | `G10.002` | `G10` |
| `D10` | `G12.003` | `G12` |
| `D10.01` | `G12.004` | `G12` |
| `D10.02` | `G12.005` | `G12` |
| `D10.03` | `G12.006` | `G12` |
| `D11` | `G07.006` | `G07` |
| `D12` | `G08.002` | `G08` |
| `D12.05` | `G08.003` | `G08` |
| `D13` | `G10.003` | `G10` |
| `D14` | `G04.005` | `G04` |
| `D15` | `G11.003` | `G11` |
| `D16` | `G11.004` | `G11` |
| `D17` | `G03.004` | `G03` |
| `D18` | `G08.004` | `G08` |
| `D18.01` | `G08.005` | `G08` |
| `D18.02` | `G08.006` | `G08` |
| `D18.03` | `G08.007` | `G08` |
| `D18.04` | `G08.008` | `G08` |
| `D18.05` | `G08.009` | `G08` |
| `D18.06` | `G08.010` | `G08` |
| `D18.07` | `G08.011` | `G08` |
| `D18.08` | `G08.012` | `G08` |
| `D18.09` | `G08.013` | `G08` |
| `D18.10` | `G08.014` | `G08` |
| `D18.11` | `G08.015` | `G08` |
| `D18.12` | `G08.016` | `G08` |
| `D18.13` | `G08.017` | `G08` |
| `D18.14` | `G08.018` | `G08` |
| `D18.15` | `G08.019` | `G08` |
| `D18.16` | `G08.020` | `G08` |
| `D18.17` | `G08.021` | `G08` |
| `D18.18` | `G08.022` | `G08` |
| `DORG.01` | `G04.006` | `G04` |
| `DORG.03A` | `G04.007` | `G04` |
| `DORG.04A` | `G04.008` | `G04` |
| `DORG.05A` | `G04.009` | `G04` |
| `DORG.06A` | `G04.010` | `G04` |
| `DORG.07A` | `G04.011` | `G04` |
| `DORG.08` | `G03.005` | `G03` |
| `DORG.09` | `G03.006` | `G03` |
| `I01` | `G01.001` | `G01` |
| `I02` | `G01.002` | `G01` |
| `I03` | `G01.003` | `G01` |
| `I04` | `G01.004` | `G01` |
| `I05` | `G01.005` | `G01` |
| `I06` | `G01.006` | `G01` |
| `I07` | `G01.007` | `G01` |
| `I08` | `G01.008` | `G01` |
| `I09` | `G01.009` | `G01` |
| `I10` | `G01.010` | `G01` |
| `O01` | `G12.007` | `G12` |
| `O02` | `G12.008` | `G12` |
| `O03` | `G12.009` | `G12` |
| `O04` | `G12.010` | `G12` |
| `S01..S09` | `G08.002` | `G08` |
| `T01` | `G02.001` | `G02` |
| `T02` | `G02.002` | `G02` |
| `T03` | `G02.003` | `G02` |
| `T04` | `G02.004` | `G02` |
| `T05` | `G02.005` | `G02` |
| `T06` | `G02.006` | `G02` |
| `T07` | `G02.007` | `G02` |
| `T08` | `G02.008` | `G02` |
| `T09` | `G02.009` | `G02` |

## 100) Integridade Reprodutível
```bash
node scripts/rebuild_ssot_registry_by_groups.mjs
node scripts/verify_ssot_canonical_groups.mjs
```

## 101) Aditamento Normativo Owner (2026-02-17)
- A autoridade normativa encontra-se consolidada no SSOT, sem dependência de documentos auxiliares.
- A baseline técnica desta ronda fecha com:
  - assignment canónico por serviço: `PROFESSIONAL_ONLY | RESOURCE_ONLY | PROFESSIONAL_AND_RESOURCE`;
  - motor temporal canónico de reservas em múltiplos de 5 minutos;
  - `orgRescheduleWindowMinutes` em `Organization` com enforcement em reagendamento;
  - `calendar` incluído no conjunto non-hideable do dashboard;
  - `BookingSplitStatus` canónico: `OPEN | SETTLING | SETTLED | CHARGE_FAILED | DEBT_OPEN | CANCELLED`;
  - hardening de `orya_organization` com `Secure=true` obrigatório em stage/prod.
- Modo final de fecho documental: `SSOT_ENFORCE_SINGLE_DOC=1`.

## 102) Índice de Gaps (documentação)
- Estado desta ronda: `SEM_GAPS_NORMATIVOS`.
- Regra transitória de autoridade por documento auxiliar está revogada.
- Critério operacional de manutenção:
  - qualquer nova contradição normativa reabre o estado para `EM_VERIFICACAO_EXECUCAO`;
  - enquanto o estado se mantiver em `SEM_GAPS_NORMATIVOS`, o SSOT permanece como única autoridade ativa.

## 103) Matriz Executável de Fecho (Documentos Decommissioned)
| Documento de origem | Regra propagada no SSOT | Código canónico (backend/frontend) | Teste/Gate executado | Evidência |
| --- | --- | --- | --- | --- |
| `calendario_motor_unico.md` | Motor temporal canónico 5m | `lib/reservas/availability.ts`, `app/api/servicos/[id]/calendario/route.ts`, `app/api/servicos/[id]/reservar/route.ts`, `app/api/org/[orgId]/reservas/[id]/reschedule/route.ts` | `npm test`, `npm run gate:ui-ux` | Validação/cálculo de slots e write-paths em múltiplos de 5 |
| `reservas.md` | Assignment por serviço e booking v1 alinhado | `lib/reservas/serviceAssignment.ts`, `app/api/org/[orgId]/servicos/route.ts`, `app/api/org/[orgId]/servicos/[id]/route.ts`, `app/[username]/_components/ReservasBookingClient.tsx` | `npm run typecheck`, `npm test` | Enum canónico aceite e propagado FE/BE |
| `policies_organizacao_fechado.md` | DF-01/DF-02/DF-03 (`POST` gate email + campos + policy global) | `app/api/org/[orgId]/policies/route.ts`, `app/api/org/[orgId]/policies/[id]/route.ts`, `app/api/org/[orgId]/me/route.ts`, `app/org/_internal/core/(dashboard)/reservas/politicas/page.tsx` | `npm test`, `npm run gate:ui-ux` | `guestBookingAllowed` e `orgRescheduleWindowMinutes` em round-trip; `noShowFeeCents` lockado em `0` |
| `dashboard_org_decisions.md` | Dashboard com `calendar` non-hideable e visibilidade UI-only | `lib/organizationDashboardTools.ts`, `app/api/org/[orgId]/dashboard/tools/visibility/route.ts` | `tests/org/dashboardToolIconsUnique.test.ts`, `npm test` | `NON_HIDEABLE_DASHBOARD_TOOL_IDS` inclui `calendar` |
| `identidade_auth_historico_pre_fecho.md` | Histórico absorvido no contrato final de identidade/auth | `app/api/auth/logout/route.ts`, `app/api/org-hub/organizations/switch/route.ts`, `proxy.ts` | `npm test`, `SSOT_NORMATIVE_MODE=SSOT_ONLY SSOT_ENFORCE_SINGLE_DOC=1 npm run gate:ssot-normative` | Sem autoridade paralela remanescente fora do SSOT |
| `identidade_auth_sessao_cookies_mobile_access.md` | Sessão/cookies/mobile access consolidados | `proxy.ts`, `app/api/auth/logout/route.ts`, `app/org/_internal/core/OrganizationTopBar.tsx`, `app/org/_internal/core/organizations/OrganizationsHubClient.tsx` | `npm test`, `npm run gate:ui-ux` | Escritas de `orya_organization` com política `Secure` por ambiente |
| `organizacoes_multiorg.md` | Multi-org canónico no namespace `/org` e org context estável | `app/api/org-hub/organizations/switch/route.ts`, `lib/organizationIdUtils.ts`, `app/org/_internal/core/OrganizationTopBar.tsx` | `tests/orgContext/*.test.ts`, `tests/ops/orgCanonicalProxyAlias.test.ts` | Semântica de contexto org consistente FE/BE |
| `SPLIT_V2.md` | Máquina técnica split v2 (`S01..S09`) | `domain/bookings/splitGarantido.ts`, `app/api/cron/bookings/split-garantido/route.ts`, `app/api/internal/worker/operations/route.ts` | `tests/bookings/splitGarantido.test.ts`, `tests/ops/splitGarantidoHardcutGuardrails.test.ts` | Transições runtime e rails monotónicos ativos |
| `split_v2_ssot.md` | Estados canónicos split e mapeamento legado determinístico | `prisma/migrations/20260217140000_normative_assignment_split_v2_core/migration.sql`, `prisma/migrations/20260217202000_service_assignment_hybrid_promotion/migration.sql`, `prisma/schema.prisma` | `npm run db:deploy`, `npm test` | `COMPLETED/EXPIRED` migrados para `SETTLED/CHARGE_FAILED/DEBT_OPEN` |
| `ws_handshake_and_jwt_claims.md` | Contrato WS/JWT consolidado no SSOT | `scripts/chat-ws-server.js`, `tests/ops/wsHandshakeRateLimitGuardrails.test.ts` | `npm test` | Guardrails WS/JWT mantidos sob contrato único |
| `padel_live_implementacao.md` | Execução live padel alinhada à norma ativa | `app/api/padel/*`, `domain/padel/*` | `tests/padel/live*.test.ts`, `npm test` | Matriz live com cobertura de permissões, transições e notificações |
| `padel_live_normativo.md` | Regras live padel consolidadas no SSOT | `domain/padel/*`, `app/api/padel/*` | `tests/padel/livePublicParity.test.ts`, `tests/padel/liveStateTransitionGuards.test.ts` | Paridade público/interno e guardas de estado validadas |
| `padel.md` | Ranking padel fechado end-to-end (trigger automático + projeções + perfis) em G08.022 | `domain/padel/matches/commands.ts`, `domain/padel/outbox.ts`, `domain/padel/playerProfile.ts`, `app/api/padel/players/route.ts`, `app/api/padel/me/summary/route.ts`, `app/api/padel/rankings/route.ts`, `app/[username]/padel/page.tsx`, `app/me/page.tsx`, `app/api/internal/ops/padel/backfill/route.ts` | `tests/padel/matchResultCardsCommands.test.ts`, `tests/padel/internalBackfillRoute.test.ts`, `tests/outbox/padelOutbox.test.ts`, `npm run typecheck`, `npm test` | Rebuild de rating automático por mutação de resultado, contagem canónica (`OFFICIAL|WALKOVER|RETIRED`), ranking visível em Hub/perfil público/me e backfill auditável com cursor |
