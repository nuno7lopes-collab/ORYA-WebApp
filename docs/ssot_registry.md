# ORYA SSOT Registry

Atualizado: 2026-02-11

## 00 Authority

### 00.1 Metadata
- `effectiveDate`: 2026-02-11
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
- Planeamento, backlog e itens “a fazer” vivem em `docs/planning_registry.md` (**NÃO-NORMATIVO**).

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
- Stripe: Connect Standard + funds flow FECHADO + onboarding Standard (D04.00.01 / C02.X01).
- Infra: backups Supabase→S3 + isolamento multi‑tenant (12.6.2 / 19.3.1).
- Check‑in: modo recinto (8.6) para fallback operacional sem offline QR.
- Policy Defaults v1 FECHADO (Apêndice A).
- Legal: sign‑off/versionamento FECHADO (19.1).
- Stripe Standard: mitigação operacional clarificada (sem controlo directo de payouts).
---

## 01 Global Invariants (I*)

Esta secção define os invariantes imutáveis da plataforma ORYA.
Estas regras DEVEM ser cumpridas em todos os momentos. Qualquer implementação
que viole um ou mais invariantes é considerada incorreta, mesmo que funcional.

### I01 — Fonte Única de Verdade (SSOT)
Cada domínio tem exatamente uma fonte autoritativa de verdade:
- Payments & money state → `Payment` + `LedgerEntry`
- Access rights → `Entitlement`
- Identity → `Identity` (USER or GUEST_EMAIL)
- Organization context → `Organization`

Dados derivados, caches, projeções e estado de UI NÃO PODEM ser
tratados como autoritativos.

---

### I02 — Ledger é Append-Only e Determinístico
Registos `LedgerEntry` são imutáveis e append-only.
DEVEM:
- nunca ser atualizados ou apagados
- referenciar sempre um evento causador
- ser suficientes para recomputar integralmente saldos e montantes líquidos

Qualquer correção é expressa por entries compensatórias, nunca por mutação.

---

### I03 — Payments são Máquinas de Estado, não Saldos
`Payment` representa ciclo de vida e intenção, não a verdade monetária.
A verdade financeira final deriva exclusivamente do ledger.

Fees do processor PODEM ser desconhecidas na criação e DEVEM ser reconciliadas
depois, sem mutar entries históricas.

---

### I04 — Entitlement é a Prova Canónica de Acesso
Um `Entitlement` é a única prova de que um utilizador (ou guest) tem acesso
a um recurso (evento, bilhete, lugar, experiência).

Estado de UI, QR codes, logs de check-in ou ecrãs de sucesso de pagamento NÃO
são prova de acesso.

---

### I05 — Contexto Explícito de Organização (Multi-Tenancy)
Todos os dados de domínio DEVEM estar scoped a um `orgId` explícito, por:
- via direta (row-level), ou
- via indireta por entidade dona

Nenhuma query, job, webhook ou tarefa assíncrona pode operar sem contexto
explícito de organização.

---

### I06 — Idempotência é Obrigatória para Operações com Side Effects
Qualquer operação que:
- cria movimento de dinheiro
- emite entitlements
- envia emails ou webhooks
- altera estado irreversível

DEVE ser idempotente e segura para retry.

---

### I07 — Assíncrono é Explícito e Observável
Todo o trabalho assíncrono DEVE:
- ser acionado via outbox ou queue durável
- ser observável por metrics e logs
- ser retryable sem side effects

Execução fire-and-forget é proibida.

---

### I08 — Sistemas Externos Não São Confiáveis
Sistemas externos (payment processors, providers de email, scanners,
integrações) são tratados como:
- não confiáveis
- duplicativos
- out-of-order

Todos os sinais de entrada DEVEM ser validados, deduplicados e reconciliados
contra a verdade interna.

---

### I09 — Fail Closed em Autorização e Acesso
Em caso de incerteza, falta de dados ou lag de reconciliação:
- acesso é negado
- payouts são atrasados
- ações irreversíveis são bloqueadas

O sistema falha sempre em fail-closed, nunca em fail-open.

---

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

### T01 — Explicit Organization Scoping (MANDATORY)
All domain entities MUST be scoped to an organization via:
- a direct `orgId` field, or
- an immutable reference to an entity that contains `orgId`

No entity that represents customer, operational, or financial data may
exist without an organization context.

---

### T02 — Query Enforcement
All read and write queries MUST:
- include `orgId` as a mandatory filter, OR
- derive `orgId` from a parent entity already scoped

Queries without explicit organization scoping are forbidden.

---

### T03 — Global Tables (Explicit Exceptions)
Only the following categories MAY exist without `orgId`:
- identity registries (e.g., username, email uniqueness)
- configuration metadata explicitly marked as GLOBAL

Global tables MUST:
- never contain customer-sensitive data
- be read-only in customer flows
- be explicitly documented as GLOBAL

---

### T04 — Background Jobs & Async Processing
All background jobs, workers, and outbox processors MUST:
- execute within a resolved `orgId` context
- include `orgId` in logs, metrics, and traces

Jobs operating across multiple organizations MUST process one
organization at a time.

---

### T05 — Webhooks & External Callbacks
Inbound webhooks MUST:
- be resolved to an internal entity
- derive the owning `orgId`
- fail if organization context cannot be resolved

Webhook handling without organization resolution is forbidden.

---

