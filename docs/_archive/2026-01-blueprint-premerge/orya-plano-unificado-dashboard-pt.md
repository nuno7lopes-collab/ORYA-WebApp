# ORYA — Plano Unificado e Completo (Dashboard, Ferramentas, Fronteiras e Fluxos)

> Fonte consolidada:  
> - `docs/orya-padel-to-be-plano-excelencia-pt.md`  
> - `docs/orya-plano-desenvolvimento-analise-mercado-pt.md`  
> - `docs/orya-ferramentas-fronteiras-e-fluxos-pt.md`  
> Este documento e o guia operativo para a evolucao do dashboard da organizacao, sem perda de informacao.

---

## 0) Objetivo e visao

**Objetivo:** tornar a ORYA num hub integrado de gestao desportiva e de clubes ao nivel das melhores plataformas globais, com modulos verticais (Padel, Eventos) a consumir servicos horizontais (Reservas, Financas, CRM, Equipa, Check-in, Promocoes, Loja, Formularios, Perfil publico).

**Visao do dashboard:** experiencia unificada e previsivel, com navegacao clara por ferramentas, fronteiras bem definidas, dados com fonte unica e integracoes explicitas, suportando operacao diaria e crescimento.

---

## 1) Principios orientadores (TO-BE)

- **Simplicidade e automacao:** defaults fortes, reducao de passos e tarefas repetitivas automatizadas.
- **Operacional e robusto:** tempo real, logs e auditoria, resiliencia em operacoes criticas.
- **Experiencia premium:** UX consistente, acessibilidade e previsibilidade para organizadores e participantes.
- **Integracao total:** perfil unico, agenda unica, pagamentos centralizados, comunicacao centralizada.

---

## 2) Arquitetura de ferramentas (visao global)

### 2.1 Ferramentas horizontais (core)
- **Reservas** (agenda, servicos, disponibilidade, recursos, profissionais, clientes)
- **Check-in** (validacao presencial)
- **Financas** (ledger, payouts, refunds, faturacao)
- **Equipa** (membros, permissoes, auditoria)
- **CRM** (clientes, segmentos, campanhas, relatorios, loyalty)
- **Formularios** (campos customizados, termos, waivers)
- **Promocoes** (codigos, campanhas, bundles)
- **Notificacoes** (email/push/SMS, templates, triggers, logs)
- **Loja** (catalogo, stock, POS, checkout)
- **Perfil publico** (organizacao/jogador, seguidores, rankings)

### 2.2 Ferramentas verticais (dominio)
- **Padel — Clube** (reservas, aulas, eventos sociais, planos de socio)
- **Padel — Torneios** (formatos, chaves, operacao live, paginas publicas)
- **Eventos** (tickets, sessoes, check-in, promocao)

---

## 3) Sub-navegacoes confirmadas (AS-IS)

> Fonte: `docs/orya-ferramentas-fronteiras-e-fluxos-pt.md`

### 3.1 Reservas
- Agenda: `/organizacao/reservas`
- Disponibilidade: `/organizacao/reservas?tab=availability`
- Servicos: `/organizacao/reservas/servicos`
- Clientes: `/organizacao/reservas/clientes`
- Profissionais: `/organizacao/reservas/profissionais`
- Recursos: `/organizacao/reservas/recursos`
- Politicas: `/organizacao/reservas/politicas`

### 3.2 Eventos / Torneios
- Eventos: `/organizacao/eventos`
- Criar evento: `/organizacao/eventos/novo`
- Formularios: `/organizacao/inscricoes` (se modulo ativo)
- Torneios: `/organizacao/torneios`
- Criar torneio: `/organizacao/torneios/novo`
- Padel Hub (categorias, clubes, courts, calendario, jogadores, treinadores, aulas):  
  `/organizacao/torneios?section=padel-hub&padel=...`

### 3.3 Servicos
- Listagem: `/organizacao/reservas/servicos`
- Criar servico: `/organizacao/reservas?create=service`
- Detalhe do servico: `/organizacao/reservas/[id]`
- Sub-navegacao propria: **em falta**

### 3.4 CRM / Seguidores
- Clientes: `/organizacao/crm/clientes`
- Segmentos: `/organizacao/crm/segmentos`
- Campanhas: `/organizacao/crm/campanhas`
- Relatorios: `/organizacao/crm/relatorios`
- Pontos & recompensas: `/organizacao/crm/loyalty`
- Seguidores: **sem sub-nav dedicada** (perfil publico)

### 3.5 Financas
- Visao geral: `/organizacao?tab=analyze&section=overview`
- Vendas: `/organizacao?tab=analyze&section=vendas`
- Financas: `/organizacao?tab=analyze&section=financas`
- Faturacao: `/organizacao?tab=analyze&section=invoices`

