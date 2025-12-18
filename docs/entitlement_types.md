# Entitlement Types (Bloco 3)

Tipos suportados e futura expansão; todos partilham o contrato base e scopes.

- EVENT_TICKET: scope = eventId; slotCount=1; QR/check-in aplica; snapshot de evento.
- PADEL_ENTRY: scope = tournamentId (+eventId se existir); slotCount=1 ou 2; campos adicionais ver padel spec; check-in conforme torneio.
- PASS: scope = seasonId ou eventGroupId; pode representar múltiplos eventos (actions controlam).
- SUBSCRIPTION_ACCESS: scope = subscriptionId/periodKey; janela temporal definida pela subscrição.
- FUTURE_TYPE: placeholder para perks/live info; segue ownerKey/source/status padrão.

Notas de scope:
- Sempre explicitar o scope primário (eventId/tournamentId/seasonId) para filtragem/políticas.
- Tipos com múltiplos alcances (ex.: pass de torneio + evento) devem guardar ambos para resolver actions corretamente.