### T06 — Authorization Is Org-Bound
Authorization checks MUST always evaluate:
- actor identity
- organization membership
- role / permission within that organization

Cross-organization access is forbidden unless explicitly designed
and documented as such.

---

### T07 — Service Roles & Elevated Access
Service roles MAY bypass user-level RBAC but MUST NOT bypass
organization isolation.

All service-role access MUST:
- be auditable
- be logged with `orgId`
- have a documented justification

---

### T08 — Testing & Verification
The platform MUST include automated tests that:
- attempt cross-org access
- verify hard failure on isolation violations
- cover API, jobs, and webhook paths

Tenancy enforcement MUST be continuously tested.

---

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
- Auth errors exposed to clients MUST comply with `errorCode` envelope rules in `03 Canonical Vocabulary`.

---

### 02.2 RGPD Retention e Isolamento DB
12.2.1 Retenção RGPD (defaults v1) — **FECHADO**
	•	EventLog: 180 dias
	•	OutboxEvent: 30 dias após `publishedAt`
	•	NotificationDeliveryLog: 180 dias
	•	Job/JobAttempt/DLQ: 30–90 dias (depende de debug/ops)
	•	AuditLog: 5 anos (payload minimizado; sem PII desnecessária)

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

### 03.5 Auth `errorCode` Canonical Set (legacy auth spec migrated)
Conjunto canónico mínimo para endpoints de autenticação:
- `FORBIDDEN`
- `INVALID_EMAIL`
- `RATE_LIMITED`
- `UNAUTHENTICATED`
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

### C-G01 — Ownership Explícito de Contrato
Todo contrato DEVE definir:
- um único domínio/equipa owner
- um ou mais consumers conhecidos

O owner é responsável por compatibilidade, versionamento e ciclo de vida.

---

### C-G02 — Versionamento de Contrato
Contratos usam versionamento semântico:

- MAJOR: breaking change
- MINOR: alteração aditiva backward-compatible
- PATCH: clarificação não comportamental ou bug fix

A versão é explícita e nunca inferida.

---

### C-G03 — Compatibilidade Retroativa é Obrigatória
Consumers DEVEM:
- tolerar unknown fields
- não depender da ordem dos fields
- não assumir default values sem documentação explícita

Producers NÃO PODEM:
- remover fields em versões minor
- alterar semântica de field sem major version

---

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

### C-G06 — Premissas de Tempo e Ordenação
Contratos NÃO PODEM assumir:
- entrega in-order
- single delivery
- clocks sincronizados

Se ordenação importar, o contrato DEVE definir explicitamente chaves de
ordenação ou lógica de reconciliação.

---

### C-G07 — Obrigações de Observabilidade
Cada contrato DEVE emitir:
- metrics de sucesso/falha
- metrics de latência (p50, p95)
- logs estruturados com correlationId

Falha silenciosa é proibida.

---

### C-G08 — Testes de Compatibilidade
Qualquer alteração de contrato DEVE incluir:
- testes de backward compatibility
- replay de pelo menos um payload histórico
- validação explícita do comportamento de idempotência

---

### C-G09 — Documentação é Executável
Cada contrato DEVE incluir:
- payloads de exemplo
- casos de erro de exemplo
- transições de estado explícitas (quando aplicável)

Contratos ambíguos são considerados incompletos.

---

C01) Reservas ↔ Padel (agenda e slots)

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

**Contract ID:** C01  
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
C02) Finanças ↔ Todos (checkout/refunds) — gateway único

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

C02.01) Eventos ↔ Finanças (convites) — resolução determinística
• Objetivo: evitar UI/backend drift em convites e tornar o checkout por convite 100% contratual.
• Entrada: { eventId, inviteToken?, email?, username? }
• Saída: { allowCheckout, constraints: { guestCheckoutAllowed, inviteIdentityMatch, ticketTypeScope? }, resolvedIdentity }
• Regra: Eventos define a policy e Finanças valida/impõe as constraints no createCheckout.

C02.02) Checkout Compatibility Adapters (legacy checkout spec migrated) — **FECHADO**
- Endpoints canónicos:
  - `POST /api/payments/intent`
  - `GET /api/checkout/status`
- Endpoints de compatibilidade (adapters) são permitidos quando:
  - mantêm path legado para clients existentes, e
  - delegam orquestração de pagamento ao domínio Finanças (`C02`) sem bypass.
- Campos de resposta compatíveis (`checkoutId`, `statusV1`, `freeCheckout`, `final`) são aditivos e não substituem o estado canónico do `Payment`.
- Divergência resolvida por SSOT:
  - aliases de status como `PAID` pertencem à camada de compatibilidade de API;
  - verdade financeira canónica continua no state machine de `Payment` (`SUCCEEDED`, etc.) e no ledger append-only.
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
Entitlements são emitidos apenas após Payment SUCCEEDED e reconciliação do ledger.
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

C10) Stripe Webhooks ↔ Finanças (ingestão e reconciliação) — **FECHADO**
Regras:
	•	Endpoint canónico: `/api/stripe/webhook` (alias `/api/webhooks/stripe` deve apontar para o mesmo handler).
	•	Assinatura Stripe obrigatória; rejeitar se `livemode` não corresponder ao modo esperado.
	•	Dedupe obrigatório por `stripeEventId` (idempotencyKey global).
	•	Resolver `orgId` por `stripeAccountId` (Connect) ou metadata `orgId` no PaymentIntent/Charge.
	•	Se `orgId` não for resolvido → guardar evento + DLQ + alerta (sem side‑effects).
	•	Persistir evento bruto (`StripeEvent`) com: `stripeEventId`, `type`, `account`, `created`, `livemode`, `requestId?`, `correlationId`.
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

