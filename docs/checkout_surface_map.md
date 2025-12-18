# Checkout Surface Map

Legenda rápida: **CORE** = parte do motor a consolidar; **SUSPEITO** = fluxo paralelo/bypass que deve convergir ou ser revisto; **LEGACY** = restos para remover.

## Frontend
| Path | Papel | Cenários suportados | Classificação |
| --- | --- | --- | --- |
| app/components/checkout/ModalCheckout.tsx | Container do modal, orquestra Step1→Step3 via contextoCheckout e controla abertura/fecho. | EVENT_DEFAULT, PADEL_TOURNAMENT (via props) | CORE |
| app/components/checkout/contextoCheckout.tsx | Provider de estado do checkout (dados, passo, breakdown, idempotency key cache). | Todos os cenários que usam o modal | CORE |
| app/components/checkout/Step1Bilhete.tsx | Step1: seleciona waves/items, define `paymentScenario` (padel FULL/SPLIT), guarda quantidades/variant; hoje bloqueia avançar se total<=0. | SINGLE, GROUP_FULL, GROUP_SPLIT (PADEL_TOURNAMENT), EVENT_DEFAULT | CORE |
| app/components/checkout/Step2Pagamento.tsx | Step2: recolhe guest/auth, valida email/phone/username, aplica promo, cria/reusa idempotencyKey, chama `/api/payments/intent`, renderiza Payment Element (paid) ou avança free. | SINGLE, GROUP_FULL, GROUP_SPLIT, RESALE (UI copy), FREE_CHECKOUT | CORE |
| app/components/checkout/Step3Sucesso.tsx | Step3: polling `/api/checkout/status`, só mostra sucesso com SaleSummary; CTA para REQUIRES_ACTION; revalida `/api/me/tickets`. | Qualquer purchaseId/clientSecret do modal | CORE |
| app/eventos/[slug]/WavesSectionClient.tsx | CTA “Comprar agora”; prepara dados/waves e abre ModalCheckout (free segue Step2/intent). | EVENT_DEFAULT e PADEL_TOURNAMENT (waves) | CORE |
| app/eventos/[slug]/PadelSignupInline.tsx | Inline signup para torneios padel; redireciona para `/eventos/{slug}?pairingId=...` (fluxo modal core). | Padel split/full | CORE |
| app/padel/checkout/page.tsx | (removido) Página standalone eliminada. | — | DELETE |
| app/padel/duplas/page.tsx | Lista pairings e links apontam para `/eventos/{slug}?pairingId=...` (modal core). | Padel split/full | CORE |

## Backend / API
| Path | Papel | Cenários suportados | Classificação |
| --- | --- | --- | --- |
| app/api/payments/intent/route.ts | Cria/reutiliza PaymentIntent ou fluxo FREE; aplica computePricing, promo, owner resolver, idempotencyKey; devolve clientSecret/purchaseId/status. | SINGLE, GROUP_FULL, GROUP_SPLIT, FREE_CHECKOUT (+ metadata genérica) | CORE |
| app/api/checkout/status/route.ts | Polling SSOT: SaleSummary → PAID; caso contrário PaymentEvent → PROCESSING/RA/FAILED; mapeia nextAction/retryable. | Qualquer purchaseId/paymentIntentId | CORE |
| app/api/stripe/webhook/route.ts | Webhook Stripe: `payment_intent.succeeded`/`charge.refunded` (resale via payment_intent). Gera PaymentEvent, SaleSummary/SaleLines/tickets/entries, promo redemptions; dedupe por eventId/PI/purchaseId. | PaymentIntent flows (eventos/padel/resale) | CORE |
| app/api/checkout/resale/route.ts | Cria PaymentIntent para revenda (paymentScenario=RESALE). | RESALE | CORE |
| app/api/padel/pairings/[id]/checkout/route.ts | Cria PaymentIntent para pairing padel (FULL paga 2 unidades, SPLIT paga 1) com metadata própria; valida elegibilidade/locks. | GROUP_FULL/GROUP_SPLIT (padel v2) | CORE |
| app/api/padel/pairings/claim/[token]/route.ts | Preview/claim de convite; valida elegibilidade/deadlines; em SPLIT devolve ação `CHECKOUT_PARTNER`. | GROUP_SPLIT (padel v2) | CORE |
| app/api/padel/pairings/[id]/assume/route.ts | Capitão assume o resto num split: valida e devolve ação `CHECKOUT_CAPTAIN_REST`. | GROUP_SPLIT (padel v2) | CORE |
| app/api/cron/padel/expire/route.ts | Job de produção: expira holds SPLIT, tenta cobrança off-session da parte do capitão e faz fallback/refund; mexe em PaymentIntent e estados de pairing. | GROUP_SPLIT guarantee | CORE |
| (removido) app/api/eventos/[slug]/comprar/route.ts | — | — | DELETE |
| app/api/checkout/reserve (dir vazio) | Diretório sem route atual (herança de fluxo anterior). | n/a | LEGACY |
| app/api/checkout/session (dir vazio) | Diretório sem route atual (herança de fluxo anterior). | n/a | LEGACY |

## Dados / Modelos / Helpers
| Path | Papel | Cenários suportados | Classificação |
| --- | --- | --- | --- |
| lib/checkoutSchemas.ts | SSOT de metadata do checkout (items normalizados, owner XOR userId/identity/email, purchaseId, paymentScenario, event/pairing context). | Todos | CORE |
| lib/paymentScenario.ts | Enum/normalização de `paymentScenario` (SINGLE/GROUP_FULL/GROUP_SPLIT/RESALE/SUBSCRIPTION/FREE_CHECKOUT). | Todos | CORE |
| lib/pricing.ts | computePricing() central (subtotal→fees/total) com FeeMode/fee overrides. | Todos os pagos | CORE |
| lib/ownership/resolveOwner.ts | Resolver de owner (userId/identity/email) usado em intent/webhook/resale; evita owner vazio/ambíguo. | Todos | CORE |
| prisma/schema.prisma (SaleSummary, SaleLine, PaymentEvent, PromoRedemption, Ticket, PadelPairing/Slot/Hold) | Tabelas SSOT de checkout: SaleSummary+SaleLine (PAID), PaymentEvent (telemetria/processamento), redemptions, tickets/entries; Pairing/Slot/Hold controla padel split/full. | Todos | CORE |
