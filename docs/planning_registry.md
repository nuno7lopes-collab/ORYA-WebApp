# ORYA Planning Registry (NÃO-NORMATIVO)

Atualizado: 2026-02-11

## Propósito
- Este documento agrega planeamento, backlog e itens “a fazer”.
- Não define autoridade arquitetural, contratos ou regras fechadas.
- A fonte normativa continua a ser apenas `docs/ssot_registry.md`.

## Regra de Migração para o SSOT
- Um item deste documento só entra no SSOT após aprovação explícita do owner.
- Quando aprovado, deve ser convertido em regra/decisão/contrato com linguagem normativa e identificador claro (`D*`, `C*`, `I*`).

## Estados de Revisão
- `PENDENTE_OWNER`: ainda não revisto.
- `APROVADO_PARA_SSOT`: aprovado para migração normativa.
- `REJEITADO`: não entra no SSOT.
- `MANTER_PLANEAMENTO`: continua apenas como planeamento.

## Bloco P1 — Padel Clube (Planeamento)
- Estado do bloco: `CONSOLIDADO_SSOT`
- Objetivo: separar claramente o que pode virar norma no SSOT do que permanece roadmap.

### P1.1 Candidatos a Norma (revisão owner)
- Histórico de consolidação: itens P1.1 foram consolidados no SSOT em `D03`/`D04` (Agenda Engine, hard-blocks e gateway financeiro canónico).
- Estado: `MIGRADO_PARA_SSOT`

### P1.2 Planeamento / Backlog (não normativo)
- Item: Agenda premium (dia/semana, drag & drop avançado, camadas operacionais).
  Origem: `blueprint legado (removido)`
  Estado: `MANTER_PLANEAMENTO`
- Item: Otimização de ocupação (open matches, waitlist) na evolução do clube.
  Origem: `blueprint legado (removido)`
  Estado: `MANTER_PLANEAMENTO`
- Item: Experiência do jogador no clube (portal/app, perfil com estatísticas, gamificação local).
  Origem: `blueprint legado (removido)`
  Estado: `MANTER_PLANEAMENTO`
- Item: Conteúdo/comunidade local do clube e integrações federação para fases futuras.
  Origem: `blueprint legado (removido)`
  Estado: `MANTER_PLANEAMENTO`

## Bloco P2 — Padel Torneios (Planeamento)
- Item: Formatos adicionais (Americano/Mexicano).
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Double elimination e formatos avançados.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Circuitos/etapas com ranking cumulativo.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Operação live avançada (árbitro mobile, monitor/TV enriquecido).
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Streaming integrado avançado.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`

## Bloco P3 — Integração Entre Ferramentas (Planeamento)
- Item: Fluxos avançados de cross-promotion (reservas ↔ torneios ↔ aulas).
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Hub Padel com atalhos operacionais e KPIs expandidos.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Camada de integração por eventos para cenários de produto.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`

## Bloco P4 — Gaps e Hardening (Planeamento)
- Item: Operação offline ampliada para torneios (além do fallback atual).
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Lock states adicionais e matriz de permissões por estado live.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`
- Item: Métricas operacionais adicionais (funis e atrasos por court).
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`

## Bloco P5 — Roadmap / Epics / Tarefas (Planeamento)
- Item: Epics de execução por sprint para evolução Padel.
  Origem: `blueprint legado (removido)` (anexo Padel, secções roadmap/checklist/epics).
  Estado: `PENDENTE_OWNER`
- Item: Tarefas por epic com critérios de aceitação operacionais.
  Origem: `blueprint legado (removido)` (anexo Padel, secções de tarefas).
  Estado: `PENDENTE_OWNER`
- Item: Sequenciamento de fases não normativas (F2/F3) para priorização.
  Origem: `blueprint legado (removido)` (anexo Padel).
  Estado: `PENDENTE_OWNER`

## Bloco P6 — Estudos e Benchmark (Planeamento)
- Item: Comparativo competitivo (Playtomic/Padel Manager/Tournify/PadelTeams).
  Origem: `blueprint legado (removido)` (anexo Padel, análise comparativa).
  Estado: `PENDENTE_OWNER`