C12) Identity/Auth (SSOT + claim/merge) — **FECHADO**

Regras:
	•	Tipos: `USER` e `GUEST_EMAIL`.
	•	Email normalizado: `trim + NFKC + lowercase`; hash HMAC para dedupe.
	•	Guest checkout cria/usa `Identity(GUEST_EMAIL)` por email normalizado.
	•	Email verificado → **claim automático** para `Identity(USER)`:
		–	mover Entitlements para o USER
		–	criar registo de merge (auditável)
		–	**não** alterar LedgerEntry nem Payment histórico
	•	Merge é idempotente e nunca destrói histórico; identidade antiga fica como tombstone.

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

C13) Org Context + RBAC (resolução e step‑up) — **FECHADO**

Regras:
	•	`orgId` é obrigatório no path (`/org/:orgId/*`) ou header `X-ORYA-ORG-ID`.
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
**Primary Consumers:** Payout cron, Admin Ops UI

#### Idempotency
- **Idempotency Key:** payoutId ou balance_transaction.id  
- **Scope:** por org

---

C15) Money & Rounding (pricing determinístico) — **FECHADO**

Regras:
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
  "verifyUrl": "/organizacao/settings?tab=official-email",
  "nextStepUrl": "/organizacao/settings?tab=official-email",
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
	•	Todos os erros externos usam envelope canónico (`errorCode`, `message`, `retryable`, `correlationId`).
	•	`send-otp` e `check-email` seguem política anti-enumeração (resposta genérica, sem leak de existência de conta).
	•	`/api/auth/refresh` é o único contrato canónico para sincronizar sessão com cookies HttpOnly.
	•	`/api/auth/me` é o read-model canónico de estado de autenticação no server.
	•	Auth UI/UX (modal, cooldowns, componentes) é não-normativo e vive em `docs/planning_registry.md`.

---

### Contract Execution Addendum (NORMATIVE)

**Contract ID:** CAUTH.02
**Contract Name:** Public Auth API Contract Baseline
**Current Version:** v1.0.0
**Owner:** Domain: Identity/Auth
**Primary Consumers:** WebApp auth UI, Mobile auth clients, internal session middlewares

#### Purpose
Definir baseline contratual dos endpoints públicos de autenticação, com anti-enumeração e envelope canónico.

#### Idempotency
- **Idempotency Key:** N/A (operações de sessão/auth sem side-effects financeiros)
- **Scope:** per request

#### Failure Mode
Em dúvida de autorização/origem/sessão: fail-closed, sem side effects irreversíveis.

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

DORG.01) Membership de Organização — fonte única de verdade (FECHADO)
	•	Fonte única canónica: `OrganizationGroupMember` + `OrganizationGroupMemberOrganizationOverride`.
	•	`OrganizationMember` é legado e não pode ser usado por código de runtime.
	•	Leituras/escritas de membership (listar, promover, remover, contar owners, resolver permissões) devem passar pelo modelo de grupo.
	•	DB hygiene: tabela legacy `organization_members` removida por migração de cut-line.

DORG.03A) Módulos da Organização — fonte única + fail-closed (FECHADO)
	•	Fonte única de ativação de módulos: `OrganizationModuleEntry.enabled=true`.
	•	`RBAC` e `module enabled` são validações separadas e cumulativas:
		–	sem membership/permissão => negar;
		–	módulo desativado => negar, mesmo que o utilizador tenha role.
	•	No perfil público da organização, um módulo só aparece se:
		–	estiver ativo, e
		–	tiver conteúdo publicável.
	•	Toggle de módulo afeta dashboard e perfil público de forma determinística (sem bypass por URL direta).

DORG.04A + DORG.05A) Contexto de organização explícito e header canónico (FECHADO)
	•	APIs de organização aceitam `organizationId` apenas por:
		–	path (`/org/:id`), ou
		–	query (`organizationId`), ou
		–	header canónico `x-orya-org-id`.
	•	Cookie não é fonte de verdade para mutações API (apenas fallback UI quando explicitamente permitido).
	•	Header legado `x-org-id` está descontinuado; único header válido é `x-orya-org-id`.

DORG.06A) Notificações Stripe Status — dedupe por organização + estado (FECHADO)
	•	Notificações `STRIPE_STATUS` usam dedupe key com fingerprint de estado:
		–	`accountId`, `charges_enabled`, `payouts_enabled`, `requirements_due`.
	•	Dedupe é por utilizador + organização + fingerprint; retries não podem gerar spam.

DORG.07A) Webhook Stripe Connect — fail-closed por mapeamento org (FECHADO)
	•	`account.updated` só atualiza organização se o mapeamento for inequívoco.
	•	Se não houver organização mapeada, ou houver mismatch `organizationId` ↔ `stripeAccountId`, a resposta é erro (não-200).
	•	Atualização parcial/silenciosa é proibida; `update_count != 1` é erro operacional.
	•	Webhook externo nunca é tratado como verdade sem reconciliação com estado interno.

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

