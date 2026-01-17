# ORYA v1 Product Specification (MVP) - Versao detalhada (PT)

Este documento e a versao detalhada da especificacao do ORYA v1. Mantem todas as decisoes acordadas sem adicionar novos escopos. O objetivo e clarificar estrutura, comportamento e limites do MVP para implementacao consistente em mobile e desktop.

## 1. Visao e Posicionamento

ORYA e uma rede social de experiencias do mundo real onde utilizadores descobrem e reservam eventos, servicos e torneios de padel. Combina feed social, bilheteira e motor de reservas.

- User-centric: tudo comeca no utilizador. Organizações e clubes existem apenas como extensao do utilizador.
- Feed-first: a app abre sempre no feed personalizado. Mapa fica para fase posterior.
- Categorias ("Mundos"): descoberta organizada em Events, Padel e Reservations (servicos). Nightlife e um template dentro de Events, nao um mundo separado.
- Privacidade: reservas e compras sao privadas por defeito; atividade social e opt-in e respeita visibilidade escolhida pelo utilizador.

### 1.1 Padel Perfeito (objetivo e principios)

Objetivo:
- Jogadores: inscricao simples, agenda clara, resultados em tempo real, historico e ranking.
- Organizadores/clubes: fluxo guiado, automatizacao maxima, operacao diaria sem friccao.
- ORYA: padel como pilar social integrado em feed, perfis e pagamentos.

Principios:
- Simplicidade com profundidade: defaults bons, opcoes avancadas escondidas.
- Automacao primeiro: gerar jogos, avancos, ranking e notificacoes sem trabalho manual.
- Tempo real: tudo atualiza instantaneamente (jogos, tabelas, brackets, feed).
- Mobile-first: organizador e jogador conseguem gerir quase tudo pelo telemovel.
- Escalavel: funciona para 8 ou 800 equipas, com performance e estabilidade.

Base obrigatoria (competitivo):
- Ciclo completo do torneio: inscricoes -> sorteio -> jogos -> resultados -> ranking.
- Multiplos formatos (grupos, eliminatorias, quadro A/B, nonstop).
- Sorteio com seeds e distribuicao automatica.
- Passagem de "melhor segundo" e regras de desempate configuraveis.
- Paginas publicas em tempo real (calendario, resultados, brackets).
- Multi-organizador com roles (owner/admin/staff).
- Ranking por torneio e por clube, com tabela de pontos.
- TV Monitor para ecras no clube.

Diferenciais ORYA (lideranca):
- Wizard de criacao (fluxo guiado passo a passo).
- Auto-scheduling com detecao de conflitos e respeito por indisponibilidades.
- Notificacoes inteligentes por jogo, fase e categoria.
- Pagamentos in-app com split nativo e confirmacao automatica.
- UI/UX moderna com identidade visual do clube.
- Social + comunidade (feed de resultados e community games).
- Streaming por jogo e base para live score.

## 2. Modelo de Entidades (alto nivel)

### 2.1 Principios de dados

- Tudo deve ser atribuivel a um utilizador (criador, comprador, participante).
- Organizações nao substituem utilizadores; apenas agregam operacoes e permissoes.
- O modelo deve suportar crescimento futuro sem alterar o basico do MVP.

### 2.2 Utilizadores

- User: entidade base. Guarda dados de autenticacao, nome exibido, username (@), avatar e preferencias basicas.
- UserProfile: perfil publico e preferencias. Inclui bio, cidade e campos de padel opcionais (nivel, mao dominante, posicao). Estes campos sao obrigatorios apenas quando o utilizador participa num torneio ou ativa modo padel.
- Follow: relacao unidirecional. Seguir mutuo equivale a seguimento reciproco. Controlo de visibilidade por utilizador (publico / seguidores / privado).
- UserActivity: eventos de atividade (RSVP, compra de bilhetes, conquistas de padel). Apenas exibido se respeitar privacidade.
- Notifications: alertas para follows, confirmacoes de RSVP, compras, convites e outros eventos relevantes.

### 2.3 Organizações

