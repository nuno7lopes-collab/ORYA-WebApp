# Bloco 4 P2 — Admin melhorias (2026-01-30)

## O que mudou
- Paginação + filtros básicos na listagem de organizações (cursor + status/q).
- Auditoria (EventLog) com filtro por eventType e paginação por cursor.
- UI admin resiliente: loading/error/empty + “Carregar mais” nas listas.

## Evidência (código)
- Paginação/filtros org list:
  - `app/api/admin/organizacoes/list/route.ts:1-190`
- Paginação/filtros EventLog:
  - `app/api/admin/organizacoes/event-log/route.ts:1-150`
- UI admin com estados resilientes + busca + load more:
  - `app/admin/organizacoes/page.tsx:330-1520`
- Testes de rota:
  - `tests/admin/organizationsListRoute.test.ts:1-120`
  - `tests/admin/organizationsEventLogRoute.test.ts:1-120`

## Testes
- `npx vitest run tests/admin`
  - Resultado: **OK** (2 files / 4 tests).
- `npm run typecheck`
  - Resultado: **FAIL** (fora de scope — `app/api/admin/infra/_helpers.ts`).
  - Erros:
    - `TS2322` `InputJsonValue` (linha ~41)
    - `TS2769` `execFile` env typings (linhas ~71 e ~88)

## Notas
- Sem alterações em infra/segredos/deploy (fora de scope).
