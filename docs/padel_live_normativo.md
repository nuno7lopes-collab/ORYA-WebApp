# Padel Live - Contrato Normativo de Produto (2026-02-16)

## 0) Estado e objetivo
- `estado_decisao`: `FECHADO_OWNER_AGUARDA_EXECUCAO`.
- `estado_execucao`: `NAO_INICIADO_B3_LIVE`.
- Objetivo: fechar o contrato de `live` para torneios de Padel com foco em 3 perguntas sempre respondidas:
  - quem joga agora,
  - qual o estado/resultado,
  - o que vem a seguir.

## 1) Autoridade e precedencia
- Durante `B1..B9`, este documento e complementar de dominio Padel e aplica-se com `docs/padel.md`.
- O SSOT (`docs/ssot_registry_v1.md`) continua normativo superior.
- Em conflito:
  - prevalece SSOT,
  - depois `docs/padel.md`,
  - depois este documento para o escopo Live.

## 2) Principios inviolaveis
- `Live` nao e so flag de estado; e contrato de confianca para publico, jogador e organizador.
- Superficie interna e publica leem o mesmo estado canonico de live (`D18.13`).
- Resultado sem regra explicita e proibido.
- Progressao automatica sem pre-condicoes completas e proibida.
- Sem empate em jogo concluido (exceto cancelado quando permitido por formato/regra).
- Toda acao critica em live exige trilho auditavel.
- Write de live so pode ocorrer por comandos canonicos de dominio; bypass direto e proibido.
- Read de live so pode sair de projecoes canonicas; query ad-hoc de estado operacional e proibida em producao.

## 2.1 Definicoes operacionais
- `match`: unidade competitiva com estado e resultado versionado.
- `phase`: etapa competitiva (grupo, playoff, final, etc.) com politica propria de score e standings.
- `standings impact`: capacidade de um resultado alterar classificacao/progressao; materializado por `affectsStandings` no snapshot do match.
- `pending`: resultado submetido mas ainda sem oficializacao.
- `disputed`: resultado contestado com resolucao operacional em curso.
- `expired review`: resultado pendente que expirou prazo e exige revisao humana.

## 3) Modelo canonico em duas camadas
- Camada A (`EventStructure`): estrutura da competicao.
- Camada B (`MatchScoringProfile`): regra de pontuacao do jogo.
- A mesma competicao pode usar perfis de jogo diferentes por fase, desde que versionados no snapshot.

## 3.1 Read-models obrigatorios de live
- `live_now_by_court`
- `upcoming_matches_by_player`
- `latest_results_feed`
- `standings_with_tiebreak_explain`
- Regra:
  - app interna, app mobile e superficie publica consomem apenas estes read-models (ou derivados diretos projetados deles).

## 4) Estruturas suportadas no v1 live (owner aprovado)
- `TODOS_CONTRA_TODOS`.
- `GRUPOS_ELIMINATORIAS`.
- `QUADRO_ELIMINATORIO`.
- `QUADRO_AB`.
- `DUPLA_ELIMINACAO`.
- `CAMPEONATO_LIGA`.
- `NONSTOP`.
- `AMERICANO`.
- `MEXICANO`.

## 5) Formatos sociais rapidos (owner aprovado)
- `NONSTOP`, `AMERICANO` e `MEXICANO` entram no primeiro corte de live.
- `SOBE_DESCE` permanece fora do primeiro corte ate fecho de motor/standings/UX dedicados.

## 6) Regras de progressao automatica
- `BYE` e entidade valida de preenchimento de quadro.
- `BEST_SECOND` so pode fechar quando todos os jogos relevantes dos grupos estiverem concluidos/oficiais.
- Cada match deve persistir `affectsStandings` no snapshot (imutavel apos `LOCKED`).
- Regra canonica para `affectsStandings=true`:
  - match pertence a fase que alimenta standings, bracket ou criterio `BEST_SECOND`.
  - matches de consolacao/exibicao usam `affectsStandings=false` por defeito.
- Progressao de fase e bloqueada quando houver resultado `PENDING_CONFIRMATION`, `PENDING_REVIEW_EXPIRED` ou `DISPUTED` com `affectsStandings=true`.
- Ao confirmar resultado:
  - standings atualizam,
  - bracket atualiza,
  - proximos jogos sao recalculados quando aplicavel.

## 7) Regras de desempate (grupos)
- Cada categoria/fase define matriz `tiebreakOrder[1..n]` versionada no snapshot.
- A ordem de desempate deve ser exibida no live em microcopy curto.
- `head_to_head` deve ser tratado explicitamente para empates de 2 e 3+ participantes.
- Critico: ordem aplicada no calculo e a mesma apresentada em UI publica/interna.
- `tiebreakExplanation` e campo obrigatorio no read-model de standings por linha de classificacao.
- `tiebreakExplanation` deve explicar em 1-2 linhas porque a posicao foi atribuida nos casos de empate.

