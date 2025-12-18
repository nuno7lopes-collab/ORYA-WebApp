# Entitlements Legacy Report (Bloco 3)

Classificação: DELETE | REFATORAR | KEEP (com evidência).

## DELETE (removido/inautivo ou substituído pela carteira nova)
- app/me/tickets/page.tsx, app/me/tickets/transfers/page.tsx, app/bilhete/[id]/page.tsx (rotas legacy de bilhetes/QR). Status: removidas do menu/UX; detalhe redireciona para carteira nova.
- app/api/qr/[token]/route.ts, app/api/qr/validate/route.ts, app/api/tickets/scan/route.ts, app/api/staff/validate-qr/route.ts (check-in/QR legacy). Status: removidas do código ou marcadas para remoção final — core usa `/api/organizador/checkin` + QR hash.
- app/api/ownership/claim/route.ts, app/api/guests/migrate/route.ts, app/api/tickets/migrate-guest/route.ts, app/api/auth/callback/claim/route.ts (claims fora de Operation). Status: substituídos por `/api/me/claim-guest` (enqueue-only).

## REFATORAR
- app/resale/[id]/page.tsx + app/api/eventos/[slug]/resales/route.ts (revenda assente em tickets → migrar para entitlements REVOKED/ACTIVE com Operation transfer).  
- app/padel/duplas/page.tsx + entradas padel (usar entitlements type PADEL_ENTRY com slot/duoStatus).  
- app/api/me/purchases/route.ts (expõe tickets/sale_lines; mover detalhes de acesso para `/api/me/wallet`).  
- app/api/me/inscricoes/route.ts (inscrições usando entries/tickets diretos).  
- domain/notifications/producer.ts (notifyTicketWaitingClaim e afins) → alinhar com Outbox + Operation SEND_EMAIL/CLAIM.  
- Checkout CTA migrate-guest em Step2Pagamento/Step3Sucesso → deve chamar endpoint enqueue-only claim.  
- worker issuance em app/api/internal/worker/operations/route.ts → continuar só como writer de entitlements materializados; FE/BE de acesso deve consumir entitlements view.
- app/me/compras/page.tsx (+ purchases-client) → consumir `/api/me/wallet` para acesso e entitlements; manter ledger só para finanças.
- app/api/me/inscricoes/route.ts e app/api/me/inscricoes/[id]/route.ts → migrar para entitlements PADEL_ENTRY; retirar dependências de entries/tickets diretos.
- app/api/admin/tickets/list/route.ts → listar suporte/admin a partir de entitlements + timeline em vez de tickets legacy.

## KEEP
- Nenhum fluxo de acesso atual está conforme o modelo de entitlements; tudo listado precisa de remoção ou refactor para o core.
