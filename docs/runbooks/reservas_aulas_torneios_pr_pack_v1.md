# ORYA PR Pack — Fecho Final Reservas, Aulas e Torneios (v2)

Data: 2026-02-22  
Estado: Fechado (sem decisões em aberto)  
Norma-mãe: `/Users/nuno/orya/ORYA-WebApp/docs/ssot_registry_v1.md`  
Decision IDs:
- `SSOT-2026-02-21-RESERVAS-AULAS-TORNEIOS-HARDCUT`
- `SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING`

## 1. Autoridade e supersessão
- Este documento é operativo de execução de PR.
- Qualquer conflito com o SSOT é inválido.
- Formulações históricas de “presets 60/90 rígidos + custom opt-in” para campos estão revogadas por:
  - `SUPERSEDED_BY_SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING`.

## 2. Estado por PR
- PR #1: fechado (schema/migrações/backfills/classes/trainers).
- PR #2: fechado (confirmBooking hardening, grid server-side, lock/race/conflicts).
- PR #3: fechado (PadelHub aulas `CLASS`, `ClassSeries`/`ClassSession`, `instructorId`, sync trainer-professional).
- PR #4: fechado (agenda + calendar com `CLASS_SESSION`).
- PR #5: fechado (política de durações de campos + preço por duração + UI admin/web/mobile + torneios sem regressão).
- PR #6: fechado (quality gates finais + observabilidade + runbook + SSOT + testes de paridade).

## 3. Regras normativas finais (resumo executável)
- `SLOT_STEP_MINUTES=5` mantém-se no motor interno.
- `bookingGridMinutes` por organização é obrigatório no server-side (`INVALID_START_GRID`).
- Catálogo de duração de campos é fixo: `[30,60,90,120]`.
- Organização escolhe `activeDurations` (subconjunto não vazio do catálogo).
- Em campos, `allowCustomDuration=true` é inválido (`INVALID_BOOKING_CONFIG`).
- Booking de campo sem preço para a duração pedida falha com `DURATION_NOT_PRICED`.
- `ServicePackage` não define preço de booking público para `COURT`.
- `CLASS_SESSION` é canónico na agenda e bloqueia overlaps.
- Bulk-block torneio default: `CASCADE_SAME_COURT`; override exige `reasonCode` auditável.
- Recursos com `courtId != null` continuam bloqueados no endpoint genérico (`COURT_RESOURCE_MANAGED_BY_COURT`).
- Sem feature flags; cutover hard-cut.
- Migrações forward-only; rollback só de aplicação.

## 4. PR #5 (formal)
Título: `feat(admin-bookings): field booking duration catalog 30/60/90/120 + per-service duration pricing`

### Descrição
Fecha política canónica de reservas de campos e pricing por duração por serviço, com paridade web/mobile e sem custom duration.

### Escopo validado
- `ServiceDurationPrice` no schema + migration forward-only.
- Backfill idempotente `COURT -> ServiceDurationPrice` com `--dry-run/--apply/--limit/--cursor`.
- `/api/org/[orgId]/reservas/config` com `activeDurations` subset de `[30,60,90,120]`.
- `/api/org/[orgId]/servicos/[id]/duration-prices` (GET/PUT) com validação de cobertura de durações ativas.
- `/api/servicos/[id]/calendario` e `/api/servicos/[id]/reservar` validam policy + preço por duração.
- UI admin (`settings`) com chips 30/60/90/120.
- UI web cliente (`ReservasBookingClient`) com presets da policy e preço por duração.
- UI mobile (`apps/mobile/app/service/[id]/booking.tsx`) em paridade de duração + payload.
- Sem regressão de torneios bulk-block/overrides.

### QA checklist
- [x] Config da org aceita subset de 30/60/90/120.
- [x] `allowCustomDuration=true` é recusado.
- [x] Reserva de campo recusa duração fora de subset ativo.
- [x] Reserva de campo recusa duração sem preço (`DURATION_NOT_PRICED`).
- [x] Web e mobile usam mesma policy de duração/preço.
- [x] Torneios continuam sem regressão funcional.

### Critérios de aceitação
- [x] Política de duração de campos canónica e sem ambiguidade.
- [x] Pricing por duração ativo e auditável por serviço `COURT`.
- [x] Contratos API/UI fechados e testados.

## 5. PR #6 (formal)
Título: `chore(closeout): final hardening, mobile parity tests, runbook+ssot normative close`

### Descrição
Fecha gates de qualidade, smoke, observabilidade e documentação normativa final.

### Escopo validado
- Testes policy/pricing/grid/admin/torneios/wizard/e2e/migration atualizados.
- Testes mobile de payload/policy de duração.
- `/api/padel/ops/summary` com KPIs e alertas determinísticos operacionais.
- Runbook live ops atualizado para catálogo 30/60/90/120 com subset ativo.
- SSOT atualizado com decisão `SSOT-2026-02-22-COURT-DURATION-CATALOG-PRICING`.
- Snapshot de inventário de superfície UI sincronizado.
- Calendário de torneio com drag temporal (hora) + preflight inline de conflitos (`CLASS_SESSION`/`BOOKING`/`HARD_BLOCK`).
- Paridade de tratamento de conflitos entre `Simular` e `Aplicar` no auto-schedule.
- Métricas operacionais emitidas: `autoScheduleBlockedByClassSessionCount`, `autoScheduleSkippedByBookingCount`, `scheduleWriteGatewayDecisionLatencyMs`, `matchStartingSoonSentCount`, `publicLivePayloadStreamCoverage`, `calendarConflictPreflightMismatchCount`.

### QA checklist
- [x] `npm run typecheck` verde.
- [x] `npm run typecheck:mobile` verde.
- [x] `npx vitest run tests/**/*.test.ts` verde.
- [x] testes mobile de booking policy verdes.
- [x] wizard de torneio coberto por matriz de formato.
- [x] runbook + SSOT sem contradições normativas no domínio fechado.
- [x] drag temporal com bloqueio explicado inline no calendário de torneio.
- [x] `preview/apply` devolvem razões consistentes para conflito de domínio.

### Critérios de aceitação
- [x] Paridade web/mobile fechada para reservas de campos.
- [x] Torneios/wizard validados por não-regressão.
- [x] Observabilidade e alertas operacionais ativos no contrato.

## 6. Evidence pack (local)
- Typecheck:
  - `npm run typecheck -- --pretty false` -> verde
  - `npm run typecheck:mobile` -> verde
- Testes:
  - `npx vitest run tests/**/*.test.ts` -> verde
  - `npm --prefix apps/mobile test -- --runInBand '__tests__/booking-payload.test.ts' 'features/services/__tests__/bookingPayload.test.ts' 'app/service/\\[id\\]/__tests__/bookingDurationPolicy.test.tsx'` -> verde

## 7. Cutover/rollback (link canónico)
- Runbook de execução: `/Users/nuno/orya/ORYA-WebApp/docs/runbooks/padel_live_ops_v1.md`
- Norma de decisão: `/Users/nuno/orya/ORYA-WebApp/docs/ssot_registry_v1.md` (00.10)
