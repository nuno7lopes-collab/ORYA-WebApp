# Politicas de Organizacao - Documento Fechado (2026-02-14)

## 1) Estado
- Estado de produto: FECHADO.
- Estado de decisao: FECHADO.
- Escopo: politicas obrigatorias, politicas personalizaveis, defaults, guardrails e regras de enforcement para Organizacoes.
- Regra de autoridade: este documento fecha a camada de politica; implementacao e SSOT devem alinhar com este contrato.

## 2) Principios Normativos
- Fail-closed: quando faltar pre-condicao critica, a operacao bloqueia.
- Least privilege: mudancas de politica exigem modulo ativo + RBAC + gates de organizacao.
- Snapshot imutavel: reservas confirmadas operam com snapshot versionado, nunca com leitura retroativa mutavel.
- Determinismo: defaults explicitos por dominio, sem inferencia ambigua.
- Auditabilidade: toda mudanca de politica relevante gera trilha de auditoria.

## 3) Politicas Obrigatorias (Hard Policies)

### HP-01) Gate de email oficial verificado
- Regra: acoes de escrita sensiveis exigem `officialEmail` + `officialEmailVerifiedAt`.
- Default: bloqueado ate verificacao.
- Guardrail: retorna `OFFICIAL_EMAIL_REQUIRED` ou `OFFICIAL_EMAIL_NOT_VERIFIED`.
- Enforcement: `lib/organizationWriteAccess.ts`, rotas de reservas/checkin/payouts/loja/crm/loyalty e permissoes.

### HP-02) Kill-switch por estado da organizacao
- Regra: `Organization.status = SUSPENDED` bloqueia operacoes sensiveis.
- Default: bloqueado em modo suspenso.
- Guardrail: `KILL_SWITCH_ACTIVE`.
- Enforcement: `ensureOrganizationWriteAccess`.

### HP-03) Invariante `orgType -> payoutMode`
- Regra: `PLATFORM => PayoutMode.PLATFORM`; `EXTERNAL => PayoutMode.ORGANIZATION`.
- Default: nao configuravel por org.
- Guardrail: `INVALID_PAYOUT_MODE`.
- Enforcement: `domain/finance/payoutModePolicy.ts`, admin payments mode update.

### HP-04) Gate de pagamentos para vendas pagas
- Regra: vendas pagas exigem email oficial verificado; Stripe obrigatorio para `EXTERNAL`.
- Default: bloqueado ate readiness.
- Guardrail: `PAYMENTS_NOT_READY`.
- Enforcement: `lib/organizationPayments.ts`, `lib/store/publicPaymentsGate.ts`, fluxos de checkout/reservas/loja.

### HP-05) Modulo ativo + RBAC para qualquer acao de dominio
- Regra: sem modulo ativo ou sem permissao efetiva, acao e negada.
- Default: deny-by-default.
- Guardrail: erro de permissao (`FORBIDDEN`/equivalente).
- Enforcement: `lib/organizationModules.ts`, `lib/organizationMemberAccess.ts`, `lib/organizationRbac.ts`.

### HP-06) Snapshot obrigatorio para alteracoes em reservas confirmadas
- Regra: cancel/reschedule/no-show de `CONFIRMED` exige confirmation snapshot valido.
- Default: bloqueio se snapshot ausente.
- Guardrail: `BOOKING_CONFIRMATION_SNAPSHOT_REQUIRED`.
- Enforcement: rotas de cancelamento/reagendamento/no-show + `lib/reservas/confirmationSnapshot.ts`.

### HP-07) Lock de policy de acesso de evento apos uso/pagamento
- Regra: quando ha entitlement/checkin/pagamento, nao pode tornar politica mais restritiva.
- Default: lock ativo apos eventos de consumo.
- Guardrail: `ACCESS_POLICY_LOCKED:<VIOLATION>`.
- Enforcement: `lib/checkin/accessPolicy.ts`.

### HP-08) Check-in protegido por janela temporal
- Regra: default abre 6h antes e fecha 6h apos fim (ou +24h apos inicio sem fim).
- Default: fora da janela bloqueia check-in.
- Guardrail: `OUTSIDE_WINDOW`.
- Enforcement: `lib/checkin/policy.ts`, `app/api/organizacao/checkin/route.ts`, `preview`.

### HP-09) Endereco canonico em fluxos criticos
- Regra: endereco usado em criacao/operacao critica deve ser `APPLE_MAPS`.
- Default: endereco invalido bloqueia.
- Guardrail: `INVALID_ADDRESS`/erros de validacao.
- Enforcement: criacao org, reservas e servicos.

### HP-10) Mutacoes de parcerias Padel com ownership estrito
- Regra: janelas/grants sao mutaveis apenas pelo owner-side da parceria.
- Default: partner-side sem poder de mutacao.
- Guardrail: `FORBIDDEN_OWNER_ONLY`.
- Enforcement: rotas de agreements/windows/grants.

## 4) Politicas Personalizaveis (com Defaults e Guardrails)