### 3.6 Equipa
- Equipa: `/organizacao/staff`
- Convidados: `/organizacao/staff?staff=convidados`
- Permissoes: `/organizacao/staff?staff=permissoes`
- Auditoria: `/organizacao/staff?staff=auditoria`

### 3.7 Check-in
- Check-in: `/organizacao/scan`
- Sub-navegacao propria: **em falta**

---

## 4) Fronteiras, papeis e limites (TO-BE)

### 4.1 Reservas
**Papel:** agenda e bookings de recursos/servicos.  
**Limites:** nao gere ledger/payouts, nem check-in, nem comunicacao massiva.  
**Gaps:** waitlist automatica e guest booking com pagamento por link.

### 4.2 Eventos
**Papel:** catalogo de eventos, tickets, paginas publicas gerais.  
**Limites:** nao gere competicao (Padel).

### 4.3 Padel — Torneios
**Papel:** formatos, categorias, geracao de jogos, operacao live e paginas publicas especificas.  
**Limites:** nao gere pagamentos/ledger, nao gere RBAC global, nao gere check-in diretamente.

### 4.4 Servicos
**Papel:** catalogo de servicos reservaveis (aulas, courts, packs).  
**Limites:** nao gere pagamentos diretamente, nao gere comunicacao com clientes.

### 4.5 CRM / Seguidores
**Papel:** clientes, segmentos, campanhas, relatorios e loyalty.  
**Limites:** nao gere operacao de torneios nem pagamentos.

### 4.6 Financas
**Papel:** ledger, payouts, refunds e faturacao.  
**Gaps:** UI dedicada de payouts/chargebacks.

**Funds flow (MVP - decisao provisoria):**
- Conta unica por organizacao.
- Ledger interno obrigatorio.
- Payouts manuais (backoffice) ate Fase 2.

### 4.7 Equipa
**Papel:** membros, convites, permissoes e auditoria.  
**Limites:** nao gere regras de competicao nem pagamentos.

### 4.8 Check-in
**Papel:** validacao presencial (scanner, confirmacao).  
**Limites:** nao gere participantes nem pagamentos.

---

## 5) Fundamentos operacionais (single source of truth)

### 5.1 Agenda Engine (unica)
- **CalendarResource:** `clubId`, `courtId`, `trainerId`
- **CalendarBlock:** bloqueios hard/soft
- **Booking:** reserva paga
- **EventMatchSlot:** slot de match
- **ServiceSession:** aula/treino
- **Availability:** opcional para staff/jogadores

**Regra:** tudo o que ocupa um court vira um item na Agenda Engine.

### 5.2 Perfil unico
- Identidade e historico do utilizador centralizados (CRM + competicao).
- Reutilizacao entre reservas, torneios, aulas e perfil publico.

### 5.3 Pagamentos centralizados
- Checkout unificado.
- Stripe Connect ou conta unica por organizacao.
- Politicas globais com override por evento.

### 5.4 RBAC e scopes
Papéis base: Owner, Club Manager, Tournament Director, Referee/Scorekeeper, Front Desk, Coach.  
Scopes exemplo: `clubs:read/write`, `bookings:manage/refund`, `tournaments:manage`, `matches:score`, `exports:generate`.

### 5.5 Modelo de dominio (entidades + dono + IDs de ligacao)
**Regra base:** cada entidade tem um dono claro; integracoes usam IDs de ligacao para evitar duplicacao.

| Entidade | Dono (owner) | IDs de ligacao principais |
|---|---|---|
| Organization | Core/Org | `organizationId` |
| Club | Padel — Clube | `organizationId` |
| Court | Reservas | `clubId`, `organizationId` |
| Event | Eventos | `organizationId` |
| Tournament | Padel — Torneios | `eventId`, `organizationId` |
| Match | Padel — Torneios | `tournamentId`, `eventId` |
| Booking | Reservas | `resourceId`, `organizationId` |
| Payment/Charge/Refund/Payout | Financas | `organizationId`, `sourceId` |
| Customer/Contact/Segment/Campaign | CRM | `organizationId`, `userId` |
| FormDefinition/FormResponse | Formularios | `organizationId`, `contextId` |

**Nota:** `sourceId` e `contextId` referenciam o objeto de origem (ex.: `bookingId`, `eventId`, `tournamentId`).

---

## 6) Ferramenta A — Gestao de Clube de Padel (TO-BE)

### 6.1 Reservas e agenda inteligente
- Disponibilidade em tempo real e multi-court.
- Pagamentos integrados nas reservas.
- Otimizacao de ocupacao, open matches, listas de espera.
- Integracao com eventos/torneios (bloqueios).
- Vistas dia/semana e drag & drop.

### 6.2 Socios, jogadores e comunicacao
- CRM unificado e wallet opcional.
- Planos e passes.
- Comunicacao direta (notificacoes/chat/email).
- Matchmaking e comunidade.

