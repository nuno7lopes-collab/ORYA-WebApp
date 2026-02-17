# ADR: Boundary Between Bookings and Calendar (Legacy Reservas Hygiene)

Date: 2026-02-17
Status: Accepted
Owner: Web App

## Context
The product currently has overlapping capabilities between:
- `Calendar` (`/org/[orgId]/calendar`, `/org/[orgId]/calendar/day`)
- `Bookings` / legacy `Reservas` (`/org/[orgId]/bookings*` powered by `app/org/_internal/core/(dashboard)/reservas/*`)

Main overlap today:
1. Legacy bookings dashboard still implements a full agenda grid (`week/day`, zoom, filters, slot click) in `app/org/_internal/core/(dashboard)/reservas/page.tsx`.
2. New calendar also implements operational grid and timeline in `app/org/[orgId]/calendar/_components/*`.
3. Availability is both visualized in calendar and edited in bookings, but the ownership is not explicit enough in UI copy/routing.

Evidence of duplication:
- `app/org/_internal/core/(dashboard)/reservas/page.tsx:539` (`calendarView` state)
- `app/org/_internal/core/(dashboard)/reservas/page.tsx:540` (`calendarTab` state)
- `app/org/_internal/core/(dashboard)/reservas/page.tsx:2237` (availability tab + editor inside legacy dashboard)
- `app/org/_internal/core/(dashboard)/reservas/page.tsx:2270` (legacy agenda grid)
- `app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx` (new operational week/day calendar)
- `app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx` (new operational day calendar)

## Decision
Define strict ownership boundaries.

### Calendar owns
- Operational timeline and occupancy reading (week/day).
- Aggregated occupancy and quick context (hover/click).
- Read-only visibility of availability windows.
- "General" (no-selection) consolidated operational board.

### Bookings owns
- Transactional actions and lifecycle:
  - create booking, cancel, reschedule, no-show, split, checkout, invites, delays.
- Master data and setup:
  - services, professionals, resources, customers, policies, integrations, prices.
- Availability editing (templates/overrides) as source-of-truth setup.

### Global rule
- No second timeline grid in bookings.
- No write actions in calendar.

## Target IA
- `/org/[orgId]/calendar` -> Operational week board (read-only)
- `/org/[orgId]/calendar/day` -> Operational day board (read-only)
- `/org/[orgId]/bookings` -> Services and booking operations hub (no duplicate calendar grid)
- `/org/[orgId]/bookings/availability` -> Availability editor (write)
- `/org/[orgId]/bookings/professionals` -> Professional management
- `/org/[orgId]/bookings/resources` -> Resource management
- `/org/[orgId]/bookings/customers` -> Customer search/lookup
- `/org/[orgId]/bookings/policies` -> Policy management (or `/org/[orgId]/policies?view=booking`)

## Implementation Plan

### Phase 0: Freeze and explicit ownership (1 sprint)
1. Add explicit UI copy and entry points:
- In bookings, add CTA "Open Operational Calendar" to `/calendar`.
- In calendar, keep CTA "Manage availability in Bookings".
2. Add telemetry events:
- calendar_opened_from_bookings
- bookings_opened_from_calendar
3. Add temporary feature flag:
- `NEXT_PUBLIC_BOOKINGS_LEGACY_AGENDA_ENABLED` (default `false` for new orgs).

Acceptance criteria:
- Users understand which tool is read-only operations vs write/setup.
- Product analytics can measure migration from legacy grid.

### Phase 0 progress (implemented)
1. `/org/[orgId]/bookings/availability` no longer reuses legacy monolith route; it now renders a dedicated availability setup page using `AvailabilityEditor`.
2. Availability page now supports explicit scope selection:
- General (organization)
- Professional
- Resource
3. Navigation copy updated to reinforce boundary:
- Bookings subnav: `Disponibilidade (setup)`
- Breadcrumb: `Reservas · Disponibilidade (setup)`

### Phase 1: Remove duplicate agenda from legacy bookings page (1 sprint)
1. In `app/org/_internal/core/(dashboard)/reservas/page.tsx`:
- Remove/disable legacy agenda grid and zoom controls.
- Remove `calendarTab="agenda"` branch.
- Keep booking operations panels and quick actions.
2. Keep `AvailabilityEditor` only in bookings availability route.

