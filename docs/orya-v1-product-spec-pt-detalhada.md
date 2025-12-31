# ORYA v1 Product Specification (MVP) - Versao detalhada (PT)

Este documento e a versao detalhada da especificacao do ORYA v1. Mantem todas as decisoes acordadas sem adicionar novos escopos. O objetivo e clarificar estrutura, comportamento e limites do MVP para implementacao consistente em mobile e desktop.

## 1. Visao e Posicionamento

ORYA e uma rede social de experiencias do mundo real onde utilizadores descobrem e reservam eventos, servicos e torneios de padel. Combina feed social, bilheteira e motor de reservas.

- User-centric: tudo comeca no utilizador. Organizacoes e clubes existem apenas como extensao do utilizador.
- Feed-first: a app abre sempre no feed personalizado. Mapa fica para fase posterior.
- Categorias ("Mundos"): descoberta organizada em Events, Padel e Reservations (servicos). Nightlife e um template dentro de Events, nao um mundo separado.
- Privacidade: reservas e compras sao privadas por defeito; atividade social e opt-in e respeita visibilidade escolhida pelo utilizador.

## 2. Modelo de Entidades (alto nivel)

### 2.1 Principios de dados

- Tudo deve ser atribuivel a um utilizador (criador, comprador, participante).
- Organizacoes nao substituem utilizadores; apenas agregam operacoes e permissoes.
- O modelo deve suportar crescimento futuro sem alterar o basico do MVP.

### 2.2 Utilizadores

- User: entidade base. Guarda dados de autenticacao, nome exibido, username (@), avatar e preferencias basicas.
- UserProfile: perfil publico e preferencias. Inclui bio, cidade e campos de padel opcionais (nivel, mao dominante, posicao). Estes campos sao obrigatorios apenas quando o utilizador participa num torneio ou ativa modo padel.
- Follow: relacao unidirecional. Seguir mutuo equivale a amizade. Controlo de visibilidade por utilizador (publico / amigos / privado).
- UserActivity: eventos de atividade (RSVP, compra de bilhetes, conquistas de padel). Apenas exibido se respeitar privacidade.
- Notifications: alertas para follows, confirmacoes de RSVP, compras, convites e outros eventos relevantes.

### 2.3 Organizacoes

- Organization: grupo (negocio, promotor, clube de padel). Campos chave: nome, slug, categoria primaria, descricao, branding (logo, cover), estado (active / suspended) e Stripe Connect ID.
- OrgMembership: liga utilizador a organizacao com role (Owner, Admin, Staff, Promoter) e estado (invited, accepted, removed). Deve existir sempre pelo menos um Owner.
- OrgRole:
  - Owner: controlo total, pode transferir ownership, ver financas, gerir membros, editar tudo.
  - Admin: controlo operacional; gere eventos/servicos/torneios, ve financas, convida membros. Nao transfere ownership.
  - Staff: controlo limitado; gere eventos/servicos/torneios conforme tipo de organizacao, sem acesso a financas.
  - Promoter: cria links de tracking e ve apenas as suas vendas. Nao edita dados core nem financas.
- AuditLog: regista acoes sensiveis (transferencias, mudancas de roles, politicas, payouts) para responsabilidade.
- OrgPolicy: politicas de cancelamento e reembolso. Templates Flexivel, Moderada, Rigida. Organizacoes podem criar politicas adicionais.
- Review: avaliacao opcional (rating + texto) sobre organizacao. So exibida quando houver moderacao (nao prioridade no v1).

### 2.4 Pagamentos e financeiros

- PaymentCustomer: liga utilizador ao customer Stripe.
- ConnectAccount: liga organizacao ao Stripe Connect para payouts diretos.
- Transaction: regista cada pagamento (montante, Stripe charge ID, fee ORYA, fee Stripe, estado de payout). Apenas Owner e Admin veem.
- PayoutRecord: resumo de payouts para organizacao, automatizado via Stripe Connect.
- SplitPayment: usado no padel e casos com participantes multiplos. Cada participante tem quota e estado (paid, pending). Modelo base do MVP cobra o captain pelo total se outros falharem; pre-autorizacao pode existir no futuro.

### 2.5 Modulos

#### Events

- Event: entidade central (titulo, descricao, data/hora, venue, capacidade, categoria/template, organizador). Suporta multiplos tipos de bilhete.
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