- Organization: grupo (negocio, promotor, clube de padel). Campos chave: nome, slug, categoria primaria, descricao, branding (logo, cover), estado (active / suspended) e Stripe Connect ID.
- OrgMembership: liga utilizador a organização com role (Owner, Admin, Staff, Promoter) e estado (invited, accepted, removed). Deve existir sempre pelo menos um Owner.
- OrgRole:
  - Owner: controlo total, pode transferir ownership, ver financas, gerir membros, editar tudo.
  - Admin: controlo operacional; gere eventos/servicos/torneios, ve financas, convida membros. Nao transfere ownership.
  - Staff: controlo limitado; gere eventos/servicos/torneios conforme tipo de organização, sem acesso a financas.
  - Promoter: cria links de tracking e ve apenas as suas vendas. Nao edita dados core nem financas.
- AuditLog: regista acoes sensiveis (transferencias, mudancas de roles, politicas, payouts) para responsabilidade.
- OrgPolicy: politicas de cancelamento e reembolso. Templates Flexivel, Moderada, Rigida. Organizações podem criar politicas adicionais.
- Review: avaliacao opcional (rating + texto) sobre organização. So exibida quando houver moderacao (nao prioridade no v1).

### 2.4 Pagamentos e financeiros

- PaymentCustomer: liga utilizador ao customer Stripe.
- ConnectAccount: liga organização ao Stripe Connect para payouts diretos.
- Transaction: regista cada pagamento (montante, Stripe charge ID, fee ORYA, fee Stripe, estado de payout). Apenas Owner e Admin veem.
- PayoutRecord: resumo de payouts para organização, automatizado via Stripe Connect.
- SplitPayment: usado no padel e casos com participantes multiplos. Cada participante tem quota e estado (paid, pending). Modelo base do MVP cobra o captain pelo total se outros falharem; pre-autorizacao pode existir no futuro.

### 2.5 Modulos

#### Events

- Event: entidade central (titulo, descricao, data/hora, venue, capacidade, categoria/template, organização). Suporta multiplos tipos de bilhete.
- TicketType (waves): preco, quantidade e janela de disponibilidade.
- Order: liga utilizador a bilhetes comprados; inclui user ID, organization ID, event ID, total e status.
- Ticket: bilhete individual com QR code, status (valid/used/refunded) e Order associado.
- CheckIn: regista leitura de bilhete na entrada (tabela existe no v1, uso opcional).

#### Reservations (servicos)

- Service: servico ou recurso (ex: manicure, haircut, meeting room). Campos: nome, descricao, duracao, preco, staff associado (opcional).
- Availability: slots por servico (data/hora, duracao, capacidade, estado).
- Booking: reserva; inclui service ID, organization ID, user ID, slot/hora, preco, status (pending, confirmed, cancelled).
- Pagamento de reservas: imediato no checkout para garantir o slot.
- BookingPolicyRef: referencia a politica usada para cancelamento/no-show.

#### Padel

- PadelClub: clube de padel dentro de uma Organization; branding, contactos e courts.
- Court: campos/quadras do clube com estado (ativo/inativo) e bloqueios de horario.
- Tournament: torneio organizado por clube ou utilizador. Inclui estado (oculto/desenvolvimento/publico/cancelado), formato e taxa de inscricao.
- Division/Category: niveis e genero dentro do torneio, com limites e formato por categoria.
- TournamentStage/Group: fases do torneio (grupos, playoffs, consolacao) geradas automaticamente.
- Pair: equipa de dois utilizadores.
- Match: jogo com horario, court, estado e resultado (com flags WO/desistiu/lesao).
- PadelRuleSet: regras de jogo e desempate aplicadas ao torneio.
- PadelPlayerProfile: dados especificos do padel por utilizador (nivel, mao dominante, lado preferido, stats). Criado na primeira participacao.
- RankingSnapshot: snapshot periodico de ranking para tabelas e historico.

## 3. Navegacao e Interface

### 3.1 Mobile (tabs inferiores)

- Tabs fixas: Inicio, Descobrir, Criar, Social, Perfil.
- "Inicio" - feed personalizado com social e agenda pessoal. Detalhes em 4.1.
- "Descobrir" - descoberta por mundos (Events, Padel, Reservations). Mudanca via tabs/chips no topo. Nightlife aparece como template em Events.
- "Criar" - botao central destacado (pill/FAB) com folha de acoes. Opcoes dependem dos roles do utilizador: criar event, criar reserva/servico, criar torneio, criar promoter link.
- "Social" - notificacoes e interacoes sociais: atividade, pedidos, sugestoes, pesquisa.
- "Perfil" - conta do utilizador com agenda, favoritos, stats padel (se ativo) e "As minhas organizações".

