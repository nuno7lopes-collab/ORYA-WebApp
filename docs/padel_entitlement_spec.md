# Padel Entitlement Spec (Bloco 3)

Campos adicionais (além do contrato base)
- slotCount: 1 (split) ou 2 (full).
- slotRole: CAPTAIN | PARTNER.
- pairingId: identifica a dupla.
- duoStatus: PENDING_PARTNER | CONFIRMED | EXPIRED.
- paymentMode: SPLIT | FULL.
- partnerRef: username/email convidado.

Regras
- FULL: worker emite 2 entitlements (capitão+parceiro) com ownerKey definido; duoStatus=CONFIRMED.
- SPLIT: worker emite 1 entitlement pago (slotCount=1, role=CAPTAIN ou PARTNER pago) e mantém duoStatus=PENDING_PARTNER até segundo pagamento/claim; estado real sempre no DB.
- Claim/ownership: segue regra ownerKey XOR; purchaseId preservado em ambos os slots.
- Check-in: aplica checkinWindow do torneio; re-entry default = não; ambos slots devem estar ACTIVE.

UI
- Mostrar duoStatus, partnerRef e quem pagou; actions canInvitePartner/canShowQr condicionadas ao status.
