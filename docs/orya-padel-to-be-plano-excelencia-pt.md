# ORYA — Padel (TO-BE) — Plano de Excelência

**Estrutura obrigatoria:** Ferramenta A (Padel Clube) / Ferramenta B (Padel Torneios) / Integracoes (contratos).  
Nao colocar infra de Reservas/Financas/CRM dentro de Padel.

> Base: `docs/orya-padel-as-is-estado-atual-completo.md` + plano fornecido pelo utilizador (“Plano para uma Plataforma de Gestão de Clubes e Torneios de Padel de Excelência”).

---

## 0) Objetivo e Princípios

**Objetivo:** elevar o ecossistema ORYA de Padel ao nível das melhores plataformas globais (Padel Manager, Playtomic Manager, Tournament Software, PadelTeams), criando **duas ferramentas distintas e integradas**:
1. **Gestão de Clube de Padel**
2. **Gestão de Torneios de Padel**

**Princípios (TO-BE):**
- **Simples e automático:** defaults fortes, pouco atrito.
- **Operacional e robusto:** tudo funciona em tempo real, com logs e controlo.
- **Experiência premium:** organizadores e jogadores com UX limpa e previsível.
- **Integração total:** clube, torneio, CRM, perfis e estatísticas em sintonia.

---

## 1) Base AS-IS (resumo)

**Referência principal:** `docs/orya-padel-as-is-estado-atual-completo.md`.

**Estado atual relevante (resumo):**
- Padel existe como preset de torneio, com Wizard e Hub Padel.
- Há clubes, courts, staff, categorias, regras, matches, standings e live via SSE.
- Páginas públicas + widgets + exports existem.
- Algumas areas-chave estão **parciais** (ex.: cancelamentos, check-in, acessibilidade).

---

## 2) Ferramenta A — Gestão de Clube de Padel (TO-BE)

### 2.1 Reservas e Agenda Inteligente
- Reservas online com disponibilidade em tempo real.
- Pagamentos integrados em reservas.
- Multi-clube e multi-court com agendas independentes.
- Otimização de ocupação (open matches, listas de espera).
- Integração com eventos/torneios (bloqueios e janelas).
- Agenda com visões dia/semana e drag & drop.

### 2.2 Sócios, Jogadores e Comunicação
- CRM unificado (reutilizar perfil competitivo).
- Wallets/saldos opcionais.
- Planos e passes (assinaturas/pacotes).
- Comunicação direta (notificações/chat/email).
- Matchmaking e comunidade.

### 2.3 Aulas, Treinos e Academia
- Gestão de treinadores com perfis públicos.
- Agenda de aulas (particulares e cursos).
- Reservas online e pagamentos integrados.
- Histórico e feedback.
- Atalho direto ao módulo existente de serviços/aulas.

### 2.4 Eventos Sociais e Ligas Internas
- Mix rápidos (Americano/Mexicano).
- Ligas internas, ladders e rankings internos.
- Eventos personalizados e formatos flexíveis.

### 2.5 Pagamentos, Faturação e Relatórios
- Checkout unificado (reservas, torneios, aulas, loja).
- Recibos e comissões transparentes.
- Dashboard financeiro com KPIs de ocupação.
- Exportações (CSV/PDF) e integrações contábeis.
- Preparar arquitetura para integração IoT (opcional).

### 2.6 Staff e Permissões
- Roles e permissões por função.
- Agenda de staff/treinadores.
- Escalas e comunicação interna.

### 2.7 Experiência do Jogador (Clube)
- Portal/app do jogador.
- Perfil unificado com estatísticas e reservas.
- Gamificação local (badges/objetivos).

---

## 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE)

### 3.1 Criação de Torneios (Wizard)
- Wizard dedicado a Padel (separado do wizard geral).
- Presets e templates de torneio (clonar e reutilizar).
- Suporte a formatos adicionais (Americano/Mexicano, ligas por equipas).
- Circuitos e etapas com ranking cumulativo.
- Validações inteligentes e sugestões operacionais.

### 3.2 Inscrições, Convites e Pagamentos
- Onboarding competitivo obrigatório.
- Convite de parceiro simplificado + status claro.
- Pagamento full/split com UX guiada.
- Waitlist com promoção automática.
- Comunicação pré-torneio (anúncios).
- Multilinguagem nas páginas públicas.

