# Scripts (Ops/Diagnostico)

## diagnoseTournamentsMissingEventId.js

Diagnostico read-only para o D1: lista torneios com `eventId` em falta ou orfao (sem `events` associado),
com resumo por organizacao e indicacao de ligacao direta via `events.tournament_id` (se a coluna existir).

Uso:

```bash
node scripts/diagnoseTournamentsMissingEventId.js
node scripts/diagnoseTournamentsMissingEventId.js --format json --out /tmp/diagnose_tournaments.json
node scripts/diagnoseTournamentsMissingEventId.js --format csv --out /tmp/diagnose_tournaments.csv
```

Nota sobre TLS (importante):

- Preferido: usar `DATABASE_URL` a apontar para um proxy/endpoint com CA correta (cadeia valida).
- Ultimo recurso (apenas em sandbox local): `NODE_TLS_REJECT_UNAUTHORIZED=0` para contornar certificados self-signed.

Exemplo (estrutura do output JSON):

```json
{
  "generatedAt": "2026-01-26T20:40:00.000Z",
  "hasEventTournamentIdColumn": true,
  "total": 2,
  "items": [
    {
      "tournamentId": 123,
      "eventId": null,
      "organizationId": 45,
      "eventStatus": null,
      "eventStartsAt": null,
      "eventEndsAt": null,
      "hasAnyCandidateEventDirectLink": true,
      "candidateEventId": 987
    }
  ],
  "countsByOrgAndStatus": [
    { "organizationId": 45, "eventStatus": null, "count": 2 }
  ]
}
```
