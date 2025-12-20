# Fees: estado atual e plano de correção

Contexto resumido: a taxa que o cliente vê hoje (`platformFeeCents`) é só a parte ORYA; a fee de processamento da Stripe é guardada à parte e abatida ao recebimento do organizador. Resultado: mesmo em modo “cliente paga taxa”, o organizador suporta a fee Stripe. O pedido é que a “taxa da plataforma” mostrada a clientes/organizadores seja a soma (ORYA + Stripe), mantendo a discriminação apenas para admins.

## Como está hoje
- Cálculo (backend): `lib/pricing.computePricing` usa apenas `platformFeeBps/fixed` (ORYA). `totalCents = subtotal [+ platformFee]` conforme `FeeMode`. Stripe não entra aqui.
- Intent de pagamento: `app/api/payments/intent/route.ts` grava `platformFeeCents` (ORYA) no metadata e, em eventos Connect, aplica `application_fee_amount = platformFeeCents`. Montante cobrado ao cliente = subtotal (+ OU não) + **só ORYA**. A fee Stripe é deduzida depois pela Stripe ao destino.
- Webhook/ledger: `app/api/stripe/webhook/route.ts` persiste em `sale_summaries`: `platformFeeCents` (ORYA), `stripeFeeCents` (real/estimada), `netCents = total - platformFeeCents - stripeFee`. Finance overview e admin usam estes campos.
- Frontend:
  - Criar evento (`app/organizador/(dashboard)/eventos/novo/page.tsx`): pré-visualização calcula `feeCents` (ORYA) e `stripeFeeCents` estimada em separado; o total do cliente usa só ORYA.
  - Checkout (`app/components/checkout/Step2Pagamento.tsx`): mostra “Taxas de serviço” = `platformFeeCents` (ORYA). O cliente não vê a parte Stripe.
  - Admin (`app/admin/payments/page.tsx` + API overview) já vê `platformFeeCents` e `stripeFeeCents` separados.
- Base de dados: `sale_summaries.platform_fee_cents` (ORYA) + `stripe_fee_cents`; `FeeMode` em eventos/organizers controla se a fee (só ORYA) é “ADDED/ON_TOP” ou “INCLUDED”.

## Problemas
- “Cliente paga taxa” só cobre a fee ORYA; a Stripe é suportada pelo organizador → discrepância com o copy.
- Montantes mostrados no FE (cliente/organizador) não refletem a taxa Stripe, mas o recebimento já sai deduzido → confusão.
- `platformFeeCents` significa “ORYA fee” no backend, mas “taxa da plataforma” no FE. Sem campo para “taxa combinada”.
- No Connect, `application_fee_amount` = ORYA; o organizer paga Stripe na mesma (talvez duas vezes, se fizerem overrides) e o cliente não cobre.

## Plano proposto
1) **Definir SSOT de fees**  
   - Criar helper `computeFees` (ex.: `lib/fees.ts`) que devolve `{oryaFeeCents, stripeFeeCentsEstimate, combinedFeeCents, feeMode}` para um subtotal. Stripe base vem de `getStripeBaseFees`.
   - Tornar explícito: `platformFeeOrya` = nossa margem; `platformFeeCombined` = ORYA + Stripe (mostrada a cliente/org).  

2) **Cálculo/metadata**  
   - Ajustar `computePricing` ou novo wrapper para calcular `totalCents` com `combinedFeeCents` quando `FeeMode.ADDED/ON_TOP`. Guardar no retorno ambos os valores.  
   - Enviar no metadata do intent: `platformFeeCombinedCents`, `platformFeeOryaCents`, `stripeFeeEstimateCents`, `feeMode`.  
   - Nos Connect charges, `application_fee_amount` deve usar apenas `platformFeeOryaCents` para não duplicar a Stripe fee; o montante cobrado ao cliente passa a incluir a parte Stripe (quando “cliente paga taxa”).  

3) **Persistência/relatórios**  
   - Adicionar colunas (migração Prisma): `platform_fee_orya_cents`, `platform_fee_combined_cents` em `sale_summaries`/`payment_events` (preservar `stripe_fee_cents`).  
   - `netCents` passa a ser `total - platformFeeOrya - stripeFee`.  
   - Backfill: `platform_fee_combined = platform_fee_cents + stripe_fee_cents`; `platform_fee_orya = platform_fee_cents` (legado).  
   - Atualizar APIs: organizer finance overview, admin payments overview, invoices, payouts a usarem os novos campos.  

4) **Frontend (cliente/organizador)**  
   - Criar adaptador de preview que consome `computeFees` para que “Total cliente” inclua a taxa combinada quando em modo “cliente paga taxa”.  
   - Mostrar apenas “Taxa da plataforma” (combinada) para cliente/organizador; ocultar breakdown. Copy: “inclui taxa de processamento”.  
   - Para admins, manter e reforçar breakdown ORYA vs Stripe nas páginas admin.  

5) **Fluxo de checkout**  
   - `Step2Pagamento` e emails de confirmação devem apresentar a taxa combinada e, quando o organizer escolhe “incluído”, não mostrar linha de taxa.  
   - `Step3Sucesso` / “compras” devem usar o mesmo breakdown para consistência.  

6) **QA e salvaguardas**  
   - Casos a testar: ON_TOP vs INCLUDED, Connect vs Platform payouts, eventos free (fees = 0), overrides de fee em evento/organizer, promo codes, padel GROUP_FULL/SPLIT.  
   - Validar totals: `total_cents` cobrado ao cliente deve ser igual ao mostrado no checkout; `netCents` deve ser ~ preço base quando “cliente paga taxa”.  

7) **Rollout**  
   - Feature flag para usar “taxa combinada” no FE/BE.  
   - Backfill + rebuild dos dashboards que dependem de `platformFeeCents`.  

## Quick wins imediatos (sem migrations)
- Ajustar copy atual do FE para avisar que a taxa Stripe é deduzida ao recebimento do organizer (mitiga confusão enquanto não se aplica o plano completo).
