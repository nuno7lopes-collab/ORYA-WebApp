# API Pública v1 (read‑only)

> Nota (SSOT v9): API pública fora de scope v1–v3. Mantido apenas para arquivo histórico.

## Endpoints

| Endpoint | Scope | Query params | Notas |
|---|---|---|---|
| `GET /api/public/v1/events` | `events:read` | `from`, `to`, `limit`, `cursor` | Lista eventos públicos da organização. |
| `GET /api/public/v1/tournaments` | `tournaments:read` | `from`, `to`, `limit`, `cursor` | Lista torneios públicos (via Event). |
| `GET /api/public/v1/discover` | `events:read` | `q`, `city`, `categories`, `date`, `day`, `type`, `priceMin`, `priceMax`, `limit`, `cursor` | Feed público (paridade com explorar). |
| `GET /api/public/v1/search` | `events:read` | `q`, `city`, `categories`, `date`, `day`, `type`, `priceMin`, `priceMax`, `from`, `to`, `limit`, `cursor` | Pesquisa pública (read‑only). |
| `GET /api/public/v1/agenda` | `agenda:read` | `from`, `to`, `limit`, `cursor`, `sourceTypes` | Lista AgendaItem (EVENT/TOURNAMENT/BOOKING). |
| `GET /api/public/v1/analytics` | `analytics:read` | `from`, `to`, `metricKeys`, `dimensionKey`, `limit` | Rollups agregados (sem PII). |

## Autenticação

Header `Authorization: Bearer <api_key>` ou `X-API-Key: <api_key>`.
Keys são guardadas apenas por hash + prefixo. O plaintext só é devolvido uma vez no create (internal).

## Exemplos (resumo)

**Events**
```json
{ "items": [{ "id": 10, "slug": "summer-open", "title": "Summer Open", "startsAt": "...", "endsAt": "...", "organization": { "id": 1, "publicName": "Club" } }], "nextCursor": 10 }
```

**Discover/Search**
```json
{ "items": [{ "id": 1, "slug": "evento-1", "title": "Evento 1", "startsAt": "...", "endsAt": "...", "location": { "city": "Lisboa" }, "isGratis": false, "priceFrom": 10.0 }], "nextCursor": 1 }
```

**Agenda**
```json
{ "items": [{ "id": "uuid", "sourceType": "EVENT", "sourceId": "10", "title": "Summer Open", "startsAt": "...", "endsAt": "...", "status": "PUBLISHED" }], "nextCursor": "uuid" }
```

**Analytics**
```json
{ "items": [{ "bucketDate": "2026-01-01T00:00:00.000Z", "metricKey": "GROSS", "dimensionKey": "CURRENCY", "dimensionValue": "EUR", "value": 12345 }] }
```

## PII guardrails (v8)

Sem dados pessoais: sem email, telefone, morada pessoal, pushTokens, IPs, deviceIds ou IDs de identidade.
Dados públicos apenas (eventos/agenda/rollups). Sem writes.
