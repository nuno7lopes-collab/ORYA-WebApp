# Plano UI/UX - Chat Interno Enterprise

## Objetivo
Entregar um chat interno com experiencia premium, comparavel a WhatsApp Web, Telegram Desktop, Slack, Discord e Linear, mantendo a barra de navegacao global intocada.

## Principios base
- Familiaridade: padroes reconheciveis (lista de conversas, bolhas, ticks).
- Clareza e hierarquia: conversa > metadados.
- Eficiencia: navegacao rapida entre conversas e resposta imediata.
- Consistencia visual com o resto do produto.

## Requisitos inegociaveis
- Barra de navegacao global no topo permanece intocada.
- Layout em duas colunas reais: sidebar a esquerda + painel de chat a direita.
- Container centralizado com largura max 1200-1400px e padding horizontal.
- Scroll independente para sidebar e mensagens; pagina global nao rola.

## Fases (sequenciais; so avancar quando a anterior estiver perfeita)

### Fase 1 - Estrutura base e layout
**Objetivo**
- Montar a grelha base com 2 colunas e container central.

**Entregas**
- Wrapper do chat abaixo da navbar global.
- Grid com sidebar fixa e painel de chat flexivel.
- Alturas calculadas para ocupar o viewport sem criar scroll global.

**Definition of Done**
- Navbar global inalterada.
- Sem overflow horizontal em desktop.
- Sidebar e painel com scroll proprio.

### Fase 2 - Sidebar: lista de conversas
**Objetivo**
- Navegacao rapida e informativa entre conversas.

**Entregas**
- Campo de pesquisa no topo.
- Botao "+" para nova conversa/grupo.
- Itens uniformes (~64px), com avatar, nome, snippet e hora/data.
- Badge de nao lidas, discreto e legivel.
- Estados de hover e selecionado bem visiveis.

**Definition of Done**
- Lista rola independentemente.
- Itens clicaveis e com area de toque clara.
- Badge nunca colide com texto.

### Fase 3 - Painel de chat: cabecalho fixo
**Objetivo**
- Identificar a conversa e dar acesso rapido a acoes.

**Entregas**
- Cabecalho com altura ~60px, fundo subtil e separador/sombra leve.
- Nome da conversa + resumo de membros (com "..." quando excede).
- Botao "Ver membros" e menu de acoes (tres pontos).
- Espaco para acoes futuras (chamada/video), sem sobrecarga.

**Definition of Done**
- Cabecalho permanece visivel durante o scroll.
- Acoes alinhadas e acessiveis.

### Fase 4 - Mensagens: bolhas e agrupamento
**Objetivo**
- Conversa clara, familiar e eficiente.

**Entregas**
- Alinhamento: utilizador a direita, restantes a esquerda.
- Bolhas com raio generoso, padding adequado e largura max 60-70%.
- Agrupamento por autor; avatar e nome apenas no inicio do bloco.
- Timestamp pequeno e discreto no canto inferior da bolha.
- Estado de envio com icones (enviado, entregue, lido).
- Tamanho minimo de bolha para mensagens curtas/emoji.

**Definition of Done**
- Blocos de mensagens aparecem coesos e legiveis.
- Timestamps e ticks nao competem com o texto.
- Mensagens muito curtas mantem presenca visual.

### Fase 5 - Composer fixo
**Objetivo**
- Envio rapido, sempre acessivel.

**Entregas**
- Composer ancorado ao fundo do painel.
- Input multiline que expande ate um limite.
- Botao de anexos a esquerda e envio a direita.
- Fundo ligeiramente contrastante, sem sombras pesadas.

**Definition of Done**
- Composer visivel durante scroll.
- Expansao nao tapa o historico recente.

### Fase 6 - Reacoes e menu de acoes
**Objetivo**
- Interacoes contextuais sem ruido visual.

**Entregas**
- Reacoes em pills pequenas, sobrepostas ao canto inferior da bolha.
- Controlo de reacoes e menu "..." visiveis apenas ao passar o cursor/tap.
- Popover abre sempre dentro do viewport (topo/baixo conforme necessario).
- Possibilidade de reagir e remover reacao rapidamente.

**Definition of Done**
- Sem espaco reservado quando nao ha reacoes.
- Controlo de acoes nao interfere com avatar/nome.

### Fase 7 - Scroll e novas mensagens
**Objetivo**
- Comportamento previsivel em tempo real.

**Entregas**
- Divisor "Novas mensagens" ao entrar com nao lidas.
- Auto-scroll apenas quando o utilizador esta no fundo.
- Indicador "Novas mensagens" com atalho para o fim.
- Carregamento de historico com spinner no topo.

**Definition of Done**
- Sem saltos inesperados no scroll.
- Retorno ao ultimo ponto lido quando reentra na conversa.

