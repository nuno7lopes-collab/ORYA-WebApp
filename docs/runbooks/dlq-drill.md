# DLQ drill (C6)

0) Objetivo e quando usar
- Testar operacionalmente DLQ + replay sem mexer em dados a mao.
- Quando: rollout, antes de go-live, apos mudancas no outbox/consumers.

1) Pre-requisitos
- Secret: `X-ORYA-CRON-SECRET`
- Endpoints internos:
  - `GET /api/internal/outbox/dlq`
  - `POST /api/internal/outbox/replay`
- Regra: replay so depois de causa resolvida.

2) Drill - modo "simulacao segura"

Passo A - medir baseline
- Chamar DLQ e guardar output.
- Capturar: count, tipos de eventos (se o endpoint mostrar), timestamps.

Passo B - forcar 1 falha controlada
- Sem mexer em codigo: provocar falha deterministica de um evento.
- Opcao 1 (preferida): usar toggle/config/env que desliga publisher/consumer (se existir no ambiente).
- Opcao 2 (fallback): desligar o consumer/worker ou bloquear network (staging) por 1 minuto.
- Objetivo: criar DLQ, nao criar drift.

Passo C - confirmar DLQ
- Voltar a chamar `GET /api/internal/outbox/dlq` e confirmar que aumentou 1 (ou n pequeno).

Passo D - corrigir causa
- Reverter toggle / voltar a ligar consumer / remover bloqueio.

Passo E - replay limitado
- Endpoint real requer `eventId` (nao ha replay "all"):

```
# listar DLQ
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/internal/outbox/dlq?limit=50"

# replay por eventId (1 a 1)
curl -sS -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/internal/outbox/replay" \
  -d '{"eventId":"evt_123"}'
```

3) Criterios de sucesso
- DLQ sobe quando forcamos falha.
- DLQ desce apos replay.
- Sem duplicados funcionais visiveis (idempotencia).

4) Nao facas asneira
- Nao apagar rows.
- Nao fazer replay em massa sem limite (nao existe endpoint bulk).
- Nao correr replay sem fix da causa.
- Se falhar de novo: parar, abrir incidente e registar IDs.

5) Template de registo do drill
- Quando / quem / ambiente:
- Baseline DLQ:
- Como forcaste falha:
- Replay params:
- Resultado:
