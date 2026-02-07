# Padel UI/UX Master Plan (Blueprint v9)
> Escopo: UI/UX Padel. Regras de produto/SSOT em `docs/ssot_registry.md` e `docs/blueprint.md`.

Data: 2026-02-02  
Escopo: UI/UX (sem mexer em infra), com split real Ferramenta A/Ferramenta B e limpeza de legacy.

## 1) Fonte de verdade usada

- Blueprint v9 + Anexo A (Padel): `docs/blueprint.md`
- Checklist de execução: `docs/v10_execution_checklist.md`
- Inventário técnico atual (gerado): `docs/padel_uiux_inventory.md`

## 2) Objetivo deste plano

Transformar o backend já fechado em operação premium de UI/UX, com:

- split real de produto (Ferramenta A Clube / Ferramenta B Torneios),
- navegação canónica e sem dependência de legacy,
- descoberta total das capacidades já implementadas (API -> UI),
- operação diária rápida (menos cliques, mais contexto, menos fricção).

## 3) Inventário e cobertura (resumo)

### 3.1 Ferramenta A — Clube (UI)

- Hub de clubes/courts/staff/jogadores/comunidade/treinadores/aulas.
- KPIs + atalhos cross-module.
- Gestão de moradas e clubs partner.

### 3.2 Ferramenta B — Torneios (UI)

- Wizard dedicado (`/organizacao/torneios/novo`).
- Operação por torneio (tabs, geração, waitlist, roles, lifecycle, monitor/live).
- Calendar SSOT com auto-schedule e operação manual.

### 3.3 APIs relevantes já expostas

- Lifecycle e roles por torneio.
- Configuração/regras/rulesets.
- Waitlist + promoção.
- Imports/exports.
- Live/standings/widgets.

### 3.4 Lacunas de UX detectadas

- Descoberta de funcionalidades avançadas ainda dispersa entre páginas.
- Nem todas as capacidades backend têm entrada óbvia no UI (ex.: geração de seeds por ranking).
- Legacy (`section=padel-hub`) ainda precisava ficar apenas como compatibilidade, nunca como rota emitida.

## 4) Plano de execução UI/UX (sem infra)

## Fase P0 — Split real + navegação canónica (obrigatório)

- [x] Separar rotas de entrada:
  - `/organizacao/padel/clube`
  - `/organizacao/padel/torneios`
- [x] Separar secções de gestão:
  - `section=padel-club`
  - `section=padel-tournaments`
- [x] Manter `padel-hub` apenas como alias de compatibilidade.
- [x] Ajustar topbar/breadcrumb/objective nav para A/B.
- [x] Atualizar deep links internos que ainda apontavam para `padel-hub`.

## Fase P1 — Operação premium da Ferramenta B

- [x] Tab “Torneios” no Hub da Ferramenta B com:
  - lista rápida,
  - status,
  - atalhos para abrir/live/calendário.
- [x] Entrada default de `/organizacao/torneios` para Ferramenta B.
- [x] Expor seed automático por ranking no UI (botão “Gerar do ranking”).
- [x] Criar barra de ações persistente por torneio (Live, Monitor, Finance, Público).
- [x] Melhorar empty states e onboarding contextual por fase do lifecycle.

## Fase P2 — Superfícies públicas e descoberta

- [x] Página de rankings no portal público (consumindo `/api/padel/rankings`).
- [x] Página/slot para calendário público em contexto de evento (`/api/padel/public/calendar`).
- [x] Centro de widgets com copy/paste e preview visual por torneio.
- [x] Entradas claras para onboarding de duplas e convites pendentes.

## Fase P3 — UX global premium (Blueprint F1-C/F2)

- [x] Command actions por contexto (torneio/clube) com atalhos de teclado.
- [x] Context drawer com “estado operacional de hoje” (split pendente, waitlist, conflitos, live alerts).
- [x] Multi-idioma consistente em páginas públicas de torneio e jogo.
- [x] Uniformizar microcopy de estados (pending/matchmaking/confirmed/expired) em todas as superfícies.

## 5) Política de legacy

- Legacy suportado: apenas leitura/alias para não quebrar links antigos.
- Legacy proibido: gerar novas rotas/links/estado UI com `padel-hub`.
- Regra de revisão: qualquer novo link Padel deve usar `padel-club` ou `padel-tournaments`.

## 6) DoD (Definition of Done) de UI/UX Padel

- Split A/B claro na navegação e no conteúdo exibido.
- Todas as operações críticas do backend com entrada de UI visível.
- Zero links novos para `padel-hub`.
- Flows com feedback (loading/success/error) e estados vazios úteis.
- Lint limpo nos ficheiros alterados.
