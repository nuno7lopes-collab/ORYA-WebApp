# DB Local vs Cloud (1 DB única + guardrails)

## Decisão atual
- Fonte de verdade: **1 DB única (cloud)**.
- Estado do projeto: DEV (sem dados de produção).
- Objetivo: migrations previsíveis e seguras, sem apontar para DB errada por engano.

## Limitação conhecida
- **Postgres “nu” local não é suportado** com o baseline atual (`0000_baseline`).
- Motivo: baseline assume objetos tipo Supabase (`auth`, `extensions.citext`, funções `auth.*`, policies).
- Resultado esperado em Postgres nu: falhas na baseline (ex.: `schema "auth"` / `schema "extensions"`).

## Guardrails ativos
- `db:deploy` exige confirmação explícita: `DB_DEPLOY_ACK=YES`.
- `db:deploy` falha se `DATABASE_URL`/`DIRECT_URL` não forem explícitas.
- Antes de qualquer migration, `db:env` imprime sempre:
  - `host`
  - `porta`
  - `dbname`
  - `mode` (`cloud`/`local`)
  - `source` de cada URL (`process`, `.env`, `.env.local`, `secrets:...`)

## Prioridade de env (determinística)
1. `process` (shell/CI)
2. `.env`
3. `.env.local` (não sobrepõe `process`)
4. `secrets` (apenas `mode=cloud` e só se variável estiver vazia)

## Comandos seguros (cloud)
1. `db:deploy`:
```bash
ORYA_DB_MODE=cloud \
DB_DEPLOY_ACK=YES \
DATABASE_URL='postgresql://<user>:<pass>@<host>:<port>/<db>' \
DIRECT_URL='postgresql://<user>:<pass>@<host>:<port>/<db>' \
npm run db:deploy
```

2. `db:gates` online:
```bash
ORYA_DB_MODE=cloud \
DB_DEPLOY_ACK=YES \
DATABASE_URL='postgresql://<user>:<pass>@<host>:<port>/<db>' \
DIRECT_URL='postgresql://<user>:<pass>@<host>:<port>/<db>' \
npm run db:gates
```

## Como confirmar a DB alvo
- Ver a linha de `db:env` antes de migrations:
```text
[db:env] target=<host>:<port>/<db> mode=<cloud|local> source(DATABASE_URL)=... source(DIRECT_URL)=...
```
- Se o `target`/`mode` não for o esperado: **parar** e corrigir env antes de repetir.

## Nota futura
- Se quisermos desenvolvimento local com migrations reais, o caminho recomendado é **Supabase local**.
- Não implementar Postgres nu local para baseline atual sem plano de bootstrap completo.