### 4.1 Reservas (`OrganizationPolicy`)
- Campos:
- `policyType`: `FLEXIBLE|MODERATE|RIGID|CUSTOM`.
- `allowCancellation` default `true`.
- `cancellationWindowMinutes` default por seed.
- `cancellationPenaltyBps` default `0`, range `[0..10000]`.
- `allowReschedule` default `true`.
- `rescheduleWindowMinutes` default = cancellation window quando nao definido.
- `guestBookingAllowed` default `false`.
- `noShowFeeCents` default `0`.
- Defaults obrigatorios por org na bootstrap:
- `Flexivel`: 1440 min.
- `Moderada`: 2880 min.
- `Rigida`: 4320 min.
- Guardrails atuais:
- janelas `>= 0` (ou `null`).
- penalty bps clamp `[0..10000]`.
- delete permitido apenas para `CUSTOM` e sem referencias (`bookingPolicyRefs`/`services`).
- Decisao fechada:
- `guestBookingAllowed` e `noShowFeeCents` sao politicas de 1a classe e devem ser editaveis no mesmo endpoint de policies.
- criar policy (`POST`) deve usar o mesmo email gate de `GET/PATCH/DELETE`.

### 4.2 Assignment mode da organizacao
- Campo: `reservationAssignmentMode` em `Organization`.
- Valores: `PROFESSIONAL|RESOURCE`.
- Default: `PROFESSIONAL`.
- Guardrail: servicos nao-court nao podem operar em `RESOURCE`.
- Enforcement: `resolveServiceAssignmentMode` + bloqueio `RESOURCE_MODE_NOT_ALLOWED`.

### 4.3 CRM policy (`CrmOrganizationPolicy`)
- Campos/defaults:
- `timezone` default `Europe/Lisbon`.
- `quietHoursStartMinute` default `1320`.
- `quietHoursEndMinute` default `480`.
- `capPerDay` default `1`.
- `capPerWeek` default `4`.
- `capPerMonth` default `10`.
- `approvalEscalationHours` default `24`.
- `approvalExpireHours` default `48`.
- Guardrails:
- quiet hours `[0..1439]`.
- caps: day `[0..100]`, week `[capDay..500]`, month `[capWeek..3000]`.
- approval: escalation `[1..168]`, expiry `[escalation..336]`.
- envio: `MAX_RECIPIENTS=1000`, `MAX_CAMPAIGNS_PER_DAY=5`, bloqueio em quiet hours.
- aprovacao: apenas `OWNER|CO_OWNER|ADMIN`.

### 4.4 Loyalty policy
- Programa:
- status default `ACTIVE`.
- nome default `Pontos ORYA`.
- `pointsName` default `Pontos`.
- `pointsExpiryDays` `null` quando `<1`.
- Guardrails de regras:
- `points` `[1..5000]`.
- `maxPointsPerDay <= 20000`.
- `maxPointsPerUser <= 200000`.
- Guardrails de recompensas:
- `pointsCost` `[100..500000]`.
- Gate: alteracoes exigem modulo CRM + email oficial verificado.

### 4.5 Event access policy (`EventAccessPolicy`)
- Defaults de resolucao:
- mode default `UNLISTED`.
- invite token default ativo apenas para `INVITE_ONLY`.
- invite TTL default `7 dias` (`604800s`) quando aplicavel.
- checkin method default: `QR_REGISTRATION` para padel, `QR_TICKET` para restantes.
- defaults de normalizacao:
- `scannerRequired=false`, `allowReentry=false`, `reentryWindowMinutes=15`, `maxEntries=1`, `undoWindowMinutes=10`.
- Guardrails:
- invite token exige TTL.
- invite token nao permite `inviteIdentityMatch=USERNAME`.
- em padel, `requiresEntitlementForEntry=true` forcado.
- lock anti-restricao apos consumo/pagamento.

### 4.6 Store policy
- Defaults na criacao da store:
- `status=CLOSED`.
- `catalogLocked=true`.
- `checkoutEnabled=false`.
- `showOnProfile=false`.
- `currency=EUR`.
- Campos customizaveis de politica textual:
- `returnPolicy`, `privacyPolicy`, `termsUrl`, `supportEmail`, `supportPhone`.
- Guardrails:
- max chars policy `2000`.
- max chars suporte `120`.
- validacao de email/URL.
- ativacao publica/checkouts depende de payments gate.

### 4.7 Padel partnership booking policy
- Defaults:
- `priorityMode=FIRST_CONFIRMED_WITH_OWNER_OVERRIDE`.
- `ownerOverrideAllowed=true`.
- `ownerOverrideRequiresAudit=true`.
- `autoCompensationOnOverride=true`.
- `protectExternalReservations=true`.
- `hardStopMinutesBeforeBooking=30`.
- Guardrails:
- `hardStopMinutesBeforeBooking >= 0`.
- janela: `startMinute/endMinute` clamp `[0..1440]` e `end > start`.
- `weekdayMask` clamp `[0..127]`.
- `capacityParallelSlots >= 1`.
- grants com janela valida e sem overlap.