### 3.3 Formatos, Chaves e Geração de Jogos
- Geração automática + ajustes manuais.
- Suporte robusto a todos os formatos (incl. A/B e consolações).
- Seeding explícito + regras de desempate visíveis e aplicadas.
- Calendarização premium com drag & drop.
- Respeito de bloqueios e disponibilidades.
- Gestão de atrasos com impacto no cronograma.

### 3.4 Operação Live
- Check-in de equipas/duplas (manual ou self-service).
- Interface de árbitro/mobile para score.
- Live score robusto com status/tempo.
- Streaming integrado (por court/jogo).
- Monitor/TV com dashboards ricos.
- Notificações de chamada de jogo e progresso.
- WO, disputa e logs visíveis.

### 3.5 Páginas Públicas e Widgets
- Páginas ricas (Calendário, Chaves, Resultados, Classificações).
- Widgets embedáveis adicionais (placar live por jogo).
- Partilha/SEO e URLs por jogo.
- Galeria e multimédia.

### 3.6 Rankings, Histórico e Perfis
- Rankings internos e por circuito.
- Integração opcional com federações.
- Perfis competitivos avançados (stats + conquistas).
- Relatórios pós-evento para organizadores.

### 3.7 Governança e Qualidade
- Logs e auditoria centralizados.
- Permissões multi-admin (árbitros/co-organizadores).
- Plano de contingência (exports PDF/backup).
- Ajuda in-app e suporte rápido.
- Políticas de cancelamento/reembolso claras.
- Acessibilidade e UX premium.

---

## 4) Integração entre as Duas Ferramentas

- Criação de torneio a partir do clube (atalho com pré-preenchimento).
- Seleção de clube no torneio com courts e staff herdados.
- Perfil do jogador unificado entre reservas, aulas e torneios.
- Cross-promotions (reservas → torneios; torneios → aulas).
- Módulos distintos, experiência unificada no frontend.

---

## 5) Fundamentos Operacionais (para ficar “perfeito”)

### 5.1 Agenda Engine (Single Source of Truth)
- **CalendarResource:** `clubId`, `courtId`, `trainerId` (recursos).
- **CalendarBlock:** bloqueios hard/soft.
- **Booking:** reserva paga.
- **EventMatchSlot:** slot de match.
- **ServiceSession:** aula/treino do módulo de serviços.
- **Availability:** opcional para staff/jogadores.

**Regra central:** tudo o que ocupa um court vira um item na Agenda Engine. Reservas, aulas e matches são apenas tipos diferentes.

**Mapeamento AS-IS (repo):** `PadelCourtBlock` → CalendarBlock, `PadelAvailability` → Availability, `PadelMatch` → EventMatchSlot, Serviços/Aulas → ServiceSession.

### 5.2 RBAC + Scopes por Ferramenta
**Papéis:**
- **Owner (Org):** acesso total.
- **Club Manager:** Ferramenta A completa, Ferramenta B limitada.
- **Tournament Director:** Ferramenta B completa, Ferramenta A leitura.
- **Referee/Scorekeeper:** operação live e scores.
- **Front desk:** reservas + check-in + pagamentos presenciais.
- **Coach:** aulas + disponibilidade + clientes.

**Scopes (exemplos):**
- `clubs:read/write`
- `courts:write`
- `bookings:manage/refund`
- `tournaments:manage`
- `matches:score`
- `exports:generate`

### 5.3 Fluxos de Dinheiro (Money Flows)
- Stripe Connect vs conta única (definir por organização).
- Split de receitas por tipo: booking vs torneio vs aula.
- Reembolsos e chargebacks com política global + override por evento.
- Payout timing (hold/libertação) por tipo de receita.
- Fatura/recibo PT com trilho de auditoria (ledger).

### 5.4 Booking Policy Presets
**Presets:**
- **Standard:** pagamento total online.
- **Flex:** depósito online + restante no clube.
- **Clube tradicional:** sem pagamento online (apenas bloqueia slot).

**Regras mínimas:**
- Reserva por utilizador ORYA ou guest booking.
- Pagamento obrigatório vs “pagar no clube”.
- Depósito vs pagamento total.
- No-show fee configurável.

