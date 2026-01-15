# ORYA Padel 100% Plan (Fase 0-3, sem ranking)

Documento de controlo para fechar o modulo padel a 100% (Fases 0-3). Ranking fica fora.

## Definicao do que e 100%

Incluido:
- Fase 0, 1, 2 e 3 do backlog.
- QUADRO A/B (consolacao), NON-STOP, Round-Robin, Mix rapido.
- Split payment com capitao garantidor (cobranca automatica se parceiro falhar).
- Auto-scheduling com conflitos por jogador, descanso minimo, bloqueios por court.
- Drag-and-drop com auditoria completa.
- Replaneamento por atrasos/adiamentos.
- Contestacao de resultados com lock admin.
- Importacoes CSV/XLSX com validacao completa e relatorio detalhado.
- Stats de jogador + head-to-head.
- Notificacoes inteligentes + realtime push.
- Widgets publicos (bracket/standings/next).
- Streaming/live score real.
- API publica documentada + rate limit.
- Analytics avancada.
- Testes de geracao/standings/KO/calendario/imports.
- Auditoria total de acoes criticas.

Excluido:
- Ranking (event/organization/global) por agora.
- Fase 4 (Club OS: reservas/aulas/memberships).
- Ligas/epocas.

## Estado final (100% fechado)

- Todos os workstreams abaixo concluídos.
- Ranking fora do scope e oculto da UI atual.

## Estado atual (resumo do que ja existe)

- Torneios padel: categorias, configuracao, seeds, grupos, KO, QUADRO A/B.
- Geracao automatica de jogos para grupos e KO, com regras e tiebreaks.
- Seeds manuais, grupos manuais.
- Importacao completa de inscritos (CSV/XLSX) com dry-run, preview e relatorio multi-erros.
- Split payment com flows de convite e expiracao.
- Waitlist e promocao de inscritos.
- Regras de score configuraveis + validacao por preset.
- Walkover automatico e auto-advance de BYE.
- Calendario manual, bloqueios por court, auto-schedule com descanso minimo.
- TV monitor configuravel.
- Widgets publicos (bracket, standings, next, calendar) via endpoints.
- Notificacoes inteligentes (bracket, proximo jogo, grupo fechado, qualificados, eliminado, campeao, T-24).
- Analytics avancada (ocupacao, atrasos, receitas) + export.

## Checklist 100% (workstreams concluídos)

### 1) Importacoes completas + tooling admin ✅

Objetivo: importar em volume sem erros e com visibilidade total.

Entregue:
- Validacao completa e relatorio multi-erros (linha, campo, mensagem).
- Dedupe contra inscritos ja existentes no evento.
- Dry-run (validar sem criar).
- UI com preview, contagem de erros e opcao "corrigir e reimportar".
- Log de importacao (auditoria).

Aceitacao:
- Import falha com relatorio completo sem criar registos.
- Dry-run mostra quantos vao entrar, quantos rejeitados, motivo.


### 2) Contestacao de resultados + lock admin ✅

Objetivo: permitir contestacao e historico de alteracoes.

Entregue:
- Estado de match: CONTESTED / LOCKED (ou flags no score).
- Fluxo de contestacao por jogador/equipa.
- Lock admin: so admin pode alterar resultado contestado.
- Historico de alteracoes por match (quem, quando, antes/depois).

Aceitacao:
- Jogador pode contestar (com motivo).
- Admin desbloqueia e revalida resultado.
- Historico visivel no dashboard.


### 3) Stats de jogador + head-to-head ✅

Objetivo: dar perfil padel robusto sem ranking.

Entregue:
- Historico de jogos por jogador.
- Head-to-head (oponentes e saldo).
- Badges simples (ex: 10 vitorias, 3 torneios).
- API de stats + UI no perfil.

Aceitacao:
- Perfil mostra ultimos jogos + H2H com filtros basicos.


### 4) Calendario avancado + replaneamento + auditoria ✅