### 6.3 Aulas, treinos e academia
- Agenda de aulas e cursos com pagamento integrado.
- Historico e feedback.
- Atalho direto ao modulo de Servicos/Aulas.

### 6.4 Eventos sociais e ligas internas
- Mix rapidos (Americano/Mexicano).
- Ligas internas e rankings locais.

### 6.5 Pagamentos, faturacao e relatorios
- Checkout unificado e recibos.
- KPIs de ocupacao e receita.
- Exportacoes e integracoes contabilisticas.
- Preparar arquitetura IoT (fase futura).

### 6.6 Staff e permissoes
- Roles por funcao, agendas e escalas.

### 6.7 Experiencia do jogador
- Portal/app com estatisticas, reservas e gamificacao.

---

## 7) Ferramenta B — Gestao de Torneios de Padel (TO-BE)

### 7.1 Criacao de torneios
- Wizard dedicado, templates e duplicacao.
- Formatos adicionais e circuitos/etapas.
- Validacoes inteligentes.

### 7.2 Inscricoes, convites e pagamentos
- Onboarding competitivo obrigatorio.
- Convite de parceiro simplificado.
- Pagamento full/split, waitlist e promocao automatica.

### 7.3 Formatos, chaves e geracao de jogos
- Geracao automatica + ajustes manuais.
- Seeding explicito e desempates visiveis.
- Calendarizacao premium com drag & drop.
- Gestao de atrasos e conflitos.

### 7.4 Operacao live
- Check-in de equipas/duplas.
- Interface de arbitro/mobile para score.
- Live score robusto e monitor/TV.
- Streaming integrado (MVP com link).

### 7.5 Paginas publicas e widgets
- Calendario, chaves, resultados e classificacoes.
- Widgets embedaveis e URLs por jogo.
- Galeria e multimédia.

### 7.6 Rankings, historico e perfis
- Rankings internos e por circuito.
- Perfis competitivos com stats e conquistas.

### 7.7 Governanca e qualidade
- Logs e auditoria centralizados.
- Permissoes multi-admin.
- Plano de contingencia com exports.
- Acessibilidade e politicas claras.

---

## 8) Eventos (TO-BE)

- Paginas de evento atrativas, bilhetes e pagamentos integrados.
- Check-in rapido por QR code.
- Promocao integrada (email, redes sociais, descontos).
- Engajamento (chat, enquetes, partilha).
- Relatorios e ROI com exportacoes.
- Agenda de sessoes sem conflitos.

---

## 9) Integracoes-chave entre ferramentas

- Reserva criada → Financas (pagamento) → CRM (interacao).
- Torneio criado → Eventos (base) + Padel (competicao) → Check-in (presenca) → CRM (historico).
- Servicos/Aulas → Reservas (disponibilidade) → Agenda Engine unica.
- CRM e Promocoes disparam **Notificacoes** (templates + triggers + logs).
- Perfil publico e rankings alimentados por Reservas e Torneios.

---

## 10) Decisao estrutural: Eventos vs Padel — Torneios

**Regra fechada:** todo torneio cria **1 Event base** (para pagina publica, tickets e check-in).  
O Tournament referencia sempre o `eventId`.

**Beneficio:** evita duplicacao de pagamentos e check-in, e garante pagina publica consistente.

---

## 11) Regras da Agenda Engine (ocupacao e conflitos)

1. **Hard block ganha sempre** sobre qualquer outro item.
2. **EventMatchSlot** bloqueia court como hard durante o slot.
3. **Booking** bloqueia court como hard enquanto ativo.
4. **Soft block** apenas avisa; nao impede a reserva (override permitido).
5. **Conflito de horarios**: dois hard blocks nunca podem coexistir no mesmo recurso.
6. **Override manual** exige `AuditLog` obrigatorio (quem/porque/quando).
7. **Prioridade de sistema**: bloqueios de manutencao > matches > reservas.
8. **Reagendamento** move o item e revalida conflitos automaticamente.

---

## 12) Decisoes fechadas (base atual)

### 10.1 Reservas de courts
- Slots configuraveis + bloqueios (hard/soft).
- Vistas: slots fixos e janelas flexiveis para torneios.

### 10.2 Aulas
- MVP com atalho e integracao parcial.
- Integracao total em Fase 2.

### 10.3 Formatos prioritarios
- Americano/Mexicano primeiro.
- Depois grupos + KO / KO / A-B.

### 10.4 Cancelamento e reembolso
- Politica global com override por evento (Flexivel / Standard / Rigido).

### 10.5 Check-in
- Manual + QR com validacao por staff no MVP.
- Self check-in opcional em fase seguinte.

### 10.6 Streaming
- Link/iframe no MVP; integracao avancada mais tarde.