### 5.5 Ciclo de Vida do Torneio
- **Draft:** edição total.
- **Published:** inscrições abertas.
- **Locked:** quadro fechado, regras de refund mudam.
- **Live:** scores ativos e operação.
- **Completed:** exports finais + relatório.

---

## 6) Gap Analysis (AS-IS vs TO-BE)

**Definições de prioridade:**
- **Obrigatório:** entra no MVP/Fase 1.
- **Ideal:** fase de escala, não bloqueia MVP.

| Área | AS-IS | TO-BE | Notas |
|---|---|---|---|
| Reservas de courts | **Em falta** | Obrigatório | Não identificado no AS-IS Padel. |
| Agenda com drag & drop | Parcial | Premium | Calendarização existe; DnD não confirmado. |
| Pagamentos em reservas | **Em falta** | Obrigatório | Pagamentos existem em inscrições; não em reservas. |
| CRM de sócios | Parcial | Obrigatório | Perfil competitivo existe; CRM ampliado. |
| Aulas integradas | Parcial | Obrigatório | Existe módulo de aulas; falta ligação direta no Hub. |
| Mix rápidos (Americano/Mexicano) | Parcial | Obrigatório | Mix rápido existe; formatação Americano/Mexicano completa não confirmada. |
| Wizard dedicado Padel | Parcial | Obrigatório | Seção Padel existe dentro do wizard geral. |
| Formatos Americano/Mexicano | **Em falta** | Obrigatório | Não identificado no AS-IS. |
| Circuitos/etapas | **Em falta** | Obrigatório | Não identificado no AS-IS. |
| Waitlist auto-promoção | Parcial | Obrigatório | Promoção manual existente. |
| Check-in | **Em falta** | Obrigatório | Fluxo não existe em UI. |
| Streaming integrado | **Em falta** | Ideal | Só live score (SSE) confirmado. |
| Monitor/TV enriquecido | Parcial | Ideal | Monitor existe; melhorias previstas. |
| Exports premium (poster/PDF) | Parcial | Obrigatório | Exports existem; qualidade a elevar. |
| Acessibilidade formal | **Em falta** | Obrigatório | Não documentado. |

---

## 7) Roadmap Proposto (alto nível)

**Fase 0 — Alinhamento e Fundação**
- Fechar decisões-chave (cancelamento, check-in, reservas, formatos).
- Definir taxonomias e fonte de verdade (clubes, courts, staff, categorias).
- Estabelecer padrões de UX, acessibilidade e logs.

**Fase 1 — MVP Premium (Clube + Torneio)**
- **Clube:** cadastro completo, moradas normalizadas, courts, staff, agenda básica.
- **Reservas:** slots configuráveis + pagamentos integrados.
- **Torneios:** wizard dedicado, seleção de clube (own/partner), categorias, regras e geração de jogos.
- **Operação:** calendário com auto-schedule, live score, exports básicos.

**Fase 2 — Upgrade Core**
- **Clube:** CRM/planos, aulas integradas, relatórios financeiros base.
- **Torneios:** presets/templates, waitlist automática, check-in, formatos adicionais (Americano/Mexicano).

**Fase 3 — Premium + Escala**
- Streaming e monitor avançado.
- Páginas públicas premium + widgets de live.
- Circuitos/etapas, rankings avançados, integrações com federações.
- Auditoria completa e acessibilidade formal.

---

## 8) Fase 1 — 10 Features Irrenunciáveis (MVP)

1. Club CRUD + courts + staff.
2. Agenda engine + bloqueios.
3. Reservas com slots + pagamento (1 método).
4. Wizard Padel dedicado (core).
5. Categorias + tickets.
6. Generate matches (formatos base).
7. Calendarização (auto-schedule + manual assign).
8. Live score + monitor.
9. Public page + standings + bracket.
10. Exports básicos “imprimíveis”.

**Tudo o resto entra explicitamente em Fase 2+.**

---

## 9) Checklist por Sprint (executável)

- [ ] **Sprint 0 — Fundação**
  - [ ] Fechar decisões abertas e políticas.
  - [ ] Definir padrões de dados e nomenclaturas.
  - [ ] Mapear fluxos críticos (clube → torneio → público).
