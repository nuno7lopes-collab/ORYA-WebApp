# ADR-2026-02-13: Hardening Total de Mensagens/Chat (Big Bang)

## Estado
Aceite

## Data
2026-02-13

## Contexto
O domínio de mensagens/chat tinha drift entre frontend/backend, comportamentos parciais por contexto (`EVENT` no b2c), superfícies com anexos ainda ativas e resíduos de código legado.

## Decisão
1. Entrega única (`big bang`) para convergir contratos, runtime e UX.
2. `b2c` passa a `mobile-only` por contrato em todos os endpoints de mensagens e no websocket.
3. `EVENT` fica suportado de ponta a ponta em `b2c`.
4. Janela temporal de escrita em `EVENT`: permitida até `endsAt + 24h`; após isso, `read-only`.
5. Conteúdo de mensagens passa a `texto-only`.
6. `attachments/presign` é desativado; payloads com anexos são rejeitados com `ATTACHMENTS_DISABLED`.
7. Migração one-off executa purge destrutivo de mensagens históricas com anexos, incluindo ficheiros e metadata associados, sem marcador no histórico.
8. A exceção de retenção para purge é estritamente one-off de migração, não uma regra operacional contínua.
9. Kill switch/feature flag transitório de chat v2 é removido.
10. Código legado de chat é removido e protegido por guardrails de CI.

## Consequências
- Breaking changes públicas: `MessagesSendSchema` sem `attachments`, `POST /api/messages/attachments/presign` removido funcionalmente, b2c não-mobile bloqueado.
- Maior previsibilidade operacional: políticas temporais e de plataforma centralizadas.
- Simplificação de superfície de produto: sem anexos, menor risco de inconsistência storage/metadata.
