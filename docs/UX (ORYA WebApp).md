# Documento central de qualidade UI/UX (ORYA WebApp) — “pronto para App Store + deploy web”
> Escopo: UX/UI. Para regras de produto/SSOT, ver `docs/v9_ssot_registry.md` e `docs/orya_blueprint_v9_final.md`.

Este texto junta e organiza **tudo o que está nos vários textos** num **único documento central**: critérios de “perfeição”, riscos reais, o que corrigir/melhorar, padrões globais a aplicar, checklist por fluxos/ecrãs e um plano de execução por prioridades (P0→P2) com gates de QA.

---

## 0) Objetivo e resultado esperado

**Objetivo:** elevar a ORYA a um nível de qualidade “plataforma grande” em **mobile (iOS/Android)**, **tablet** e **desktop**, garantindo:

* UX sem fricção e sem becos sem saída (zero dead-ends).
* UI consistente (design system real, sem divergências entre ecrãs).
* Acessibilidade **obrigatória** (A11y) e validada.
* Performance “rápida em condições reais” (3G/4G, devices medianos).
* Cobertura completa e coerente entre **backend ↔ UI** (e eliminação total de legado/duplicações).
* Deploy com **gates objetivos** (Playwright + Lighthouse CI + visual regression), para não “voltar atrás” sem dar por isso.

**Resultado final (o que tem de acontecer):**

* Qualquer fluxo principal (evento → comprar → pagar → sucesso / loja → carrinho → checkout / revenda / dashboard org / admin) tem estados de **loading, erro, vazio e sucesso** bem desenhados e acessíveis.
* Checkout deixa de ser monolítico e pesado; Stripe só carrega quando é preciso.
* Todos os formulários (checkout/login/perfil/org) passam a ter um padrão único (FormField) e acessível.
* Um relatório automático garante “API ↔ UI coverage” e impede endpoints públicos sem UI e UI a chamar legacy/deprecated.
* A app passa em budgets mínimos de performance/acessibilidade definidos e repetíveis.

---

## 1) Definição prática de “UI/UX perfeito” para launch

### 1.1 UX (experiência)

Para considerar “perfeito”:

* **Zero dead-ends:** qualquer ação tem feedback imediato (loading/success/error) e próximo passo claro.
* **Erros human-friendly:** mensagem simples + causa provável + ação (“Tentar novamente”, “Alterar dados”, “Contactar suporte”).
* **Empty states com CTA útil:** não é “nada encontrado”; é “nada encontrado + o que podes fazer agora”.
* **Fluxos longos com progress/stepper:** “onde estou / quanto falta”, com voltar consistente.
* **Confiança e clareza:** preço, taxas, termos e regras (ex.: autenticação obrigatória) sempre visíveis e consistentes — sem surpresas.
* **Persistência inteligente:** fechar/reabrir modal ou trocar método de pagamento não deve apagar dados que não precisem de ser apagados (nome/email/telefone/promo).

### 1.2 UI (interface)

* **Tap targets e espaçamentos mobile** corretos (mín. ~44px).
* **Sem layout shift (CLS)** e sem scroll horizontal.
* **Hierarquia tipográfica consistente** (títulos, subtítulos, corpo, hint, erro).
* **Consistência de componentes** (botões, inputs, cards, menus, toasts, modais) em toda a app.
* **Legibilidade real:** evitar texto demasiado pequeno (ex.: 10px só em casos muito específicos). Preferir **≥12px** para texto informativo.

### 1.3 Acessibilidade (obrigatório)

* Navegação **100% por teclado** (desktop) e correta para leitores de ecrã.
* Inputs com **label real** (placeholder não conta).
* Mensagens de erro ligadas ao campo (aria-describedby) e com anúncio (aria-live/role=alert quando apropriado).
* **Focus visible** sempre, contraste WCAG AA, modais com focus trap, ESC para fechar e retorno do focus ao elemento anterior.
* Nada de **div onClick**: usar `button`/`a` (semântica e teclado).

### 1.4 Performance (obrigatório)

* Páginas core (especialmente checkout) **abrem rápido** em 4G/3G.
* **Code-splitting agressivo** para libs pesadas (Stripe, charts, etc.).
* Imagens otimizadas (Next/Image ou equivalente), lazy-load e prefetch onde faz sentido.
* Client components só quando necessário; resto server-first.

---

## 2) O que mais impede “perfeição absoluta” hoje (riscos reais)

### 2.1 Checkout Step2Pagamento.tsx está monolítico (UX + manutenção + bugs)