- [ ] **Sprint 1 — Club Core**
  - [ ] CRUD de clubes + moradas normalizadas.
  - [ ] Courts e staff completos.
  - [ ] Agenda base com bloqueios.
- [ ] **Sprint 2 — Reservas + Pagamentos**
  - [ ] Reserva de courts com slots configuráveis.
  - [ ] Pagamento online + recibo.
  - [ ] Waitlist e regras de cancelamento.
- [ ] **Sprint 3 — Torneio Core**
  - [ ] Wizard dedicado Padel.
  - [ ] Seleção de clube own/partner.
  - [ ] Categorias, formatos base e geração automática.
- [ ] **Sprint 4 — Operação & Público**
  - [ ] Auto-schedule + drag & drop (se aplicável).
  - [ ] Live score estável + monitor.
  - [ ] Páginas públicas e exports premium.
- [ ] **Sprint 5 — Escala**
  - [ ] Presets/templates, circuitos e rankings.
  - [ ] Streaming e widgets avançados.
  - [ ] Acessibilidade e auditoria completa.

---

## 10) Decisões Fechadas (versão final)

### 10.1 Reservas de courts
**Decisão:** Slots configuráveis com bloqueios (base), com duas vistas: slots fixos e janelas flexíveis.

**Standard (Ferramenta A):**
- Duração base (ex: 60/90 min), buffer (ex: 10 min), horários do clube, regras por court.
- Templates de slots por dia da semana (ex: 08:00–23:00 em blocos).
- Bloqueios por torneio/treino/manutenção/eventos privados.
- Bloqueios “soft” (preferência) vs “hard” (indisponível).

**Quando usar janelas flexíveis (Ferramenta B):**
- Torneios e operação com duração estimada + buffer.
- Motor de agenda único com dois modos de visualização.

**Porquê:** slots fixos são o padrão mental do clube; janelas flexíveis são essenciais para torneios.

### 10.2 Aulas
**Decisão:** Atalhos já no MVP; integração total na Fase 2.

**MVP:**
- Bloco “Aulas” na Ferramenta A com KPIs rápidos.
- Botão “Gerir Aulas” → Serviços > Aulas.
- Toggle “Ativar Aulas no Clube” (visibilidade, sem lógica duplicada).

**Fase 2:**
- Aulas geram bloqueios automáticos de courts.
- Instrutores como staff com permissões.

**Porquê:** evita duplicação de lógica e dívida técnica no MVP.

### 10.3 Formatos prioritários
**Decisão:** Americano/Mexicano primeiro.

**Ordem recomendada:**
1. Americano/Mexicano
2. Grupos + KO / KO / A-B
3. Liga/Circuito

**Porquê:** Americano/Mexicano gera volume semanal; circuitos exigem maturidade operacional.

### 10.4 Cancelamento / reembolso
**Decisão:** Defaults globais com overrides por evento.

**Modelo:**
- Política global (org/plataforma) com regras base.
- Override por evento com presets: Flexível / Standard / Rígido.
- Ajuste máximo de 2–3 parâmetros (ex: horas limite, taxa, bloqueio após draw).

**Porquê:** evita caos operacional e mantém flexibilidade comercial.

### 10.5 Check-in
**Decisão:** Manual + QR self-check-in opcional.

**MVP:**
- Staff marca presença no painel.
- QR no bilhete/perfil para validação rápida pelo staff.

**Fase seguinte (opcional):**
- Self check-in com geofencing/limites.

**Porquê:** mantém controlo em torneios reais com menos fricção.

### 10.6 Streaming
**Decisão:** Link/iframe no MVP; integração avançada depois.

**MVP:**
- Link de stream por torneio.
- Opcional: link por court/match.
- Embed simples (YouTube/Twitch).

**Depois:**
- Overlays, scoreboard sincronizado, patrocinadores, replay.

**Porquê:** valor imediato sem custo alto de integração.

### 10.7 Federações
**Decisão:** Export como base; API em fase de escala.

**MVP/V1:**
- Exports de inscritos, quadro, resultados, ranking, calendário.
- PDFs “federation-ready” + CSV padrão.

**Escala:**
- API direta quando houver tração e APIs estáveis.

**Porquê:** export resolve a maior parte do valor com custo menor.

---