## 8) Resultado de jogo: estados oficiais
- `IN_PROGRESS`
- `RESULT_SUBMITTED`
- `PENDING_CONFIRMATION`
- `PENDING_REVIEW_EXPIRED`
- `OFFICIAL`
- `DISPUTED`
- `CANCELLED`
- `WALKOVER`
- `RETIRED`

## 9) Modelo de submissao e confirmacao de resultado
- Decisao fechada nesta ronda: suportar os 2 modos em paralelo:
  - `IMMEDIATE_OFFICIAL` (organizacao valida e oficializa no ato),
  - `IMMEDIATE_PENDING_THEN_OFFICIAL` (resultado aparece imediato mas fica pendente ate confirmar/prazo).
- Quando `PENDING_CONFIRMATION`:
  - live mostra badge visivel `Pendente`,
  - progressao sensivel a classificacao fica bloqueada,
  - trilho de confirmacao/rejeicao e obrigatorio.

### 9.1 Matriz canonica de permissoes por modo
- `IMMEDIATE_OFFICIAL`:
  - submeter: `DIRETOR_PROVA`, `REFEREE`, `SCOREKEEPER`, `OWNER`, `CO_OWNER`, `ADMIN`.
  - confirmar: nao aplicavel (ja entra oficial).
  - disputar: `DIRETOR_PROVA`, `REFEREE`, `OWNER`, `CO_OWNER`, `ADMIN`.
- `IMMEDIATE_PENDING_THEN_OFFICIAL`:
  - submeter por staff: `DIRETOR_PROVA`, `REFEREE`, `SCOREKEEPER`, `OWNER`, `CO_OWNER`, `ADMIN`.
  - submeter por jogador: permitido apenas se torneio ativar `playerResultSubmissionEnabled=true`.
  - confirmacao: `DIRETOR_PROVA`, `REFEREE`, `OWNER`, `CO_OWNER`, `ADMIN`.
  - disputa: jogador participante, ou perfis operacionais acima.
- Regra obrigatoria:
  - qualquer submissao de jogador entra sempre em `PENDING_CONFIRMATION`.
  - jogador nunca oficializa diretamente resultado.

### 9.2 Expiracao de `PENDING_CONFIRMATION`
- Politica canonica v1 (obrigatoria):
  - ao expirar `PendingConfirmationWindowMinutes`, o resultado NAO auto-oficializa.
  - transita para `PENDING_REVIEW_EXPIRED`.
  - progressao dependente permanece bloqueada.
  - gera alerta operacional `HIGH` no painel live do organizador.
  - envia notificacao interna para perfis de direcao elegiveis.
  - SLA operacional: alerta deve aparecer em dashboard em ate `30s`; primeira acao humana esperada em ate `5 min`.

### 9.2.1 Acoes permitidas/proibidas em `PENDING_REVIEW_EXPIRED`
- Permitidas:
  - `confirm_result` por direcao/refs autorizados,
  - `reject_result` por direcao/refs autorizados,
  - `override_result` por direcao/owner/admin com auditoria obrigatoria,
  - `reset_pending_result` por direcao/owner/admin,
  - `cancel_match` quando permitido por fase/formato,
  - `dispute_result`.
- Proibidas:
  - qualquer `auto-advancement`,
  - qualquer `auto-officialization`,
  - novo `submit_result` de jogador sem acao previa de rejeicao/reset operacional,
  - promocao de proximos jogos dependentes da classificacao afetada.

### 9.2.2 Contrato de `reset_pending_result`
- Comando: `reset_pending_result`.
- Perfis autorizados: `DIRETOR_PROVA`, `REFEREE`, `OWNER`, `CO_OWNER`, `ADMIN`.
- Campos obrigatorios:
  - `reasonCode`,
  - `reasonText`,
  - `targetState` (`IN_PROGRESS` ou `RESULT_SUBMITTED`).
- Efeito:
  - encerra o pending expirado atual com trilho auditavel,
  - repoe estado para `targetState`,
  - desbloqueia nova submissao conforme matriz de permissoes.

### 9.2.3 Contrato minimo de `override_result`
- `override_result` so e permitido quando estado atual e `DISPUTED` ou `PENDING_REVIEW_EXPIRED`.
- Campos obrigatorios:
  - `reasonCode`,
  - `reasonText`,
  - `evidenceAttachments[]` (minimo `1` anexo).
- Efeito canonico:
  - estado final `OFFICIAL`,
  - registo de resolucao `resolutionType=OVERRIDE`,
  - quando origem era disputa, marca `disputeStatus=RESOLVED_BY_OVERRIDE` no trilho auditavel.

