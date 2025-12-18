# Check-in Policy (Bloco 3)

Janelas
- `checkinWindow`: start/end por evento/tipo. Default permissivo se não configurado.
- Fora da janela → result `OUTSIDE_WINDOW` (sem efeitos).

Re-entry
- Default: não permite re-entry (USED bloqueia).
- Opcional: cooldown ou re-entry limitado configurável por evento; armazenar `usedAt`/`deviceId` para audit.

Estados
- ACTIVE: elegível.
- USED: retorna `ALREADY_USED`.
- REFUNDED/REVOKED/SUSPENDED: recusado com code correspondente.

Dispositivos
- `deviceId` obrigatório no input para auditoria/antifraude.
- Possível rate-limit por device/evento.