Estados e comportamento:
- Tab ativa com destaque visual claro; tabs inativas com tratamento neutro.
- Badges em "Social" para novos itens. Notificacoes no topo quando aplicavel.

Top bar inclui notificacoes; chat fica fora do MVP.

### 3.2 Desktop (topbar, sem sidebar)

- Topbar fixa com tabs primarias: Inicio, Descobrir, Social, Perfil.
- Botao "Criar" a direita (equivalente ao "+" mobile) sempre visivel.
- Pesquisa global opcional na topbar; obrigatoria em Descobrir.
- Workspace de organização abre na mesma interface, mantendo topbar.

### 3.3 Workspace de Organização (Modo Organização)

Ao entrar numa organização, o utilizador muda para um layout interno com quatro tabs:

- Painel: metricas de alto nivel (eventos, reservas, torneios, receita semanal, conversao) e acoes rapidas.
- Gestao: secoes dependem da categoria primaria:
  - Eventos: lista de eventos (futuros e passados), criar/editar, gerir waves e check-ins.
  - Reservas: agenda/calendario, gerir servicos/recursos, ver bookings, definir politicas.
  - Padel Clube: lista de torneios, ranking, roster de jogadores, gerir courts (se aplicavel).
- Equipa: gerir membros, convites, roles e logs de mudancas.
- Relatorios/Financas: ver transacoes e payouts (Owner/Admin). Mostra fees ORYA e Stripe.

Topbar adapta-se para mostrar nome/branding da organização e tabs internas do modo.
Existe um botao claro "Sair do modo organização" para regressar a experiencia pessoal.

## 4. Layouts e Fluxos Principais

### 4.1 Inicio (Home Feed)

- Em Alta: lista de items em destaque por cidade. No v1 e curada manualmente.
- Para ti: dashboard pessoal com blocos:
  - Proximos Eventos: eventos comprados ou com RSVP.
  - Proximas Reservas: reservas futuras (visiveis apenas ao utilizador).
  - Padel: torneios proximos e ranking atual (se perfil padel ativo).
  - Onde quem segues vai: atividades publicas de pessoas que segues (respeitando privacidade).
  - Sugestoes: organizações ou eventos recomendados por interesses/uso.
- Posts curtos: anuncios de organizações e comentarios de utilizadores, com CTAs contextuais: Comprar, Reservar, Inscrever-me, Juntar-me.

Estados esperados:
- Sem atividade: mostrar empty state amigavel com sugestoes.
- Com atividade: feed com mistura de blocos e cards.

### 4.2 Descobrir

- Barra de pesquisa no topo.
- Tabs de mundos: Events, Padel, Reservations.
- Cada mundo tem listagem e filtros:
  - Events: cards com nome, data, organização, preco. Nightlife ajusta template (VIP/Guest list). Filtros: Today, This week, Price range, Category.
  - Padel: torneios, courts publicos, community games. Filtros: data, nivel, formato (mixed/men/women).
  - Reservations: servicos com horarios disponiveis. Filtros: tipo de servico, data, preco.

### 4.3 Social (Activity and Suggestions)

Tabs internas:

- Atividade: feed cronologico de follows, RSVPs publicos, resultados de torneios. Reservas permanecem privadas.
- Pedidos: follow requests, convites de organização, convites de promoter.
- Sugestoes: utilizadores recomendados por localizacao, interesses e seguidores em comum. Cada item mostra numero de mutuals e botao seguir.
- Search: pesquisar utilizadores (opcionalmente organizações).

### 4.4 Perfil (User Profile)

- Header: avatar, nome, @username, botao "editar perfil".
- Proximos: cards de eventos e reservas com CTAs (download ticket, gerir booking). Apenas o utilizador ve.
- Favourites: lista de eventos, servicos e organizações favoritas.
- Padel: visivel so com perfil padel ativo; mostra ranking, torneios recentes e stats.
- As Minhas Organizações: lista com badges (Owner/Admin/etc). Clique abre Modo Organização.

### 4.5 Perfis Publicos de Organização

#### Organização (Events)

- Cover, logo, descricao curta.
- Upcoming events com preco e CTA Comprar.
- Past events colapsados.
- Reviews (se ativado).

