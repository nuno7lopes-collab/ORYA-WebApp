# Auditoria profunda — criação de utilizadores, empresas, eventos, torneios, grupos e reservas

Data: 2026-02-24

## Âmbito analisado
- Criação/autenticação de utilizadores (signup/login/bootstrap)
- Criação de organização/empresa
- Governança de grupos, dashboard de grupos e associação org<->grupo
- Criação de eventos
- Criação de torneios (padel)
- Criação de equipas de grupo/torneio
- Criação de serviços, aulas de padel, treinadores e reservas
- Inventário de scripts antigos

## Metodologia
- Leitura dos endpoints e domínio principal (`app/api/**`, `lib/**`, `prisma/schema.prisma`)
- Verificação da cobertura de testes por domínio
- Matriz de referências de scripts (`package.json` + referências no repositório)

## Estado por domínio

### 1) Utilizadores, signup, login e bootstrap
Estado: **bom**, com um gap de cobertura.

Pontos fortes:
- `POST /api/auth/login` suporta email e `@username` com resolução por `global_usernames`.
- `POST /api/auth/send-otp` aplica rate limit e valida username.
- `POST /api/auth/bootstrap` inicializa/sincroniza perfil e aplica `pending_username` com `global_usernames`.

Gap real:
- Há testes para `login` e `send-otp`, mas **não há teste dedicado para `auth/bootstrap`** (ponto crítico porque é onde acontece o sync de perfil/username).

### 2) Criação de organização/empresa
Estado: **bom e coerente**.

Pontos fortes:
- Fluxo oficial via `POST /api/org-hub/organizations` + `createOrganizationAtomic`.
- Criação atómica de org + grupo/membership + módulos + `global_usernames`.
- Validação de email verificado, website e morada (Apple Maps).

Risco residual:
- Fluxo depende fortemente da consistência de `global_usernames`; drift manual pode afetar UX de username.

### 3) Grupos, governança e dashboard de grupos
Estado: **arquitetura robusta**, cobertura parcial no dashboard.

Pontos fortes:
- Join/exit/owner transfer com códigos, email tokens, lockout e outbox.
- Invariantes de governança aplicadas.

Gap real:
- Cobertura de testes do dashboard de grupo foca agenda (`groupDashboardAgendaRoute.test.ts`), mas **não cobre de forma equivalente os restantes painéis** (finance/crm/reservas/rankings).

### 4) Eventos
Estado: **bom**.

Pontos fortes:
- Criação com validações fortes (onboarding, módulo, permissões, morada, schedule).
- Proteções de payout/pricing e integração com outbox/search index.

### 5) Torneios (padel)
Estado: **muito bom**.

Pontos fortes:
- Fluxo de criação robusto com validação de clube/courts/categorias/staff/formatos.
- Ecossistema padel com cobertura de testes muito ampla (100 ficheiros em `tests/padel`).

### 6) Equipas de grupos/torneios
Estado: **funcional**, com gap de teste direto.

Pontos fortes:
- Endpoints de convites e entries existem e têm testes.

Gap real:
- **Sem teste direto dedicado ao CRUD base de `POST/GET /api/padel/teams`** (há testes para invites/entries, não para todo o fluxo CRUD base).

### 7) Aulas de padel, treinadores e reservas
Estado: **bom**.

Pontos fortes:
- Serviços/reservas com validações detalhadas de assignment mode, durations, políticas e conflitos.
- Modelos para `ReservationProfessional`, `TrainerProfile`, `ClassSeries`, `ClassSession` e `Booking` bem integrados.

## Cobertura de testes (inventário rápido)
- Auth: 2
- RBAC/Group/Org-hub: 19
- Events: 5
- Tournaments: 5
- Reservas: 6
- Agenda: 22
- Bookings: 7
- Org: 9
- Padel: 100

## Achados prioritários (não está “perfeito”)
1. P1 — Falta de teste dedicado a `POST /api/auth/bootstrap` (sync profile + username).
2. P1 — Dashboard de grupos sem cobertura equivalente em todos os submódulos (só agenda está validado de forma explícita).
3. P2 — Falta de teste direto para CRUD base de `POST/GET /api/padel/teams`.
4. P2 — Sprawl de scripts legados (45 sem referências internas).

## Scripts legados removidos nesta intervenção (fase 1)
Total removido: 44

