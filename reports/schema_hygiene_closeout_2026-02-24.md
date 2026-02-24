# Schema Hygiene Closeout (2026-02-24)

- GeneratedAtUTC: 2026-02-24T16:35:37Z
- Scope: `app_v3`, `auth`, validação explícita de `out`

## Fecho desta fase (executado)

1. Migração pendente aplicada:
   - `20260224143500_padel_result_validation_mode_enum_alignment`
2. Remoção de tabelas legacy sem uso runtime confirmado:
   - `app_v3.crm_journey_enrollments`
   - `app_v3.crm_journey_runs`
   - `app_v3.refund_policy_versions`
   - `app_v3.ticket_orders`
   - `app_v3.ticket_order_lines`
3. Limpeza de enums órfãos associadas:
   - `app_v3.CrmJourneyEnrollmentStatus`
   - `app_v3.CrmJourneyRunStatus`
   - `app_v3.RefundFeePayer`
   - `app_v3.TicketOrderStatus`
4. Migração adicional aplicada:
   - `20260224162000_schema_hygiene_drop_legacy_ticket_orders_v1`
5. Hardening runtime:
   - removido fallback `supabase.from("profiles")` em:
     - `app/api/me/route.ts`
     - `app/api/public/profile/route.ts`
     - `app/api/public/profile/events/route.ts`
   - residual intencional apenas em job interno:
     - `app/api/cron/repair-usernames/route.ts`
6. Correção de regressão nesta ronda:
   - `ChatConversationAttachment` reposto em `lib/envModels.ts` para manter isolamento por `env`.
7. Refactor de compatibilidade para remover legado `TicketOrder`:
   - `domain/finance/fulfillment.ts` passa a emitir entitlements a partir de `sale_summaries` + `sale_lines`;
   - `domain/finance/checkout.ts` exige `resolvedSnapshot` para `SourceType.TICKET_ORDER`;
   - `lib/checkin/accessPolicy.ts` deixa de depender de `ticket_orders` e usa `tickets` como lock signal.

## Estado final confirmado (live DB)

- `out` schema: inexistente.
- tabelas:
  - `app_v3`: 226
  - `auth`: 20
- tabelas removidas nesta fase: não existem no catálogo.
- enums removidos nesta fase: não existem no catálogo.
- migrações: `Database schema is up to date` (`npx prisma migrate status`).

## Tabelas revistas e mantidas (ativas)

- `chat_conversation_attachments`
  - usada por handlers de mensagens (`attachments: true` em múltiplas rotas de chat).
- `store_order_addresses`
  - usada em checkout/faturas/lookup e contém dados (`40` rows).
- `store_order_bundle_items`
  - escrita runtime via nested create no checkout de loja.
- `padel_partnership_tournament_requests`
  - rotas ativas de partnerships dependem da tabela (com fallback controlado se ausente).

## Validações executadas

- `npx prisma migrate status` -> OK
- `node -r ./scripts/load-env.js scripts/run-ts.cjs scripts/verify_schema_hygiene_smoke.ts` -> OK
- `npx eslint lib/envModels.ts` -> OK
- `npx vitest run tests/checkin/policyLock.test.ts tests/finance/fulfillment.test.ts tests/finance/checkout.test.ts` -> OK

## Backlog imediato (fase seguinte)

1. Monitorização da watchlist `WATCHLIST_DEV` (agora com 5 colunas) sem DDL destrutivo.
2. Revisão dos pares de redundância estrutural (overlap alto) antes de qualquer merge/drop.

## Nota Dev-Mode

- Em modo de desenvolvimento, “tabela/coluna vazia” não implica legado.
- Auditoria dev-safe adicional:
  - `reports/schema_hygiene_dev_mode_audit_2026-02-24.md`
  - `reports/schema_hygiene_dev_watchlist_columns_2026-02-24.csv`
  - `reports/schema_hygiene_overlap_audit_post_cleanup_2026-02-24.md`
  - `reports/schema_hygiene_watchlist_probe_2026-02-24.json`
  - `reports/schema_hygiene_bookings_profiles_closeout_2026-02-24.md`
  - `reports/schema_hygiene_bookings_profiles_field_audit_2026-02-24.csv`
- Decisão atual: sem drops adicionais de colunas; backlog `REVIEW_COLUMN` fechado em modo dev-safe e foco em watchlist monitorizada.
