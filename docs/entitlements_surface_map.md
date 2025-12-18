# Bloco 3 — Entitlements Surface Map

Regra de ouro: qualquer fluxo fora do core (entitlements SSOT + operations + outbox) é LEGACY e deve ser apagado ou refatorado.

## UI / Páginas
| path/rota/template | responsabilidade | cenários | classificação | notas |
| --- | --- | --- | --- | --- |
| app/me/page.tsx | Perfil privado com contagem/lista via `/api/me/wallet` | EVENT_TICKET, PADEL_ENTRY, FREE, RESALE, SPLIT | CORE | Usa hook `useWallet` (entitlements + snapshot + actions); auth wall. |
| app/me/carteira/page.tsx | Carteira unificada (bilhetes/inscrições) | EVENT_TICKET, PADEL_ENTRY, FREE, RESALE, SPLIT | CORE | Consome `/api/me/wallet`; filtros de status; auth wall. |
| app/me/wallet/[id]/page.tsx | Detalhe entitlement (redirect p/ carteira) | EVENT_TICKET, PADEL_ENTRY | CORE | `/api/me/wallet/[id]` com QR token hash e actions; redirect mantém retrocompatibilidade. |
| app/me/tickets* | Wallet legacy e transfers | EVENT_TICKET, RESALE | LEGACY | Rotas antigas a remover; substituídas por `/me/carteira` e entitlements. |
| app/me/compras/page.tsx (+ purchases-client.tsx) | Histórico de compras | EVENT_TICKET, FREE, SPLIT | SUSPEITO | Usa `/api/me/purchases` com sale_summary/tickets; deve alinhar com entitlements para acesso. |
| app/bilhete/[id]/page.tsx | Página detalhe de bilhete com QR live | EVENT_TICKET | LEGACY | Fetch direto a `ticket` e `ticketType`; QR é `qrSecret` legado. |
| app/resale/[id]/page.tsx | Detalhe de revenda + pagamento | RESALE | SUSPEITO | Compra revenda ainda assenta em tickets legacy; deve migrar para entitlement transfer emitido pelo worker. |
| app/staff/scan/page.tsx | UI staff scan/check-in (valida via `/api/staff/validate-qr`) | EVENT_TICKET | LEGACY | Usa QR/token legado e check-in direto em tickets. |
| app/organizador/scan/scan-client.tsx | UI check-in organizer (usa `/api/tickets/scan`) | EVENT_TICKET | LEGACY | Faz POST direto e mostra status baseado em ticket.checkins; não usa entitlements. |
| app/staff/eventos/page.tsx | Lista eventos para staff check-in | EVENT_TICKET | SUSPEITO | Alimenta fluxo de check-in legacy. |
| app/padel/duplas/page.tsx | Gestão de dupla/entrada padel | PADEL_ENTRY, SPLIT/FULL | SUSPEITO | Usa ticket/entry direto; deve virar entitlement com slot/duoStatus. |

