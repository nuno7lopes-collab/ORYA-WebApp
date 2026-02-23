# SSOT Deep Audit — 2026-02-23

## Estado actual (pós-correcções desta ronda)
- Gates críticos: `OK`
  - `gate:api-contract`
  - `gate:ssot-normative`
  - `gate:api-ui-coverage`
  - `gate:api-ui-baseline`
  - `gate:api-ui-hints`
  - `gate:parity`
  - `gate:p0-policy`
  - `gate:tombstones`
  - `gate:org-context`
  - `gate:p0-errors`
  - `gate:org-id-parser`
  - `gate:readme-refs`
- Cobertura API<->UI actual:
  - API total: `551`
  - Cobertas: `435`
  - Órfãs reais: `51`
  - Órfãs novas: `0`
  - Tombstones `410` isentas: `14`
  - Internas/cron/webhook isentas: `48`
  - Missing API (UI -> endpoint inexistente): `0`
  - Baseline activa: `51` entradas

## Melhorias aplicadas nesta ronda
1. O auditor API/UI deixou de contar falsos missing para bases de namespace (`/api/org`, `/api/org-system`, `/api/public/store`).
2. O auditor passou a separar claramente:
   - órfãos reais novos,
   - órfãos baseline,
   - tombstones `410`,
   - rotas internas/cron/webhook.
3. A extracção de uso frontend ficou mais forte (captura `useMemo`, `useCallback`, `resolveCanonicalOrgApiPath`, `useSWR`), reduzindo falsos órfãos e falsos “P0 sem uso”.
4. P0 de payouts ficou efectivamente coberto pela UI (`status/list/summary/settings/connect`).
5. O endpoint P0 de créditos foi formalizado por política explícita no manifest (`DISABLED_BY_POLICY`) e validado por gate dedicado (`gate:p0-policy`):
   - `/api/servicos/[id]/creditos/checkout` (`410 CREDITS_DISABLED`).
6. A baseline de órfãos foi migrada para entradas com metadata (`owner`, `reason`, `expiresAt`) e passou a ter gate dedicado de validade temporal (`gate:api-ui-baseline`).
7. Foi criado `baseline:api-ui:sync` para manter baseline alinhada ao estado real dos órfãos (sem entradas stale).
8. A baseline passou a aplicar ownership por domínio também para casos `public` (eliminando entradas com owner genérico nas entradas activas).
9. A baseline passou a ter planeamento por ondas (`wave-1|wave-2|wave-3`) com gate a validar (`wave_missing_or_invalid` deixa de passar).
10. Foi criado relatório operacional de burn-down por onda:
   - `reports/api_ui_orphan_burndown_plan_v1.md`.
11. O parity report deixou de usar extractor paralelo e passou a consumir o mesmo output do auditor API/UI (`reports/api_ui_coverage_v1.csv`), removendo dupla verdade operacional.
12. O detector de tombstone `410` foi corrigido para não classificar como tombstone endpoints activos com sucesso implícito (`ok: true` / `respondOk`), reduzindo falsos positivos.
13. Tombstones passaram a ter ciclo de vida governado:
   - sync: `tombstones:sync`
   - gate: `gate:tombstones`
   - manifest: `scripts/manifests/tombstone_lifecycle_v1.json`
   - report: `reports/tombstone_lifecycle_v1.md`
14. Foi introduzido mecanismo explícito de hints para chamadas UI dinâmicas com `endpointBase` (difíceis de inferir por AST puro):
   - manifest: `scripts/manifests/frontend_api_usage_hints_v1.json`
   - gate: `gate:api-ui-hints`
   - impacto nesta ronda: `30` rotas de `org.store` deixaram de ser órfãs falsas.
15. Burn-down de wave-1 fechado:
   - `org.store` reduziu de `32` para `0` endpoints órfãos.
   - `/api/org/[orgId]/store/preview` passou a ser consumido no frontend.
   - `/api/org/[orgId]/store/settings` passou a ser classificado correctamente como tombstone `410`.

## Gaps e ambiguidades ainda abertas

### P0 — Fechado nesta ronda: créditos checkout
- Estado:
  - endpoint mantido no P0 com rótulo normativo `DISABLED_BY_POLICY`;
  - sem expectativa de UI;
  - gate de política activa (`gate:p0-policy`).
- Resultado:
  - deixa de haver ambiguidade entre P0 activo e P0 desactivado por contrato.

### P1 — Baseline de órfãos ainda relevante (`51`)
- Distribuição dominante:
  - `padel.public`: `22`
  - `org.padel`: `13`
  - `me`: `7`
- Risco:
  - backend acima da maturidade de frontend em módulos críticos de negócio;
  - maior custo de manutenção e teste de superfícies sem consumo real.
- Decisão em falta:
  - plano de redução por ondas com owner, data e critério de remoção por endpoint (agora focado sobretudo em `padel`).

### P1 — Fechado nesta ronda: fonte de verdade única para paridade
- Estado:
  - `v9_inventory.mjs` executa o auditor API/UI e usa `reports/api_ui_coverage_v1.csv` para paridade.
- Resultado:
  - elimina divergência metodológica entre `api-ui-coverage` e `parity`.

### P2 — Fechado nesta ronda: ciclo de vida de tombstones
- Estado:
  - todos os tombstones `410` estão mapeados com `owner`, `reason`, `removeBy` e `wave`.
  - gate falha se houver tombstone sem governança, expirado, ou divergente do inventário real.
- Resultado:
  - deixa de existir dívida “sem data” para tombstones activos.

### P2 — Fechado nesta ronda: metadata de baseline por domínio
- Estado:
  - concluído na última levada técnica;
  - entradas activas com owner por domínio (`commerce-core`, `padel-core`, `org-platform`, `identity-core`, `messaging-core`, `reservas-core`);
  - `platform-architecture` ficou apenas como política global de fallback.
- Resultado:
  - deixa de existir ambiguidade de dono nas entradas activas da baseline.

## Recomendações objectivas para “melhor plataforma do mundo”
1. Manter decisão P0 de créditos estável
- Entregável: preservar `DISABLED_BY_POLICY` como contrato explícito, sem regressão para estado ambíguo.

2. Executar programa “Orphan Burn-down 51 -> 0” por domínio
- Ordem recomendada: `padel.public` -> `org.padel` -> restantes (`org.store` já fechado).
- Regra: cada endpoint órfão tem owner, data, wave e destino (`adopt`, `merge`, `remove`).

3. Acompanhar semanalmente o plano por ondas
- Fonte: `reports/api_ui_orphan_burndown_plan_v1.md`.
- Critério de sucesso: redução líquida por wave sem criar novos órfãos fora da baseline.

4. Manter governança da baseline por domínio
- Garantir que novas entradas entram sempre com `owner` e `expiresAt` do domínio correcto, sem regressão para ownership genérico.

5. Executar hard-cut físico conforme `removeBy`
- Fonte normativa: `scripts/manifests/tombstone_lifecycle_v1.json`.
- Após remoção, manter apenas registo em changelog/ADR.

## Conclusão
A base normativa ficou reforçada, os gates críticos estão verdes e as ambiguidades principais desta ronda foram fechadas (P0 desactivado por política, paridade com fonte única, wave-1 fechada, tombstones com ciclo de vida, hints dinâmicos auditáveis). O que resta é execução: reduzir os 51 órfãos (quase todos em `padel`) e cumprir o hard-cut físico dos tombstones nas datas definidas.
