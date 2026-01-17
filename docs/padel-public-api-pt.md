# ORYA Padel - API publica (v1)

API publica para widgets e dados de torneios padel. Todos os endpoints abaixo so respondem quando o evento esta publicado e com competicao em estado PUBLIC.

## Versao

- Versao atual: `v1`
- Base URL: `https://<dominio>/`

## Changelog

- 2026-01-11: Adicionado calendario publico por court/dia (`/api/padel/public/calendar`).
- 2026-01-11: Rate limit publico unificado para endpoints padel.

## Rate limit

- Limite base: 120 requests/min por IP.
- Live (SSE): 30 requests/min por IP.
- Em caso de bloqueio: status `429` com header `Retry-After` (segundos).

## Endpoints de torneio

### GET `/api/padel/matches`

Parâmetros:
- `eventId` (obrigatorio)
- `categoryId` (opcional)

Resposta: lista de jogos com equipas, horários e score.

Exemplo:
```
GET /api/padel/matches?eventId=42
```
```json
{ "ok": true, "items": [ { "id": 101, "status": "IN_PROGRESS", "roundLabel": "SEMIFINAL" } ] }
```

### GET `/api/padel/standings`

Parâmetros:
- `eventId` (obrigatorio)
- `categoryId` (opcional)

Resposta: standings por grupo (`standings`).

Exemplo:
```
GET /api/padel/standings?eventId=42
```
```json
{ "ok": true, "standings": { "A": [ { "pairingId": 1, "points": 3 } ] } }
```

### GET `/api/padel/live`

Parâmetros:
- `eventId` (obrigatorio)
- `categoryId` (opcional)

Resposta: SSE (`event: update`) com `matches` + `standings`.

Exemplo (SSE):
```
GET /api/padel/live?eventId=42
```
```
event: update
data: {"matches":[...],"standings":{...},"updatedAt":"2025-01-01T10:00:00.000Z"}
```

### GET `/api/padel/public/calendar`

Parâmetros:
- `eventId` (opcional)
- `slug` (opcional)
- `date` (opcional, `YYYY-MM-DD`)

Resposta: dias com courts e jogos ordenados por horário.

Exemplo:
```
GET /api/padel/public/calendar?slug=torneio-orya
```
```json
{ "ok": true, "days": [ { "date": "2025-01-01", "courts": [ { "courtLabel": "Court 1" } ] } ] }
```

## Widgets publicos

Os widgets renderizados para iframe estao em `/widgets/padel/*`. Os endpoints abaixo devolvem JSON para consumo direto.

### GET `/api/widgets/padel/bracket`

Parâmetros:
- `eventId` (opcional)
- `slug` (opcional)

Resposta: bracket com rondas e jogos KO.

### GET `/api/widgets/padel/standings`

Parâmetros:
- `eventId` (obrigatorio)

Resposta: standings simplificados por grupo.

### GET `/api/widgets/padel/next`

Parâmetros:
- `eventId` (opcional)
- `slug` (opcional)

Resposta: proximos jogos (ate 8).

### GET `/api/widgets/padel/calendar`

Parâmetros:
- `eventId` (opcional)
- `slug` (opcional)

Resposta: JSON com dias, courts e jogos.

Embed (iframe):
```
/widgets/padel/calendar?slug=<slug>
```

## Descoberta publica

### GET `/api/padel/public/clubs`

Parâmetros:
- `q`, `city`, `limit`, `includeCourts=1`

Resposta: clubes de padel ativos.

### GET `/api/padel/public/open-pairings`

Parâmetros:
- `q`, `city`, `limit`

Resposta: duplas abertas para parceiro.

### GET `/api/padel/discover`

Parâmetros:
- `q`, `city`, `date`, `day`, `format`, `eligibility`, `level`, `priceMin`, `priceMax`, `limit`

Resposta: eventos padel publicados.

## Erros comuns

- `403 FORBIDDEN`: evento nao publicado ou invite-only.
- `404 EVENT_NOT_FOUND`: eventId/slug invalido.
- `429 RATE_LIMITED`: excedeu rate limit (ver `Retry-After`).
