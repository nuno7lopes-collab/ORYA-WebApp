# SSOT Deep Audit — 2026-02-23

## Estado actual (pós-correcções desta ronda)
- Gates críticos: `OK`
  - `gate:api-contract`
  - `gate:ssot-normative`
  - `gate:api-ui-coverage`
  - `gate:api-ui-baseline`
  - `gate:parity`
  - `gate:org-context`
  - `gate:p0-errors`
  - `gate:org-id-parser`
  - `gate:readme-refs`
- Cobertura API<->UI actual:
  - API total: `551`
  - Cobertas: `403`
  - Órfãs reais: `83`
  - Órfãs novas: `0`
  - Tombstones `410` isentas: `14`
  - Internas/cron/webhook isentas: `48`
  - Missing API (UI -> endpoint inexistente): `0`
  - Baseline activa: `83` entradas

## Melhorias aplicadas nesta ronda
1. O auditor API/UI deixou de contar falsos missing para bases de namespace (`/api/org`, `/api/org-system`, `/api/public/store`).
2. O auditor passou a separar claramente:
   - órfãos reais novos,
   - órfãos baseline,
   - tombstones `410`,
   - rotas internas/cron/webhook.
3. A extracção de uso frontend ficou mais forte (captura `useMemo`, `useCallback`, `resolveCanonicalOrgApiPath`, `useSWR`), reduzindo falsos órfãos e falsos “P0 sem uso”.
4. P0 de payouts ficou efectivamente coberto pela UI (`status/list/summary/settings/connect`).
5. O único P0 sem UI foi formalizado como allowlisted por decisão técnica explícita:
   - `/api/servicos/[id]/creditos/checkout` (`410 CREDITS_DISABLED`).
6. A baseline de órfãos foi migrada para entradas com metadata (`owner`, `reason`, `expiresAt`) e passou a ter gate dedicado de validade temporal (`gate:api-ui-baseline`).
7. Foi criado `baseline:api-ui:sync` para manter baseline alinhada ao estado real dos órfãos (sem entradas stale).
8. A baseline passou a aplicar ownership por domínio também para casos `public` (eliminando entradas com owner genérico nas entradas activas).

## Gaps e ambiguidades ainda abertas

### P0 — Ambiguidade de produto/contrato em créditos checkout
- Sintoma:
  - Endpoint ainda no P0 mas desactivado por contrato (`410 CREDITS_DISABLED`).
- Risco:
  - Mantém ruído de governança e confusão entre “P0 activo” vs “P0 tombstone”.
- Decisão em falta (obrigatória):
  - ou remover do manifest P0;
  - ou manter no P0 com rótulo normativo explícito `DISABLED_BY_POLICY`.

### P1 — Baseline de órfãos ainda alta (`83`)
- Distribuição dominante:
  - `org.store`: `32`
  - `padel.public`: `22`
  - `org.padel`: `13`
  - `me`: `7`
- Risco:
  - backend acima da maturidade de frontend em módulos críticos de negócio;
  - maior custo de manutenção e teste de superfícies sem consumo real.
- Decisão em falta:
  - plano de redução por ondas com owner, data e critério de remoção por endpoint.

### P1 — Duas fontes de verdade operacionais para “paridade”
- Sintoma:
  - `audit_api_ui_coverage.ts` (AST + heurísticas melhores) já é mais fiel;
  - `v9_inventory.mjs` usa heurística mais simples para secção A do parity report.
- Risco:
  - diferenças de leitura entre relatórios para a mesma realidade.
- Decisão em falta:
  - unificar extractor de uso frontend (biblioteca comum ou importação do mesmo módulo).

### P2 — Tombstones legacy sem prazo de remoção física
- Sintoma:
  - `/api/org/[orgId]/payouts/*` está correctamente em `410`, mas continua em árvore activa.
- Risco:
  - dívida técnica “aceite para sempre”, ruído de inventário e onboarding.
- Decisão em falta:
  - data de remoção física + owner + condição de saída.

### P2 — Fechado nesta ronda: metadata de baseline por domínio
- Estado:
  - concluído na última levada técnica;
  - entradas activas com owner por domínio (`commerce-core`, `padel-core`, `org-platform`, `identity-core`, `messaging-core`, `reservas-core`);
  - `platform-architecture` ficou apenas como política global de fallback.
- Resultado:
  - deixa de existir ambiguidade de dono nas entradas activas da baseline.

## Recomendações objectivas para “melhor plataforma do mundo”
1. Fechar decisão de P0 créditos em 1 sprint
- Entregável: P0 sem ambiguidade contratual (`ACTIVE` ou `DISABLED_BY_POLICY`).

2. Lançar programa “Orphan Burn-down 83 -> 0” por domínio
- Ordem recomendada: `org.store` -> `padel.public` -> `org.padel` -> restantes.
- Regra: cada endpoint órfão tem owner, data, e destino (`adopt`, `merge`, `remove`).

3. Unificar motor de inventário/paridade
- Reutilizar o mesmo extractor AST para `api-ui-coverage` e `v9_inventory/parity`.
- Resultado: sem leituras contraditórias no controlo de plataforma.

4. Manter governança da baseline por domínio
- Garantir que novas entradas entram sempre com `owner` e `expiresAt` do domínio correcto, sem regressão para ownership genérico.

5. Hard-cut final de legacy físico
- Após janela definida, apagar rotas tombstone antigas e manter apenas tracking no changelog/ADR.

## Conclusão
A base normativa está sólida, os gates críticos estão verdes e esta última levada técnica fica fechada. O que resta é maioritariamente decisão de produto/governança: reduzir órfãos com disciplina temporal e remover definitivamente as zonas de ambiguidade (P0 desactivado, legacy físico, extractores divergentes).