- audit-reserved-usernames.ts
- audit_db_stats.mjs
- audit_event_access_policy.ts
- audit_schema_drift.mjs
- backfillSaleSummaries.js
- backfillStripeFees.js
- backfill_agenda_scopes.ts
- backfill_booking_confirmation_snapshot.ts
- backfill_court_duration_prices.ts
- backfill_event_access_policy.ts
- backfill_event_payout_mode_non_platform.ts
- backfill_interest_tags.js
- backfill_services_aulas_to_class.ts
- backfill_trainer_professional_links.ts
- check-slug.js
- check_tournament_event_id.js
- cleanup_non_court_booking_resources.js
- cleanup_orphan_entitlements.ts
- cleanup_unverified_org_data.js
- debug-prisma-delegates.js
- diagnoseTournamentsMissingEventId.js
- export-repo-core-onepdf.mjs
- hard-delete-user.ts
- infra-mode.sh
- padel_cleanup.ts
- padel_dedupe_org_user_profiles.ts
- purge-reserved-usernames.ts
- purge_events_data.js
- purge_padel_total.js
- rebuild_agenda.js
- rebuild_search_index.js
- register-server-only.cjs
- render-taskdef.py
- resolve_organization_usernames.ts
- run-axe.sh
- run-devicefarm.sh
- run-e2e-p1-manual.js
- run-e2e-p1.sh
- run-lighthouse.sh
- run-migrations.sh
- runtime_outbox_smoke.js
- seed_matosinhos_migration.ts
- setup-localhost-aliases.sh
- test-with-mocks.sh

## Recomendação de limpeza
- Fase 1 (baixo risco): concluída nesta intervenção.
- Fase 2 (risco médio): **concluída** com whitelist explícita por ambiente + gate automático.
- Fase 3 (governança total): **concluída** com catálogo obrigatório (owner + runbook + comando npm) e gate dedicado.

## Entregáveis implementados nesta intervenção
- Hard-cut posterior: scripts de criação legados removidos
- `scripts/manifests/operational_scripts_allowlist_v1.json` (allowlist operacional por ambiente)
- `scripts/operational_scripts_allowlist_gate.mjs` (validação automática da allowlist)
- `scripts/manifests/operational_scripts_catalog_v1.json` (catálogo obrigatório por script)
- `scripts/operational_scripts_catalog_gate.mjs` (gate de conformidade do catálogo)
- `docs/runbooks/scripts_operacionais_catalogo_v1.md` (runbook central dos scripts operacionais)
- `package.json` com comandos:
  - `npm run gate:scripts-ops`
  - `npm run gate:scripts-catalog`

## Gaps de qualidade fechados nesta intervenção
- Testes dedicados para `POST /api/auth/bootstrap`:
  - `tests/auth/bootstrapRoute.test.ts`
- Cobertura adicional do dashboard de grupos (além de agenda):
  - `tests/rbac/groupDashboardModulesRoute.test.ts` (finance, crm, reservas, rankings)
- Cobertura CRUD base de equipas em padel:
  - `tests/padel/teamsRoute.test.ts` (GET/POST)

## Validacao E2E (dev) de scripts novos (historico antes do hard-cut)
- Execucao validada em 2026-02-24:
  - fluxo de criação de utilizador (comando legado, entretanto removido)
  - fluxo de criação de empresa + seeds (comando legado, entretanto removido)
- Login confirmado com credenciais do utilizador criado (`signInWithPassword` Supabase).
- Owner e associacao confirmados em base de dados:
  - `Organization.groupId` e `OrganizationGroup.ownerUserId` coerentes com o user criado.
  - `OrganizationGroupMember` do owner presente no grupo (com `scopeAllOrgs=true`).
- Modulos e seeds confirmados:
  - Modulos esperados ativos no `organizationModuleEntry`.
  - Seeds observados: eventos/torneios/servicos/reservas/equipas.
- Artefactos da validacao:
  - `/tmp/orya_e2e/user_create_1771942884_367d9cdd.json`
  - `/tmp/orya_e2e/company_create_1771942884_367d9cdd.json`
  - `/tmp/orya_e2e/meta_1771942884_367d9cdd.txt`
  - `/tmp/orya_e2e/validation_1771942884_367d9cdd.json`

### Nota de higiene de schema dev
- Durante a validacao foi encontrado drift de enum em dev para `result_validation_mode` de `padel_tournament_configs`.
- O alinhamento ficou formalizado em migration idempotente:
  - `prisma/migrations/20260224143500_padel_result_validation_mode_enum_alignment/migration.sql`
- Dry-run SQL da migration em dev: `MIGRATION_SQL_DRY_RUN_OK` (executada com `ROLLBACK`).