## APIs / Handlers
| path/rota/template | responsabilidade | cenários | classificação | notas |
| --- | --- | --- | --- | --- |
| app/api/me/tickets/route.ts | Lista tickets do user (wallet legacy) | EVENT_TICKET, FREE, RESALE, SPLIT | LEGACY | Join direto em tickets/sale_summary; entrega qrToken; sem entitlements/actions/snapshot. |
| app/api/me/tickets/transfers/route.ts | Lista transferências de tickets | RESALE/TRANSFER | LEGACY | Baseada em ticket transfer; não há entitlements nem ownership XOR. |
| app/api/me/purchases/route.ts | Detalhe de compras com linhas/tickets | EVENT_TICKET, FREE, SPLIT | SUSPEITO | Usa sale_summary + tickets; wallet/detalhe deveria vir de entitlements. |
| app/api/qr/validate/route.ts | Valida QR/token e retorna ticket/event | EVENT_TICKET | LEGACY | Token custom, não entitlementId; faz update de purchase/ticket direto. |
| app/api/staff/validate-qr/route.ts | Check-in staff (idempotência parcial) | EVENT_TICKET | LEGACY | Atualiza ticket.usedAt direto; códigos/resultados não padronizados. |
| app/api/tickets/scan/route.ts | Check-in organizer (usado por /organizador/scan) | EVENT_TICKET | LEGACY | Busca ticket por code e incrementa checkins; sem constraint única nem audit completa. |
| app/api/qr/[token]/route.ts | Serve QR dinâmico (legacy) | EVENT_TICKET | LEGACY | Usa qrSecret; não segue token hash entitlement. |
| app/api/me/inscricoes/route.ts | Lista inscrições | PADEL_ENTRY | SUSPEITO | Usa entries/tickets diretos; deve ser entitlements type PADEL_ENTRY. |
| app/api/me/inscricoes/[id]/route.ts | Detalhe inscrição | PADEL_ENTRY | SUSPEITO | Não usa entitlements; deve migrar. |
| app/api/eventos/[slug]/resales/route.ts | Lista revendas de bilhetes | RESALE | SUSPEITO | Usa tickets para revenda; futuro: entitlements REVOKED/ACTIVE em resale. |
| app/api/internal/worker/operations/route.ts (issue tickets) | Emissão/notify legacy | EVENT_TICKET, PADEL_ENTRY | SUSPEITO | Worker atual ainda emite tickets; Bloco 3 lê entitlements materializados. |
| domain/notifications/producer.ts (notifyTicketWaitingClaim) | Notificação claim guest | CLAIM | SUSPEITO | Usa ticketId e dedupe própria; precisa migrar para Operation+Outbox com entitlement/purchaseId. |
| app/api/ownership/claim/route.ts | Claim identity (user) | CLAIM | LEGACY | Reatribui tickets via helper; deve virar Operation CLAIM_GUEST_PURCHASE. |
| app/api/guests/migrate/route.ts | Migra guest por email | CLAIM | LEGACY | Atualiza tickets/guest_link direto; sem Operation/dedupe/purchaseId anchor. |
| app/api/tickets/migrate-guest/route.ts | Migrate guest CTA checkout | CLAIM | LEGACY | Similar ao acima; fora de Operation. |
| app/api/auth/callback/claim/route.ts | Callback claim identity | CLAIM | LEGACY | Fluxo paralelo sem Operation. |
| app/api/padel/pairings/claim/[token]/route.ts | Claim de pairing padel | PADEL_ENTRY, CLAIM | SUSPEITO | Não usa entitlements; pode ser mantido com refactor para entitlements padel. |
| app/api/admin/tickets/list/route.ts | Admin list tickets | ADMIN | LEGACY | Baseado em tickets; deve ler entitlements para suporte. |
| app/api/internal/checkout/timeline/route.ts | Timeline checkout | EVENT_TICKET | SUSPEITO | Usa tickets/refunds; para acesso deve consumir entitlements timeline. |

## Emails / Notificações
| path/rota/template | responsabilidade | cenários | classificação | notas |
| --- | --- | --- | --- | --- |
| domain/notifications/producer.ts (várias notify*) | Envio/trigger de emails/notifs | PURCHASE, CLAIM, REFUND | SUSPEITO | Pode bypassar Outbox; precisa alinhar com Operation SEND_EMAIL e dedupeKey por purchaseId+recipient. |
| app/components/checkout/Step3Sucesso.tsx (fetch /api/me/tickets) | Pós-compra revalida wallet | EVENT_TICKET | LEGACY | Refresca tickets legacy para mostrar QR; deve chamar /api/me/wallet novo. |
| app/components/checkout/Step2Pagamento.tsx (migrate-guest) | CTA migrate guest | CLAIM | SUSPEITO | Endpoint `/api/tickets/migrate-guest` (se existir) fora do modelo de Operation dedupe. |

## Classificação resumo
- CORE: inexistente (ainda não há superfícies baseadas em entitlements materializados).
- SUSPEITO: pontos que tocam bilhetes/claim/emails mas ainda podem ser reaproveitados com refactor (ex.: resales, padel entries, notifications).
- LEGACY: wallet/tickets atuais, QR/scan/check-in, quaisquer handlers que usem tickets direto ou enviem emails sem Outbox/Operation.

Gate: qualquer rota/página/handler acima deve ser migrado ou eliminado antes de fechar Bloco 3.