#### Negocio (Reservations)

- Servicos oferecidos com duracao e preco.
- Calendario ou lista de slots disponiveis.
- CTA Reservar para fluxo de booking.

#### Clube Padel

- Overview: descricao, localizacao, contacto.
- Torneios ativos com CTA Inscrever-me.
- Ranking board / hall of fame.
- Lista de jogadores registados (avatars).

### 4.6 Detalhe de Evento e Compra de Bilhete

- Nome do evento, banner, organização, data/hora, local, descricao.
- Opcoes de bilhete (waves) com preco, quantidade restante e janela de venda.
- CTA Comprar; apos checkout, confirmacao e bilhete com QR code.
- Opcional: campo de codigo de promoter (template Nightlife).

### 4.7 Detalhe de Servico e Reserva

- Nome, descricao, duracao, preco.
- Seletor de disponibilidade (calendario ou lista) para escolher slot livre.
- Resumo de politica (nome e janela de cancelamento).
- CTA Reservar; confirmacao com data/hora, preco, politica e contacto.

### 4.8 Padel Perfeito (fluxo e funcionalidades)

Objetivo: tornar o padel o modulo mais forte do ORYA, com fluxo guiado, automacao e tempo real, sem perder flexibilidade.

Estados da competicao:
- Oculto: configuracao interna, sem dados publicos.
- Desenvolvimento: inscricoes abertas e listas visiveis para utilizadores autenticados.
- Publico: calendario, resultados, brackets e tabelas em tempo real.
- Cancelado: apenas aviso de cancelamento.

Fluxo do jogador:
- Descobrir torneio -> pagina publica -> CTA Inscrever-me.
- Escolher categoria(s) e parceiro (ou procurar parceiro).
- Pagar (split payment quando aplicavel).
- Receber agenda e notificacoes (ex: jogo em 30 min).
- Acompanhar resultados em tempo real e ver ranking/historico no perfil.

Fluxo do organizador:
- Criar torneio via wizard (dados base, categorias, formato, pagamentos, courts).
- Abrir inscricoes e acompanhar pagamentos.
- Gerar brackets e sorteio com seeds.
- Gerar calendario e ajustar por drag-and-drop.
- Publicar e inserir resultados (ou delegar a staff).
- Encerrar com ranking e comunicados.

### 4.9 Split Payments (Padel e futuros casos)

- Captain paga o total no checkout (MVP). Aviso explica que, se convidados nao pagarem ate a data, o restante sera cobrado ao captain.
- Apos pagamento, convidados recebem pedido para pagar a sua parte por email/app. O sistema guarda estado (paid/pending). Nao ha refund automatico se alguem sair; a organizacao decide via politica.

## 5. Consideracoes Financeiras e Legais

- Pagamentos via Stripe Connect. ORYA aplica fee de plataforma e Stripe aplica fee de processamento automaticamente.
- Moeda: apenas EUR no v1.
- Preco publico: o preco exibido ao utilizador inclui sempre todas as taxas (ORYA + Stripe) e e o valor final.
- Checkout: nao exibe breakdown de taxas ao utilizador; apenas o organização ve o detalhe das taxas nas transacoes e relatorios.
- Codigos de desconto: podem reduzir o total pago; o utilizador ve o desconto aplicado (codigo/valor), sem breakdown de taxas.
- Sem carteira interna ou saldo. Fundos seguem direto para a Connect account do organização.
- Reembolsos sao definidos por politica do organização (templates ou custom). ORYA apenas aplica as regras.
- Chargebacks e fraude ficam com Stripe, mas ORYA regista tudo no AuditLog.

## 6. Matriz de Roles e Permissoes de Organização

![Matriz de Roles e Permissoes de Organização](./assets/organisation-roles-permissions-matrix.svg)

## 7. Questoes em Aberto e Decisoes Finais

