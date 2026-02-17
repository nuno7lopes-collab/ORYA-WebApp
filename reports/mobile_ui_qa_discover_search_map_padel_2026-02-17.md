# Mobile UI QA - Descobrir, Search, Mapa, Padel Hub

Data: 2026-02-17
Escopo: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/search/index.tsx`, `apps/mobile/app/map/index.tsx`, `apps/mobile/app/padel/index.tsx`, `apps/mobile/components/discover/DiscoverGridCard.tsx`

## Critérios de validação
- UI mobile com alvo de toque AA (`>= 44`) para ações primárias.
- Covers de eventos/torneios com fallback resiliente (incluindo erro de carregamento de imagem).
- Estados de loading/empty/error consistentes.
- Comportamento responsivo em grelha e listas.
- Navegação e payloads de preview alinhados com contrato backend atual.

## Resultado geral
Status: APROVADO com melhorias aplicadas.

## Evidências por ecrã

### 1) Descobrir (`/(tabs)/index`)
- Grelha responsiva por largura (2 colunas em compacto, 3 em regular) e skeleton/ghost grid sincronizados com colunas.
  - Referência: `apps/mobile/app/(tabs)/index.tsx:71`, `apps/mobile/app/(tabs)/index.tsx:127`, `apps/mobile/app/(tabs)/index.tsx:363`, `apps/mobile/app/(tabs)/index.tsx:615`
- Search header com touch target mínimo aplicado.
  - Referência: `apps/mobile/app/(tabs)/index.tsx:1153`, `apps/mobile/app/(tabs)/index.tsx:1154`, `apps/mobile/app/(tabs)/index.tsx:1186`
- Covers no card principal com fallback e `onError` já validados via `DiscoverGridCard`.
  - Referência: `apps/mobile/components/discover/DiscoverGridCard.tsx:145`, `apps/mobile/components/discover/DiscoverGridCard.tsx:146`, `apps/mobile/components/discover/DiscoverGridCard.tsx:249`, `apps/mobile/components/discover/DiscoverGridCard.tsx:252`

### 2) Search (`/search`)
- Botão de limpar pesquisa ajustado para área de toque AA.
  - Referência: `apps/mobile/app/search/index.tsx:385`, `apps/mobile/app/search/index.tsx:391`, `apps/mobile/app/search/index.tsx:392`
- Segmentação Padel já alinhada em tab dedicado (`tab=padel`) para ofertas relevantes.
  - Referência: `apps/mobile/app/search/index.tsx:55`, `apps/mobile/app/search/index.tsx:57`, `apps/mobile/app/search/index.tsx:120`, `apps/mobile/app/search/index.tsx:191`

### 3) Mapa (`/map`)
- Cover de eventos reforçado com fallback também para erro de imagem (`onError`) via `MapEventThumb`.
  - Referência: `apps/mobile/app/map/index.tsx:106`, `apps/mobile/app/map/index.tsx:111`, `apps/mobile/app/map/index.tsx:128`, `apps/mobile/app/map/index.tsx:899`
- Preview de navegação do evento agora normaliza `coverImageUrl` com `resolveMediaUri` antes de abrir detalhe.
  - Referência: `apps/mobile/app/map/index.tsx:856`
- Controlo de toque AA aplicado a botões principais de mapa (back, recenter, reset, prompts).
  - Referência: `apps/mobile/app/map/index.tsx:1251`, `apps/mobile/app/map/index.tsx:1261`, `apps/mobile/app/map/index.tsx:1282`, `apps/mobile/app/map/index.tsx:1404`, `apps/mobile/app/map/index.tsx:1424`

### 4) Padel Hub (`/padel`)
- Featured tournaments com fallback robusto de cover (inclusive falha de carregamento) sem quebrar overlay.
  - Referência: `apps/mobile/app/padel/index.tsx:54`, `apps/mobile/app/padel/index.tsx:59`, `apps/mobile/app/padel/index.tsx:76`, `apps/mobile/app/padel/index.tsx:733`
- Meta de torneio enriquecida no cover (data/preço + pills de formato/estado).
  - Referência: `apps/mobile/app/padel/index.tsx:697`, `apps/mobile/app/padel/index.tsx:698`, `apps/mobile/app/padel/index.tsx:731`

## Checks executados
- `npm test -- tests/mobile/touchTargetGuardrails.test.ts` -> PASS (2/2)
- `npm --prefix apps/mobile test -- --runInBand` -> PASS (7 suites, 19 testes)
- `node scripts/uiux_surface_inventory.mjs tests/ui/surface-inventory/surface-inventory.snapshot.json` -> executado para inventário de superfícies

## Riscos residuais
- Não foi executado teste visual E2E em dispositivo real (iOS/Android) nesta passada; recomendável para validação final de micro-layout e animações.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` continua com erros já existentes fora do escopo (baseline do repositório), sem bloqueio específico das melhorias de UI aplicadas aqui.
