# Permissions Matrix (Bloco 3)

Permissões mínimas e códigos estáveis (403 com `code`).

## Wallet/Detail
- OWNER (autenticado): acesso total à própria wallet e detalhe de entitlements.
- ADMIN: acesso a qualquer wallet para suporte.
- ORGANIZER: sem acesso à wallet de utilizadores (0 permissões).
- Público/anon: sem acesso.
- Erro: `FORBIDDEN_WALLET_ACCESS` (sem leaks).

## Attendees/Check-in
- ORGANIZER: pode listar/filtrar attendees e fazer check-in apenas para eventos/torneios do seu scope.
- ADMIN: pode para qualquer scope.
- OWNER: sem acesso a attendees/check-in (fora do seu próprio entitlement).
- Erro listar: `FORBIDDEN_ATTENDEES_ACCESS`; Erro check-in: `FORBIDDEN_CHECKIN_ACCESS`.

## Claim Guest
- OWNER identity (guest) com emailVerifiedAt: pode enfileirar claim.
- OWNER user (já claimed) ou estados REFUNDED/REVOKED/SUSPENDED: `FORBIDDEN_CLAIM`.
- ORGANIZER/ADMIN: não podem reclamar em nome de outro via UI pública.

## Emails/Outbox
- Apenas worker/operations enviam; rotas UI não enviam.
- Re-enfileirar (admin tool) respeita dedupe.

## Observações
- Todas as rotas devem validar role + scope antes de ler dados sensíveis.
- Logs sempre com purchaseId + entitlementId + role + resultCode.