DORG.09) Perfil Mobile — UI/UX baseline (FECHADO)
	•	Escopo: perfil de Utilizador (view pública/própria) + perfil público de Organização (view pública).
	•	Padrão comum:
		–	App Bar sticky, Hero com avatar/badges, CTA primário visível, Stats row, secções sticky, estados loading/empty/error.
		–	acessibilidade mínima: touch targets >= 44pt, contraste AA, dynamic type.
	•	Utilizador:
		–	stats `Seguidores` + `A seguir`.
		–	CTA `Follow/Unfollow` (outro user) e `Editar Perfil` (próprio).
	•	Organização:
		–	stats apenas `Seguidores`.
		–	CTA primário derivado do módulo ativo (`Ver eventos`/`Reservar`/`Ver loja`/`Contactar`).
	•	Ordem canónica de blocos org:
		–	`HERO -> ABOUT -> EVENTS_AGENDA -> STORE -> SERVICES -> FORMS -> GALLERY -> FAQ -> CONTACT`.
	•	Layout de perfil público de organização é controlado por `OrgPublicProfileLayout` versionado (edição apenas no painel org).

D00) Fora de scope (v1–v3): API pública (terceiros)
	•	Não vamos expor API pública/SDK para terceiros nesta fase.
	•	Endpoint(s) públicos **first‑party** (ex.: páginas públicas/agenda) são permitidos, read‑only e rate‑limited.
	•	Qualquer “Public API” com chaves/SDK é **futuro**: sem documentação externa, sem onboarding de parceiros e **desativado por defeito** em prod até decisão explícita.
	•	Integrações externas só via exports e integrações pontuais configuráveis (Fase 2+), sem “public API” aberta.

D01) Evento base obrigatório para torneios

Todo torneio de Padel tem eventId obrigatório.
	•	Eventos: tickets, SEO, página pública base, sessões, entitlements
	•	Padel Torneios: competição, matches, bracket/standings, live ops

D01.01) Schedule de Evento — invariantes de tempo (FECHADO)
	•	`endsAt` é **obrigatório** em toda a stack (criação, edição, ingestão, seed).  
	•	Regra: `endsAt` **tem de ser depois** de `startsAt` (nunca antes).  
	•	Não existe fallback runtime para `endsAt`; payload inválido falha e deve ser corrigido na origem.  
	•	Evento publicado **nunca** pode regressar a `DRAFT`. `DRAFT` nunca é público.  
	•	Chat de evento: `open_at = startsAt`, `read_only_at = endsAt`, `close_at = endsAt + 24h`.  
	•	Chat de evento (acesso) — **presença** obrigatória: **Entitlement + check-in consumido**.  
	•	Definição: **check‑in consumido = entitlement consumido** (`CheckinResultCode.OK` ou `ALREADY_USED`).  
	•	Entitlement mantém-se como prova única de acesso ao evento; o chat é uma feature de presença.  
	•	Entrada no chat é por **convite com aceitação explícita**; convite emitido após entitlement consumido (check‑in/claim) se dentro da janela.  
	•	Convites de chat **expiram** e **não podem ser aceites** após `endsAt + 24h` (janela de participantes).  
	•	Chat de evento aparece em “Mensagens” **apenas após** convite aceite.  
	•	CTA “Entrar no chat” na página do evento **e** no bilhete/carteira, apenas após entitlement consumido.  
	•	Notificação do chat enviada após entitlement consumido (respeita preferências do utilizador).  
	•	Chat de evento é **exclusivo da app** (não existe chat de evento na web para users).  
	•	Após `close_at`: chat fica **read‑only** para quem tem acesso; histórico **não expira**.  
	•	Discovery: eventos `PAST`/`CANCELLED` **não** entram em listas públicas.  
	•	Mobile checkout: CTA **bloqueado** se `status != ACTIVE` **ou** `endsAt < now`.  
	•	Wallet: separação “Ativos/Histórico” **baseada em `endsAt`** (ou janela de check‑in).
	•	Higiene legacy: migração one-shot corrige `endsAt` inválido e aplica constraint DB `endsAt > startsAt`.

D01.02) Mensagens & Chat — decisões de produto (FECHADO)
	•	Mensagens para utilizador final **apenas na app** (sem chat na web).  
	•	“Inbox” único de Mensagens: eventos + reservas/serviços + chats com organizações + chats entre utilizadores.  
	•	Chat de evento segue D01.01 (convite aceite, CTA pós‑consumo, app‑only, read‑only após close, histórico permanente).  
	•	Chat de reservas/serviços: canal **só ativa** com a 1ª mensagem (não criar canal vazio).  
	•	Chat de serviço (pré‑reserva): **apenas via pedido**; pedido **aprovado por staff** da organização.  
	•	Chat org‑contact (cliente → organização): **pedido obrigatório**, aprovado por staff.  
	•	Reserva: organização pode iniciar chat no **detalhe da reserva** (1ª mensagem cria canal).  
	•	Chat interno da organização: **só canais** (sem mensagens diretas internas); admins criam por defeito; canais automáticos do sistema (Ops, evento, reserva).  
	•	Canais cliente‑profissional: cliente vê o profissional; admins podem ver/escrever; identidade padrão para admins é “Organização”; identidade pessoal opcional quando necessário; admins **não aparecem** como membros visíveis ao cliente.  
	•	Mensagens entre utilizadores: só entre amigos/seguidores confirmados; pedidos de mensagem para desconhecidos; grupos por convite.  
	•	Notificações: push em todas as mensagens por defeito; opção de silenciar por conversa.  
	•	Conteúdo: **texto apenas** na Fase 1; anexos em fase futura.  
	•	“Anular envio”: janela de **2 minutos**.  
	•	Retenção: mensagens guardadas; chats de evento/reserva ficam read‑only após fecho, sem purge.

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