## 11) Métricas de Sucesso (exemplos)

- Tempo médio para criar torneio completo (minutos).
- % de torneios com calendário auto-schedule bem-sucedido.
- Taxa de preenchimento de categorias (inscrição → confirmada).
- Ocupação média de courts (clubes).
- Engajamento do público (visitas públicas + partilhas).

---

## 12) Saída Esperada

- Duas ferramentas separadas (Clube / Torneio) integradas entre si.
- Fluxos simples, automáticos e robustos.
- Experiência pública premium e “shareable”.
- Plataforma ao nível PadelTeams (ou superior) em robustez e clareza.

---

## 13) Plano de Execução por Equipa

**Produto/UX**
- Definir IA final dos dois módulos (Club/Tournament).
- Especificar wizard dedicado e padrões de copy/validação.
- Desenhar páginas públicas premium + monitor/TV.
- Garantir acessibilidade e UX consistente entre módulos.

**Frontend**
- Implementar wizard dedicado Padel.
- Implementar reservas e agenda (slots + drag & drop).
- Integrar calendário avançado + auto-schedule UI.
- Páginas públicas premium + widgets avançados.

**Backend**
- Engine de reservas com regras e pagamentos.
- Endpoints para check-in, waitlist automática e formatos extra.
- Logs/auditoria centralizados e exports premium.
- Integrações com pagamentos, streaming e federações (fase 3).

**Dados/DevOps**
- Observabilidade e métricas (SSE, jobs, pagamentos).
- Rotinas de backup/export e validações de consistência.
- Performance para 64+ equipas, multi-categoria.

---

## 14) Backlog Inicial (Epics)

1. **Clube Core**
   - CRUD clubes + moradas normalizadas.
   - Courts e staff completos.
   - Agenda base com bloqueios.
2. **Reservas**
   - Slots configuráveis + pagamentos.
   - Waitlist e cancelamentos.
   - Relatórios base.
3. **Torneio Core**
   - Wizard dedicado + seleção de clube own/partner.
   - Categorias + regras + geração automática.
4. **Operação Live**
   - Auto-schedule + calendário premium.
   - Live score + monitor.
5. **Experiência Pública**
   - Página pública premium.
   - Widgets e exports premium.

---

## 15) Tarefas por Epic (com critérios de aceitação)

### 15.1 Clube Core
- **Tarefa:** CRUD de clubes com morada normalizada.
  - **AC:** criação/edição exige seleção de sugestão; endereço normalizado guardado + lat/long.
- **Tarefa:** Courts com metadados (indoor/outdoor, piso, ordem).
  - **AC:** criar/editar/desativar courts; ordenação persistente; validações básicas.
- **Tarefa:** Staff com roles e herança para eventos.
  - **AC:** adicionar/remover staff; flag `inheritToEvents` refletido no torneio.
- **Tarefa:** Agenda base com bloqueios.
  - **AC:** criar bloqueios por court/dia; refletir indisponibilidade em reservas.

### 15.2 Reservas
- **Tarefa:** Slots configuráveis por clube (duração e janela).
  - **AC:** agenda diária respeita horários; slots gerados automaticamente.
- **Tarefa:** Checkout de reserva com pagamento online.
  - **AC:** pagamento concluído cria reserva confirmada; falha não bloqueia agenda.
- **Tarefa:** Waitlist e cancelamentos.
  - **AC:** cancelamento promove próximo da fila; notificação enviada.
- **Tarefa:** Regras de no-show e cancelamento tardio.
  - **AC:** política aplicada conforme configuração; logs auditáveis.

### 15.3 Torneio Core
- **Tarefa:** Wizard dedicado Padel.
  - **AC:** fluxo em passos; validações claras; checklist completo.
- **Tarefa:** Seleção de clube own/partner com courts/staff.
  - **AC:** own carrega courts/staff; partner restringe edição e exige staff local.
- **Tarefa:** Formatos base + geração automática.
  - **AC:** gera grupos/KO corretos; validações de capacidade.
- **Tarefa:** Seeding e publicação de chaves.
  - **AC:** seeds configuráveis por categoria; visíveis no UI; respeitados na geração.
- **Tarefa:** Regras e desempates configuráveis.
  - **AC:** regras por categoria; desempates aplicados e auditáveis.

