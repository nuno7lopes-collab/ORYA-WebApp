# Runtime Validation — Local (2026-02-07)

Base URL: `http://localhost:3000`

## Ops / Saúde (P0)
- `GET /api/internal/ops/health` → **200 OK**
- `GET /api/internal/ops/dashboard` → **200 OK**
- `GET /api/internal/ops/slo` → **200 OK**
- `GET /api/internal/outbox/dlq?limit=5` → **200 OK** (vazio)

## Outbox / Worker (P0)
- Smoke automático (script: `scripts/runtime_outbox_smoke.js`)
  - Evento criado: `diagnostic.runtime_smoke` (`eventId=3500b85f-8f33-43df-862e-2e74dc837abd`)
  - `POST /api/internal/worker/operations` (1) → **200 OK** (processed=0, backlog=0)
  - `POST /api/internal/worker/operations` (2) → **200 OK** (processed=0, backlog=0)
  - Estado após publish: `claimedAt` preenchido, **sem** `operation` criada, `publishedAt=null`
  - Fallback: inserção manual de `operationType=OUTBOX_EVENT` + novo worker
  - `POST /api/internal/worker/operations` (fallback) → **500**; `operation` ficou **RUNNING**, `publishedAt` continua `null`
  - `GET /api/internal/ops/outbox/summary` → pendingCountCapped=12, oldestPendingCreatedAt=2026-02-01
  - Re-run (após aumentar timeout de transação do outbox publisher para 60s)
    - Evento criado: `diagnostic.runtime_smoke` (`eventId=27d6130f-4da1-4e79-975f-cb69e64c8d2b`)
    - `POST /api/internal/worker/operations` (1) → **200 OK** (duration ~60s, processed=0)
    - `POST /api/internal/worker/operations` (2) → **200 OK** (processed=0)
    - Fallback → **500**, `operation` ficou **RUNNING**, `publishedAt` continua `null`
  - Diagnóstico direto (TS runner): `publishOutboxBatch()` falha com
    - `Transaction API error: ... commit cannot be executed on an expired transaction` (timeout 60s)
  - Ações locais executadas:
    - Stop temporário de `scripts/operations-loop.js` + `scripts/cron-loop.js`
    - Reset de `claimed_at/processing_token` em `app_v3.outbox_events` (pending=15)
    - Reconcile `RUNNING` → `FAILED` via `POST /api/internal/reconcile`
    - Loops **não** reiniciados: `operations-loop`/`cron-loop` apontavam para `https://orya.pt` via env (evitado em local).

### Outbox end‑to‑end (local, final)
- Ajuste de runtime:
  - Fallback sem transação para claim (pooler `:6543`) + guardas de erro por evento.
  - Flags suportadas: `OUTBOX_PUBLISH_SKIP_TX`, `OPERATIONS_SKIP_TX`,
    `OUTBOX_PUBLISH_TX_TIMEOUT_MS`, `OPERATIONS_TX_TIMEOUT_MS`.
  - Worker passou a processar em local sem timeout de transação.
- Execução (runner local com `OPERATIONS_SKIP_TX=1`, `OUTBOX_PUBLISH_SKIP_TX=1`):
  - Outbox total: **15**
  - Published: **12**
  - Dead‑lettered: **3** (`LOCAL_MISSING_DEP`)
  - Pending: **0**
- Operações:
  - SUCCEEDED: **12**
  - DEAD_LETTER: **5** (3 outbox + 2 legacy com `LOCAL_MISSING_DEP`)

**Motivos de DLQ local**
- `payment.created` / `payment.free_checkout.requested`: falta de dependências Stripe + FK `payment_snapshots_payment_fk`.
- `search.index.upsert.requested`: DB local sem coluna esperada (schema desatualizado).

**Conclusão:** pipeline outbox/worker **funciona end‑to‑end em local**, com DLQ controlado para eventos que dependem de Stripe/DB íntegros.

## Location (coarse + ip)
- `GET /api/location/ip` → **200 OK** (`UNAVAILABLE` em local, esperado sem headers edge)

## Address Service
- `GET /api/address/reverse` → **502** (Apple Maps indisponível)
- `GET /api/address/autocomplete` → **502** (Apple Maps indisponível)

**Nota:** o resolver atual é **Apple‑only** por decisão de produto; sem credenciais locais do Apple Maps, falha.
Para validar localmente: configurar Apple Maps no `.env.local`.

## Itens não validados (faltam credenciais/fluxo)
- Pagamentos/Stripe (`/api/payments/intent`, `/api/checkout/status`)
- Webhooks e reconciliação
- `POST /api/me/location/consent` (requer auth)

**Nota:** o pipeline outbox/worker foi validado em local com fallback sem transação, mas o sucesso total
depende de Stripe e de um schema DB atualizado (casos que geraram DLQ acima).

---

Resumo: Infra local responde, DLQ ok, mas Address Service falha por provider não configurado.