### Fase 8 - Estados e feedback
**Objetivo**
- Transparencia sem bloquear o utilizador.

**Entregas**
- Indicador discreto "A ligar novamente..." no topo do painel.
- Skeletons de mensagens durante carregamento inicial.
- Indicadores de envio para anexos ou mensagens demoradas.

**Definition of Done**
- Feedback visivel mas nao intrusivo.
- Skeletons substituidos sem flicker.

### Fase 9 - Responsividade
**Objetivo**
- Experiencia consistente em desktop, tablet e telemovel.

**Entregas**
- Sidebar colapsa em ecra pequeno; abre como painel sobreposto.
- Cabecalho com botao "voltar" para lista no mobile.
- Bolhas e composer ajustam largura; max 60-70% mantido.
- Elementos menos vitais escondidos em ecras muito pequenos.

**Definition of Done**
- Sem quebras de layout ao redimensionar.
- Interacoes acessiveis ao toque.

### Fase 10 - Polimento visual e microinteracoes
**Objetivo**
- Acabamento premium e coerente.

**Entregas**
- Tipografia consistente e legivel (14-16px para mensagens).
- Paleta sobria: fundo claro, bolhas suaves, realces discretos.
- Hierarquia visual clara (texto > metadados).
- Animacoes suaves: entrada de mensagem, abertura de menus, reacoes.
- Espacamento coerente com base de 8px.

**Definition of Done**
- Interface transmite produto enterprise premium.
- Microinteracoes nao distraem.

## Tokens recomendados (ajustar ao design system)
- Largura max do container: 1200-1400px
- Altura de item de conversa: 64px
- Altura de cabecalho: 60px
- Raio das bolhas: 16-20px
- Espacamento base: 8px

## Definition of Done global
- Navbar superior intacta.
- Conversa e lista de conversas funcionam com scroll independente.
- Estados de nao lidas, ligacao e envio bem comunicados.
- Comportamento consistente em desktop/tablet/telemovel.
- Interface comparavel a apps lideres sem perder identidade enterprise.

## Arquitetura de informacao e navegacao
- Modulo de chat vive abaixo da navbar global, sem alterar a hierarquia do resto do produto.
- Estrutura base: Sidebar (navegacao) + Painel (conversa ativa) + Drawer/Modal (detalhes).
- Sidebar organizada por: fixadas, recentes, nao lidas, arquivadas (quando aplicavel).
- Pesquisa global na sidebar; pesquisa intra-conversa dentro do painel.
- Ordenacao primaria por atividade; opcao de filtros (nao lidas, mentions, grupos).

## Fluxos principais (detalhados)
**Criar conversa direta**
- Abrir "Novo chat".
- Pesquisa por pessoa (nome, email, equipa).
- Criar e abrir conversa; foco imediato no composer.

**Criar grupo**
- Selecionar participantes (minimo 3).
- Definir nome e imagem opcional.
- Abrir conversa com mensagem de sistema "Grupo criado".

**Entrar numa conversa com nao lidas**
- Abrir conversa.
- Scroll posicionado no divisor de nao lidas.
- Marcacao como lida ao cruzar o divisor.

**Reagir a mensagens**
- Hover mostra barra curta de reacoes rapidas + menu.
- Clique alterna reacao (add/remove).
- Lista de reacoes mostra quem reagiu.

**Editar e eliminar**
- Editar apenas mensagens proprias, com etiqueta "editado".
- Eliminar com confirmacao; opcao "apagar para mim".

## Sidebar (especificacao detalhada)
**Item de conversa**
- Altura 64px, padding lateral consistente.
- Avatar 36-40px, nome em destaque, snippet em cinzento.
- Hora/data alinhada a direita, formato curto (hoje, ontem, dd/mm).
- Badge de nao lidas no canto direito; acima de 99 mostra "99+".

**Estados**
- Default: fundo neutro.
- Hover: fundo subtil + cursor pointer.
- Selecionado: fundo distinto + barra/borda de destaque.
- Silenciado: icone discreto + snippet em tom mais baixo.

**Pesquisa**
- Input com placeholder "Pesquisar conversas".
- Atalho de teclado (ex: Cmd/Ctrl+K) opcional.
- Resultados em tempo real; vazio mostra sugestao "Criar nova conversa".

## Cabecalho do chat (detalhe)
- Nome da conversa em destaque.
- Subtitulo: membros (ate 2-3 visiveis) + "..." se excede.
- Botao "Ver membros" abre drawer lateral com lista e roles.
- Menu de acoes: silenciar, fixar, arquivar, sair, gerir membros.
- Indicador de presenca (online/ocupado/ausente) se existir no sistema.

## Mensagens (detalhe funcional)
**Tipos**
- Texto simples, emojis, links com preview, imagem, ficheiro, audio, video.
- Mensagens de sistema: entradas/saidas, mudancas de nome, chamadas de atencao.