### 15.4 Operação Live
- **Tarefa:** Auto-schedule + calendário premium.
  - **AC:** agenda automática sem conflitos óbvios; drag & drop atualiza slots.
- **Tarefa:** Live score estável.
  - **AC:** update em tempo real; estados consistentes; logs por alteração.
- **Tarefa:** Monitor/TV melhorado.
  - **AC:** mostra próximos jogos, resultados recentes, destaque live.
- **Tarefa:** Check-in de equipas.
  - **AC:** check-in manual + opcional QR; bloqueia no-show conforme regra.

### 15.5 Experiência Pública
- **Tarefa:** Página pública premium.
  - **AC:** tabs claras; regras do match visíveis; partilha fácil.
- **Tarefa:** Widgets avançados.
  - **AC:** bracket + calendário + próximos jogos embedáveis; responsivo.
- **Tarefa:** Exports premium (poster/PDF).
  - **AC:** export com layout consistente; pronto para imprimir.
- **Tarefa:** Multilinguagem base.
  - **AC:** PT/EN/ES para páginas públicas essenciais.

---

## 16) Análise do Plano ORYA — Excelência e Comparativo Global

### 16.1 Visão Geral e Objetivo de Excelência
O plano posiciona a ORYA ao nível das plataformas globais de referência (Playtomic Manager, Padel Manager, Tournament Software, PadelTeams) ao combinar duas ferramentas integradas: **Gestão de Clube** e **Gestão de Torneios**. A orientação para simplicidade, operação robusta em tempo real, UX premium e integração total reduz fricção entre módulos e entrega um ecossistema completo de padel.

### 16.2 Gestão de Clube (Ferramenta A) — análise comparativa
- **Reservas e agenda inteligente:** disponibilidade em tempo real, agenda multi-court, drag & drop, listas de espera e open matches. Alinha-se com líderes como Playtomic, com a vantagem da agenda unificada com torneios.
- **Pagamentos integrados:** checkout unificado e políticas flexíveis (total, depósito ou offline). Esta flexibilidade supera modelos rígidos de marketplace.
- **CRM e comunidade:** perfil único do jogador, comunicação direta e matchmaking. Espaço claro para evoluir com rating de nível e evolução estatística.
- **Aulas e academia:** gestão de treinadores, agenda e pagamentos; integração faseada evita dívida técnica no MVP.
- **Eventos sociais e ligas internas:** Americano/Mexicano, ladders e ranking interno, reforçando engajamento semanal.
- **Relatórios e analytics:** dashboards financeiros e operacionais alinhados com práticas internacionais.
- **Staff e permissões:** RBAC granular para operação segura e escalável.

**Conclusão (Clube):** o escopo cobre o estado da arte e adiciona integração e flexibilidade que muitas plataformas não oferecem.

### 16.3 Gestão de Torneios (Ferramenta B) — análise comparativa
- **Wizard dedicado:** presets, templates e validações inteligentes reduzem atrito e tempo de configuração.
- **Inscrições e pagamentos:** convite de dupla simplificado, split payment guiado e waitlist automática.
- **Formatação e chaves:** suporte completo a formatos, seeding explícito, desempates visíveis e geração automática robusta.
- **Operação live:** check-in, score em tempo real, monitor/TV, notificações e logs de disputa.
- **Páginas públicas e widgets:** páginas ricas e embedáveis com foco em partilha e visibilidade.
- **Rankings e histórico:** evolução do jogador, rankings e exports “federation-ready”.

**Conclusão (Torneios):** cobre o state of the art e acrescenta recursos que muitas plataformas ainda não integram no mesmo ecossistema.

### 16.4 Integração Clube–Torneio (diferencial)
- Pré-preenchimento de dados do clube ao criar torneios.
- Agenda única para reservas, aulas e matches.
- Perfil unificado do jogador com histórico completo.
- Cross-promotion entre reservas e torneios.

**Conclusão:** integração orgânica é um diferencial claro face a soluções fragmentadas.

### 16.5 Fundamentos Operacionais e Qualidade Técnica
- **Agenda Engine única** evita conflitos e garante consistência.
- **RBAC + scopes** permitem delegação segura por função.
- **Money flows** explícitos (Stripe Connect, refunds, payouts, ledger).
- **Booking presets** garantem flexibilidade sem caos operacional.
- **Tournament lifecycle** organiza políticas e operação por estado.

