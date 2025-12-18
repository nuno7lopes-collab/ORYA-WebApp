# Checkout Legacy Report

Classificação de superfícies associadas ao checkout após migração para o motor único.

## DELETE (seguro)
- `app/api/checkout/session` (diretório vazio, sem rota) — não usado.
- `app/api/checkout/reserve` (diretório vazio, sem rota) — não usado.
- Branch `checkout.session.completed` no webhook Stripe — removido; revenda já tratada em `payment_intent.succeeded`.

## REFATORAR / MIGRAR PARA CORE
- Padel checkout standalone: página foi desativada/redirecionada para o fluxo principal (não é mais checkout ativo fora do modal). Links atualizados em UI para apontar para /eventos/{slug}.
- Resale FE: página `/resale/[id]` usa Payment Element; falta UX de pré-visualização detalhada (preço, vendedor, ticket). Pode ser polido, mas já usa motor único.
- Eventos gratuitos legacy: `/api/eventos/[slug]/comprar` removido; referências no FE varridas (checkout free agora passa pelo modal core).
- TournamentEntry: sem fluxo de criação encontrado; se emissão for ativada, precisa preencher `purchaseId/saleSummaryId/emissionIndex` e usar uniques recém-criados.

Evidência TournamentEntry sem uso: `rg -n "tournamentEntry.create|tournament_entry" app` não retorna criação; apenas leitura/listagem em `/api/me/inscricoes` e dashboards.

## KEEP (core)
- `/api/payments/intent`, `/api/checkout/status`, webhook Stripe (`payment_intent.succeeded`/`charge.refunded`), modelo SaleSummary/SaleLine/PaymentEvent, resolveOwner, computePricing.
- Components do modal de checkout: Step1/Step2/Step3 + contexto.
- Padel pairing validação + delegação ao intent central (`app/api/padel/pairings/[id]/checkout`).
- Revenda: `/api/checkout/resale` (agora chamando intent central) + webhook PI succeeded.