O Step2Pagamento concentra demasiadas responsabilidades: auth/guest, validações, promo, Stripe, cenários diferentes, resets, etc. Isto cria risco direto em:

* **Performance (mobile):** re-renders, bundle pesado, lag em inputs/scroll.
* **UX:** estados “fantasma”, transições confusas, feedback irregular.
* **Consistência:** estilos e micro-interações acabam por divergir dentro do mesmo ecrã.
* **A11y:** labels/focus/erros dispersos → falhas típicas.

**Isto é P0.** Enquanto isto existir, a app nunca vai parecer “premium” no pagamento.

### 2.2 Stripe importado estaticamente no topo (bundle pesado desnecessário)

Mesmo com lógica `needsStripe`, **imports estáticos** fazem o bundle carregar dependências no client. Em mobile, isto é um “não” para qualidade App Store (arranque lento e jank no momento mais sensível: pagar).

**Isto é P0.** Stripe tem de ser isolado e carregado só quando necessário.

### 2.3 “Guest vs Auth” e cenários que exigem auth precisam de UX explícita

Há cenários (ex.: FREE_CHECKOUT e GROUP_SPLIT) que forçam autenticação. Isso é correto do lado de regra/segurança, mas se a UI “muda o modo” sem explicar, o utilizador sente “bug”.

**Perfeição exige:**

* banner/card claro “Este checkout exige sessão iniciada” + CTA (Entrar / Criar conta).
* skeleton enquanto authChecking (evitar mostrar UI errada por 1 frame).
* ao transitar de guest→auth, **não perder** dados preenchidos (onde faz sentido).

### 2.4 Formulários e validações ainda precisam de padrão “App Store”

Validações existem, mas falta polimento que muda a perceção de qualidade:

* `type`, `inputMode`, `autoComplete` corretos (email/tel/nome).
* `autoCapitalize="none"` em email e códigos (promo).
* erros inline + ligação ao campo + scroll/focus para primeiro erro no submit.
* estados de “a validar / a aplicar / aplicado / rejeitado” (promo, username check, etc.).

### 2.5 Estados (loading/erro/vazio) — onde a app “parece amadora” mesmo com backend forte

Sem skeletons decentes, erros humanos e empty states com CTA, a perceção cai. Isto tem de ficar fechado em todas as áreas críticas.

### 2.6 API ↔ UI coverage e eliminação de legacy (regra de ouro)

Tu pediste explicitamente: **não pode existir UI legacy** nem backend user-facing sem UI.

Regra prática:

* `app/api/internal/**` e `app/api/cron/**`: **sem UI**, invisíveis ao user, protegidos por secret.
* Tudo o que é user-facing: **tem de ter UI** (botões, páginas, estados) e não pode haver chamadas a endpoints deprecated/legacy.

Para fechar isto a 100%, tem de existir um **relatório automático** (audit) que detete:

* endpoints públicos sem UI;
* UI a chamar endpoints legacy/deprecated;
* strings hard-coded de `/api/...` espalhadas a causar drift.

Gate recomendado: `npm run gate:api-ui-coverage` (falha se houver órfãos).

---

## 3) Padrões globais obrigatórios (para consistência e “qualidade premium”)

### 3.1 “FormField” padrão (unificar TODOS os forms críticos)

Criar um componente/standard único:

**FormField =** Label + Input/Select + Hint + Error + `aria-*` + estados (disabled/loading)
Aplicar em:

* checkout (guest/auth, promo, dados)
* login/signup/recovery
* perfil / settings
* criação/edição de evento
* promo codes
* qualquer form do dashboard/admin

**Regras do FormField:**

* label visível e associado (`htmlFor`).
* erro inline, com `aria-describedby` e `role="alert"` quando relevante.
* input com `type/inputMode/autoComplete` corretos.
* ao submeter: foco no primeiro erro e scroll até ele.

### 3.2 Sistema único de estados: Loading / Empty / Error / Success

Cada página/fluxo crítico deve ter:

* **Loading:** skeleton real (não só spinner ao centro).
* **Empty:** mensagem + CTA útil (Explorar / Criar / Voltar).
* **Error:** mensagem humana + recovery (Tentar novamente / Contactar suporte).
* **Success:** confirmação clara + próximos passos.

Em Next.js App Router: adicionar `loading.tsx` e `error.tsx` nos segmentos principais (explorar, evento, checkout, loja, organização/dashboard).
No `error.tsx`, idealmente mostrar **“Código de suporte”** (requestId/correlationId) quando existir.

### 3.3 Toasts/alerts acessíveis e coerentes

