# Plano Perfeito — Personalizacao do Perfil Modular (ORYA)

## 1) Objetivo
Maximizar a personalizacao do perfil publico com um editor intuitivo, modular e orientado a conversao, mantendo a simplicidade para o organizador e a consistencia visual da ORYA.

## 2) Principios de produto (inspiracao nas maiores plataformas)
- Shopify/Squarespace: secoes modulares com presets e possibilidade de reorganizar.
- Webflow: grelha e largura por bloco, com alinhamento visual claro.
- Notion: blocos simples, reordenacao rapida, foco na clareza.
- Instagram/Airbnb: destaques, prova social e CTA sempre visivel.

## 3) Estrutura geral da UX
- 2 modos: Rápido (templates) + Avancado (layout detalhado).
- Um so lugar para tudo: painel de Perfil Publico.
- Preview continuo: ver como publico em qualquer momento.

## 4) Catalogo de modulos (MVP + Extensao)
MVP:
- Servicos (Reservas) com carrossel e destaques.
- Agenda publica (eventos).
- Formularios/Contacto.
- Sobre.
- Avaliacoes.

Extensao:
- Loja (quando estiver pronta).
- Galeria, Equipa, Patrocinadores (futuro).

## 5) Regras inteligentes (auto-UX)
- Header sempre visivel.
- Modulo ativo so aparece se tiver conteudo ativo.
- Modulo sem conteudo ativo mostra banner no editor: "Este modulo nao aparece porque nao ha conteudo.".
- Ordem default baseada em conversao: Servicos -> Agenda -> Formularios -> Avaliacoes -> Sobre.

## 6) Desenho de UI completo (ecras e componentes)

### 6.1. Ecran principal (Perfil Publico -> Layout)
Objetivo: editar layout, ordem e largura.

Wireframe (desktop):
```
[ Perfil publico ]

[ Header do perfil (capa, avatar, nome, bio) ]

+--------------------------------------------------------------+
| Layout do perfil                                             | [Guardar layout]
| Arrasta para ordenar e escolhe a largura.                    |
+--------------------------------------------------------------+
| [Módulos]                              | [Servicos em destaque]|
| - [::] Servicos     [Ativo] [1 col] [2 col] | [chips dos servicos]
| - [::] Agenda pub.  [Ativo] [1 col] [2 col] | [ordem por arrasto]
| - [::] Formularios  [Ativo] [1 col] [2 col] | [mensagem se vazio]
| - [::] Avaliacoes   [Ativo] [1 col] [2 col] |
| - [::] Sobre        [Ativo] [1 col] [2 col] |
| - [::] Loja         [Inativo] [1 col] [2 col]|
+--------------------------------------------------------------+

[Preview do perfil] (botao: Ver como publico)
```

Componentes:
- Lista reordenavel (drag-and-drop).
- Toggle Ativo/Inativo.
- Selector de largura (1 col / 2 col).
- Botao Guardar layout (estado: desativado quando nao ha changes).

### 6.2. Drawer de configuracao por modulo (Avancado)
Objetivo: editar detalhes sem sair do editor.

Wireframe (drawer lateral):
```
+------------------------------+
| Modulo: Servicos             |
| [Ativo]                      |
| Largura: [1 col] [2 col]     |
| Mostrar titulo: [on/off]     |
| CTA: texto + destino         |
| Carrossel: [on/off]          |
| Destaques: [lista]           |
| Ordem interna: [arrastar]    |
+------------------------------+
```

### 6.3. Templates (Modo rapido)
Objetivo: configurar com 1 clique.

Wireframe:
```
+------------------------------+
| Escolhe um template          |
| [Reservas primeiro]          |
| [Eventos primeiro]           |
| [Comunidade]                 |
| [Premium]                    |
+------------------------------+
| Preview pequeno + aplicar    |
```

### 6.4. Preview responsivo
- Toggle Desktop/Mobile.
- Mobile mostra 1 coluna com mesma ordem.

Wireframe:
```
[ Preview ]  [Desktop] [Mobile]
```

### 6.5. Estados vazios e avisos
- Modulo sem conteudo ativo: badge cinzento + tooltip "Sem conteudo".
- Agenda vazia: CTA interno "Criar evento".
- Servicos vazios: CTA interno "Criar servico".

## 7) Personalizacao visual (fase 2)
- Paleta automatica baseada na capa.
- Tipografia por preset (2 fontes).
- Densidade visual: Compacto / Equilibrado / Arrojado.

## 8) Intuicao e onboarding
- Micro-tutorial inicial: "Arrasta para ordenar".
- Sugestao automatica de ordem (1 clique para aplicar).
- Botao "Repor default".

## 9) Metricas e iteracao (fase 3)
- Cliques por modulo.
- CTR do CTA principal.
- Teste A/B light para ordem.

## 10) Estrutura de dados (resumo)
- publicProfileLayout: lista ordenada de modulos.
- cada modulo: { type, enabled, width, settings }.
- settings por modulo: CTA, carrossel, destaques, densidade, etc.

## 11) Checklist de UX perfeito
- Um clique para aplicar template.
- Arrastar para reordenar.
- Preview sempre acessivel.
- Feedback claro quando um modulo nao aparece.
- Sem complexidade excessiva no MVP.

## 12) Sequencia de implementacao
1) Templates + editor base.
2) Drawer por modulo + CTA configuravel.
3) Preview responsivo e micro-onboarding.
4) Metricas e A/B light.