- Trending (Em Alta) - no inicio e curado manualmente ou gerado por vendas/metricas ate existir recomendacao robusta.
- Check-in - scanning de bilhetes faz parte do modulo de eventos; tabela e UI existem, mas pode ser desativado no primeiro release e ativado depois.
- Convites para organizações - podem ser por email ou notificacao. Exigem aceitacao. Roles atribuidas na aceitacao. Utilizadores podem pedir para entrar, sujeito a aprovacao de Owner/Admin.
- Clubes tab - omitido na bottom navigation do MVP. Clubes existem como organizações sem tab dedicada.
- Chat - excluido do MVP. Apenas notificacoes e comentarios. Chat em tempo real fica para depois.
- Padel - regras de desempate padrao vs custom (ate onde vai a configuracao do organizador).
- Padel - modelo de ranking global (peso por nivel vs fase, e cadencia de expirar pontos).
- Padel - politica de cancelamento de jogos e impacto no ranking.
- Padel - validacao de resultados enviados por jogadores.

## 8. Roadmap Pos-MVP (Fases de Implementacao)

### Fase 0 - Fundacoes (core padel)

Objetivo: garantir base tecnica e funcional para o modulo de padel funcionar de ponta a ponta.

Entregas:
- Modelos base: PadelClub, Court, Tournament, Division/Category, Stage/Group, Match, RuleSet.
- Regras de estados da competicao (oculto/desenvolvimento/publico/cancelado).
- Motor de geracao de jogos (grupos, playoffs, quadro A/B, todos contra todos, nonstop).
- Seeds e sorteio base (aleatorio e manual).
- Regras de desempate padrao (configuracao por torneio).
- Logs e auditoria para acoes sensiveis (sorteios, resultados, cancelamentos).

### Fase 1 - MVP Competitivo (padel completo)

Objetivo: igualar o PadelTeams no essencial e permitir torneios reais do inicio ao fim.

Entregas:
- Criacao de torneio e categorias (com limites, genero, nivel).
- Inscricoes (dupla/individual) com pagamento Stripe e split payment.
- Lista de espera (pendentes) quando excede capacidade.
- Brackets e tabelas publicas em tempo real.
- Calendario manual com drag-and-drop + bloqueios de horario.
- Insercao de resultados com foto e flags (WO/desistiu/lesao).
- Ranking basico por torneio + historico no perfil do jogador.
- Notificacoes basicas (inscricao confirmada, bracket publicado, torneio iniciou/finalizou).

### Fase 2 - V1+ Diferenciais ORYA

Objetivo: vencer em UX e automacao, reduzindo friccao para organizadores e jogadores.

Entregas:
- Wizard de criacao (passo a passo com defaults inteligentes).
- Auto-scheduling inicial com deteccao de conflitos e respeito por indisponibilidades.
- Notificacoes inteligentes por jogo (ex: 30 min antes).
- TV Monitor com modos automatico e curado.
- Easy Mix / community games (torneios rapidos).
- Templates de torneio (8/16/32) com setups prontos.
- Personalizacao visual do clube (cores, banner, patrocinadores).
- Convites privados com codigo (competicoes fechadas).
- Regras de ranking com modelos pre-definidos (clubes podem ajustar).

### Fase 3 - Escala e Produto Premium

Objetivo: escalar para clubes grandes e elevar a experiencia competitiva.

Entregas:
- Live score e streaming por jogo (link e base para integracao futura).
- API e widgets publicos (proximos jogos, tabela, inscricoes).
- Analitica avancada (pagamentos, tempo medio de jogo, ocupacao de courts).
- Exportacao PDF/Excel de calendarios, resultados e rankings.
- Ranking regional/global com filtros por periodo.
- Multi-idioma e localizacao completa (datas, moedas, textos).

### Fase 4 - Padel Club OS (opcional estrategico)

Objetivo: tornar ORYA o sistema operativo do clube.

Entregas:
- Reservas de courts e aulas.
- Gestao de membros e planos (fora do MVP).
- Financeiro integrado e caixa do clube.

Outras iniciativas transversais (dependem de prioridade global ORYA):
- Map view com geolocalizacao e clustering.
- Experiencias publicas criadas por utilizadores com moderacao.
- Clubes como entidade principal com feeds e group chats.
- Chat em tempo real entre utilizadores, staff, promoters e organizacoes.
- Payouts automaticos para promoters com thresholds e agendamento.
- Ferramentas de marketing para organizacoes (email campaigns, push notifications).

Este documento captura todas as decisoes e estruturas necessarias para o ORYA v1. Cada pagina e modulo esta limitado para entregar uma experiencia coesa sem over-engineering. As funcionalidades futuras ficam indicadas, mas nao entram no MVP.