* Informações: `aria-live="polite"`.
* Erros críticos: `aria-live="assertive"` + `role="alert"`.
* Nunca depender só de cor; usar texto claro.

### 3.4 Botões, menus e semântica (evitar bugs e falhas A11y)

* Nada de `div` clicável.
* `button` com `type="button"` por defeito (evitar submits acidentais).
* Ícones sozinhos precisam de `aria-label`/`title`.
* Menus e listas com semântica adequada (ul/li ou roles coerentes).

---

## 4) Checkout “perfeito” (o coração da qualidade)

### 4.1 Refactor estrutural (de monstro → orquestrador + subcomponentes)

Transformar Step2Pagamento num **orquestrador pequeno**, e extrair subcomponentes:

* **PurchaseModeSelector** (guest/auth; escondido quando irrelevante)
* **AuthGateBanner/AuthRequiredCard** (quando requiresAuth)
* **GuestDetailsForm** (nome/email/tel + validação padrão)
* **OrderSummaryPanel** (itens, fees, total; sempre visível)
* **PromoCodeInput** (aplicar/remover; estados claros)
* **PaymentMethodSelector** (com microcopy sobre recalcular)
* **StripePaymentSection** (isolado e lazy)
* **FreeCheckoutConfirm** (quando não precisa Stripe)

Isto não é só “limpar código”: é para garantir micro-estados consistentes, performance e UX.

### 4.2 Stripe: code-splitting obrigatório (carregar só quando precisa)

**Regra:** o único ficheiro que importa Stripe libs é `StripePaymentSection.tsx`.

* Step2Pagamento decide:

  * se é grátis → renderiza FreeCheckoutConfirm
  * se precisa de Stripe → renderiza `DynamicStripePaymentSection` (`dynamic import`, `ssr:false`)

**Resultado esperado:**

* checkout abre mais rápido,
* menos JS,
* menos lag/crashes em mobile.

### 4.3 Troca de método de pagamento sem “perder tudo”

Se hoje há reset agressivo, manter o que é do utilizador:

* **manter:** nome/email/telefone, promo input/código (quando aplicável)
* **resetar:** apenas o que é do payment intent e breakdown que precisa de recalcular

E a UI deve dizer explicitamente:

> “Ao mudares o método de pagamento, vamos recalcular o total.”

### 4.4 Mobile “App Store”: sticky CTA + teclado + safe areas

No Step2:

* CTA “Pagar/Confirmar” **sticky bottom** (sempre acessível).
* Safe areas (notch): padding consistente topo/fundo.
* Garantir que inputs não ficam escondidos pelo teclado.
* `inputMode="tel"` e `type="tel"` para teclado numérico.
* Evitar situações que causam “double tap zoom” em iOS (inputs mal configurados).

### 4.5 Stepper e sensação de controlo

* Stepper visível (1/2/3) e voltar consistente.
* Fechar modal e reabrir: não perder tudo (a não ser por segurança real).
* Pós-sucesso (Step3): mensagem clara + CTA (“Ver bilhetes”, “Voltar ao evento”, “Ver encomenda”).

---

## 5) Navegação e estrutura (para não “perder” o utilizador)

### 5.1 Navbar pública

* Deve funcionar impecável em mobile: se houver muitas opções, usar menu colapsável.
* Ícones em mobile precisam de labels (A11y).
* Evitar poluição visual; priorizar: explorar, loja, conta/perfil.

### 5.2 Dashboard de organização

* Topbar clara com organização ativa e indicador de dropdown visível mesmo em mobile.
* Subnavegação por módulos (eventos, reservas, loja, financeiro, etc.) sempre acessível:

  * desktop/tablet: sidebar ou tabs claras
  * mobile: drawer ou tabs compactas (sem perder discoverability)
* Se a topbar se oculta em scroll, garantir que não desorienta (sensibilidade e comportamento previsível).

### 5.3 Breadcrumbs/retorno

* “Voltar a explorar” em eventos é bom — replicar onde faz sentido:

  * loja → produto → carrinho (voltar)
  * dashboard → detalhe → voltar ao módulo
  * revenda → voltar ao evento / explorar

---

## 6) Checklist por ecrãs/fluxos (o que tem de existir em cada um)

### 6.1 Eventos (EventPage / InviteGate / Waves / Live)

**Obrigatório:**

* Loading: skeleton das secções (hero, waves, detalhes).
* Empty states: sem waves / sold out / evento terminado → CTA “Explorar eventos”, “Seguir organizador”, “Ver próximos”.
* Navegação:

  * mobile: anchors/tabs (Descrição / Bilhetes / Local / FAQ)
  * desktop/tablet: layout 2 colunas (info + compra/waves)
