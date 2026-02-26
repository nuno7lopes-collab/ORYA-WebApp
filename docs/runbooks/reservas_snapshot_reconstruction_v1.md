# Runbook: Reconstrucao de Snapshot de Reservas (v1)

Data de referencia: 2026-02-26

## Objetivo

Garantir consistencia de `bookings` quando regras de negocio mudam:

- nenhum booking em estado final sem snapshot completo;
- capacidade de reconstruir dados historicos por batch;
- validacao antes e depois de qualquer seed/backfill.

## Estados finais protegidos

- `CONFIRMED`
- `COMPLETED`
- `NO_SHOW`
- `DISPUTED`

## Guardrails tecnicos ativos

- DB constraint: `bookings_snapshot_fields_consistent_ck`
- DB constraint: `bookings_final_status_requires_snapshot_ck`
- Gate de scripts/SQL: `npm run gate:reservas-seed-integrity`
- Smoke de higiene: `npm run db:schema-hygiene:smoke`

## Procedimento quando as regras mudam

1. Atualizar logica canónica na aplicacao (confirmacao/cancelamento/backfill).
2. Correr `npm run gate:reservas-seed-integrity`.
3. Correr dry-run de reconstrucao:
   - `npm run reservas:backfill-confirmation-snapshots:dry -- --limit=500 --max-batches=20`
4. Rever output:
   - `updated=0` no dry-run (esperado),
   - contagem por estado em `byStatus`,
   - `missingPolicy`, `missingPricing`, `missingService` em zero ou com plano de correcao.
5. Executar reconstrucao:
   - `npm run reservas:backfill-confirmation-snapshots:execute -- --limit=500 --max-batches=20`
6. Validar pos-migracao:
   - `npm run db:schema-hygiene:smoke`
   - `npm run gate:reservas-seed-integrity`
7. Se houver violacoes:
   - corrigir origem dos dados (seed/script),
   - repetir do passo 2.

## Politica operacional

- Nao promover SQL/script de seed sem passar no gate de integridade.
- Preferir scripts canónicos e catalogados em `scripts/manifests/operational_scripts_catalog_v1.json`.
- Manter `dry-run` como passo obrigatorio antes de qualquer `--execute`.
