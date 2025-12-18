# Access Policy Resolver (Bloco 3)

Resolver central calcula `actions` a partir de entitlement + contexto (role, policy de evento/torneio, tempo). FE só renderiza o que vier de `actions`.

## Inputs
- entitlement: type, status, ownerKey, scope (eventId/tournamentId/seasonId), snapshotStartAt.
- requester: role (OWNER | ORGANIZER | ADMIN), userId/identityId para comparar ownership.
- policy: checkinWindow (start/end), re-entry rules, live info flags por scope.
- environment: agora (para janelas), deviceId (para auditoria de check-in).

## Actions mínimas (boolean)
- canShowQr: OWNER com status ACTIVE; bloqueado se REFUNDED/REVOKED/SUSPENDED; opcional se dentro da janela de check-in.
- canCheckIn: ORGANIZER/ADMIN se dentro de janela e status ACTIVE; se USED → false e retorna ALREADY_USED; se REFUNDED/REVOKED/SUSPENDED → false com códigos respectivos; OUTSIDE_WINDOW se hora fora.
- canClaim: OWNER identity (guest) com emailVerifiedAt true, status ≠ REFUNDED/REVOKED/SUSPENDED; idempotente.
- canViewDetails: OWNER sempre que entitlement existe; ORGANIZER/ADMIN apenas para o seu scope.
- canContactSupport: fallback true se entitlement existe (owner ou admin).
- Extensível: canViewLiveInfo, canViewSchedule, canViewResults, canTransfer (futuro), canInvitePartner (padel).

## Regras por status
- ACTIVE: ações permitidas conforme role/policy (QR/Check-in/Claim).
- USED: canShowQr=false (pode mostrar audit light), canCheckIn=false retorna ALREADY_USED.
- REFUNDED/REVOKED/SUSPENDED: canShowQr=false, canCheckIn=false com code REFUNDED/REVOKED/SUSPENDED; canClaim=false.

## Regras por role
- OWNER: vê wallet/detalhe; QR apenas se status ACTIVE; claim se guest e elegível.
- ORGANIZER: pode check-in/ver attendees para eventId/tournamentId do scope; sem acesso à wallet de outros eventos.
- ADMIN: ignora scope restrictions mas respeita status; deve usar mesma API/códigos.
