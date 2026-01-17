# Plano Completo — Perfil Modular (MVP)

## 1) Objectivo
Criar um perfil público modular, sem duplicações, com layout em grelha de 2 colunas, configurável via drag-and-drop pelo organizador. O header é obrigatório e sempre visível. Módulos ativos são visíveis quando há conteúdo.

## 2) Princípios
- Uma fonte de verdade por conteúdo (sem duplicações).
- Prioridade para conversão: Reservas/Serviços -> Agenda pública -> Formulários.
- Flexível, mas com defaults sólidos.
- Simples no MVP, extensível para Loja.

## 3) Catálogo de módulos (MVP)
- Serviços (Reservas) — carrossel, destaques, CTA principal.
- Agenda pública — eventos ativos e CTA para ver mais.
- Formulários/Contacto — formulário e contactos essenciais.
- Sobre — descrição curta e links úteis.
- Avaliações/Prova social — reviews/ratings.

## 4) Regras de visibilidade e prioridade
- Header: sempre visível e obrigatório.
- Módulos ativos: visíveis se tiverem conteúdo.
- Módulos sem conteúdo ativo: ocultos automaticamente.
- Ordem default (quando não há personalização):
  1) Serviços, 2) Agenda pública, 3) Formulários, 4) Avaliações, 5) Sobre.
- Prioridade do editor: o organizador pode reordenar livremente; se não personalizar, aplica-se o default.

## 5) Layout e responsivo
- Desktop: grelha 2 colunas, módulos com largura 1 ou 2 colunas.
- Mobile: coluna única, mantendo a ordem definida; módulos 2 colunas passam a linha completa.
- Gaps e alinhamentos consistentes para reduzir ruído visual.

## 6) Editor do organizador
- Drag-and-drop para ordenar.
- Toggle de activação por módulo.
- Selector de largura: 1 coluna / 2 colunas.
- Restrições: header não editável; módulos sem conteúdo ativo não podem ser forçados a aparecer.
- Pré-visualização em tempo real (ou modo "ver como público").

## 7) Serviços (carrossel)
- Mostrar 2-3 cards visíveis (dependente da largura do módulo).
- Setas para navegar; indicador de posição.
- "Destaques" escolhidos pelo organizador.
- Ordem: primeiro destaques, depois restantes.
- Se não houver destaques, usa ordem normal.

## 8) Modelo de dados (base)
- ProfileLayout:
  - modules: array ordenado
  - cada módulo: { id, type, enabled, width, settings }
- settings por tipo:
  - Serviços: featuredServiceIds, itemsPerView, carouselEnabled
  - Agenda: maxItems, showPastEvents (default false)
  - Formulários: formId, contactMethods
  - Sobre: shortBio
  - Avaliações: maxItems

## 9) Backend e APIs
- Guardar layout por organização.
- Endpoint para obter layout + conteúdo ativo.
- Fallback para layout default se não houver layout guardado.
- Validação: impedir módulos ativos sem conteúdo se o conteúdo for obrigatório.

## 10) Migração e compatibilidade
- Para perfis existentes sem layout: criar layout default automaticamente.
- Não alterar conteúdos existentes, apenas a forma de apresentação.

## 11) Estados e empty states
- Sem serviços: módulo Serviços oculto.
- Sem eventos ativos: módulo Agenda oculto.
- Sem avaliações: módulo Avaliações oculto.
- Mensagens suaves no painel do organizador para explicar porque um módulo está invisível.

## 12) Critérios de aceitação (MVP)
- Header sempre visível.
- Módulos ativos com conteúdo aparecem.
- Drag-and-drop funcional e persistente.
- Serviços com carrossel e destaques.
- Layout 2 colunas no desktop, 1 coluna no mobile.
- Ordem default respeitada quando não há personalização.

## 13) Fases de entrega
- Fase 1: Modelo de dados + renderização default no perfil público.
- Fase 2: Editor com drag-and-drop + largura por módulo.
- Fase 3: Serviços com carrossel + gestão de destaques.
- Fase 4: Preparação do módulo Loja (placeholder apenas).

## 14) Métricas de sucesso
- Aumento de cliques no CTA de reservas.
- Tempo médio no perfil.
- Taxa de activação de módulos no editor.