D03) Agenda Engine e conflitos (FECHADO)

Regra base: **quem marca primeiro ocupa**. Nada sobrepõe automaticamente.  
Conflitos ficam bloqueados; quem chega depois tem de se adaptar.

Override **só manual** por Owner/Admin, com auditoria e notificações.  
Se o override mexer numa reserva de utilizador, requer **pedido + aceitação** (ver 9.2).

D03.01 MatchSlot (Padel)
MatchSlot bloqueia novas marcações no mesmo horário/campo.  
Se já existir reserva/aula, MatchSlot **não** sobrepõe automaticamente; requer override explícito.

D03.02) Operação de Calendário do Clube/Reservas (FECHADO)
	•	Calendário único de clube:
		–	reservas, aulas e torneios partilham o mesmo calendário operacional.
		–	tudo o que ocupa recurso/campo bloqueia esse recurso no horário.
	•	Visibilidade de calendário:
		–	Utilizador: mês atual + 3 meses; passado oculto.
		–	Organização: até fim do ano + 2 anos; passado em leitura.
	•	Permissões:
		–	Owner/Admin: tudo.
		–	Staff: apenas recursos atribuídos.
		–	Trainer: aulas próprias em recursos atribuídos.
	•	Override/mudança de reserva:
		–	org pede mudança até T-4h.
		–	user responde até 24h ou T-2h (o que ocorrer primeiro).
		–	sem resposta = recusado; reserva mantém-se.
		–	cancelamento pelo org = refund total automático.
	•	Guest booking e aulas recorrentes:
		–	guest booking permitido apenas por policy e cria Entitlement canónico.
		–	aulas recorrentes usam `ClassSeries + ClassSession` com bloqueio explícito na Agenda Engine.

D04) Finanças determinística (Stripe Connect + Fees ORYA) — decisão única

> **FECHADO (SSOT):** SSOT financeiro = `Payment` (state machine) + `LedgerEntry` (linhas imutáveis).  
> Tudo o resto (SaleSummary, dashboards, exports) é **derivado**.

Princípios
- Stripe Connect obrigatório já (v1.x): cada Organization tem `stripeAccountId`.
- **Finanças é o único gateway lógico**: nenhum módulo cria PaymentIntents/CheckoutSessions diretamente no Stripe.
  Endpoints especializados de checkout são permitidos **apenas** se delegarem ao domínio Finanças e respeitarem idempotência/policies canónicas.
- Idempotência obrigatória em todas as operações: `idempotencyKey` por createCheckout/refund/reconcile.
- “Pago” só existe quando `Payment.status == SUCCEEDED`.

D04.00) Stripe Connect — Account Type (FECHADO)
- ORYA usa **Stripe Connect Standard** como tipo de conta por defeito para Organizações.
- A conta Stripe é do organizador (autonomia e responsabilidade fiscal/operacional).
- A ORYA não cria nem gere contas Custom nesta fase.
- Qualquer excepção (Express/Custom) só por decisão de produto + contrato (fora v1.x).

D04.00.01) Stripe Funds Flow (FECHADO)
Objetivo: definir de forma única como o dinheiro flui e onde a ORYA consegue (ou não) aplicar “risk holds”.

Decisão (v1.x):
- Modelo: **Destination Charges + Application Fee** (Stripe Connect Standard).
- A cobrança ao cliente é criada pela ORYA (Finanças) para o evento/serviço (`sourceType/sourceId`), com:
  - `application_fee_amount` = fee ORYA (conforme FeePolicyVersion)
  - `transfer_data.destination` = `Organization.stripeAccountId`

Implicações (normativas):
- Refunds são iniciados pela ORYA (Finanças) e são idempotentes.
- Disputes/chargebacks afectam `Payment/Entitlements` conforme D04.09 e Secções 7/8.
- “Risk hold” em v1.x é **operacional** (step‑up, limits, bloqueio temporário de criação de eventos/checkout); não assume controlo directo de payouts.
- Se for necessário controlo fino de payouts/transferências (hold real de fundos), isso é **fora v1.x** e requer revisão do flow (ou mudança de account type/contrato).

Regra: nenhum módulo assume “payout control” fora do que este flow permite.

D04.01 Política de Fee (Admin) (FECHADO)
- Config por organização (default) + overrides por `sourceType` (e opcionalmente por `sourceId`).
- Limites opcionais: min/max, arredondamentos, feeMode (INCLUDED/ADDED/ABSORBED — se aplicável).
- Qualquer alteração gera nova versão (`feePolicyVersion`), nunca edita retroativamente.

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

D04.05 SaleSummary (se existir) — read model derivado
- Pode existir para performance/UX, mas:
  - nunca decide estados (pago/reembolsado)
  - é re‑gerável a partir de Ledger + Payment
  - falhas são reparáveis por replay (EventLog/Jobs)
