# Schema Hygiene Dev-Mode Audit (2026-02-24)

- GeneratedAtUTC: 2026-02-24T16:20:00Z
- Contexto: ambiente de desenvolvimento ativo (`tabelas vazias != legacy`)
- Objetivo: decidir com critério conservador o que pode (ou não) ser removido nesta fase

## Regra operacional (dev-safe)

Uma coluna só pode entrar em rota de remoção se cumprir **todos**:

1. sem uso em runtime/scripts/tests (sinal estrutural e sinal por campo);
2. sem dependência em índices/constraints/funções;
3. sem plano funcional ativo no domínio;
4. validação com owner do produto.

## Evidência executada

1. Snapshot live + inventário pós-limpeza:
   - `app_v3`: 226 tabelas
   - `auth`: 20 tabelas
2. Cruzamento por coluna “always null”:
   - input: `reports/schema_hygiene_columns_never_populated_2026-02-24.csv`
   - output: `reports/schema_hygiene_column_evidence_2026-02-24.csv`
3. Verificação estrutural dedicada para colunas de menor sinal:
   - índices/constraints/funções para:
     - `padel_tournament_participants.seed_rank`
     - `tickets.rotating_seed`
     - `profiles.deleted_at_final`
     - `padel_rounds.duration_seconds`
   - resultado: sem dependências estruturais encontradas;
   - resultado de dados: todas com `NOT NULL rows = 0`.

## Resultado objetivo

- Colunas “always null” analisadas: **100**
- Candidatos seguros a drop imediato: **0**
- Decisão nesta fase: **não remover mais colunas agora**.
- Distribuição de sinal de uso por campo:
  - `signal = 0`: 4
  - `signal 1..5`: 10
  - `signal 6..50`: 42
  - `signal > 50`: 44

Racional:
- todas as 100 colunas têm sinal indireto de uso no domínio/tabela;
- ambiente ainda está em construção e há features parcialmente ativadas;
- remoção agressiva agora aumenta risco de regressão sem ganho real imediato.

## Watchlist (baixo sinal explícito por campo)

Estas 5 colunas têm sinal de código explícito muito baixo, mas ainda não são drop-safe por contexto funcional:

1. `padel_tournament_participants.seed_rank`
2. `tickets.rotating_seed`
3. `profiles.deleted_at_final`
4. `profiles.location_source`
5. `padel_rounds.duration_seconds`

Estado recomendado: `WATCHLIST_DEV` (monitorizar, sem DDL nesta fase).

## Próximo ciclo recomendado

1. instrumentar writes/reads explícitos destas 5 colunas (telemetria de uso real);
2. rever em 1 ciclo de release:
   - se continuar sem writes/reads e sem owner funcional, preparar depreciação;
3. manter política conservadora e revalidação periódica por release.

## Atualização pós-auditoria de hotspots (2026-02-24 16:35 UTC)

- Revisão aprofundada `bookings` + `profiles` concluída em:
  - `reports/schema_hygiene_bookings_profiles_closeout_2026-02-24.md`
  - `reports/schema_hygiene_bookings_profiles_field_audit_2026-02-24.csv`
- Resultado:
  - `bookings` deixou de ser bloco “always-null” (7/8 campos com valores não nulos nesta snapshot);
  - `profiles` mantém 2 campos em watchlist (`deleted_at_final`, `location_source`) e restantes campos como ativos.

## Probe implementado

- Script: `scripts/db/schema_hygiene_watchlist_probe.mjs`
- Output atual: `reports/schema_hygiene_watchlist_probe_2026-02-24.json`
- Estado desta execução: `activeColumns = 0` (nenhuma coluna da watchlist com valores não nulos).