- Tournament: torneio organizado por clube ou utilizador. Campos: nome, intervalo de datas, categoria (mixed/men/women), formato, taxa de inscricao.
- Division: niveis dentro do torneio.
- Pair: equipa de dois utilizadores.
- Match: resultados e pontuacoes.
- PadelPlayerProfile: dados especificos do padel por utilizador (nivel, mao dominante, lado preferido, stats). Criado na primeira participacao.
- RankingSnapshot: snapshot periodico de ranking para tabelas e historico.

## 3. Navegacao e Interface

### 3.1 Mobile (tabs inferiores)

- Tabs fixas: Inicio, Descobrir, Criar, Social, Perfil.
- "Inicio" - feed personalizado com social e agenda pessoal. Detalhes em 4.1.
- "Descobrir" - descoberta por mundos (Events, Padel, Reservations). Mudanca via tabs/chips no topo. Nightlife aparece como template em Events.
- "Criar" - botao central destacado (pill/FAB) com folha de acoes. Opcoes dependem dos roles do utilizador: criar event, criar reserva/servico, criar torneio, criar promoter link.
- "Social" - notificacoes e interacoes sociais: atividade, pedidos, sugestoes, pesquisa.
- "Perfil" - conta do utilizador com agenda, favoritos, stats padel (se ativo) e "As minhas organizacoes".

Estados e comportamento:
- Tab ativa com destaque visual claro; tabs inativas com tratamento neutro.
- Badges em "Social" para novos itens. Notificacoes no topo quando aplicavel.

Top bar inclui notificacoes; chat fica fora do MVP.

### 3.2 Desktop (topbar, sem sidebar)

- Topbar fixa com tabs primarias: Inicio, Descobrir, Social, Perfil.
- Botao "Criar" a direita (equivalente ao "+" mobile) sempre visivel.
- Pesquisa global opcional na topbar; obrigatoria em Descobrir.
- Workspace de organizacao abre na mesma interface, mantendo topbar.

### 3.3 Workspace de Organizacao (Modo Organizacao)

Ao entrar numa organizacao, o utilizador muda para um layout interno com quatro tabs:

- Painel: metricas de alto nivel (eventos, reservas, torneios, receita semanal, conversao) e acoes rapidas.
- Gestao: secoes dependem da categoria primaria:
  - Eventos: lista de eventos (futuros e passados), criar/editar, gerir waves e check-ins.
  - Reservas: agenda/calendario, gerir servicos/recursos, ver bookings, definir politicas.
  - Padel Clube: lista de torneios, ranking, roster de jogadores, gerir courts (se aplicavel).
- Equipa: gerir membros, convites, roles e logs de mudancas.
- Relatorios/Financas: ver transacoes e payouts (Owner/Admin). Mostra fees ORYA e Stripe.

Topbar adapta-se para mostrar nome/branding da organizacao e tabs internas do modo.
Existe um botao claro "Sair do modo organizacao" para regressar a experiencia pessoal.

## 4. Layouts e Fluxos Principais

### 4.1 Inicio (Home Feed)

- Em Alta: lista de items em destaque por cidade. No v1 e curada manualmente.
- Para ti: dashboard pessoal com blocos:
  - Proximos Eventos: eventos comprados ou com RSVP.
  - Proximas Reservas: reservas futuras (visiveis apenas ao utilizador).
  - Padel: torneios proximos e ranking atual (se perfil padel ativo).
  - Onde os amigos vao: atividades publicas de amigos (respeitando privacidade).
  - Sugestoes: organizacoes ou eventos recomendados por interesses/uso.
- Posts curtos: anuncios de organizadores e comentarios de utilizadores, com CTAs contextuais: Comprar, Reservar, Inscrever-me, Juntar-me.

Estados esperados:
- Sem atividade: mostrar empty state amigavel com sugestoes.
- Com atividade: feed com mistura de blocos e cards.

### 4.2 Descobrir

- Barra de pesquisa no topo.
- Tabs de mundos: Events, Padel, Reservations.
- Cada mundo tem listagem e filtros:
  - Events: cards com nome, data, organizador, preco. Nightlife ajusta template (VIP/Guest list). Filtros: Today, This week, Price range, Category.
  - Padel: torneios, courts publicos, community games. Filtros: data, nivel, formato (mixed/men/women).
  - Reservations: servicos com horarios disponiveis. Filtros: tipo de servico, data, preco.

### 4.3 Social (Activity and Suggestions)

Tabs internas:

- Atividade: feed cronologico de follows, RSVPs publicos, resultados de torneios. Reservas permanecem privadas.
- Pedidos: follow requests, convites de organizacao, convites de promoter.
- Sugestoes: utilizadores recomendados por localizacao, interesses e amigos em comum. Cada item mostra numero de mutuals e botao seguir.
- Search: pesquisar utilizadores (opcionalmente organizacoes).