- Definição (read‑model):
  - `SaleSummary`: resumo por compra (`purchaseId`/`paymentIntentId`), totais/fees (`subtotal/discount/platformFee/cardFee/stripeFee/total/net`), `status`, owner (`ownerUserId`/`ownerIdentityId`), modo/teste (`mode`/`isTest`) e snapshots de promo (`promoCodeSnapshot/label/type/value`).
  - `SaleLine`: linhas por ticketType (`ticketTypeId`), `quantity`, `unitPrice`, `gross/net/platformFee` + snapshots de promo.
- Owner: apenas o consumer de finanças (domain/finance read‑model consumer) escreve; resto é read‑only.

D04.06 FeeMode e pricing têm um resolvedor único (FECHADO)
- `computePricing()` (Finanças) decide de forma determinística e versionada:
  - platform default
  - org default
  - override por `sourceType`
  - override por `sourceId` (opcional)
- Regra: nenhum módulo força feeMode “por fora”. Se Eventos quiserem “INCLUDED sempre”, isso é configurado como override por `sourceType=TICKET_ORDER` e fica escrito em policy versionada.

D04.07 Regras de FREE_CHECKOUT (FECHADO)
- Um checkout é “free” se:
  - `totalAmount == 0` (após promos/fees) **ou**
  - `scenario == FREE_CHECKOUT` (explicitamente resolvido por Finanças)
- Limites e anti‑abuso aplicam-se ao free checkout independentemente de qualquer flag no evento.
- Bilhetes 0€ só existem por decisão explícita:
  - `Event.allowZeroPriceTickets` (default false) **ou** policy por TicketType (recomendado).

D04.07.01 Guardrails de FREE_CHECKOUT (FECHADO)
- Anti‑abuso é **normativo** e vive em Finanças (não em Eventos):
  - Limite por `Identity` e por `eventId+ticketTypeId`: default `max=1` (configurável por policy, com guardrails globais).
  - Rate limit por IP/device + janela (ex.: 10 tentativas/5 min) + cooldown progressivo em falhas.
  - Step‑up em casos suspeitos: captcha/turnstile, obrigar login, ou bloquear por 15–60 min (policy).
  - Dedupe por idempotencyKey e por `Identity+sourceId` (não existe “free checkout repetido”).
  - Audit + EventLog obrigatórios: `free_checkout.denied` com reasonCode (sem PII).
- Regra: o mesmo conjunto de guardrails aplica-se a `totalAmount==0` e a `scenario==FREE_CHECKOUT`.

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

D04.09 Refunds, cancelamentos e chargebacks (FECHADO)
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

D05) RBAC mínimo viável + Role Packs

Introduzir já: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE
Com mapa fixo para roles/scopes (Secção 11).

