# Discover API Contract Matrix (Before vs After)

| Endpoint | Antes | Depois |
|---|---|---|
| `GET /api/servicos/list` | `city` ignorado | `city` suportado e aplicado no `where` |
| `GET /api/padel/discover` | `city` ignorado | `city` suportado e aplicado no `where` |
| `GET /api/padel/public/open-pairings` | `city` ignorado | `city` suportado e aplicado no `where.event` |
| `GET /api/explorar/list` | Em erro interno devolvia `200` com `items: []` | Em erro interno devolve `500` com `errorCode/code = INTERNAL_ERROR` |
| `POST /api/me/events/signals` | Sem logs estruturados em erro | Log estruturado com scope `api.me.events.signals` |
| `GET /api/address/*` | `console.error` solto | Log estruturado (`api.address.autocomplete/details/reverse`) |