### 9.3 Idempotencia obrigatoria por comando
- Todas as acoes abaixo exigem `idempotencyKey`:
  - `submit_result`,
  - `confirm_result`,
  - `reject_result`,
  - `dispute_result`,
  - `walkover`,
  - `retired`,
  - `cancel_match`.
- Scope canonico da chave:
  - `tournamentId + matchId + action + actorId + clientRequestId`.
- Chave repetida no mesmo scope deve devolver exatamente o mesmo resultado logico.

### 9.4 Idempotencia de dominio por transicao de estado (obrigatoria)
- Para alem da `idempotencyKey`, comandos devem ser idempotentes pelo estado atual do match.
- Regras minimas:
  - `confirm_result` em match ja `OFFICIAL` = `NOOP` auditado.
  - `reject_result` em match ja `OFFICIAL` = erro de transicao invalida (ou `NOOP` estrito com audit), sem mutacao de resultado.
  - `walkover`/`retired`/`cancel_match` apos `OFFICIAL` = proibido sem fluxo explicito de anulacao/reabertura auditada.
  - `confirm_result` e `reject_result` concorrentes devem resolver por lock transacional + versao do estado.
- Regra geral:
  - uma transicao invalida nunca pode produzir duplo efeito competitivo.

## 10) Excecoes operacionais obrigatorias
- `WALKOVER`:
  - vencedor explicito,
  - motivo obrigatorio,
  - actor elegivel por RBAC operacional.
- `RETIRED`:
  - equipa que desiste explicita,
  - ponto de paragem registado.
- `CANCELLED`:
  - apenas quando a regra da fase/formato permitir,
  - impacto em standings e progressao explicado no detalhe do jogo.

### 10.1 Contrato de standings para `CANCELLED`, `WALKOVER`, `RETIRED`
- `CANCELLED` (`VOID` competitivo):
  - pontos: `0/0`,
  - `playedForStandings=false`,
  - `countsForHeadToHead=false`,
  - `countsForBestSecondMinimum=false`.
- `WALKOVER`:
  - vencedor recebe pontos de vitoria da politica da fase (default `3`),
  - vencido recebe `0`,
  - `playedForStandings=true`,
  - `countsForHeadToHead=true`,
  - `countsForBestSecondMinimum=true`,
  - `technicalWinScore` obrigatorio no `MatchScoringProfile` ativo para o formato/fase.
  - sem `technicalWinScore` definido, write falha em `fail-closed`.
- `RETIRED`:
  - vencedor recebe pontos de vitoria da politica da fase,
  - vencido recebe `0`,
  - `playedForStandings=true`,
  - `countsForHeadToHead=true`,
  - `countsForBestSecondMinimum=true`,
  - score final segue `retirementScoreRule` obrigatoria no `MatchScoringProfile`.
  - sem `retirementScoreRule` definida, write falha em `fail-closed`.

## 11) RBAC operacional live (torneio)
- Perfis canonicos de torneio:
  - `DIRETOR_PROVA`,
  - `REFEREE`,
  - `SCOREKEEPER`,
  - `STREAMER`.
- `DIRETOR_PROVA` obrigatorio para publicar torneio.
- Acoes criticas (disputa, override live, confirmacao em KO critico) exigem direcao ou admin equivalente.

## 12) Publico, app e visibilidade
- Publico web:
  - acesso sem login para visualizacao de live em paginas publicas.
- App:
  - login obrigatorio.
- Visibilidade por estado de competicao:
  - `HIDDEN`,
  - `DEVELOPMENT`,
  - `PUBLIC`,
  - `CANCELLED`.
- Em `PUBLIC`, superficies publicas devem apresentar informacao coerente com modelo canonico de live.

### 12.1 Excecoes controladas ao principio `projection-only`
- Dev/Staging:
  - permitido endpoint de diagnostico raw para engenharia.
- Producao:
  - permitido apenas endpoint admin protegido com `step-up` + auditoria completa.
  - endpoint raw de diagnostico nunca pode ser usado por UI publica/app nem por APIs de consumo final.

### 12.2 Contrato de dados publicos (PII/GDPR)
- Superficie publica sem login so pode expor:
  - nome proprio + inicial do apelido de jogador (ou alias competitivo),
  - nome da dupla/equipa,
  - categoria/fase, score, estado, horario e campo.
- E proibido expor em publico:
  - email, telefone, identificadores civis, moradas, notas internas, metadados de disputa.
- Qualquer dado adicional em publico exige base legal e flag explicita de publicacao.

## 13) Contrato de UX do live
- Pagina publica do evento deve ter:
  - hero com estado e KPIs,
  - zona `Agora` por campo,
  - tabs `Calendario`, `Grupos`, `Quadro`, `Resultados`, `Participantes`.