**Conclusão:** base técnica sólida para operação em escala.

### 16.6 Comparativo com plataformas líderes
- **Playtomic:** ORYA empata em reservas/comunidade e supera em profundidade de torneios e flexibilidade de políticas.
- **Padel Manager:** ORYA cobre o mesmo escopo e tende a superar em UX, live ops e integração total.
- **Tournament Software/Tournify:** ORYA iguala robustez de chaves e supera com pagamentos e operação integrada.
- **PadelTeams:** ORYA cobre ligas e torneios e acrescenta reservas, aulas e agenda única.

### 16.7 Recomendações e aprimoramentos
- Considerar **rating de nível** (Elo/Glicko) para matchmaking e evolução do jogador.
- Expandir gamificação com metas e conquistas ligadas a reservas e torneios.
- Garantir UX mobile de referência e suporte in-app rápido.

### 16.8 Conclusão
Em escopo e arquitetura, o plano é **equivalente ou superior** às referências globais. O fator decisivo para liderança será execução rigorosa, UX impecável e estabilidade operacional.

### 16.9 Referências (a inserir)
- Playtomic Manager, Padel Manager, Tournament Software, PadelTeams, Tournify e apps de padel com foco em comunidade e ranking.

---

## 17) Integração com Ferramentas ORYA (para distribuição correta de escopo)

### 17.1 O que **não** deve viver nas ferramentas de Padel
Estas áreas devem ser **donas** noutras ferramentas e apenas integradas:
- **CRM:** perfis, segmentação, comunicação, histórico do cliente.
- **Finanças:** pagamentos, reembolsos, comissões, ledger, payouts.
- **Equipa:** gestão de colaboradores, roles e permissões globais.
- **Check-in:** processo único de credenciamento/presença.
- **Formulários:** campos customizados, termos e consentimentos.
- **Promoções:** descontos, cupons e campanhas.
- **Loja:** produtos, pagamentos e fulfillment.
- **Chat interno:** comunicação operacional da equipa.
- **Definições:** políticas, branding, idiomas e configuração global.

**Regra:** as Ferramentas de Padel **consomem** estas capacidades via integração e deep links, sem duplicar lógica.

### 17.2 O que fica **dentro** das ferramentas de Padel
- **Ferramenta A (Clube):** clubs/courts/staff local, agenda operacional, bloqueios, vista de reservas, insights do clube.
- **Ferramenta B (Torneios):** formatos, categorias, seeds, matches, bracket, live ops, páginas públicas.

### 17.3 Matriz de responsabilidade (owner vs integração)

| Capacidade | Dono (Ferramenta) | Uso em Padel |
|---|---|---|
| Reservas | Reservas | Padel A/B consome agenda e bloqueios. |
| Check-in | Check-in | Padel B usa status e valida presença. |
| CRM | CRM | Padel A/B lista participantes e comunica. |
| Finanças | Finanças | Padel A/B envia cobranças e consulta ledger. |
| Equipa | Equipa | Padel A/B respeita RBAC e roles globais. |
| Formulários | Formulários | Padel B usa para inscrição e waivers. |
| Promoções | Promoções | Padel A/B aplica cupons em reservas/inscrições. |
| Loja | Loja | Padel A/B pode vender extras (opcional). |
| Chat interno | Chat interno | Padel A/B abre canais de operação. |
| Perfil público | Perfil público | Padel usa pages e perfis unificados. |
| Eventos | Eventos | Torneio Padel herda base de evento. |

### 17.4 Integrações mínimas obrigatórias
- **Agenda Engine única** consumida por Reservas/Padel/Aulas.
- **RBAC centralizado** com scopes globais.
- **Pagamentos unificados** via Finanças (Stripe/ledger).
- **Single Profile** (CRM/Perfil público) para jogadores e clubes.
- **Deep links** entre ferramentas para evitar duplicação.

### 17.5 Ajustes recomendados ao plano
- Mover “comunicação com jogadores” para CRM e Chat interno.
- Mover “checkout unificado” para Finanças (Padel apenas chama).
- Mover “check-in” para a Ferramenta Check-in, mantendo UI de acesso no Padel.
- Mover “formulários/waivers” para Formulários, com embed no Padel.
- Manter Padel focado em **competição e operação**, não em infraestrutura.