* Performance: imagens otimizadas, lazy-load de secções longas.
* A11y: botões/links com labels e focus correto.

### 6.2 Checkout (Modal + Steps 1/2/3)

**Obrigatório:**

* Stepper + voltar.
* Persistência de estado quando faz sentido.
* Loading/erro/vazio/sucesso desenhados.
* Erro com recovery e, idealmente, código de suporte (requestId).
* Proteções anti-duplo submit: desativar botão + “Processando…”.

### 6.3 Loja (storefront, produto, carrinho, checkout)

**Obrigatório:**

* Mobile:

  * carrinho com CTA sticky “Checkout”
  * quantidades com botões acessíveis (`aria-label="Aumentar quantidade"`)
* Desktop/tablet:

  * carrinho e resumo lado a lado
* Stocks/variantes:

  * estados claros (esgotado/poucas unidades)
* Checkout consistente com resto (FormField + estados + Stripe gating se aplicável)

### 6.4 Revenda (/resale/[id])

**Obrigatório:**

* Confiança: explicar claramente o que está a ser comprado, evento, política.
* Estados: ticket já vendido / inválido / expirado.
* CTA forte + alternativa (“Explorar evento”, “Ver outras opções”).

### 6.5 Organização / Dashboard (Dashboard, Edit Event, Promo Codes, Financeiro)

**Obrigatório:**

* Desktop/tablet: estrutura de navegação eficiente (sidebar/top tabs).
* Mobile: alternativa real (cards, accordions ou tabelas adaptadas).
* Ações destrutivas: confirmação forte e microcopy clara.
* Performance: paginação/filtros, evitar “listar tudo sempre”.
* Onboarding interno (se existir tour): garantir que funciona em mobile e não quebra layout.

### 6.6 Admin Console

**Obrigatório:**

* Segurança: acesso bloqueado a não-admin (redirecionamento/403 com UI).
* Listagens grandes: busca/filtros.
* Ações críticas: confirmação e logging.
* UI limpa e legível para “power users”.

### 6.7 Onboarding e autenticação (login/signup/recovery + gates)

**Obrigatório:**

* Auth modal com:

  * erros junto ao campo
  * loading no botão (evitar cliques duplos)
  * recovery claro
* Pós-login:

  * roteamento guiado (criar org / aceitar convite / entrar no dashboard)
* Gate de verificação (ex.: email oficial):

  * explicar porquê
  * CTA de “reenviar verificação”
  * feedback imediato quando fica ok

---

## 7) Performance que vira UX (sem isto, não parece premium)

### 7.1 Bundle e client components

* Server-first sempre que possível.
* Client components apenas onde necessário (Stripe, interações específicas).
* Monitorizar bundle: impedir libs pesadas de entrar globalmente por engano.

### 7.2 “Hard-coded fetch strings” → drift garantido

Centralizar chamadas:

* `apiFetch()` único:

  * normaliza envelope
  * injeta headers (requestId/correlationId)
  * traduz erros para mensagens humanas
* `routes.ts` com constantes tipadas: `API.USERNAME_CHECK`, etc.

Isto reduz bugs, facilita refactor e impede chamadas a endpoints legacy “por acidente”.

### 7.3 Imagens e render

* Otimização de imagens (Next/Image), lazy-load e placeholders.
* Evitar CLS: reservar espaço (skeleton) para secções que aparecem depois.

---

## 8) Acessibilidade (A11y) — checklist obrigatório final

Validar em todas as páginas/fluxos:

* Sem `div onClick`.
* `button type="button"` por defeito.
* Inputs com `label` (ou `aria-label` quando não há label visível).
* Erros com `aria-describedby` + `role="alert"` quando necessário.
* Modais:

  * focus trap
  * ESC fecha
  * ao fechar, focus volta ao trigger
* Toasts/alerts com `aria-live` adequado.
* Contraste AA (especial atenção a texto “disabled” e CTAs).
* Focus visible sempre.
* Tap targets ≥ 44px em mobile.
* Adicionar `eslint-plugin-jsx-a11y` e corrigir warnings P0 antes do release.

---

## 9) API ↔ UI coverage e eliminação total de legacy

**Meta:** nenhum endpoint público sem UI e nenhuma UI a chamar endpoints deprecated/legacy.

### 9.1 Auditoria automática (release gate)

Gerar relatório (script Node/TS) que:

* lista `app/api/**` (exclui internal/cron)
* procura no frontend por `fetch("/api/...")` e derivados
* marca:

  * **API sem UI** (órfãos)
  * **UI a chamar endpoint legacy/deprecated**