Objetivo: operar torneios com atrasos e historico.

Entregue:
- Replaneamento automatico por atraso: desloca jogos afetados.
- Alertas de conflito com sugestoes.
- Auditoria completa de alteracoes (drag/drop, auto-schedule, edicao manual).
- Log por match: quem mudou, motivo, timestamp.

Aceitacao:
- Ao marcar atraso, sistema sugere novo slot.
- Historico auditavel por match e por evento.


### 5) Realtime push (substituir polling) ✅

Objetivo: updates em tempo real para publico e organizadores.

Entregue:
- Canal realtime (SSE/WebSocket/Supabase realtime).
- Update push para matches, standings, bracket e widgets.
- Fallback para polling se realtime indisponivel.

Aceitacao:
- Paginas publicas atualizam em <2s sem refresh.


### 6) Notificacoes inteligentes completas ✅

Objetivo: informar jogadores nos momentos criticos.

Entregue:
- Grupo fechado e qualificados.
- Vespera do torneio (T-24h).
- Campeao e eliminado.
- Dedupe robusto e preferencia de notificacao.

Aceitacao:
- Notificacoes enviadas nas transicoes corretas, sem duplicados.


### 7) Streaming / Live score real ✅

Objetivo: experiencia live completa.

Entregue:
- Integracao com provider (YouTube/Twitch/RTMP) ou embed gerido.
- Live scoreboard por jogo.
- Sinalizar jogo em destaque.

Aceitacao:
- Evento pode ativar stream e exibir no publico/monitor.


### 8) API publica + rate limits ✅

Objetivo: permitir integracoes externas com seguranca.

Entregue:
- Endpoints publicos documentados (matches, standings, bracket, calendario).
- Rate limit por IP/key.
- Versoes e changelog.

Aceitacao:
- Documentacao com exemplos + quotas.


### 9) Analytics avancada ✅

Objetivo: visibilidade operacional e financeira completa.

Entregue:
- Tempo medio por fase, atraso medio, ocupacao por court/dia.
- Receita por categoria/fase.
- Exportacao CSV/Excel.

Aceitacao:
- Dashboard com KPIs basicos + export.


### 10) Testes e QA ✅

Objetivo: cobertura minima para motor padel.

Entregue:
- Testes de geracao (grupos/KO/A-B).
- Testes de standings (tiebreaks, empates 3+).
- Testes de auto-schedule (conflitos, descanso, bloqueios).
- Testes de importacao (CSV/XLSX, erros, dry-run).

Aceitacao:
- Suite automatica com coverage de fluxos criticos.


### 11) Auditoria completa (acoes criticas) ✅

Objetivo: rastreio total para suporte.

Entregue:
- Audit log para: sorteio, geracao, resultados, contestacoes, calendario, auto-schedule, importacoes.
- UI simples para ver logs por evento.

Aceitacao:
- Todas as acoes criticas tem registro com actor + timestamp.

## Milestones concluídos (ordem de execucao)

1) ✅ Importacoes completas + auditoria basica
2) ✅ Contestacao de resultados + historico
3) ✅ Calendario avancado (replaneamento + auditoria completa)
4) ✅ Realtime push + widgets
5) ✅ Notificacoes inteligentes completas
6) ✅ Stats de jogador + head-to-head
7) ✅ Streaming/live score
8) ✅ API publica + rate limit
9) ✅ Analytics avancada
10) ✅ Testes automatizados

## Riscos residuais (monitorizar)

- Realtime push depende de infra (SSE/WebSocket) e permissao publica; manter fallback.
- Streaming pode exigir provider externo e termos legais.
- Replaneamento pode colidir com bloqueios e disponibilidade; manter alertas.
- Auditoria total exige consistencia em todos os endpoints.

## Criterios finais de conclusao (100%)

- Todos os workstreams acima entregues.
- Nenhum blocker conhecido em fluxo de torneio end-to-end.
- Testes criticos a passar.
- Auditoria completa ativa.