---

## 18) Padel não monólito — redistribuição final e integração profunda

### 18.1 Regra de ouro
Padel não é um produto isolado; é uma **camada de domínio**. As ferramentas core (Reservas, Check-in, Finanças, Equipa, CRM, Eventos, Formulários, Chat interno, Promoções, Loja) são **donas** das suas capacidades. Padel integra e orquestra.

### 18.2 Redistribuição ideal (por ferramenta)

**Reservas (tool Reservas)**
- **Dono de:** slots, janelas, buffers, bloqueios hard/soft, waitlist, open matches, drag & drop.
- **Padel:** templates/horários recomendados, vista filtrada por courts Padel, atalhos “criar bloqueio”.

**Finanças**
- **Dono de:** Stripe Connect vs conta única, payouts/holds, refunds/chargebacks, comissões, faturas/ledger.
- **Padel:** KPIs por evento/clube + ações contextuais (deep link para reembolsos, payouts, exports).

**Equipa**
- **Dono de:** RBAC, roles globais, staff e escalas.
- **Padel:** atribuições específicas do torneio (ex.: árbitro do court, diretor do evento).

**Check-in**
- **Dono de:** QR, presença, no-show, penalizações.
- **Padel:** lista de participantes + regras de janela e penalizações.

**CRM**
- **Dono de:** membros, segmentos, comunicação e histórico.
- **Padel:** eventos/tags (ex.: “participou M4”, “no-show”, “2x/semana”).

**Eventos**
- **Dono de:** catálogo global, SEO, tickets, páginas base.
- **Padel:** wizard dedicado + estrutura competitiva (bracket/matches/rulesets).

**Formulários**
- **Dono de:** waivers, dados extra, imports e validação.
- **Padel:** exige formulário X para completar inscrição.

**Chat interno**
- **Dono de:** canais operacionais e mensagens internas.
- **Padel:** dispara eventos/alertas (atrasos, WO, mudanças de horário).

**Promoções + Loja**
- **Dono de:** vouchers, campanhas, bundles, produtos.
- **Padel:** habilita códigos e add-ons por torneio.

### 18.3 O que fica obrigatoriamente dentro de Padel (core)

**Padel – Torneios (dono):**
- Formatos (grupos/KO/A-B/dupla eliminação + Americano/Mexicano).
- Seeding, rulesets, desempates, geração de jogos.
- Slots competitivos (gravados na Agenda Engine comum).
- Operação live: scoreboard, WO, dispute, undo, match states.
- Brackets, standings, widgets e páginas públicas específicas.
- Exports competitivos (bracket/resultados/ranking/calendário).

**Padel – Clube (dono):**
- Cadastro do clube de padel e metadados específicos.
- Courts com metadados padel (indoor/outdoor, piso, ordem).
- Regras operacionais específicas (buffers recomendados, templates Padel).
- Hub com KPIs e atalhos (sem duplicar Reservas/Finanças/CRM).

### 18.4 Buracos que vão bater em produção
- **Fronteiras e source of truth:** contrato explícito (Agenda/Finanças/Check-in/CRM).
- **Operação offline:** “imprimir e operar” + reconciliação pós-evento.
- **Lock states:** quem pode mexer no quê em estado Live.
- **Dispute flow:** resolução e auditoria com UX clara.
- **Modelo de negócio:** guest booking, depósito, regras de cancelamento por janela.
- **No-show:** lembretes automáticos e penalizações.
- **Métricas operacionais:** funil de reservas, funil split-pay, tempo até publicar, atrasos por court.

### 18.5 Recomendações cirúrgicas (sem rebentar scope)
1. **Rebatizar Ferramenta A** para “Configuração Padel + Atalhos”.
2. **Criar camada de integração (event bus interno)** com eventos:
   - `tournament.published`, `match.delayed`, `pairing.confirmed`,
     `booking.cancelled`, `refund.issued`.
3. **Hub Padel** com KPIs e atalhos: “Abrir Reservas”, “Abrir Check-in”, “Abrir Finanças”, “Abrir CRM”.
