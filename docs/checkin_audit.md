# Check-in Audit (Bloco 3)

Endpoint core: `POST /api/organizador/checkin`
- Input: { qrToken, eventId, deviceId }
- Output codes: OK | ALREADY_USED | INVALID | REFUNDED | REVOKED | SUSPENDED | NOT_ALLOWED | OUTSIDE_WINDOW

Idempotência
- Constraint única: `unique(eventId, entitlementId)` garante “primeiro scan ganha”.
- Double scan devolve `ALREADY_USED` sem efeitos.

Campos de auditoria (persistentes)
- entitlementId
- eventId
- checkedInAt (timestamptz)
- checkedInBy (userId do operador ou serviço)
- deviceId
- resultCode (um dos outputs)
- purchaseId (para correlação)

Logs estruturados
- Sempre incluir purchaseId, entitlementId, ownerKey (quando disponível), scopeId, deviceId, resultCode, dedupeKey.