### 4.8 Taxa/plataforma na organizacao
- Campos: `feeMode`, `platformFeeBps`, `platformFeeFixedCents`.
- Defaults de schema: `ADDED`, `200`, `0`.
- Guardrails atuais de endpoint de settings:
- `feeMode` bloqueado a `INCLUDED` (`FEE_MODE_LOCKED` para restante).
- `platformFeeBps` range `[0..5000]`.
- `platformFeeFixedCents` range `[0..5000]`.
- Decisao fechada:
- manter lock de `feeMode` em `INCLUDED` ate existir rollout de pricing por tenant com migracao e simulador.

## 5) Guardrails Operacionais Fechados
- `PENDING_HOLD_MINUTES = 10` para pre-reservas.
- Grelha temporal de reservas: 15 minutos.
- `MAX_INVITES = 20` por reserva.
- Delay operacional maximo: `MAX_DELAY_MINUTES = 480`.
- Check-in rate limit: `300 req/min` por utilizador (`checkin` e `preview`).
- No-show apenas apos inicio da reserva.
- Cancelamento por organizacao permitido ate ao inicio da reserva; apos inicio bloqueia.

## 6) Decisoes de Fecho para Alinhamento de Implementacao

### DF-01) Uniformizar email gate em policies
- Decisao: `POST /api/organizacao/policies` passa a exigir `ensureOrganizationEmailVerified`.
- Motivo: consistencia com `GET/PATCH/DELETE` e com regra HP-01.

### DF-02) Completar surface de policy de reservas
- Decisao: endpoints de policies devem ler/escrever tambem `guestBookingAllowed` e `noShowFeeCents`.
- Motivo: campos ja existem no modelo e no snapshot; faltam no contrato API atual.

### DF-03) Reagendamento da organizacao deixa de ser hardcoded
- Decisao: substituir janela fixa `T-4h` por policy explicita.
- Regra fechada: nova policy `orgRescheduleWindowMinutes` default `240` para manter backward behavior.

### DF-04) Criacao de organizacao e status inicial
- Decisao: self-service (`createOrganizationAtomic`) permanece `ACTIVE` no momento de criacao.
- Regra fechada: `PENDING` fica reservado para fluxos administrativos/manual review.

### DF-05) Snapshot fail-closed mantem-se
- Decisao: nao existe fallback permissivo para reservas confirmadas sem snapshot.
- Regra fechada: manter bloqueio e usar backfill/migracao.

## 7) Matriz Final (Obrigatorio vs Personalizavel)
- Obrigatorio (nao customizavel por org): email gate, kill-switch, invariante orgType->payout, payments gate estrutural, modulo+RBAC, snapshot fail-closed, lock de event access apos consumo.
- Personalizavel (com clamp/guardrail): reservas (`OrganizationPolicy`), assignment mode, CRM config, loyalty rules/rewards, event access policy, store settings, parceria padel booking policy, fee bps/fixed (com lock de feeMode).

## 8) Evidencia Tecnica (fontes)
- `prisma/schema.prisma`
- `lib/organizationWriteAccess.ts`
- `lib/organizationPayments.ts`
- `domain/finance/payoutModePolicy.ts`
- `lib/organizationPolicies.ts`
- `app/api/organizacao/policies/route.ts`
- `app/api/organizacao/policies/[id]/route.ts`
- `lib/reservas/confirmationSnapshot.ts`
- `app/api/organizacao/reservas/[id]/cancel/route.ts`
- `app/api/organizacao/reservas/[id]/reschedule/route.ts`
- `app/api/organizacao/reservas/[id]/no-show/route.ts`
- `app/api/servicos/[id]/reservar/route.ts`
- `lib/crm/policy.ts`
- `lib/crm/campaignApproval.ts`
- `lib/crm/campaignSend.ts`
- `lib/loyalty/guardrails.ts`
- `app/api/organizacao/loyalty/programa/route.ts`
- `app/api/organizacao/loyalty/regras/route.ts`
- `app/api/organizacao/loyalty/recompensas/route.ts`
- `lib/checkin/accessPolicy.ts`
- `lib/events/accessPolicy.ts`
- `lib/checkin/policy.ts`
- `app/api/organizacao/checkin/route.ts`
- `app/api/organizacao/checkin/preview/route.ts`
- `lib/organizationCategories.ts`
- `lib/organizationRbac.ts`
- `lib/organizationRolePackPolicy.ts`
- `app/api/organizacao/organizations/members/permissions/route.ts`
- `app/api/org/[orgId]/store/route.ts`
- `app/api/org/[orgId]/store/settings/route.ts`
- `lib/store/publicPaymentsGate.ts`
- `app/api/organizacao/payouts/settings/route.ts`
- `app/api/admin/organizacoes/update-payments-mode/route.ts`
- `app/api/padel/partnerships/agreements/route.ts`
- `app/api/padel/partnerships/agreements/[id]/windows/route.ts`
- `app/api/padel/partnerships/agreements/[id]/grants/route.ts`
- `domain/padel/partnershipSchedulePolicy.ts`

## 9) Resultado
- Contrato de politicas de organizacao fechado.
- Defaults e guardrails fechados.
- Backlog de alinhamento fechado nas decisoes DF-01..DF-05.
