# Loja Admin UX Plan (PT)

## Objetivo
- Tornar a area da Loja clara e leve (MVP), com navegacao simples e profissional.
- Separar a Loja dos modulos Eventos/Reservas/Padel.
- Organizar o conteudo por vistas (nao por scroll infinito).
- Manter o MVP: sem criar features novas, apenas organizar e simplificar.

## Principios (Shopify-inspired, mas MVP)
- Navegacao por areas principais (topo + subnav local).
- Cada area tem subareas (dropdown simples).
- Mesmo com MVP, o utilizador ve uma estrutura profissional e previsivel.
- Uma area, um objetivo: evitar tudo numa unica coluna sem contexto.

## IA proposta (Loja) - V2 sem scroll

### 1) Visao geral
- Status da loja (aberta/fechada), catalogo bloqueado, checkout.
- Ativacao e bloqueio (card existente).
- Acoes rapidas (criar produto, configurar envios, ver encomendas).

### 2) Catalogo
- Produtos (criacao simples + publicar rapido)
- Categorias
- Imagens
- Variantes
- Personalizacao (opcoes + valores)
- Ficheiros digitais

### 3) Encomendas
- Encomendas (listagem + detalhe)

### 4) Envios
- Definicoes
- Zonas
- Metodos
- Tabelas / Tiers

### 5) Marketing (MVP = base)
- Bundles / Packs (ja existe)
- Descontos (placeholder futuro)

### 6) Definicoes
- Preferencias (placeholder)
- Politicas (future)

## Navegacao

### Topbar (organizacao)
- Quando o path for /organizacao/loja, a subnav global (Eventos/Reservas/Padel) e substituida por uma subnav da Loja.
- Itens: Visao geral, Catalogo, Encomendas, Envios, Marketing, Definicoes.
- Cada item pode ter dropdown com subitems.
- Navegacao baseada em `view` + `sub` (sem anchors).

### Subnav local (pagina loja)
- Removida. A navegação vive apenas no topo (como Shopify).

## MVP Scope (agora)
- Subnav da Loja no topo com dropdowns e vistas por area.
- Sem subnav interna na pagina.
- Cada vista mostra apenas 1 area, reduzindo scroll e confusao.
- Criacao de produto via modal em 2 passos (essencial + detalhes).
- Toggle de publicacao + tipo fisico/digital + stock opcional.
- Cartao de ativacao apenas na Visao geral (ou se loja ainda nao existir).

## Evolucao futura (fora do MVP)
- Separar Catalogo/Encomendas/Envios em rotas dedicadas.
- Adicionar analitica e descontos completos.
- Pagina de configuracao de pagamentos e politicas com fluxos guiados.

## Checklist de implementacao
1) Subnav da Loja com query params (`view` + `sub`).
2) Ocultar subnav interna na pagina.
3) Renderizar apenas a vista ativa (sem scroll gigante).
4) Simplificar criacao de produto (modal guiada).
5) Limpar a densidade nas vistas (card de ativacao apenas na visao geral).
6) Ajustar copy para guiar o utilizador.
