# Plano de Revisão UX/UI — Área do Utilizador e Descobrir (ORYA)

## Objetivo
Fechar, por fases, todas as correções pedidas nas áreas de utilizador, navegação mobile e organização, mantendo a coerência entre mobile e desktop e reduzindo ruído visual.

## Escopo
- Área do utilizador: `Carteira` (Acessos) e `Compras` (Movimentos).
- Navegação mobile + pesquisa (lupa no topo, barra inferior reordenada).
- Descobrir/Explorar (remoção do “Escolhe o teu mundo” e do separador de mundo).
- Organizar (labels de eventos/torneios, CTA de criação e modal de notificações).
- Navbar desktop compacta (subnavegação + badges de ativação).

## Estado atual (observações rápidas)
- **Mobile nav**: a barra inferior tem `Descobrir`, `Rede`, `Agora`, `Procurar`, `Perfil`. O item “Procurar” abre `ExplorarContent` em `app/procurar/page.tsx`, ou seja, “Descobrir real” está na rota errada.
- **Pesquisa**: a modal de pesquisa existe no `Navbar` (desktop), mas não está acessível em mobile (`MobileTopBar` não tem lupa).
- **Descobrir/Explorar**: existe landing `app/explorar/page.tsx` com “Escolhe o teu mundo” e tabs “Mundos” + cartão “Mundo” dentro de `ExplorarContent`.
- **Carteira**: tem botões “Histórico de compras” e “Definições” e mistura acessos com histórico. Precisa de ficar só em Acessos.
- **Compras**: copy e estrutura apontam para bilhetes + pagamentos; vai passar a Movimentos (pagamentos, reembolsos, faturas, métodos).
- **Definições**: funcional, mas precisa de revisão de conteúdo (itens a manter/remover/adicionar).
- **Avatar menu**: ainda mostra “Organizar (modo empresa)” apesar do botão “Organizar” já existir no topo.
- **Organizar**: “Gestão de padel” aparece em eventos; falta CTA de criação dentro do container principal.
- **Topbar organização**: badges “Email obrigatório”/“Stripe recomendado” sobrepõem-se à subnavegação em larguras médias.
- **Modal notificações**: paleta atual verde; pede-se ajuste para azul e maior alinhamento com design geral.

## Plano faseado (execução)

### Fase 1 — Área do utilizador (Acessos vs Movimentos)
**Objetivo**: `Carteira` fica 100% Acessos, `Compras` fica 100% Movimentos.

**Tarefas**
- **Carteira (Acessos)**:
  - Remover botões “Histórico de compras” e “Definições” do topo.
  - Cabeçalho focado em Acessos (passes/bilhetes/reservas).
  - Criar 3 cartões-resumo com CTA:
    - `Passes e bilhetes`
    - `Acessos ativos`
    - `Reservas planeadas`
  - Cada cartão abre a secção correcta (ou detalhe do acesso).
  - Manter lista de “Acessos ativos” com cartão atual.
- **Compras (Movimentos)**:
  - Ajustar copy para pagamentos, reembolsos e faturas.
  - Garantir que as linhas da compra são consistentes e visíveis (evento + tipo de bilhete).
  - Adicionar ligação cruzada “Ver acesso” quando existir.
  - Reforçar estados com labels e cores consistentes.
  - Preparar áreas para “Faturas” e “Métodos” (mesmo que sejam placeholders).
- **Avatar menu**:
  - Remover “Organizar (modo empresa)”.

**Critérios de aceitação**
- `Carteira` não mostra qualquer referência a histórico de compras/definições.
- `Compras` apresenta movimentos e ligações cruzadas com acessos.
- Linhas de compra aparecem correctamente (evento + tipo).

**Ficheiros-alvo**
- `app/me/carteira/WalletHubClient.tsx`
- `app/me/compras/page.tsx`
- `app/api/me/purchases/route.ts`
- `app/components/Navbar.tsx`

### Fase 2 — Navegação mobile + pesquisa
**Objetivo**: nav mobile reflecte o novo modelo (Início/Descobrir/Agora/Rede/Perfil) e pesquisa passa para o topo.

**Tarefas**
- Reordenar `MobileBottomNav`:
  - `Início` | `Descobrir` | `Agora` | `Rede` | `Perfil`
  - Remover `Procurar` da barra inferior.