**Agrupamento**
- Mesma autoria e intervalo <= 5 min agrupa no mesmo bloco.
- Novo dia gera separador de data.
- Avatar e nome apenas no inicio do bloco (para outros utilizadores).

**Timestamps e estado**
- Timestamp pequeno dentro da bolha.
- Estado de envio para mensagens proprias: a enviar, enviado, entregue, lido.
- Erro de envio mostra icone de alerta + acao "Tentar novamente".

**Conteudos longos**
- Links longos truncados com tooltip/copy.
- Ficheiros com nome, tamanho e estado de download.
- Imagens com lazy-load e placeholder.

## Reacoes e menu de acoes
- Reacoes aparecem como pills sobrepostas ao canto inferior da bolha.
- Max 3 reacoes visiveis; overflow mostra "+N".
- Menu "..." inclui: Responder, Copiar, Editar (se proprio), Eliminar, Fixar.
- No mobile: long-press abre menu contextual.

## Composer (detalhe funcional)
- Placeholder: "Escreve uma mensagem".
- Enter envia; Shift+Enter nova linha.
- Botao de anexos abre picker (ficheiros/imagens).
- Suporta drag & drop e paste de imagens.
- Preview de anexos com opcao de remover antes de enviar.
- Indicador de progresso para uploads grandes.

## Scroll, historico e memoria de leitura
- Virtualizacao de mensagens para performance em conversas longas.
- Carregamento incremental ao scroll para cima.
- Manter posicao visual ao inserir mensagens antigas (anchor).
- Auto-scroll apenas quando o utilizador esta no fim.
- Botao "Novas mensagens" surge quando ha novas abaixo.

## Estados e feedback (detalhe)
- "A ligar novamente..." em barra discreta no topo do painel.
- Modo offline: composer desativado + fila de envio local opcional.
- Skeletons para lista e mensagens durante carregamento.
- Indicador "X pessoas a escrever..." no rodape do painel.

## Responsividade (breakpoints sugeridos)
- >= 1280px: duas colunas sempre visiveis.
- 1024-1279px: sidebar compacta, labels reduzidas.
- 768-1023px: sidebar recolhivel; abre como drawer.
- < 768px: so painel de chat; header com botao "voltar".

## Acessibilidade e teclado
- Navegacao por teclado na lista de conversas (setas/enter).
- Foco visivel em items, botoes e composer.
- Leitores de ecran: labels claros para botoes e estados.
- Contraste minimo AA nas bolhas e texto.

## Permissoes e governance
- Roles: admin do grupo, membro, convidado (se aplicavel).
- Acoes limitadas: editar/eliminar apenas mensagens proprias.
- Arquivar/silenciar nao afeta outros membros.
- Audit log para acoes criticas (eliminar, remover membro).

## Seguranca e conformidade
- Dados em transito com TLS.
- Politicas de retencao por organizacao.
- Exportacao e discovery controlados por permissao.
- Bloqueios de partilha externa (se requerido).

## Telemetria e KPI
- TTFM (time to first message) apos abrir conversa.
- Taxa de envio com sucesso vs falhas.
- Tempo medio de leitura (envio -> lido).
- Uso de reacoes, anexos e pesquisa.

## QA e testes
- Cross-browser (Chrome, Safari, Firefox, Edge).
- Stress com conversas 10k+ mensagens.
- Upload/download de anexos em rede lenta.
- Responsividade real (desktop -> tablet -> telemovel).

## Estados vazios e erros
**Estados vazios**
- Sidebar sem conversas: mostrar CTA "Iniciar conversa" + descricao curta.
- Pesquisa sem resultados: sugerir "Criar nova conversa".
- Conversa sem mensagens: placeholder simples e foco no composer.

**Erros**
- Falha ao enviar: estado na bolha + acao "Tentar novamente".
- Falha ao carregar historico: banner pequeno com "Recarregar".
- Permissao insuficiente: mensagem de sistema discreta.

## Conteudo e microcopy (exemplos)
- "Escreve uma mensagem"
- "A ligar novamente..."
- "Novas mensagens"
- "Sem resultados"
- "Falha no envio. Tentar novamente"
- "Grupo criado por {nome}"

## Notificacoes e integracao com o resto do produto
- Notificacoes alinhadas com o sistema global (sem mexer na navbar).
- Badges na sidebar apenas para nao lidas e mentions.
- Push/email opcionais: mentions, respostas, mensagens diretas.
- Preferencias por conversa: silenciar por 1h/8h/ate reativar.

