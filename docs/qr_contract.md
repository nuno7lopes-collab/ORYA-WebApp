# QR Contract (Bloco 3)

Token strategy: lookup (recomendada)
- QR contém `qrToken` opaco (não é entitlementId).
- Backend guarda `tokenHash -> entitlementId (+metadata)` com exp opcional.
- Validação: hash token, buscar entitlement, aplicar policy/status → codes estáveis.
- Rotatividade opcional (regerar token invalida hash anterior).

Segurança
- Token imprevisível (>=128 bits), sem dados legíveis.
- Rate-limit por device/IP/entitlement para evitar brute force.
- Expiração curta pode ser usada mas não obrigatória se hash lookup for suficiente.
- Offline assinado fica para S2.

Uso
- QR exibido só se `actions.canShowQr` = true.
- Em check-in, endpoint deve sempre responder com códigos estáveis (ver check-in).
