# ORYA Chat V2 (WS + Redis) - Cutover e QA

## Objetivo
Executar a migração para o Chat Interno V2 com UX premium e realtime (WS + Redis), mantendo Postgres como fonte de verdade e eliminando o legado.

## Migração (Fases)
1) **V2 por defeito**
- Forçar o V2 como default (legacy mantido apenas como fallback técnico).
- Validar módulos de organização e permissões.

2) **Legacy read-only**
- Mensagens legacy ficam só leitura.
- Banner a indicar migração e botão para abrir V2.

3) **Cutover definitivo**
- Remover UI legacy.
- Remover chamadas legacy nos clientes.

## Realtime (WS + Redis)
- WS gateway ativo por defeito (fanout via Redis pub/sub).
- Eventos: message:new/update/delete, reaction:update, pin:update, message:read, typing:start/stop, presence:update, conversation:update.
- Reconexao com backoff e backfill via REST (refreshWindow + listagem incremental).

## Checklist QA (P0)
1) WS+Redis ativos em produção (sem polling no cliente).
2) Novo fluxo de conversa em modal dedicado (DM/Grupo/Canal).
3) Virtualização para conversas, timeline e threads.
4) Thread drawer à direita, sem poluir timeline principal.
5) Ações de mensagem: responder, reagir, fixar, copiar, editar, apagar, reportar.
6) Pesquisa FTS com highlight e salto para mensagem.
7) Definições de mute/notificações por conversa.
8) Offline: banner + envio pendente + retry.
9) Read receipts com debounce + separador de “novas mensagens”.
10) Acessibilidade: teclado, foco, ARIA e contraste.