- `TV_MODE` e pilar obrigatorio desde inicio desta frente.
- Direcao visual aprovada:
  - `sports_broadcast`,
  - numeros grandes, alto contraste, foco em score/tempo/estado.

## 14) Notificacoes live
- Base aprovada:
  - subscricao por competicao/categoria + canal `GERAL`,
  - eventos de inicio/fim de competicao,
  - fecho de grupos.
- Canal aprovado:
  - notificacoes apenas para utilizadores autenticados na app mobile,
  - sem notificacoes web/publicas.
- Perfil `JOGADOR` (owner aprovado):
  - `jogo agendado`,
  - `T-30`,
  - `T-15`,
  - `alteracao de campo/hora`,
  - `resultado registado/oficial`,
  - `proximo adversario`.
- Regra obrigatoria de dedupe:
  - `notificationKey = userId + matchId + eventType + scheduledAt`.
- Rate limit obrigatorio por prioridade:
  - `CRITICAL` (ex.: alteracao de hora/campo em cima da hora, cancelamento, proximo jogo definido): max `3` notificacoes por match/utilizador em `30 min`; evento `cancelamento` e sempre enviado.
  - `NON_CRITICAL` (ex.: lembretes T-30/T-15, updates nao urgentes): max `5` notificacoes por jogo por utilizador em `90 min`.
- `quietHours` opcional por utilizador/org:
  - durante quiet hours, notificacoes nao criticas sao adiadas para o proximo slot permitido.

## 15) Decisoes fechadas nesta ronda (owner)
- `DF-01`: publico web sem login para live em paginas publicas.
- `DF-02`: app com login obrigatorio.
- `DF-03`: `TV_MODE` entra desde inicio desta frente.
- `DF-04`: linguagem visual `sports_broadcast`.
- `DF-05`: coexistencia de resultados `imediatos` e `oficiais apos confirmacao`.
- `DF-06`: formatos do primeiro hard-launch = todos os formatos aprovados do menu live.
- `DF-07`: formatos sociais no primeiro corte = `NONSTOP`, `AMERICANO`, `MEXICANO`.
- `DF-08`: scoring default = `Golden Point ON` + `Super Tie-break no 3o set ON`.
- `DF-09`: submissao de resultados por defeito = apenas staff/organizacao; torneio pode abrir para jogadores.
- `DF-10`: janela default `PENDING_CONFIRMATION` = `15 min`.
- `DF-11`: notificacoes sao exclusivas da app mobile para utilizadores autenticados.
- `DF-12`: publico web sem login nao recebe notificacoes.
- `DF-13`: expiracao de `PENDING_CONFIRMATION` bloqueia progressao e exige revisao operacional (`PENDING_REVIEW_EXPIRED`).
- `DF-14`: `CANCELLED` e `VOID` competitivo sem efeito em `head_to_head` e minimo de jogos para `BEST_SECOND`.
- `DF-15`: idempotencia por comando com scope canonico e obrigatoria para todas as acoes de resultado.
- `DF-16`: paridade publico/interno e enforced por guardrails de comando/projecao (sem bypass).
- `DF-17`: dedupe + rate limit de notificacoes entram no contrato normativo.
- `DF-18`: `tiebreakExplanation` obrigatorio no read-model de standings.
- `DF-19`: `PENDING_REVIEW_EXPIRED` integra o enum oficial de estado de resultado.
- `DF-20`: `PENDING_REVIEW_EXPIRED` tem matriz formal de acoes permitidas/proibidas.
- `DF-21`: `technicalWinScore` e `retirementScoreRule` obrigatorios por `MatchScoringProfile`.
- `DF-22`: idempotencia de dominio por transicao de estado e obrigatoria.
- `DF-23`: `projection-only` tem excecao controlada apenas para diagnostico tecnico.
- `DF-24`: `reset_pending_result` e comando canonico obrigatorio para desbloqueio operacional.
- `DF-25`: `override_result` exige motivo e evidencias, e so opera em `DISPUTED`/`PENDING_REVIEW_EXPIRED`.
- `DF-26`: `affectsStandings` e obrigatorio no snapshot de match para gating de progressao.
- `DF-27`: alerta de expiracao tem canais e SLA operacionais minimos.
- `DF-28`: contrato de PII publica sem login e restritivo por defeito.
- `DF-29`: rate limit de notificacoes `CRITICAL` tem travao maximo (exceto cancelamento).

## 16) Decisoes abertas (owner) para fecho final
- Sem decisoes abertas de owner neste momento.

## 17) Gate de fecho do documento
- Este documento passa a `FECHADO_FINAL` quando:
  - sem decisoes abertas de owner para este escopo,
  - plano de implementacao live estiver materializado em codigo + testes,
  - evidencias de gate da fase B3 estiverem verdes.
