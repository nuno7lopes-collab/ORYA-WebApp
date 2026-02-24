# Schema Hygiene Closeout: bookings + profiles (2026-02-24)

- GeneratedAtUTC: 2026-02-24T16:35:37Z
- Contexto: revisão dev-safe aprofundada (sem drops automáticos por dados vazios)
- Scope: `app_v3.bookings` (8 campos) e `app_v3.profiles` (7 campos)

## Snapshot live usado nesta decisão

Fonte: `reports/schema_hygiene_bookings_profiles_field_audit_2026-02-24.csv`

- `bookings`: 161 rows
  - campos com `NOT NULL > 0`: 7/8
  - único campo ainda 100% null: `pending_expires_at`
- `profiles`: 124 rows
  - campos com `NOT NULL > 0`: 0/7

## Dependências estruturais confirmadas

### bookings

- `bookings_guest_email_idx` em `guest_email`
- `bookings_payment_intent_id_key` (unique) em `payment_intent_id`
- `bookings_pending_expires_idx` em `pending_expires_at`

### profiles

- sem índices/constraints dedicados aos 7 campos auditados

## Decisão final por campo

### bookings

Mantidos (`KEEP_DEV_ACTIVE`):
- `confirmation_snapshot`
- `confirmation_snapshot_created_at`
- `confirmation_snapshot_version`
- `guest_email`
- `guest_name`
- `guest_phone`
- `payment_intent_id`
- `pending_expires_at`

Racional:
- os 7 primeiros já têm preenchimento real no ambiente atual;
- `pending_expires_at` continua null na amostra, mas é usado intensivamente em hold expiry/cleanup/calendário e tem índice dedicado.

### profiles

Mantidos (`KEEP_DEV_ACTIVE`):
- `bio`
- `deleted_at`
- `deletion_requested_at`
- `deletion_scheduled_for`
- `padel_club_name`

Watchlist (`WATCHLIST_DEV`, sem DDL nesta fase):
- `deleted_at_final`
- `location_source`

Racional:
- `bio`, `padel_club_name` e fluxo de delete (`deleted_at`, `deletion_*`) têm uso funcional explícito;
- `deleted_at_final` e `location_source` permanecem sem leitura/escrita explícita de runtime no estado atual.

## Impacto no plano de higiene

- `reports/schema_hygiene_action_matrix_2026-02-24.csv` foi atualizado:
  - `bookings.*` e `profiles.*` passaram de `REVIEW_COLUMN` para `CLOSED_DEV_SAFE`.
- Backlog de hotspots por grupo (`REVIEW_COLUMN`) foi fechado em modo dev-safe.
- Watchlist atualizada com 5 colunas no total (antes: 4).

## Regras operacionais mantidas

1. não remover colunas apenas por estarem vazias em desenvolvimento;
2. qualquer drop exige sinal de não uso em runtime + validação funcional + janela de release;
3. continuar monitorização ativa da watchlist.
