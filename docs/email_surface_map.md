# Email Surface Map (Bloco 3)

Inventário de emails transacionais relacionados com entitlements/acesso.

| templateKey | trigger | destinatário | cenários | notas |
| --- | --- | --- | --- | --- |
| PURCHASE_CONFIRMED | pagamento confirmado (paid) | buyer (user) | EVENT_TICKET, PADEL_ENTRY, FREE, RESALE, SPLIT | Recebido quando SaleSummary PAID; inclui resumo da compra. |
| PURCHASE_CONFIRMED_GUEST | pagamento confirmado para guest | guest email (ownerIdentityId) | EVENT_TICKET, PADEL_ENTRY, RESALE, SPLIT | Usa email normalizado. |
| ENTITLEMENT_DELIVERED | entitlements emitidos | buyer (user) | EVENT_TICKET, PADEL_ENTRY, FREE | Liga para wallet; contém snapshot do entitlement. |
| ENTITLEMENT_DELIVERED_GUEST | entitlements emitidos (guest) | guest email | EVENT_TICKET, PADEL_ENTRY | Incentiva verificação + claim. |
| CLAIM_GUEST | claim efetuado | user (novo owner) | CLAIM | Confirma reassociação; inclui purchaseId. |
| REFUND | refund/cancelamento/alteração de data | buyer/guest conforme owner | REFUNDED | Valor base-only, alerta que acesso está bloqueado. |
| IMPORTANT_UPDATE (gancho futuro) | updates críticos | buyer/guest | QUALQUER | Placeholder para mudanças de horário/local/perks. |

Gate: Todos os envios via Outbox + Operation SEND_EMAIL.