- Item: Recomendações de evolução (rating, gamificação, comunidade).
  Origem: `blueprint legado (removido)` (anexo Padel, recomendações).
  Estado: `PENDENTE_OWNER`

## Bloco P7 — Extrações Não-Normativas do SSOT (Auditoria 2026-02-11)
- Estado do bloco: `MANTER_PLANEAMENTO`
- Objetivo: preservar detalhe operacional/UX removido do SSOT para manter o registry estritamente normativo.

### P7.1 UX operacional de convites guest (extraído de D08.02)
- Página de convite (web): “Aceitar convite” com nome + email (pré-preenchido quando possível).
- Pós-compra (web): CTA para criar conta e guardar bilhetes com fluxo simplificado.
- Mobile: login obrigatório; guest checkout não suportado.
- Estado: `MANTER_PLANEAMENTO`

### P7.2 UX global B2B (extraído de D09.02)
- Unified Search global por ID/email/nome/evento com resultados por tipo e ações rápidas.
- Context Drawer universal com resumo, ações RBAC, links cruzados, audit log e timeline curta.
- Command Palette (`⌘K`) para ações operacionais de alta frequência.
- Ops mode com visões rápidas (`Hoje`, `Agora`, `Pendentes críticos`) e filtros por unidade.
- Estados visuais consistentes (`loading/empty/error/success`) e toasts padronizados.
- Estado: `MANTER_PLANEAMENTO`

### P7.3 Implementação do Address Service (extraído de D11)
- `AddressNormalizeJob`: parse + normalização + geocode + persistência de canonical/geo/confidence.
- Dedupe: reutilização de `addressId` por match de canonical+geo (arredondado).
- UX front: autocomplete via Address Service com sugestões normalizadas e confidence.
- Estado: `MANTER_PLANEAMENTO`

### P7.4 Roadmap Apple por fase (extraído de D17)
- Sequenciamento por fase (`V1`, `V1.5`, `V2`) para rollout de capacidades Apple.
- Entrada de App Clips/NFC/fluxos adicionais só após validação de prioridade e custo.
- Estado: `MANTER_PLANEAMENTO`

### P7.5 Catálogo de eventos do Ops Feed (extraído de 12.5)
- Lista operacional sugerida para monitorização/feed:
  - `booking.created`, `booking.cancelled`, `booking.no_show`
  - `payment.succeeded`, `payment.failed`
  - `subscription.failed`
  - `ticket.order.created`
  - `padel.registration.created`, `padel.registration.expired`
  - `checkin.success`, `checkin.denied`, `checkin.duplicate`
  - `refund.created`, `refund.succeeded`, `chargeback.opened`
  - `review.negative`, `moderation.flagged`
  - `inventory.low_stock`
- Estado: `MANTER_PLANEAMENTO`

## Bloco P8 — Discovery / Ranking (Planeamento)
- Item: Ranking Unificado v2 (personalização total) para Agora/Descobrir/Mapa/Pesquisa.
  Origem: migração do SSOT (cut-line OUT v1.0).
  Detalhe operacional:
  - engine único entre superfícies de discovery;
  - categorias por `Event.interestTags` com fallback canónico;
  - sinais comportamentais (`CLICK`, `VIEW`, `DWELL`, `FAVORITE`, `PURCHASE`);
  - afinidade social (org follows + amigos a ir);
  - feedback explícito (`HIDE_EVENT`, `HIDE_CATEGORY`, `HIDE_ORG`);
  - razões explicáveis de ranking (`rank.reasons`) para observabilidade.
  Estado: `MANTER_PLANEAMENTO`
- Item: Evolução de infraestrutura de busca para engine dedicada (Typesense/Meilisearch) quando houver volume.
  Origem: migração do SSOT (infra discovery futura).
  Estado: `MANTER_PLANEAMENTO`

## Notas Operacionais
- Este documento pode ser reorganizado por prioridade/impacto sem alterar o SSOT.
- Sempre que um item migrar para norma, registar no topo: `Migrado para SSOT: <id>`.
