# Schema Hygiene Execution Plan

- GeneratedAtUTC: 2026-02-24T15:28:00Z
- Scope: `app_v3` + `auth`, com decisão operacional para limpeza segura
- Inputs:
  - `reports/schema_hygiene_deep_audit_2026-02-24.md`
  - `reports/schema_hygiene_table_inventory_2026-02-24.csv`
  - `reports/schema_hygiene_field_decision_seed_2026-02-24.csv`
  - `reports/schema_hygiene_columns_never_populated_2026-02-24.csv`
  - `reports/schema_hygiene_table_overlap_candidates_2026-02-24.csv`

## Estado factual consolidado

- `out` schema: inexistente (confirmado no snapshot live).
- `app_v3`: 231 tabelas.
- `auth`: 20 tabelas.
- Migração pendente: `20260224143500_padel_result_validation_mode_enum_alignment`.
- Hardening runtime concluído em 2026-02-24:
  - removido fallback `supabase.from("profiles")` em `/api/me`, `/api/public/profile`, `/api/public/profile/events`;
  - ficou 1 uso runtime residual em job interno: `app/api/cron/repair-usernames/route.ts`.

## Decisão por campo (seed)

- `KEEP`: 1214
- `KEEP_KEY`: 737
- `KEEP_PENDING`: 842
- `REVIEW_COLUMN`: 100
- `REVIEW_TABLE_COLUMN`: 60

Notas:
- `REVIEW_TABLE_COLUMN` = campos de tabelas sem uso runtime e sem dados (candidatos fortes a descontinuação completa de tabela).
- `REVIEW_COLUMN` = campos sempre nulos em tabelas com dados (requer validação funcional antes de drop).

## Faseamento de higienização

### Fase 0 (já feito)

- Remover dependência runtime do schema não exposto via PostgREST (`profiles` em `app_v3`).
- Validação:
  - `npx vitest run tests/profiles/publicProfileSelfFallbackRoute.test.ts` -> PASS
  - `npx eslint app/api/me/route.ts app/api/public/profile/route.ts app/api/public/profile/events/route.ts tests/profiles/publicProfileSelfFallbackRoute.test.ts` -> PASS

### Fase 1 (tabelas candidatas a descontinuação)

Tabelas com `REVIEW_TABLE_COLUMN` (60 colunas em 7 tabelas):

- `padel_partnership_tournament_requests` (18 colunas)
- `chat_conversation_attachments` (10 colunas)
- `crm_journey_enrollments` (9 colunas)
- `crm_journey_runs` (8 colunas)
- `refund_policy_versions` (6 colunas)
- `store_order_bundle_items` (5 colunas)
- `ticket_order_lines` (4 colunas)

Gates obrigatórios antes de DDL:

1. owner funcional aprova (`KEEP` ou `DROP`);
2. confirmação de não uso indireto por relações Prisma/nested writes;
3. snapshot de backup lógico por tabela;
4. migração de remoção com rollback explícito.

### Fase 2 (colunas sempre nulas em tabelas com dados)

- `REVIEW_COLUMN`: 100 colunas, 42 tabelas.
- Hotspots prioritários:
  - `padel_pairings` (10)
  - `bookings` (8)
  - `profiles` (7)
  - `outbox_events` (6)
  - `operations` (5)
  - `padel_tournament_configs` (5)

Critério de decisão por coluna:

1. campo sem leitura nem escrita efectiva no runtime;
2. sem papel contratual em API pública;
3. sem dependência em ETL/reporting externo;
4. sem plano activo de feature flag que o reative.

### Fase 3 (redundância estrutural)

Pares com overlap elevado (shape):

- `padel_registrations` <-> `ticket_orders` (0.90)
- `organization_member_invites` <-> `padel_team_member_invites` (0.88)
- `crm_contact_consents` <-> `user_consents` (0.85)
- `organization_group_owner_transfers` <-> `organization_owner_transfers` (0.83)

Acção:

- decidir tabela canónica por domínio;
- bloquear novas writes na tabela secundária;
- migrar leituras e dados;
- remover secundária só após 1 ciclo de release sem regressão.

### Fase 4 (fecho de migrações e histórico)

1. aplicar/fechar a migração pendente de enum;
2. confirmar que não existem tipos/artefactos legacy sem uso;
3. actualizar baseline (`schema_baseline`, `schema_diff_matrix`, `auth_schema_audit`);
4. repetir smoke de schema hygiene.

## Riscos e mitigação

- Risco de falso positivo em “runtime unreferenced” por uso relacional indirecto.
  - Mitigação: validação manual por owner + testes de integração.
- Risco de quebrar contratos JSON por remoção de colunas retornadas.
  - Mitigação: depreciação em 2 passos (write-off primeiro, drop depois).
- Risco de drift entre código e DB por migração pendente.
  - Mitigação: fechar pipeline de migrações antes dos drops estruturais.

## Resultado esperado após execução completa

- schema `app_v3` sem tabelas/campos mortos;
- eliminação de redundâncias funcionais aprovadas;
- runtime sem fallback legacy para tabelas não expostas no PostgREST;
- baseline e migrações alinhados com o estado real da BD.
