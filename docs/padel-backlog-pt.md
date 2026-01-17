# ORYA Padel Backlog (Epicos + Stories)

Backlog organizado por fases do roadmap em docs/orya-v1-product-spec-pt-detalhada.md.

## Fase 0 - Fundacoes (core padel)

Epico: Modelo de dados base de padel
- Story: Criar PadelClub com branding e contactos
- Story: Criar Court com estado e bloqueios de horario
- Story: Criar Tournament com estados e configuracoes
- Story: Criar Division/Category com genero, nivel e limites
- Story: Criar Stage/Group para grupos e playoffs
- Story: Criar Match com estado, placar e flags
- Story: Criar RuleSet com formato de jogo e desempate

Epico: Motor de geracao de jogos
- Story: Gerar grupos com round-robin
- Story: Gerar playoffs com bracket base
- Story: Gerar quadro A/B (consolacao)
- Story: Gerar todos contra todos (1 volta) e nonstop
- Story: Criar regras de transicao entre fases

Epico: Sorteio e seeds
- Story: Sorteio aleatorio por categoria
- Story: Seeds por ranking e distribuicao entre grupos
- Story: Insercao manual de equipas em slots

Epico: Auditoria e estados
- Story: Implementar estados de competicao (oculto/desenvolvimento/publico/cancelado)
- Story: Audit log para sorteio, resultados e cancelamentos

## Fase 1 - MVP Competitivo

Epico: Criacao de torneio e categorias
- Story: UI criar torneio (nome, datas, clube, contactos)
- Story: UI criar categorias (genero, nivel, capacidade)
- Story: Configurar formatos por categoria

Epico: Inscricoes e pagamentos
- Story: Inscricao dupla com parceiro
- Story: Inscricao individual (para mix/pareamento futuro)
- Story: Split payment no checkout
- Story: Lista de espera (pendentes) ao exceder vagas
- Story: Validacoes basicas (email/telefone obrigatorios)

Epico: Brackets e paginas publicas
- Story: Pagina publica do torneio com grupos e bracket
- Story: Atualizacao em tempo real de resultados
- Story: Publicacao de calendario com courts

Epico: Calendario manual
- Story: Vista calendario por court e dia
- Story: Drag-and-drop para jogos
- Story: Bloqueios de horario

Epico: Resultados e ranking
- Story: Inserir resultados com foto
- Story: Flags WO/desistiu/lesao
- Story: Ranking basico por torneio
- Story: Historico do jogador no perfil

Epico: Notificacoes basicas
- Story: Confirmacao de inscricao
- Story: Bracket publicado
- Story: Torneio iniciado/finalizado

## Fase 2 - V1+ Diferenciais ORYA

Epico: Wizard de criacao
- Story: Fluxo passo a passo com defaults inteligentes
- Story: Opcoes avancadas escondidas por default

Epico: Auto-scheduling
- Story: Gerar calendario automatico por duracao e courts
- Story: Detetar conflitos de agenda por jogador
- Story: Respeitar indisponibilidades declaradas

Epico: Notificacoes inteligentes
- Story: Lembrete de jogo 30 min antes
- Story: Aviso de proximo jogo
- Story: Grupo fechado e qualificados

Epico: TV Monitor
- Story: Modo automatico por fase do torneio
- Story: Conteudos curados e rodape
- Story: Patrocinadores e anuncios

Epico: Community games (Easy Mix)
- Story: Criar mix rapido (2-3 horas)
- Story: Formatos nonstop e fase+finais
- Story: Link partilhavel e resultados em tempo real

Epico: Templates e personalizacao
- Story: Templates 8/16/32 equipas
- Story: Cores e banner do clube
- Story: Area de patrocinadores

Epico: Convites privados
- Story: Gerar convites com codigo
- Story: Controlar inscricoes por convite

Epico: Ranking configuravel
- Story: Modelos pre-definidos de pontos
- Story: Ajustes por nivel e fase

## Fase 3 - Escala e Produto Premium

Epico: Live score e streaming
- Story: Link de streaming por jogo
- Story: Scoreboard ao vivo basico

Epico: API e widgets
- Story: Widget proximos jogos
- Story: Widget tabela/bracket
- Story: Widget inscricoes

Epico: Analitica avancada
- Story: Ocupacao de courts e tempo medio
- Story: Pagamentos e taxas por torneio

Epico: Exportacoes
- Story: Exportar PDF de calendario
- Story: Exportar Excel de inscritos e resultados

Epico: Ranking avancado
- Story: Ranking regional/global com filtros
- Story: Ranking por periodo com expiracao

Epico: Localizacao
- Story: Multi-idioma completo
- Story: Formatos de data/hora e moeda

## Fase 4 - Padel Club OS (opcional estrategico)

Epico: Reservas e aulas
- Story: Reservas de courts com disponibilidade
- Story: Aulas com instrutores e planos

Epico: Membros e planos (pos-MVP)
- Story: Planos de membro
- Story: Beneficios e controlo de acesso

Epico: Financeiro do clube
- Story: Caixa e relatorios internos
- Story: Integracao com pagamentos recorrentes
