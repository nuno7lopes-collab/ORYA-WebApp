# Wallet UI Spec (Bloco 3)

Cartão
- Formato quadrado; imagem de fundo = snapshotCoverUrl.
- Overlay vidro/blur no terço inferior; texto em alto contraste.
- Conteúdo: snapshotTitle, snapshotStartAt (data curta + hora), snapshotVenueName.
- Badges discretos: type (ex.: EVENT_TICKET/PADEL_ENTRY) + status (ACTIVE/USED/REFUNDED/REVOKED/SUSPENDED) com cor semáforo.

Estados
- ACTIVE: mostra CTA QR (se actions.canShowQr); badge verde.
- USED: mostra audit light (usedAt, device) se disponível; badge neutro.
- REFUNDED/REVOKED/SUSPENDED: cartão desativado (desaturado) e CTA desabilitado.
- Carregamento: skeleton quadrado; erro: alerta curto.

Detalhe por tipo
- EVENT_TICKET: QR vivo (ou código) se canShowQr; status; audit light; link para info do evento.
- PADEL_ENTRY: mostra duoStatus/partnerRef/slotCount; ações de convidar parceiro se canInvitePartner; schedule/results quando existirem.
- PASS/SUBSCRIPTION: lista de eventos inclusos + actions canShowQr/canCheckIn por evento (futuro).

Interações
- Clique abre detalhe `/me/wallet/[entitlementId]`.
- Botões exibidos apenas se `actions` permitirem (QR/check-in/claim/etc.).
