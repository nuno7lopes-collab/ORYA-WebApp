# Bookings x Calendar Hygiene Plan (Deep)

Date: 2026-02-17
Owner: Web App
Scope: Eliminate duplicated calendar capabilities between `Calendar` and legacy `Reservas`.

## Product Boundary (Final)

### Calendar tool owns
- Operational reading board (day/week).
- Aggregated occupancy blocks (overlap cluster -> one block).
- General board when no professional/resource is selected.
- Availability window visualization (read-only, including weekday defaults).

### Bookings tool owns
- Setup and write actions:
  - services, professionals, resources, customers, policies, integrations, prices.
  - booking lifecycle actions (create/cancel/reschedule/no-show/split/checkout).
  - availability configuration (templates + overrides).

### Non-overlap rules
- Calendar does not expose write actions.
- Bookings does not render an operational day/week timeline grid.
- Any availability write flow starts in `/bookings/availability`.

## UX Contract

1. `Calendar` is the operational board.
2. `Bookings` is setup for services/catalog.
3. `bookings/operations` is transaction control.
4. `bookings/availability` is a setup editor, not a second agenda.
5. Default availability:
- Mon-Fri: open by default (08:00-17:00 unless policy changes).
- Sat/Sun: closed by default.
- Org default is the baseline; professional/resource can narrow or override.

## Execution Plan

### Phase A (completed now)
- Isolated `/bookings/availability` from legacy monolith.
- Added explicit scope selection (General/Professional/Resource) in availability page.
- Updated nav language to `Disponibilidade (setup)`.

### Phase B (1 sprint)
- Remove legacy agenda controls from `reservas/page.tsx`:
  - day/week switch
  - zoom
  - duplicated timeline grid
- Keep operational CTA to `/calendar`.
- Preserve write modules (drawers/actions/panels).

Acceptance:
- Only `Calendar` renders timeline grid.
- No regression in booking lifecycle actions.

Status update:
- Implemented with hard cut in `/bookings`: duplicated timeline removed.
- `Dia/Semana` and `Zoom` controls removed from bookings dashboard.
- Quick booking creation remains available through `Nova reserva` action (without legacy timeline dependency).

### Phase C (2 sprints)
- Split `reservas/page.tsx` into smaller modules:
  - booking-actions-panel
  - service-management-panel
  - delays-panel
  - upcoming-list
- Keep `/bookings` as services hub and `/bookings/operations` as operations hub, both without duplicated timeline.

Acceptance:
- `reservas/page.tsx` reduced substantially.
- Ownership boundary preserved by structure.

### Phase D (1 sprint)
- Replace remaining monolith-backed wrappers:
  - `/bookings/prices`
  - `/bookings/integrations`
- Move each to dedicated page entry components.

Acceptance:
- `/bookings/*` routes are explicit and single-purpose.
- No route relies on "tab switching inside monolith" for core UX.

Status update:
- `/bookings/prices` now points to dedicated services/pricing page.
- `/bookings/integrations` now points to dedicated integrations setup page.

### Phase E (1 sprint)
- Hard delete dead agenda code from legacy reservas.
- Add guardrail tests:
  - fail build if legacy timeline classes/components reappear in `/bookings`.

Acceptance:
- No duplicate agenda implementation remains.

Status update:
- Hard delete completed in `app/org/_internal/core/(dashboard)/reservas/page.tsx`.
- Guardrail test added in `tests/bookings/calendarBoundaryGuardrails.test.ts`.
- Week overlap aggregation extracted to reusable helper `app/org/[orgId]/calendar/_components/week/aggregation.ts`.
- Aggregation behavior locked by unit tests in `tests/calendar/agendaAggregation.test.ts`.
- Operational day/week UX guardrails added in `tests/calendar/calendarUxGuardrails.test.ts`.
- Day `Geral` mode now renders aggregated overlap blocks with internal occupancy lines (clickable for right-panel detail), covered by `tests/calendar/dayGeneralAggregation.test.ts`.

## Technical Checklist (per PR)

1. Routing:
- Canonical route remains `/org/[orgId]/...`.
- No re-export from monolith when a dedicated page exists.

2. Navigation:
- Subnav and breadcrumb labels match ownership semantics.

3. Telemetry:
- `calendar_opened_from_bookings`
- `bookings_opened_from_calendar`
- `availability_scope_changed`

4. Tests:
- Calendar read-only checks.
- Bookings write/setup checks.
- Scope-based availability editing checks.

## Risks and Mitigations

1. Risk: users depend on legacy agenda for slot-based create flow.
- Mitigation: ship dedicated booking-create flow before hard delete of legacy timeline.

2. Risk: mixed mental model between tools.
- Mitigation: explicit CTA copy and route naming across topbar, subnav, breadcrumbs.

3. Risk: hidden coupling in monolith.
- Mitigation: phase-by-phase extraction and smoke tests at each step.

## confirmBooking algorithm v2 (Normativo)

Ordem obrigatória de execução em `confirmPendingBooking`:

1. Ler booking pendente e validar módulo/estado.
2. Adquirir lock transaccional por organização:
- `pg_advisory_xact_lock(hashtext('booking:<orgId>'))`
3. Resolver policy de reserva por organização:
- `bookingGridMinutes` (default `30`)
- `durationCatalog` canónico `[30,60,90,120]`
- `activeDurations` como subset ativo da organização (default `[60,90]`)
- em campos, `allowCustomDuration` é sempre `false` (hard-cut)
4. Validar `startsAt` contra grid por timezone org (`INVALID_START_GRID`).
5. Validar `durationMinutes` contra policy (`INVALID_DURATION_POLICY`).
6. Resolver `candidateScopes` conforme assignment mode:
- `PROFESSIONAL` -> profissionais elegíveis
- `RESOURCE` -> recursos elegíveis
- `HYBRID` -> pares profissional+recurso
7. Carregar disponibilidade canónica:
- schedules
- weekly templates
- date overrides
8. Carregar conflitos ativos no intervalo:
- bookings ativos (confirmados e pendentes válidos)
- `ClassSession` (`status=SCHEDULED`) para modos com profissional
9. Construir blocos e avaliar slot com resolução interna `SLOT_STEP_MINUTES=5`.
10. Aplicar `evaluateCandidate` para decisão final de conflito.
11. Confirmar booking, gravar snapshot e atividade do utilizador.

Regra operacional:
- `ClassSession` é bloqueio efetivo de reserva; overlap devolve `SLOT_TAKEN`.