* endpoints públicos sem uso (avaliar remoção ou UI em falta)

Status: Feito — script em `scripts/audit_api_ui_coverage.ts` + gate `npm run gate:api-ui-coverage`.

### 9.2 Regras de manutenção

* Sempre que entra endpoint novo user-facing → entra UI correspondente + estados.
* Sempre que endpoint é deprecated → remover chamadas e UI associada (ou redirecionar com aviso).

---

## 10) Plano de execução (P0 → P2) para fechar “perfeito”

### P0 — Bloqueadores de qualidade/performance (tem de ir já)

1. **Refactor do checkout Step2Pagamento** em subcomponentes e hooks (orquestrador leve).  
   Status: Feito — `Step2Header`, `Step2AccessGate`, `Step2PaymentPanel`.
2. **Code-splitting do Stripe**: remover imports estáticos do Step2; criar `StripePaymentSection.tsx` com dynamic import só quando `needsStripe`.  
   Status: Feito — `dynamic(() => import("./StripePaymentSection"))`.
3. **UX explícita para requiresAuth** (FREE_CHECKOUT / GROUP_SPLIT): banner/card + CTA + skeleton em authChecking + preservar dados ao transitar.  
   Status: Feito — `Step2AccessGate` + `AuthGateBanner`.
4. **Preservar dados do utilizador** ao mudar método de pagamento (reset só do que é payment-intent related).  
   Status: Feito — reset isolado na troca de método.

### P1 — Qualidade “App Store” (consistência e perceção premium)

1. **FormField standard** aplicado a todos os forms críticos.  
   Status: Feito — `app/components/forms/FormField.tsx` + re-export no checkout.
2. **loading.tsx + error.tsx + skeletons reais** nos segmentos principais (explorar, evento, checkout, loja, org dashboard).
3. **aria-live global** em toasts/alerts + foco no primeiro erro ao submeter forms.
4. **Centralizar chamadas API** (`apiFetch` + `routes.ts`) e remover strings hard-coded.

### P2 — Hardening final / polish (para não regressar e ganhar confiança)

1. **Lint A11y** (jsx-a11y) e correção de warnings P0.
2. **Relatório automático API↔UI** em CI e correção de órfãos/legacy.
3. **Lighthouse CI** com budgets (mobile + desktop):

   * Performance ≥ 85
   * Accessibility ≥ 95
   * Best Practices ≥ 95
     (e correções CLS/LCP/JS bundle)
4. **Playwright E2E** + visual regression (screenshots) para fluxos principais.

---

## 11) Gates de QA (para garantir “perfeito” de forma objetiva)

### 11.1 Playwright (mínimo) — cenários obrigatórios

* evento → escolher bilhetes → checkout guest → pagar → sucesso
* evento → checkout auth → pagar → sucesso
* cenários **GROUP_SPLIT** e **FREE_CHECKOUT** (auth gate + sucesso)
* revenda: válido / já vendido / inválido
* loja: produto → carrinho → checkout → sucesso
* organização: criar/editar evento + publicar; promo codes básico
* (se aplicável) admin: acesso negado para não-admin + ações principais com confirmação

### 11.2 Lighthouse CI

* thresholds e budgets fixos (não “a olho”).
* mobile emulação realista (rede/CPU) para apanhar problemas de bundle e CLS.

### 11.3 QA manual mínimo (device matrix)

Testar pelo menos:

* iPhone SE (pequeno), iPhone com notch, Android pequeno/médio, iPad, desktop 1440p.
* Foco: teclado, safe areas, sticky CTA, scroll, modais, erros/empty/loading.

---

## 12) Definição de “Done” (quando podemos dizer “está perfeito”)

Só podemos considerar “fechado” quando:

* Checkout está componentizado, rápido e com Stripe lazy.
* Todos os formulários críticos usam FormField padrão e passam A11y básico.
* Todas as páginas críticas têm loading/empty/error/success bem desenhados.
* Não há UI legacy nem endpoints públicos sem UI (audit passa).
* Playwright e Lighthouse CI passam consistentemente.
* Não há scroll horizontal, não há CLS visível, e tap targets estão corretos.

---

## Nota final (o “centro” de tudo)

Se tiveres de resumir este documento numa frase operacional para a equipa:

**“Para ficar perfeito: reduzir complexidade e peso do checkout (Stripe lazy + componentização), padronizar formulários e estados (loading/erro/vazio), fechar acessibilidade, e criar gates automáticos (API↔UI audit + Playwright + Lighthouse) para nunca mais regredir.”**