Acceptance criteria:
- Only one operational grid exists (Calendar app).
- Bookings no longer renders week/day agenda timeline.

### Phase 1 progress (implemented)
1. `/bookings` no longer renders duplicated timeline grid.
2. Legacy controls (`Dia/Semana` + `Zoom`) were removed from bookings dashboard.
3. Bookings now exposes operational CTA to `/calendar` plus quick booking creation entrypoint without timeline dependency.

### Phase 2: Decompose monolith bookings dashboard (2 sprints)
1. Extract feature blocks from `reservas/page.tsx` into independent page-level modules:
- booking operations panel
- service drawer/forms
- delays panel
- upcoming bookings list
2. Reduce root `/bookings` page to operations + service catalog summary.
3. Keep all write flows intact and scoped to bookings.

Acceptance criteria:
- `reservas/page.tsx` substantially reduced (<35% current size).
- No duplicated UI logic with `/calendar`.

### Phase 3: Route and naming hygiene (1 sprint)
1. Keep `/bookings/*` as canonical UI.
2. Treat `_internal/.../reservas/*` as implementation detail only.
3. Remove stale route aliases that imply duplicate tools.
4. Update breadcrumb/nav copy to reinforce boundary:
- "Calendar" = operations
- "Bookings" = setup and actions

Acceptance criteria:
- Navigation labels and breadcrumbs are unambiguous.
- No user-visible route suggests two agenda tools.

### Phase 3 progress (implemented)
1. `/bookings/prices` no longer points to legacy monolith page; it now uses dedicated services/pricing page.
2. `/bookings/integrations` no longer points to legacy monolith page; it now uses dedicated integrations setup page.
3. Breadcrumb and subnav wording now reinforce `Disponibilidade (setup)`.

### Phase 4: Legacy cleanup and hard delete (1 sprint)
1. Remove dead code paths from legacy agenda logic in bookings.
2. Delete orphan constants, handlers, and styles for old agenda implementation.
3. Add regression tests to prevent calendar UI from reappearing in bookings.

Acceptance criteria:
- Legacy duplicate agenda implementation removed from codebase.
- CI test ensures boundary contract.

### Phase 4 progress (implemented)
1. Legacy duplicated agenda code path removed from `app/org/_internal/core/(dashboard)/reservas/page.tsx`.
2. Guardrail test added: `tests/bookings/calendarBoundaryGuardrails.test.ts`.
3. Week aggregation logic extracted to dedicated helper with unit coverage (`tests/calendar/agendaAggregation.test.ts`) to lock overlap-cluster behavior.
4. Calendar UX guardrails added to block reintroduction of `Modo A/B` and `Zoom` in operational day/week clients (`tests/calendar/calendarUxGuardrails.test.ts`).
5. Day view `Geral` mode now uses overlap aggregation blocks (single slot with internal lines) backed by `buildProjectedEvents` + aggregation helper and covered by `tests/calendar/dayGeneralAggregation.test.ts`.

## API Contract Boundary
- Keep existing API namespace `/api/org/[orgId]/reservas/*` for now to avoid backend churn.
- UI contract boundary is functional, not necessarily endpoint renaming in this cycle.
- Optional future iteration: add `/api/org/[orgId]/bookings/*` aliases and migrate clients gradually.

## Risk and Mitigation
1. Risk: Staff users rely on quick actions embedded in legacy agenda.
- Mitigation: preserve write actions in bookings and add direct context links from calendar block detail to booking drawer/action pages.
2. Risk: Team confusion during migration.
- Mitigation: phased rollout + telemetry + explicit in-product copy.
3. Risk: hidden coupling in monolith page.
- Mitigation: phase-by-phase extraction with smoke tests per feature.

## Test Plan (Minimum)
1. Calendar read-only checks:
- day/week render
- no write action exposed
- hover/click detail works
2. Bookings write checks:
- create booking
- cancel/reschedule/no-show
- availability template update
- service/professional/resource CRUD
3. Access model checks:
- STAFF vs ADMIN visibility and allowed actions.

## Rollout Strategy
1. Enable Phase 1 to internal orgs first.
2. Monitor telemetry and support tickets for 7 days.
3. Roll out to all orgs.
4. Execute hard delete (Phase 4) only after stable KPI window.