### 4.4 Perfil (User Profile)

- Header: avatar, nome, @username, botao "editar perfil".
- Proximos: cards de eventos e reservas com CTAs (download ticket, gerir booking). Apenas o utilizador ve.
- Favourites: lista de eventos, servicos e organizacoes favoritas.
- Padel: visivel so com perfil padel ativo; mostra ranking, torneios recentes e stats.
- As Minhas Organizacoes: lista com badges (Owner/Admin/etc). Clique abre Modo Organizacao.

### 4.5 Perfis Publicos de Organizacao

#### Organizador (Events)

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

- Nome do evento, banner, organizador, data/hora, local, descricao.
- Opcoes de bilhete (waves) com preco, quantidade restante e janela de venda.
- CTA Comprar; apos checkout, confirmacao e bilhete com QR code.
- Opcional: campo de codigo de promoter (template Nightlife).

### 4.7 Detalhe de Servico e Reserva

- Nome, descricao, duracao, preco.
- Seletor de disponibilidade (calendario ou lista) para escolher slot livre.
- Resumo de politica (nome e janela de cancelamento).
- CTA Reservar; confirmacao com data/hora, preco, politica e contacto.

### 4.8 Fluxo de Torneio (Padel)

- Pagina do torneio com divisoes, taxa de inscricao, deadline e regras.
- CTA Inscrever-me; utilizador insere parceiro ou escolhe par aleatorio; pagamento via Stripe.
- Apos inscricao, dupla aparece em bracket/roster; ranking atualiza apos torneio.

### 4.9 Split Payments (Padel e futuros casos)

- Captain paga o total no checkout (MVP). Aviso explica que, se convidados nao pagarem ate a data, o restante sera cobrado ao captain.
- Apos pagamento, convidados recebem pedido para pagar a sua parte por email/app. O sistema guarda estado (paid/pending). Nao ha refund automatico se alguem sair; o organizador decide via politica.

## 5. Consideracoes Financeiras e Legais

- Pagamentos via Stripe Connect. ORYA aplica fee de plataforma e Stripe aplica fee de processamento automaticamente.
- Moeda: apenas EUR no v1.
- Preco publico: o preco exibido ao utilizador inclui sempre todas as taxas (ORYA + Stripe) e e o valor final.
- Checkout: nao exibe breakdown de taxas ao utilizador; apenas o organizador ve o detalhe das taxas nas transacoes e relatorios.
- Codigos de desconto: podem reduzir o total pago; o utilizador ve o desconto aplicado (codigo/valor), sem breakdown de taxas.
- Sem carteira interna ou saldo. Fundos seguem direto para a Connect account do organizador.
- Reembolsos sao definidos por politica do organizador (templates ou custom). ORYA apenas aplica as regras.
- Chargebacks e fraude ficam com Stripe, mas ORYA regista tudo no AuditLog.

## 6. Matriz de Roles e Permissoes de Organizacao

![Matriz de Roles e Permissoes de Organizacao](./assets/organisation-roles-permissions-matrix.svg)

## 7. Questaoes em Aberto e Decisoes Finais

- Trending (Em Alta) - no inicio e curado manualmente ou gerado por vendas/metricas ate existir recomendacao robusta.
- Check-in - scanning de bilhetes faz parte do modulo de eventos; tabela e UI existem, mas pode ser desativado no primeiro release e ativado depois.
- Convites para organizacoes - podem ser por email ou notificacao. Exigem aceitacao. Roles atribuidas na aceitacao. Utilizadores podem pedir para entrar, sujeito a aprovacao de Owner/Admin.
- Clubes tab - omitido na bottom navigation do MVP. Clubes existem como organizacoes sem tab dedicada.
- Chat - excluido do MVP. Apenas notificacoes e comentarios. Chat em tempo real fica para depois.

## 8. Roadmap Pos-MVP (Ideias)

- Map view com geolocalizacao e clustering.
- Experiencias publicas criadas por utilizadores com moderacao.
- Clubes como entidade principal com feeds, eventos e group chats.
- Chat em tempo real entre utilizadores, staff, promoters e organizadores.
- Payouts automaticos para promoters com thresholds e agendamento.
- Ferramentas de marketing para organizadores (email campaigns, push notifications).
- Rankings avancados para padel com pontos por jogo, head-to-head e badges.

Este documento captura todas as decisoes e estruturas necessarias para o ORYA v1. Cada pagina e modulo esta limitado para entregar uma experiencia coesa sem over-engineering. As funcionalidades futuras ficam indicadas, mas nao entram no MVP.