- Adicionar lupa no `MobileTopBar` junto das notificações.
- Reutilizar a mesma modal de pesquisa do desktop (eventos, organizações, utilizadores).
- Alinhar rota de “Descobrir real” com a versão desktop (remover confusão entre `/procurar`, `/descobrir`, `/explorar`).
- Garantir mobile-first (área de toque, safe-area, altura do topo).

**Critérios de aceitação**
- Barra inferior com 5 itens na ordem correcta.
- Lupa no topo abre modal de pesquisa (igual ao desktop).
- “Descobrir” mobile mostra o mesmo conteúdo funcional de desktop.

**Ficheiros-alvo**
- `app/components/MobileBottomNav.tsx`
- `app/components/mobile/MobileTopBar.tsx`
- `app/components/Navbar.tsx` (extração/partilha da modal de pesquisa)
- `app/procurar/page.tsx`
- `app/explorar/page.tsx`
- `app/descobrir/page.tsx`

### Fase 3 — Descobrir/Explorar (limpeza visual)
**Objetivo**: remover redundâncias visuais e manter só o essencial.

**Tarefas**
- Remover landing “Escolhe o teu mundo” em `app/explorar/page.tsx`.
- Em `ExplorarContent`, remover o separador “Mundo” (cartão com título/descrição do mundo).
- Manter só a escolha do mundo num único ponto (tabs “Mundos” ou filtro superior).
- Rever textos para evitar duplicações de “Explorar/Descobrir”.

**Critérios de aceitação**
- Sem “Escolhe o teu mundo”.
- Sem cartão “Mundo” nas páginas de Eventos/Torneios/Reservas.
- Um único ponto claro para trocar de mundo.

**Ficheiros-alvo**
- `app/explorar/page.tsx`
- `app/explorar/_components/ExplorarContent.tsx`
- `app/explorar/eventos/page.tsx`
- `app/explorar/torneios/page.tsx`
- `app/explorar/reservas/page.tsx`

### Fase 4 — Organizar (labels, CTA e modal)
**Objetivo**: corrigir labels e melhorar chamadas à ação.

**Tarefas**
- Garantir “Gestão de eventos” quando em `/organizacao/eventos`, mesmo em organizações de torneios.
- Adicionar CTA dentro do container principal: “Criar evento” / “Criar torneio”.
- Rever legado (labels e fluxos que já não fazem sentido).
- Refinar modal de notificações para paleta azul e hierarquia mais limpa.

**Critérios de aceitação**
- `/organizacao/eventos` mostra “Gestão de eventos”.
- CTA visível no container, não apenas na subnavegação.
- Modal de notificações mais alinhada com o look & feel azul.

**Ficheiros-alvo**
- `app/organizacao/DashboardClient.tsx`
- `app/components/notifications/NotificationBell.tsx`
- `app/organizacao/OrganizationTopBar.tsx`

### Fase 5 — Navbar desktop compacta
**Objetivo**: evitar sobreposição entre subnavegação e badges.

**Tarefas**
- Ajustar layout do topo para suportar larguras médias:
  - Scroll interno da subnavegação com fade/indicador.
  - Ou quebra controlada para segunda linha sem colisões.
- Garantir que os badges (“Email obrigatório”, “Stripe recomendado”) não empurram a subnav.

**Critérios de aceitação**
- Sem sobreposição visual em larguras ~900–1200px.
- Subnavegação mantém legibilidade e acesso.

**Ficheiros-alvo**
- `app/organizacao/OrganizationTopBar.tsx`
- `app/organizacao/ObjectiveSubnav.tsx`

### Fase 6 — QA e checklist final
**Objetivo**: validar o conjunto sem regressões.

**Checklist**
- Mobile: navegação + pesquisa + discover.
- Compras/Carteira: listas, estados, CTAs e links cruzados.
- Organizar: labels e CTA correctos.
- Topbar: subnav + badges sem colisão.
- Estados vazios e carregamentos.

## Recomendações extra (fora do pedido directo)
- Criar uma pequena legenda de estados (pago, reembolsado, pendente) para uniformizar perceção.
- Introduzir “Ações rápidas” na Carteira (ex.: reenviar bilhete, adicionar ao calendário).
- Reforçar acessibilidade: contraste dos textos pequenos e foco visível em botões.
- Centralizar nomenclaturas: “Descobrir” vs “Explorar” vs “Procurar”.

## Decisões já fechadas
- `Carteira` = Acessos.
- `Compras` = Movimentos.
- Barra mobile: `Início`, `Descobrir`, `Agora`, `Rede`, `Perfil`.
- Lupa no topo abre modal de pesquisa (mesma do desktop).
