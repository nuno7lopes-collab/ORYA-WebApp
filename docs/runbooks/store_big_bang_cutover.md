# Store Big-Bang Cutover Runbook

## Scope
Big-bang cutover do dominio Loja para contrato final ORG-only.

## Preconditions
- Janela de manutencao ativa.
- Deploy freeze aplicado para backend/web/mobile.
- Backup credenciais validadas.
- Artefactos deste corte presentes:
  - `scripts/db/store_big_bang_purge.sql`
  - `scripts/db/store_big_bang_verify.sql`
  - migration `20260211110000_store_big_bang_contract`

## Baseline gates (pre-change)
Executar e bloquear cutover se algum falhar:

```bash
npm run gate:api-contract
npm run gate:api-ui-coverage
npm run typecheck
npm run test
npm --prefix apps/mobile test -- --runInBand
```

## Step 1: Full backup (mandatory)
1. Executar dump completo da DB alvo.
2. Confirmar checksum/tamanho do dump.
3. Guardar metadata de restauro (timestamp, cluster, schema).

## Step 2: Purge legacy store data
Executar:

```bash
psql "$DATABASE_URL" -f scripts/db/store_big_bang_purge.sql
```

## Step 3: Verify purge (mandatory)
Executar:

```bash
psql "$DATABASE_URL" -f scripts/db/store_big_bang_verify.sql
```

Critico: todas as queries de verificacao devem retornar zero residuos.

## Step 4: Apply final migration
```bash
npm run db:deploy
```

Confirmar status:

```bash
npm run db:status
```

## Step 5: Deploy order
Ordem obrigatoria:
1. backend/web
2. mobile

## Step 6: Smoke checklist E2E
### Public web
- `/:username/loja` abre catalogo
- produto abre
- carrinho atualiza
- checkout conclui

### Admin web
- `/org/:orgId/loja` abre
- catalogo/products/bundles/shipping/orders respondem
- RBAC respeitado

### Mobile
- deep link `/:username/loja` resolve para nativo
- fluxo nativo: storefront -> product -> cart -> checkout -> success
- wallet tab Loja lista compras
- detalhe compra abre recibo/fatura
- downloads digitais funcionam (signed URL)

## Step 7: Re-open criteria
Reabrir Loja apenas se:
- gates verdes
- smoke E2E verde
- sem erros P0 em logs

## Fail-hard policy
Se qualquer guardrail/contrato falhar: abortar reabertura.

## Rollback
1. Colocar aplicacao em modo manutencao.
2. Restore integral do backup da Step 1.
3. Redeploy da versao anterior backend/web/mobile.
4. Reexecutar `store_big_bang_verify.sql` para validar consistencia.
5. Reabrir apenas apos smoke minimo.