## Mapa de componentes (UI)
- ChatLayout (container + grid)
- ChatSidebar (pesquisa + lista + botao novo)
- ChatListItem (avatar + nome + snippet + badge)
- ChatHeader (titulo + membros + acoes)
- MessageList (scroll + divisores)
- MessageGroup (avatar + bloco)
- MessageBubble (texto + timestamp + estado)
- MessageActions (reagir + menu)
- ReactionPills (lista compacta)
- Composer (input + anexos + envio)
- AttachmentPreview (antes do envio)
- SystemMessage (eventos do grupo)
- MemberDrawer (lista e roles)

## Atalhos de teclado (detalhe)
- Ctrl/Cmd+K: focar pesquisa de conversas.
- Esc: fechar drawers/menus.
- Enter: enviar; Shift+Enter: nova linha.
- Ctrl/Cmd+F: pesquisa dentro da conversa.

## Internacionalizacao e formatos
- Hora em 24h, formato local (hoje/ontem/dd/mm).
- Mensagens de sistema localizadas e consistentes.
- Suporte a diferentes timezones no timestamp.

## Escalabilidade e performance (UX)
- Lazy-load de imagens e previews.
- Virtualizacao obrigatoria para listas longas.
- Limite de tamanho e tipo de anexos com feedback imediato.

## Modelo de dados (orientado a UX)
**Conversa**
- id, tipo (direta/grupo), titulo, avatar, ultimo_evento, is_pinned, is_muted.
- unread_count, last_read_at por utilizador, membros e roles.

**Mensagem**
- id, conversation_id, author_id, created_at, client_id (dedupe).
- content (texto/emoji), attachments, reactions, status.
- system_event para entradas/saidas/alteracoes.

**Participante**
- role (admin/membro/convidado), presence, last_seen.

## Estado da mensagem (maquina de estados)
- draft -> queued -> sending -> sent -> delivered -> read.
- failed com acao "Tentar novamente".
- Reenvio nao duplica (usa client_id).

## Regras de leitura e nao lidas
- Marca como lida quando a ultima mensagem fica visivel no viewport.
- Se a janela nao estiver focada, nao marca automaticamente.
- Mentions podem ter contagem separada.

## Presenca e indicadores
- Estados: online, ocupado, ausente, offline.
- "A escrever..." com timeout curto.
- Presenca pode ser desativada por privacidade.

## Pesquisa e navegacao em resultados
- Pesquisa global: conversa + mensagem + pessoa.
- Pesquisa na conversa: salto para a mensagem com contexto (2-3 mensagens antes/depois).
- Filtros por data, autor e anexos.
- Destaque do termo nos resultados.

## Respostas, citacoes e mensagens fixadas
- "Responder" cria bloco citado acima da bolha.
- "Fixar" coloca mensagem em barra discreta no topo do painel.
- Limite de mensagens fixadas por conversa (ex: 3).

## Anexos e media
- Tipos base: imagem, pdf, doc, zip, audio, video.
- Preview imediato; download com progresso.
- Limites por ficheiro e por mensagem; feedback claro.
- Antivirus e DLP antes de disponibilizar.

## Links e previews
- Metadados gerados no servidor (seguranca).
- Dominios bloqueados nao geram preview.
- Preview compacto, sem empurrar o layout.

## Historico e consistencia
- Ordenacao por created_at do servidor.
- Mensagens recebidas fora de ordem reordenam sem "saltos".
- Separador por dia entre mensagens.

## Notificacoes (regras finas)
- Mute por conversa ou horario (quiet hours).
- Mentions ignoram mute se configurado.
- Badge global soma apenas nao lidas relevantes.

## SLO e orcamentos de performance
- Abrir conversa < 1s (cache quente).
- Envio com ack visual < 300ms.
- Render de 100 mensagens < 100ms.
- Scrolling fluido a 60fps em conversas longas.

## Instrumentacao (eventos)
- chat_opened, chat_created, message_sent, message_failed.
- message_read, reaction_added, attachment_uploaded.
- search_used, member_added, member_removed.

## Governanca e compliance (enterprise)
- Retencao configuravel por organizacao.
- Legal hold para conversas criticas.
- Exportacao controlada por permissao.
- Auditoria para eliminar mensagens e gerir membros.

## Riscos e mitigacoes
- Spam de notificacoes -> throttling e preferencias por conversa.
- Conversas longas -> virtualizacao e paginacao.
- Inconsistencia de leitura -> regra clara de visibilidade.
- Anexos grandes -> limites + filas de upload.

## Backlog operacional (alta resolucao)
**Fase 1-2**
- ChatLayout + ChatSidebar + pesquisa.
- Lista com estados (hover/selecionado/nao lidas).

**Fase 3-5**
- ChatHeader fixo + MessageList + Composer.
- Estado de mensagem e timestamps.

**Fase 6-8**
- Reacoes, menu contextual, skeletons, reconexao.
- Indicadores de typing e novas mensagens.

**Fase 9-10**
- Responsividade total + microinteracoes + polimento visual.