D05.01) Resolução de organização é determinística
	•	Em B2B, organizationId vem da rota (/org/:orgId/...) como fonte primária.
	•	Cookie pode existir apenas como conveniência (redirect inicial), não como base de autorização.
	•	RBAC avalia sempre com orgId explícito.
	•	Qualquer fallback (cookie/lastUsedAt) é permitido apenas para redirect/UI. Nunca para autorização.
	•	Alias legado (compatibilidade): /organizacao/* → redirect 301 para /org/:orgId/* (apenas UI).

D05.02) Step-up obrigatório em ações irreversíveis (FECHADO v1)
	•	Exige reautenticação/2FA recente + `reasonCode` obrigatório para:
		–	refunds;
		–	cancelamento de evento/torneio (soft-cancel);
		–	alteração de fee policy/overrides;
		–	exportação com PII.
	•	Todas as ações acima geram `AuditLog` com before/after (payload minimizado RGPD).

D06) Notificações como serviço (com logs e opt-in)

Templates, consentimento RGPD, logs de delivery, outbox e preferências.

D07) sourceType canónico (Finanças/ledger/check-in)

Todos os checkouts e entitlements usam sourceType canónico e unificado (Secção 7).

D08) EventAccessPolicy (acesso + convites + identidade + claim entitlements) — definição final

> **FECHADO (SSOT):** `EventAccessPolicy` é a única fonte de verdade para:
> 1) modo de acesso (public/invite/unlisted), 2) checkout como convidado, 3) convites por token, 4) compatibilidade de identidade, e 5) check‑in (ver Secção 8).

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
- compra gera `Entitlement` com `ownerIdentityId = Identity(GUEST_EMAIL)`
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

UX operacional detalhada de convite/checkout guest é **não‑normativa** e vive em `docs/planning_registry.md` (P7.1).

⸻

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

D09) Merchant of Record + fiscalidade (decisão “top”)
	•	MoR por defeito é a Organização (Connected Account)
	•	Organização é responsável por IVA / fatura ao consumidor final
	•	ORYA cobra fee de plataforma e emite fatura B2B da fee à Organização (ou documento equivalente)
	•	Excepção futura (enterprise): ORYA como MoR só por contrato/config explícita (fora v1.x)

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

D09.02) UX Operacional Global (B2B)
	•	Blueprint de UX global (Unified Search, Context Drawer, Command Palette, Ops mode e padrões visuais) é **não‑normativo** e vive em `docs/planning_registry.md` (P7.2).

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

D10) Jobs/Queues + Outbox (motor enterprise sem overkill) — definição final

> **FECHADO:** Tudo o que é assíncrono, re‑tentável, ou depende de webhooks externos passa por Jobs/Queues.  
> A entrega de eventos internos é garantida por Outbox + idempotência (evita “eventos perdidos”).

D10.01 Jobs/Queues (obrigatório)
- Sistema de jobs com:
  - queue, retries, backoff, e DLQ
  - prioridades (ex.: pagamentos/entitlements > notificações)
  - dedupe por `idempotencyKey`
- Tudo assíncrono passa por jobs:
  - notificações, exports, ingest CRM, sync Stripe, indexação/search
  - replays do EventLog, reminders (ex.: split payment T‑48/36/24), reconciliations
- Estado efémero com TTL (holds, locks, rate‑limits) vive em Redis; DB guarda apenas estado final/auditável.

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

D11) Moradas — Address Service (SSOT) + Apple Maps como provider único

> **FECHADO (SSOT):** Todos os módulos consomem e escrevem moradas **apenas** via Address Service. Nunca há “moradas por módulo”.

Regra
- Todos os módulos (Eventos / Reservas / Loja / Serviços / Padel) consomem e escrevem moradas APENAS via Address Service (SSOT).
- O SSOT guarda SEMPRE:
  - `addressId`
  - `formattedAddress` (para UI)
  - `canonical` (estruturado: `countryCode` ISO‑3166‑1, region, locality, postalCode, street, number, etc.)
  - `geo` (lat, lng)
  - `sourceProvider` (ex.: `APPLE_MAPS` / `MANUAL`)
  - `sourceProviderPlaceId` (quando existir)
  - `confidenceScore` + `validationStatus` (`RAW | NORMALIZED | VERIFIED`)
- Nunca há “moradas locais” por módulo. Só referências a `addressId`.

Provider (decisão FECHADO)
- **Provider único:** Apple Maps (autocomplete + geocode/reverse) via server token.
- Regra: o client **não** usa providers como fonte de verdade; tudo passa pelo Address Service (protege keys, rate limits e consistência).
- Exceção permitida: reverse geocode **no device** apenas como hint de UX (não é SSOT). A normalização e persistência continuam no backend.

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

Detalhe de implementação/execução do Address Service é **não‑normativo** e vive em `docs/planning_registry.md` (P7.3).

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

D12.05) Ops — Prisma env auto-load (FECHADO)
	•	Prisma CLI deve ler variáveis automaticamente do `.env` (root), sem `set -a`, `source` ou inline envs.
	•	Nota operacional: DATABASE_URL via pooler (6543) + DIRECT_URL direto (5432) e ambos com `sslmode=require`.

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

D14) Multi-Organizações (empresa mãe → filiais)
	•	OrganizationGroup (mãe) agrega Organizations (filiais)
	•	RBAC suporta: permissões na mãe, permissões por filial, e papéis herdáveis/limitados (Secção 11)

D15) Macro + Micro Analytics (obrigatório)
	•	dashboards financeiros e operacionais com drill-down por dimensões
	•	sempre derivados do Ledger + dimensões (sem duplicar estado “financeiro” fora de Finanças)

D16) Ops Feed (Activity Feed) é first-class
	•	eventos operacionais são publicados no EventBus e gravados no EventLog
	•	um consumer gera Activity Feed + posts automáticos no canal “Ops” do chat interno

⸻

D17) Integrações Apple — guardrails normativos (FECHADO)
	•	Sign in with Apple é método suportado e obrigatório em iOS quando existirem logins de terceiros.
	•	Push iOS usa APNs com token-based auth.
	•	Universal links e share sheet iOS são suportados para superfícies públicas relevantes.
	•	Apple Wallet/PassKit em v1.x mantém validação **online** por `EntitlementQrToken` (`tokenHash`), com updates/revogação por jobs idempotentes.
	•	Offline signed QR permanece fora de v1.x e só pode entrar com payload assinado/versionado, rotação de chaves e revocation list sincronizada.
	•	Address provider canónico continua em D11 (Apple Maps via Address Service).
	•	Certificados/keys Apple vivem em AWS Secrets Manager com rotação e mínimo privilégio.
	•	Detalhe de roadmap/fases Apple fica em `docs/planning_registry.md` (P7.4).

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
- Tipos:
  - `USER` (userId)
  - `GUEST_EMAIL` (emailNormalizado + emailHash)
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

Separação de enums (SSOT D07):
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
- WebApp: executar claim **automaticamente no login** (callback/useUser).
- Mobile (app): não executa claim automático (app é login‑only e não suporta guest checkout).

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

11) RBAC v2 — roles, scopes e role packs

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
	•	Conteúdo movido para `docs/planning_registry.md` (bloco de roadmap/check-in, não-normativo).

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
	•	O catálogo operacional de eventos do feed (playbooks/listas de monitorização) é **não‑normativo** e vive em `docs/planning_registry.md` (P7.5).

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

Stack canónica de produção imediata:
	•	Postgres full-text + trigram + filtros por tipo.
	•	Index unificado derivado (owners continuam Eventos/Padel/Reservas/Serviços).
	•	Rebuild por jobs + replay a partir de EventLog (idempotente).

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

Ranking Unificado v2 (personalização avançada) está fora do cut-line de produção imediata e vive em `docs/planning_registry.md` (planeamento não normativo).

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

18) Nota final (regra de ouro)

Se uma decisão não estiver aqui, não está decidida.
Se uma implementação contradizer D02/D04/D03, é bug de arquitectura, não é “trade-off”.

⸻

## 06 Production Gates (SLI/SLO, go-live, release gates)

### 06.0 P0 endpoints (guardrails)
Lista canónica de rotas P0 usada pelos gates de envelope/erro.
Este bloco é gerado automaticamente a partir de `scripts/manifests/p0_endpoints.json` via `npm run ssot:p0:sync` (não editar manualmente).

<!-- P0_ENDPOINTS_START -->
- `app/api/payments/intent/route.ts`
- `app/api/checkout/status/route.ts`
- `app/api/checkout/resale/route.ts`
- `app/api/convites/[token]/checkout/route.ts`
- `app/api/cobrancas/[token]/checkout/route.ts`
- `app/api/servicos/[id]/checkout/route.ts`
- `app/api/organizacao/reservas/[id]/checkout/route.ts`
- `app/api/padel/pairings/[id]/checkout/route.ts`
- `app/api/admin/payments/refund/route.ts`
- `app/api/admin/payments/dispute/route.ts`
- `app/api/admin/payments/reprocess/route.ts`
- `app/api/admin/refunds/list/route.ts`
- `app/api/admin/refunds/retry/route.ts`
- `app/api/organizacao/refunds/list/route.ts`
- `app/api/organizacao/payouts/status/route.ts`
- `app/api/organizacao/payouts/list/route.ts`
- `app/api/organizacao/payouts/summary/route.ts`
- `app/api/organizacao/payouts/settings/route.ts`
- `app/api/organizacao/payouts/connect/route.ts`
- `app/api/organizacao/payouts/webhook/route.ts`
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
- `app/api/cron/payouts/release/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/webhooks/stripe/route.ts`
<!-- P0_ENDPOINTS_END -->

## Operational SLIs, SLOs & Alerting (NORMATIVE)

This section defines the minimum observability and alerting standards
required for production operation of the ORYA platform.

Dashboards without actionable thresholds are insufficient.

---

### O01 — Alert Classification
Alerts are classified as:
- **PAGER:** requires immediate human intervention
- **TICKET:** requires investigation but not immediate action

---

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

### O03 — Logging & Correlation
All logs MUST include:
- `correlationId`
- `orgId`
- domain entity identifiers

Logs without correlation context are non-compliant.

---

### O04 — Incident Readiness
For each PAGER alert, the following MUST exist:
- documented runbook
- clear ownership
- rollback or mitigation steps

Production without runbooks is forbidden.

---

17.1 Escopo de Produção (Cut Line v1.x) — **FECHADO**
ADITAMENTO FECHADO: delimita o que entra em produção v1.0 e o que fica bloqueado.

A) IN (obrigatório para v1.0)
	•	Eventos: criar/publicar/listar + gestão básica
	•	Tickets: compra + emissão/entitlement
	•	Finanças: checkout + webhooks + ledger append‑only + reconciliação
	•	Entitlements: criação + revogação
	•	Check‑in: scanner + consumo + logs
	•	Org onboarding Stripe Connect Standard (KYC) — C02.X01
	•	RBAC mínimo (org scopes críticos)
	•	Notificações essenciais (transaccionais + operacionais)
	•	DSAR básico operativo (19.4)
	•	Trust & Safety mínimo operativo (19.2)
	•	Observabilidade mínima (SLIs + alertas críticos 14.1.1)

B) OUT (consta neste SSOT, mas fica bloqueado/feature‑flagged em v1.0)
	•	QR offline assinado (S2) e validação offline
	•	Ranking Unificado v2 (personalização avançada; detalhes em `docs/planning_registry.md`)
	•	Automações CRM complexas e campanhas
	•	Funcionalidades sociais não essenciais (comunidade)
	•	Marketplace avançado e integrações enterprise

C) Regra de execução (hard)
	•	Tudo o que está OUT: UI escondida + endpoints protegidos + feature flag obrigatória + **403 por defeito**.
	•	Qualquer activação exige aprovação explícita + `SafetyCase` quando aplicável (19.2).

D) Definição de Done para Go‑Live v1.0
	•	Todos os itens IN operacionais **e** 19.0 Go‑Live Gate cumprido.
	•	Cut‑line aplicado e verificado por testes (19.6).

⸻

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
- Restore tests recorrentes + exports assinados.
- Observabilidade avançada (tracing end‑to‑end, SLOs por domínio).
- Risk engine mais sofisticado (modelos e regras dinâmicas).
- Automação de DSAR e auditorias internas periódicas.

## 07 Normative Appendices (só referência normativa)

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
- Snapshot operacional PROD/LOCAL e runbooks de custo ficam em `docs/planning_registry.md` (não-normativo).

A9) Cutover Guardrails (Store Big-Bang compatibility) — FECHADO
Guardrails normativos mínimos para cutovers destrutivos de domínio:
- Pré-condições obrigatórias:
  - janela de manutenção ativa
  - deploy freeze aplicado
  - backup/restore validados
- Gates obrigatórios pré-change:
  - `npm run gate:api-contract`
  - `npm run gate:api-ui-coverage`
  - `npm run typecheck`
  - `npm run test`
  - `npm --prefix apps/mobile test -- --runInBand`
- Fail-hard policy:
  - qualquer guardrail/gate falhado bloqueia reabertura.
- Rollback:
  - restore integral + redeploy da versão anterior + verificação de consistência pós-restore.

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
2. Entitlement issued to GUEST_EMAIL identity
3. Verification link sent
4. Identity upgraded to USER
5. Entitlement re-bound without mutation

---

---
