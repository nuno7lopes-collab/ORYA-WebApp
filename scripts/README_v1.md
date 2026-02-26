# Scripts (Ops/Diagnostico)

Este diretório foi limpo de scripts legados one-off.

Os scripts de criação legados foram removidos.
Para segredos, o fluxo operacional foi mantido via `prepare-secrets-json.sh` + `upload-secrets.sh`.

Os scripts de seed/backfill de criação também foram removidos.

## Nota de execução TypeScript

Quando um script `.ts` não arranca diretamente:

```bash
node scripts/run-ts.cjs scripts/nome-do-script.ts
```

## Governança de scripts operacionais (Fase 2)

- Manifesto: `scripts/manifests/operational_scripts_allowlist_v1.json`
- Gate: `npm run gate:scripts-ops`

Este gate valida:
- caminhos de scripts permitidos por ambiente (`local`, `dev`, `ci`, `prod`);
- cobertura da allowlist para todos os scripts referenciados no `package.json`;
- cobertura extra para scripts operacionais fora do `package.json` (deploy/aws/secrets/e2e auxiliares).

## Governança de scripts operacionais (Fase 3)

- Catalogo: `scripts/manifests/operational_scripts_catalog_v1.json`
- Runbook: `docs/runbooks/scripts_operacionais_catalogo_v1.md`
- Gate: `npm run gate:scripts-catalog`

Este gate valida:
- owner, runbook e comando npm oficial para cada script da allowlist;
- existencia real dos runbooks e das ancoras por script;
- alinhamento de ambientes entre allowlist e catalogo.

## Guardrail de seeds/reservas

- Gate: `npm run gate:reservas-seed-integrity`
- Backfill canónico de snapshots: `npm run reservas:backfill-confirmation-snapshots:dry`
- Runbook de reconstrucao: `docs/runbooks/reservas_snapshot_reconstruction_v1.md`

Este guardrail bloqueia scripts/SQL que tentem confirmar bookings sem snapshot de confirmação completo.
O scan cobre todos os ficheiros de `scripts/` com extensões operacionais (`.ts`, `.tsx`, `.js`, `.cjs`, `.mjs`, `.sh`, `.sql`).