### 10.7 Federacoes
- Export como base; API em fase de escala.

---

## 13) Roadmap consolidado (fases)

### Fase 0 — Fundacoes e alinhamento
- Taxonomias e fonte de verdade por entidade.
- Agenda engine unica.
- UX guidelines, acessibilidade base, logs e auditoria.
- Politicas globais (cancelamentos, pagamentos).

### Fase 1 — MVP Core
1. CRUD de clubes e courts.
2. Reservas de courts com pagamento.
3. Wizard Padel e geracao de chaves.
4. Live score e monitor basico.
5. Paginas publicas e inscricoes online.
6. Check-in manual com QR.
7. RBAC minimo viavel.
8. Financas base (refunds manuais).
9. CRM minimo com perfil unico.
10. Logs e exportacoes.

### Fase 2 — Recursos avancados
- Waitlists, reservas recorrentes, open matches.
- Americano/Mexicano completos, consolacao, ligas.
- Check-in self-service.
- Promocoes e fidelizacao.
- Loja online basica.
- Dashboards avancados.
- Acessibilidade e UX refinados.
- APIs e webhooks.

### Fase 3 — Expansao e premium
- Streaming integrado.
- Integracao com federacoes.
- IA e insights preditivos.
- Marketplace publico de reservas.
- Expansao para outros desportos.

---

## 14) Gaps e melhorias identificadas

- Reservas de courts com pagamento **em falta** no AS-IS.
- Drag & drop na agenda **parcial**.
- Waitlist automatica e guest booking **em falta**.
- Check-in dedicado com sub-nav **em falta**.
- Sub-nav de Seguidores **em falta**.
- UI de payouts/chargebacks **em falta**.
- Acessibilidade formal **em falta**.
- Americano/Mexicano completos **em falta** no AS-IS.

---

## 15) Questoes e notas a aprofundar

1. **Agenda Engine:** qual o modelo definitivo para recursos nao-horarios (ex.: alojamento) e reservas multi-dia?
2. **Pagamentos:** Stripe Connect vs conta unica por organizacao; politica de holds e libertacao?
3. **No-show e cancelamentos:** regras globais vs excecoes por clube/torneio; qual a janela minima?
4. **Check-in self-service:** geofencing, limites e anti-fraude?
5. **RBAC:** quais os scopes minimos para Front Desk, Coach e Referee?
6. **CRM e perfil:** como gerir opt-in/privacidade e exportacao de dados (RGPD)?
7. **Promocoes e loyalty:** quais os primeiros casos de uso (ex.: packs, torneios, aulas)?
8. **Loja:** prioridade e integracao com POS fisico; como gerir stock multi-local?
9. **UX do dashboard:** qual a sub-navegacao ideal para Servicos, Seguidores e Check-in?
10. **Metrica de sucesso:** quais os KPIs prioritarios por modulo (reservas, torneios, CRM)?

---

## 16) Metricas de sucesso (exemplos)

- Tempo medio para criar torneio completo.
- Percentagem de auto-schedule bem-sucedido.
- Taxa de preenchimento de categorias.
- Ocupacao media de courts.
- Conversao em paginas publicas.
- Retencao de clubes e utilizadores.

---

## 17) Fluxos operacionais por papel (MVP)

### 17.1 Club Manager
1. Criar clube e courts.
2. Definir disponibilidade e politicas.
3. Abrir reservas e ativar pagamentos.
4. Monitorizar ocupacao e receita.
5. Exportar relatorios.

### 17.2 Tournament Director
1. Criar torneio (gera Event base).
2. Abrir inscricoes e gerir duplas.
3. Sortear e gerar chaves.
4. Agendar slots e operar live score.
5. Publicar resultados e exportar.

### 17.3 Front Desk
1. Check-in presencial (QR/manual).
2. Marcar no-show e registar ocorrencias.
3. Venda no POS (se aplicavel).
4. Reembolso assistido (Financas).

### 17.4 Coach
1. Criar/gerir aulas (Servicos).
2. Marcar presencas.
3. Dar feedback e atualizar historico.
4. Reagendar quando necessario.

---

## 18) Sidebar TO-BE (proposta)

**Nivel 1:**
- Dashboard
- Reservas
- Padel (Clube / Torneios)
- Eventos
- CRM
- Financas
- Loja
- Check-in
- Equipa
- Definicoes

**Sub-nav (exemplos):**
- Reservas: Agenda, Disponibilidade, Servicos, Clientes, Profissionais, Recursos, Politicas
- Padel: Clube (Courts, Aulas, Ligas) / Torneios (Categorias, Calendario, Jogadores)
- CRM: Clientes, Segmentos, Campanhas, Relatorios, Loyalty
- Financas: Visao geral, Vendas, Financas, Faturacao, Payouts
- Check-in: Scanner, Historico, Regras
