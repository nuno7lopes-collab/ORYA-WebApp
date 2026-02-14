# V9 Inventory — Pages/Routes

Total: 246

| Route | File | Group | Flow Tags |
| --- | --- | --- | --- |
| /[username] | app/[username]/page.tsx | - | public |
| /[username]/loja | app/[username]/loja/page.tsx | - | loja |
| /[username]/loja/carrinho | app/[username]/loja/carrinho/page.tsx | - | loja |
| /[username]/loja/checkout | app/[username]/loja/checkout/page.tsx | - | checkout, loja |
| /[username]/loja/descargas | app/[username]/loja/descargas/page.tsx | - | loja |
| /[username]/loja/produto/[slug] | app/[username]/loja/produto/[slug]/page.tsx | - | loja |
| /[username]/padel | app/[username]/padel/page.tsx | - | padel |
| /[username]/treinadores/[trainer] | app/[username]/treinadores/[trainer]/page.tsx | - | public |
| /admin | app/admin/(protected)/page.tsx | (protected) | admin |
| /admin/audit | app/admin/(protected)/audit/page.tsx | (protected) | admin |
| /admin/config/platform-email | app/admin/(protected)/config/platform-email/page.tsx | (protected) | admin |
| /admin/eventos | app/admin/(protected)/eventos/page.tsx | (protected) | admin |
| /admin/finance | app/admin/(protected)/finance/page.tsx | (protected) | admin |
| /admin/forbidden | app/admin/forbidden/page.tsx | - | admin |
| /admin/infra | app/admin/(protected)/infra/page.tsx | (protected) | admin |
| /admin/mfa | app/admin/mfa/page.tsx | - | admin |
| /admin/organizacoes | app/admin/(protected)/organizacoes/page.tsx | (protected) | admin |
| /admin/payments | app/admin/(protected)/payments/page.tsx | (protected) | admin |
| /admin/payouts | app/admin/(protected)/payouts/page.tsx | (protected) | admin |
| /admin/refunds | app/admin/(protected)/refunds/page.tsx | (protected) | admin |
| /admin/settings | app/admin/(protected)/settings/page.tsx | (protected) | admin |
| /admin/tickets | app/admin/(protected)/tickets/page.tsx | (protected) | admin |
| /admin/utilizadores | app/admin/(protected)/utilizadores/page.tsx | (protected) | admin |
| /agora | app/agora/page.tsx | - | public |
| /atividade | app/atividade/page.tsx | - | public |
| /auth/callback | app/auth/callback/page.tsx | - | login |
| /cobrancas/[token] | app/cobrancas/[token]/page.tsx | - | public |
| /convites/[token] | app/convites/[token]/page.tsx | - | public |
| /convites/organizacoes | app/convites/organizacoes/page.tsx | - | public |
| /cookie-policy | app/cookie-policy/page.tsx | - | public |
| /cookies | app/cookies/page.tsx | - | public |
| /descobrir | app/descobrir/page.tsx | - | public |
| /descobrir/eventos | app/descobrir/eventos/page.tsx | - | public |
| /descobrir/reservas | app/descobrir/reservas/page.tsx | - | reservas |
| /descobrir/torneios | app/descobrir/torneios/page.tsx | - | public |
| /docs/org-canonical-migration | app/docs/org-canonical-migration/page.tsx | - | public |
| /em-breve | app/em-breve/page.tsx | - | public |
| /eventos | app/eventos/page.tsx | - | eventos |
| /eventos/[slug] | app/eventos/[slug]/page.tsx | - | eventos |
| /eventos/[slug]/calendario | app/eventos/[slug]/calendario/page.tsx | - | eventos |
| /eventos/[slug]/jogos/[matchId] | app/eventos/[slug]/jogos/[matchId]/page.tsx | - | eventos |
| /eventos/[slug]/live | app/eventos/[slug]/live/page.tsx | - | eventos |
| /eventos/[slug]/monitor | app/eventos/[slug]/monitor/page.tsx | - | eventos |
| /eventos/[slug]/ranking | app/eventos/[slug]/ranking/page.tsx | - | eventos |
| /eventos/[slug]/score | app/eventos/[slug]/score/page.tsx | - | eventos |
| /eventos/nova | app/eventos/nova/page.tsx | - | eventos |
| /explorar | app/explorar/page.tsx | - | public |
| /guest/tickets/[token] | app/guest/tickets/[token]/page.tsx | - | public |
| /inscricoes/[id] | app/inscricoes/[id]/page.tsx | - | public |
| /landing | app/landing/page.tsx | - | public |
| /legal/cookies | app/legal/cookies/page.tsx | - | public |
| /legal/organizacao | app/legal/organizacao/page.tsx | - | public |
| /legal/privacidade | app/legal/privacidade/page.tsx | - | public |
| /legal/reembolsos | app/legal/reembolsos/page.tsx | - | public |
| /legal/termos | app/legal/termos/page.tsx | - | public |
| /live/[id]/monitor | app/live/[id]/monitor/page.tsx | - | public |
| /login | app/login/page.tsx | - | login |
| /logo | app/logo/page.tsx | - | public |
| /loja/seguimento | app/loja/seguimento/page.tsx | - | loja |
| /me | app/me/page.tsx | - | user |
| /me/atividade | app/me/atividade/page.tsx | - | user |
| /me/bilhetes/[id] | app/me/bilhetes/[id]/page.tsx | - | user |
| /me/carteira | app/me/carteira/page.tsx | - | user |
| /me/compras | app/me/compras/page.tsx | - | user |
| /me/compras/loja | app/me/compras/loja/page.tsx | - | loja, user |
| /me/compras/loja/[orderId] | app/me/compras/loja/[orderId]/page.tsx | - | loja, user |
| /me/creditos | app/me/creditos/page.tsx | - | user |
| /me/loja | app/me/loja/page.tsx | - | loja, user |
| /me/reservas | app/me/reservas/page.tsx | - | reservas, user |
| /me/settings | app/me/settings/page.tsx | - | user |
| /me/wallet/[id] | app/me/wallet/[id]/page.tsx | - | user |
| /network | app/network/page.tsx | - | public |
| /onboarding/padel | app/onboarding/padel/page.tsx | - | onboarding, padel |
| /onboarding/perfil | app/onboarding/perfil/page.tsx | - | onboarding |
| /org-hub | app/org-hub/page.tsx | - | public |
| /org-hub/create | app/org-hub/create/page.tsx | - | public |
| /org-hub/organizations | app/org-hub/organizations/page.tsx | - | public |
| /org/[orgId] | app/org/[orgId]/page.tsx | - | public |
| /org/[orgId]/[...slug] | app/org/[orgId]/[...slug]/page.tsx | - | public |
| /org/[orgId]/analytics | app/org/[orgId]/analytics/page.tsx | - | public |
| /org/[orgId]/analytics/cohorts | app/org/[orgId]/analytics/cohorts/page.tsx | - | public |
| /org/[orgId]/analytics/conversion | app/org/[orgId]/analytics/conversion/page.tsx | - | public |
| /org/[orgId]/analytics/no-show | app/org/[orgId]/analytics/no-show/page.tsx | - | public |
| /org/[orgId]/analytics/occupancy | app/org/[orgId]/analytics/occupancy/page.tsx | - | public |
| /org/[orgId]/bookings | app/org/[orgId]/bookings/page.tsx | - | public |
| /org/[orgId]/bookings/[id] | app/org/[orgId]/bookings/[id]/page.tsx | - | public |
| /org/[orgId]/bookings/availability | app/org/[orgId]/bookings/availability/page.tsx | - | public |
| /org/[orgId]/bookings/customers | app/org/[orgId]/bookings/customers/page.tsx | - | public |
| /org/[orgId]/bookings/integrations | app/org/[orgId]/bookings/integrations/page.tsx | - | public |
| /org/[orgId]/bookings/new | app/org/[orgId]/bookings/new/page.tsx | - | public |
| /org/[orgId]/bookings/policies | app/org/[orgId]/bookings/policies/page.tsx | - | public |
| /org/[orgId]/bookings/prices | app/org/[orgId]/bookings/prices/page.tsx | - | public |
| /org/[orgId]/bookings/professionals | app/org/[orgId]/bookings/professionals/page.tsx | - | public |
| /org/[orgId]/bookings/professionals/[id] | app/org/[orgId]/bookings/professionals/[id]/page.tsx | - | public |
| /org/[orgId]/bookings/resources | app/org/[orgId]/bookings/resources/page.tsx | - | public |
| /org/[orgId]/bookings/resources/[id] | app/org/[orgId]/bookings/resources/[id]/page.tsx | - | public |
| /org/[orgId]/bookings/services | app/org/[orgId]/bookings/services/page.tsx | - | public |
| /org/[orgId]/chat | app/org/[orgId]/chat/page.tsx | - | public |
| /org/[orgId]/chat/preview | app/org/[orgId]/chat/preview/page.tsx | - | public |
| /org/[orgId]/check-in | app/org/[orgId]/check-in/page.tsx | - | public |
| /org/[orgId]/check-in/devices | app/org/[orgId]/check-in/devices/page.tsx | - | public |
| /org/[orgId]/check-in/list | app/org/[orgId]/check-in/list/page.tsx | - | public |
| /org/[orgId]/check-in/logs | app/org/[orgId]/check-in/logs/page.tsx | - | public |
| /org/[orgId]/check-in/scanner | app/org/[orgId]/check-in/scanner/page.tsx | - | public |
| /org/[orgId]/check-in/sessions | app/org/[orgId]/check-in/sessions/page.tsx | - | public |
| /org/[orgId]/crm | app/org/[orgId]/crm/page.tsx | - | crm |
| /org/[orgId]/crm/campaigns | app/org/[orgId]/crm/campaigns/page.tsx | - | crm |
| /org/[orgId]/crm/customers | app/org/[orgId]/crm/customers/page.tsx | - | crm |
| /org/[orgId]/crm/customers/[customerId] | app/org/[orgId]/crm/customers/[customerId]/page.tsx | - | crm |
| /org/[orgId]/crm/journeys | app/org/[orgId]/crm/journeys/page.tsx | - | crm |
| /org/[orgId]/crm/loyalty | app/org/[orgId]/crm/loyalty/page.tsx | - | crm |
| /org/[orgId]/crm/reports | app/org/[orgId]/crm/reports/page.tsx | - | crm |
| /org/[orgId]/crm/segments | app/org/[orgId]/crm/segments/page.tsx | - | crm |
| /org/[orgId]/crm/segments/[segmentId] | app/org/[orgId]/crm/segments/[segmentId]/page.tsx | - | crm |
| /org/[orgId]/events | app/org/[orgId]/events/page.tsx | - | public |
| /org/[orgId]/events/[id] | app/org/[orgId]/events/[id]/page.tsx | - | public |
| /org/[orgId]/events/[id]/edit | app/org/[orgId]/events/[id]/edit/page.tsx | - | public |
| /org/[orgId]/events/[id]/live | app/org/[orgId]/events/[id]/live/page.tsx | - | public |
| /org/[orgId]/events/new | app/org/[orgId]/events/new/page.tsx | - | public |
| /org/[orgId]/finance | app/org/[orgId]/finance/page.tsx | - | public |
| /org/[orgId]/finance/dimensions | app/org/[orgId]/finance/dimensions/page.tsx | - | public |
| /org/[orgId]/finance/ledger | app/org/[orgId]/finance/ledger/page.tsx | - | public |
| /org/[orgId]/finance/payouts | app/org/[orgId]/finance/payouts/page.tsx | - | public |
| /org/[orgId]/finance/refunds-disputes | app/org/[orgId]/finance/refunds-disputes/page.tsx | - | public |
| /org/[orgId]/finance/subscriptions | app/org/[orgId]/finance/subscriptions/page.tsx | - | public |
| /org/[orgId]/forms | app/org/[orgId]/forms/page.tsx | - | public |
| /org/[orgId]/forms/[id] | app/org/[orgId]/forms/[id]/page.tsx | - | public |
| /org/[orgId]/forms/responses | app/org/[orgId]/forms/responses/page.tsx | - | public |
| /org/[orgId]/forms/settings | app/org/[orgId]/forms/settings/page.tsx | - | public |
| /org/[orgId]/marketing | app/org/[orgId]/marketing/page.tsx | - | public |
| /org/[orgId]/marketing/content | app/org/[orgId]/marketing/content/page.tsx | - | public |
| /org/[orgId]/marketing/promos | app/org/[orgId]/marketing/promos/page.tsx | - | public |
| /org/[orgId]/marketing/promoters | app/org/[orgId]/marketing/promoters/page.tsx | - | public |
| /org/[orgId]/overview | app/org/[orgId]/overview/page.tsx | - | public |
| /org/[orgId]/padel/clubs | app/org/[orgId]/padel/clubs/page.tsx | - | padel |
| /org/[orgId]/padel/clubs/community | app/org/[orgId]/padel/clubs/community/page.tsx | - | padel |
| /org/[orgId]/padel/clubs/courts | app/org/[orgId]/padel/clubs/courts/page.tsx | - | padel |
| /org/[orgId]/padel/clubs/lessons | app/org/[orgId]/padel/clubs/lessons/page.tsx | - | padel |
| /org/[orgId]/padel/clubs/players | app/org/[orgId]/padel/clubs/players/page.tsx | - | padel |
| /org/[orgId]/padel/clubs/trainers | app/org/[orgId]/padel/clubs/trainers/page.tsx | - | padel |
| /org/[orgId]/padel/parcerias | app/org/[orgId]/padel/parcerias/page.tsx | - | padel |
| /org/[orgId]/padel/parcerias/[agreementId] | app/org/[orgId]/padel/parcerias/[agreementId]/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments | app/org/[orgId]/padel/tournaments/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments/calendar | app/org/[orgId]/padel/tournaments/calendar/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments/categories | app/org/[orgId]/padel/tournaments/categories/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments/create | app/org/[orgId]/padel/tournaments/create/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments/players | app/org/[orgId]/padel/tournaments/players/page.tsx | - | padel |
| /org/[orgId]/padel/tournaments/teams | app/org/[orgId]/padel/tournaments/teams/page.tsx | - | padel |
| /org/[orgId]/profile | app/org/[orgId]/profile/page.tsx | - | public |
| /org/[orgId]/profile/followers | app/org/[orgId]/profile/followers/page.tsx | - | public |
| /org/[orgId]/profile/requests | app/org/[orgId]/profile/requests/page.tsx | - | public |
| /org/[orgId]/settings | app/org/[orgId]/settings/page.tsx | - | public |
| /org/[orgId]/settings/verify | app/org/[orgId]/settings/verify/page.tsx | - | public |
| /org/[orgId]/store | app/org/[orgId]/store/page.tsx | - | public |
| /org/[orgId]/team | app/org/[orgId]/team/page.tsx | - | public |
| /org/[orgId]/team/trainers | app/org/[orgId]/team/trainers/page.tsx | - | public |
| /organizacao | app/organizacao/(dashboard)/page.tsx | (dashboard) | organizacao |
| /organizacao/analyze | app/organizacao/(dashboard)/analyze/page.tsx | (dashboard) | organizacao |
| /organizacao/become | app/organizacao/become/page.tsx | - | organizacao |
| /organizacao/categorias | app/organizacao/(dashboard)/categorias/page.tsx | (dashboard) | organizacao |
| /organizacao/categorias/padel | app/organizacao/(dashboard)/categorias/padel/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/chat | app/organizacao/(dashboard)/chat/page.tsx | (dashboard) | organizacao |
| /organizacao/chat/preview | app/organizacao/(dashboard)/chat/preview/page.tsx | (dashboard) | organizacao |
| /organizacao/clube/caixa | app/organizacao/(dashboard)/clube/caixa/page.tsx | (dashboard) | organizacao |
| /organizacao/clube/membros | app/organizacao/(dashboard)/clube/membros/page.tsx | (dashboard) | organizacao |
| /organizacao/crm | app/organizacao/(dashboard)/crm/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/campanhas | app/organizacao/(dashboard)/crm/campanhas/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/clientes | app/organizacao/(dashboard)/crm/clientes/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/clientes/[customerId] | app/organizacao/(dashboard)/crm/clientes/[customerId]/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/journeys | app/organizacao/(dashboard)/crm/journeys/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/loyalty | app/organizacao/(dashboard)/crm/loyalty/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/relatorios | app/organizacao/(dashboard)/crm/relatorios/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/segmentos | app/organizacao/(dashboard)/crm/segmentos/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/crm/segmentos/[segmentId] | app/organizacao/(dashboard)/crm/segmentos/[segmentId]/page.tsx | (dashboard) | organizacao, crm |
| /organizacao/estatisticas | app/organizacao/estatisticas/page.tsx | - | organizacao |
| /organizacao/eventos | app/organizacao/(dashboard)/eventos/page.tsx | (dashboard) | organizacao |
| /organizacao/eventos/[id] | app/organizacao/(dashboard)/eventos/[id]/page.tsx | (dashboard) | organizacao |
| /organizacao/eventos/[id]/edit | app/organizacao/(dashboard)/eventos/[id]/edit/page.tsx | (dashboard) | organizacao |
| /organizacao/eventos/[id]/live | app/organizacao/(dashboard)/eventos/[id]/live/page.tsx | (dashboard) | organizacao |
| /organizacao/eventos/novo | app/organizacao/(dashboard)/eventos/novo/page.tsx | (dashboard) | organizacao |
| /organizacao/faturacao | app/organizacao/faturacao/page.tsx | - | organizacao |
| /organizacao/inscricoes | app/organizacao/(dashboard)/inscricoes/page.tsx | (dashboard) | organizacao |
| /organizacao/inscricoes/[id] | app/organizacao/(dashboard)/inscricoes/[id]/page.tsx | (dashboard) | organizacao |
| /organizacao/loja | app/organizacao/(dashboard)/loja/page.tsx | (dashboard) | organizacao, loja |
| /organizacao/manage | app/organizacao/(dashboard)/manage/page.tsx | (dashboard) | organizacao |
| /organizacao/mensagens | app/organizacao/(dashboard)/mensagens/page.tsx | (dashboard) | organizacao |
| /organizacao/organizations | app/organizacao/(dashboard)/organizations/page.tsx | (dashboard) | organizacao |
| /organizacao/overview | app/organizacao/(dashboard)/overview/page.tsx | (dashboard) | organizacao |
| /organizacao/padel | app/organizacao/(dashboard)/padel/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/padel/clube | app/organizacao/(dashboard)/padel/clube/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/padel/parcerias | app/organizacao/(dashboard)/padel/parcerias/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/padel/parcerias/[agreementId] | app/organizacao/(dashboard)/padel/parcerias/[agreementId]/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/padel/torneios | app/organizacao/(dashboard)/padel/torneios/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/padel/torneios/novo | app/organizacao/(dashboard)/padel/torneios/novo/page.tsx | (dashboard) | organizacao, padel |
| /organizacao/pagamentos | app/organizacao/pagamentos/page.tsx | - | organizacao |
| /organizacao/pagamentos/invoices | app/organizacao/pagamentos/invoices/page.tsx | - | organizacao |
| /organizacao/profile | app/organizacao/(dashboard)/profile/page.tsx | (dashboard) | organizacao |
| /organizacao/promo | app/organizacao/promo/page.tsx | - | organizacao |
| /organizacao/promote | app/organizacao/(dashboard)/promote/page.tsx | (dashboard) | organizacao |
| /organizacao/reservas | app/organizacao/(dashboard)/reservas/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/[id] | app/organizacao/(dashboard)/reservas/[id]/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/clientes | app/organizacao/(dashboard)/reservas/clientes/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/novo | app/organizacao/(dashboard)/reservas/novo/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/politicas | app/organizacao/(dashboard)/reservas/politicas/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/profissionais | app/organizacao/(dashboard)/reservas/profissionais/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/profissionais/[id] | app/organizacao/(dashboard)/reservas/profissionais/[id]/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/recursos | app/organizacao/(dashboard)/reservas/recursos/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/recursos/[id] | app/organizacao/(dashboard)/reservas/recursos/[id]/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/reservas/servicos | app/organizacao/(dashboard)/reservas/servicos/page.tsx | (dashboard) | organizacao, reservas |
| /organizacao/scan | app/organizacao/(dashboard)/scan/page.tsx | (dashboard) | organizacao |
| /organizacao/settings | app/organizacao/(dashboard)/settings/page.tsx | (dashboard) | organizacao |
| /organizacao/settings/verify | app/organizacao/(dashboard)/settings/verify/page.tsx | (dashboard) | organizacao |
| /organizacao/staff | app/organizacao/(dashboard)/staff/page.tsx | (dashboard) | organizacao |
| /organizacao/torneios | app/organizacao/(dashboard)/torneios/page.tsx | (dashboard) | organizacao |
| /organizacao/torneios/[id] | app/organizacao/(dashboard)/torneios/[id]/page.tsx | (dashboard) | organizacao |
| /organizacao/torneios/[id]/edit | app/organizacao/(dashboard)/torneios/[id]/edit/page.tsx | (dashboard) | organizacao |
| /organizacao/torneios/[id]/live | app/organizacao/(dashboard)/torneios/[id]/live/page.tsx | (dashboard) | organizacao |
| /organizacao/torneios/novo | app/organizacao/(dashboard)/torneios/novo/page.tsx | (dashboard) | organizacao |
| /organizacao/tournaments/[id]/finance | app/organizacao/(dashboard)/tournaments/[id]/finance/page.tsx | (dashboard) | organizacao |
| /organizacao/tournaments/[id]/live | app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx | (dashboard) | organizacao |
| /organizacao/treinadores | app/organizacao/(dashboard)/treinadores/page.tsx | (dashboard) | organizacao |
| /organization-terms | app/organization-terms/page.tsx | - | public |
| /padel/duplas | app/padel/duplas/page.tsx | - | padel |
| /padel/rankings | app/padel/rankings/page.tsx | - | padel |
| /page.tsx | app/page.tsx | - | public |
| /perfil | app/perfil/page.tsx | - | user |
| /privacidade | app/privacidade/page.tsx | - | public |
| /privacy | app/privacy/page.tsx | - | public |
| /procurar | app/procurar/page.tsx | - | public |
| /rede | app/rede/page.tsx | - | social |
| /reembolsos | app/reembolsos/page.tsx | - | public |
| /refunds | app/refunds/page.tsx | - | public |
| /resale/[id] | app/resale/[id]/page.tsx | - | public |
| /reset-password | app/reset-password/page.tsx | - | login |
| /servicos | app/servicos/page.tsx | - | public |
| /servicos/[id] | app/servicos/[id]/page.tsx | - | public |
| /signup | app/signup/page.tsx | - | login |
| /social | app/social/page.tsx | - | social |
| /termos | app/termos/page.tsx | - | public |
| /termos-organizacao | app/termos-organizacao/page.tsx | - | public |
| /terms | app/terms/page.tsx | - | public |
| /widgets/padel/bracket | app/widgets/padel/bracket/page.tsx | - | padel |
| /widgets/padel/calendar | app/widgets/padel/calendar/page.tsx | - | padel |
| /widgets/padel/inscricoes | app/widgets/padel/inscricoes/page.tsx | - | padel |
| /widgets/padel/next | app/widgets/padel/next/page.tsx | - | padel |
| /widgets/padel/standings | app/widgets/padel/standings/page.tsx | - | padel |

Flow tags: login, onboarding, organizacao, checkout, padel, loja, crm, reservas, admin, eventos, social, user, public.