# ORYA Loja 100% Plan (Fases 0-4, loja fechada)

Documento de controlo para fechar a Loja a 100% com loja fechada e sem catálogo ativo. Este plano é o guia único a seguir por ordem.

## Plano simplificado (MVP) - definitivo para seguir agora

### Objetivo
- Reduzir ao essencial para criar e gerir produtos sem friccao.
- Manter capacidade de crescer (sem apagar dados), mas esconder complexidade.
- Separar claramente Loja de Eventos/Reservas/Padel.

### Navegacao (IA)
- Topbar apenas com: **Visao geral**, **Produtos**, **Encomendas**, **Envios**, **Marketing**, **Definicoes**.
- Sem submenus complexos dentro de Catalogo/Envios.
- Cada area mostra 1 pagina limpa, sem scroll gigante.

### Produtos (fluxo unico, simples)
**Criar/editar num unico fluxo (modal ou pagina)**
- **Essenciais**: nome, tipo (fisico/digital), preco, imagem principal (upload), categoria (selecionar ou criar).
- **Estado**: ativo/inativo.
- **Opcional**: descricao curta/longa, galeria (2-6 imagens), stock (toggle + quantidade), SKU.
- **Tamanhos (variantes)**: lista simples (ex: S, M, L). Se existir, criar variantes com o mesmo preco base (editavel).
- **Personalizacao**: toggle + 1 campo de texto (label + limite). Sem "valores".
- **Digital**: upload de ficheiro ou "entrega manual" (envio por email pelo admin).

**Categorias**
- Sem pagina dedicada obrigatoria.
- Criacao inline dentro do produto (se nao existir nenhuma, criar logo ao adicionar).
- Lista simples acessivel dentro de Produtos (mini-modal "Gerir categorias").

**Imagens**
- Apenas dentro do produto.
- Remover area dedicada "Imagens".

### Envios (simplificado)
- **Portes base (flat)** + **portes gratis acima de X**.
- Sem zonas, metodos ou tabelas.
- Aplicar apenas a produtos fisicos.
- Campo extra opcional: nota de envio (ex: "Envio em 2-4 dias").

### Marketing
- **Packs** (bundles) + **descontos simples** (percentual ou valor fixo).
- Numa unica area (sem submenus).

### Encomendas
- Lista + detalhe + estados basicos.
- Filtros simples (data, estado, pesquisa por email/nome).
- Entrega digital: mostrar botao "Enviar ficheiro" quando em modo manual.

### Visao geral
- KPIs curtos + ultimas encomendas.
- CTA para Financas ("Abrir Financas").

### Financas / origem de receitas
- Marcar cada venda com origem: **STORE / EVENTOS / RESERVAS**.
- Atualizar dashboards para filtrar por origem.

### Infra / Storage (erro atual)
- O erro "Bucket not found" indica bucket inexistente no Supabase.
- Criar bucket `uploads` (ou definir `SUPABASE_UPLOADS_BUCKET` para um bucket existente).
- Garantir pasta `store-products/` para imagens.

### Alteracoes de dados (minimas)
- Manter tabelas existentes, mas **esconder UI** de:
  - Imagens, Valores, Ficheiros digitais, Zonas, Metodos, Tabelas.
- Usar `StoreProductVariant` apenas para tamanhos.
- Usar `StoreProductOption` apenas como **personalizacao simples** (1 campo texto).
- Adicionar `store.shippingFlatRateCents` (se nao existir) para portes base.

### Fases de implementacao (por ordem)
1) **IA + Navegacao**: reduzir menus, ajustar rotas e titulos.
2) **Produtos**: novo formulario unico com imagem, categoria inline, tamanhos e personalizacao.
3) **Envios simples**: um painel com flat rate + free shipping.
4) **Encomendas**: lista + detalhe + entrega digital manual.
5) **Marketing**: packs + descontos simples.
6) **Financas**: marcar origem das vendas e filtros.
7) **Limpeza**: remover/ocultar paginas antigas e validacoes redundantes.

---

## Definição do que é 100%

Incluído:
- Loja multi-tenant: organização e perfil individual.
- Produtos físicos e digitais (sem serviços, sem produtos adultos).
- Catálogo completo (categorias, variantes, imagens, personalização).
- Carrinho e checkout com Stripe (reaproveitar core atual).
- Portes simples e robustos, alinhados com práticas das maiores plataformas.
- Packs (bundles), descontos e promoções (marketing).
- Recomendações "Completa o teu pedido".
- Proteção de dados sensíveis, auditoria, retenção e permissões.
- Backoffice completo (gestão, estados, operações, exportações).
- Monitorização, eventos e testes críticos.

Excluído:
- Serviços (reservas já cobrem).
- Produtos com restrição de idade.
- Cálculo avançado de impostos por país (fase posterior, fora do scope).

## Princípios e restrições

- Loja fechada por defeito: `Store.status = CLOSED` e `Store.catalogLocked = true`.
- Sem inserção de produtos até decisão explícita (unlock manual por Owner/Admin).
- Só produtos físicos e digitais.
- Sem categorias "adulto" e sem gate de idade.
- Dados sensíveis cifrados e com acesso mínimo.
- Checkout e pricing sempre no servidor.

## Estado atual (o que já existe no projeto)

- Checkout e pagamentos (Stripe) para eventos/reservas.
- Promos e regras de desconto simples (`PromoCode`).
- Estrutura de módulos de organização e permissões.
- Histórico de compras em `/me/compras`.

## Estado final (100% fechado)

- Loja estável com catálogo, checkout, portes e operações completas.
- Loja pode estar fechada/aberta por organização ou perfil.
- Todos os fluxos críticos testados e monitorizados.

---

# Modelo de dados (v1 completo)

## 1) Loja e configuração

**Store**
- id
- ownerType: ORG | PROFILE
- ownerOrganizationId | ownerUserId (um dos dois)
- status: DRAFT | CLOSED | OPEN
- showOnProfile: boolean
- catalogLocked: boolean
- checkoutEnabled: boolean
- currency (default EUR)
- supportEmail, supportPhone
- returnPolicy, privacyPolicy, termsUrl
- freeShippingThresholdCents
- shippingMode: FLAT | VALUE_TIERS
- createdAt, updatedAt

**StoreSettings (opcional, para expandir)**
- defaultLanguage, timezone
- orderNumberPrefix
- notificationsEmail

## 2) Catálogo

**StoreCategory**
- id, storeId
- name, slug, description
- sortOrder, isActive
- coverImageUrl

**StoreProduct**
- id, storeId, categoryId
- name, slug
- shortDescription, description
- status: DRAFT | ACTIVE | ARCHIVED
- isVisible (toggle rápido)
- priceCents, compareAtPriceCents
- currency
- sku (opcional)
- stockPolicy: NONE | TRACKED
- stockQty (se sem variantes)
- requiresShipping: boolean
- weightGrams, dimensions (L/W/H) opcionais
- tags (array)
- createdAt, updatedAt

**StoreProductVariant** (tamanhos/opções)
- id, productId
- label (ex: S, M, L)
- sku, priceCents
- stockQty
- isActive, sortOrder

**StoreProductImage**
- id, productId
- url, altText, sortOrder
- isPrimary

**StoreProductOption** (personalização)
- id, productId
- type: TEXT | SELECT | NUMBER | CHECKBOX
- label, required
- maxLength, min, max
- priceDeltaCents
- sortOrder

**StoreProductOptionValue**
- id, optionId
- value, label, priceDeltaCents
- sortOrder

## 3) Digital

**StoreDigitalAsset**
- id, productId
- storagePath
- filename, sizeBytes, mimeType
- maxDownloads
- isActive

**StoreDigitalGrant**
- id, orderLineId, userId
- downloadToken, expiresAt
- downloadsCount

## 4) Packs / Bundles

**StoreBundle**
- id, storeId
- name, slug, description
- pricingMode: FIXED | PERCENT_DISCOUNT
- priceCents | percentOff
- status, isVisible

**StoreBundleItem**
- id, bundleId
- productId, variantId (opcional)
- quantity

## 5) Carrinho e encomendas

**StoreCart**
- id, storeId
- userId (opcional) ou sessionId
- status: ACTIVE | CHECKOUT_LOCKED | ABANDONED
- currency
- createdAt, updatedAt

**StoreCartItem**
- id, cartId
- productId, variantId (opcional)
- quantity
- unitPriceCents (snapshot)
- personalization (json)

**StoreOrder**
- id, storeId, userId
- orderNumber
- status: PENDING | PAID | FULFILLED | CANCELLED | REFUNDED | PARTIAL_REFUND
- paymentIntentId, purchaseId
- subtotalCents, discountCents, shippingCents, totalCents
- currency
- customerEmail, customerName, customerPhone
- notes
- createdAt, updatedAt

**StoreOrderLine**
- id, orderId
- productId, variantId (opcional)
- nameSnapshot, skuSnapshot
- quantity
- unitPriceCents, discountCents
- totalCents
- requiresShipping
- personalization (json)

**StoreOrderAddress**
- id, orderId
- type: SHIPPING | BILLING
- fullName, line1, line2, city, region, postalCode, country
- nif (opcional, cifrado)

**StoreShipment**
- id, orderId
- carrier, trackingNumber, trackingUrl
- status: PENDING | SHIPPED | DELIVERED
- shippedAt, deliveredAt

## 6) Portes

**StoreShippingZone**
- id, storeId
- name, countries (array)
- isActive

**StoreShippingMethod**
- id, zoneId
- name, description
- baseRateCents
- mode: FLAT | VALUE_TIERS
- freeOverCents (opcional)
- isDefault
- etaMinDays, etaMaxDays

**StoreShippingTier** (se VALUE_TIERS)
- id, methodId
- minSubtotalCents, maxSubtotalCents
- rateCents

## 7) Promoções

Reutilizar `PromoCode` com novo `scopeType`:
- STORE (loja inteira)
- PRODUCT (produto específico)
- SHIPPING (portes)

Campos adicionais:
- minCartSubtotalCents (novo)
- applicableProductIds (array opcional)

## 8) Inventário

**StoreInventoryMovement**
- id, productId, variantId
- type: ADJUST | SALE | REFUND | RETURN
- quantity, reason
- createdAt

---

# Portes (modelo simples e robusto)

## Objetivo
Simplificar ao máximo e alinhar com práticas das maiores plataformas.

## Modelo escolhido (v1)
- **Zonas + Métodos**: Standard, Expresso, Levantamento em loja.
- **Preço por método**: taxa fixa ou escalões por valor (VALUE_TIERS).
- **Portes grátis**: limiar global por loja (aplica ao método Standard).
- **Carrinho misto**: portes calculados apenas com subtotal de itens físicos.

## Algoritmo (resumo)
1. Calcular `subtotalFisico` (somatório de itens físicos).
2. Se `subtotalFisico = 0` -> não mostrar métodos de envio.
3. Selecionar zona com base no país de envio.
4. Para cada método:
   - Se `freeOverCents` e `subtotalFisico >= freeOverCents` -> rate = 0.
   - Se `mode = FLAT` -> rate = baseRate.
   - Se `mode = VALUE_TIERS` -> aplicar tier compatível.
5. Escolha do utilizador entre métodos válidos.
6. Mostrar progress bar: `falta = freeOverCents - subtotalFisico`.

---

# Fluxos end-to-end

## 1) Activação da loja
- Organização/perfil cria Store (DRAFT).
- Owner confirma email oficial + Stripe (gate atual).
- Store passa para CLOSED (loja fechada, sem checkout).
- Só Owner/Admin pode desbloquear `catalogLocked`.
- `showOnProfile` ativo só quando `status = OPEN`.

## 2) Gestão de catálogo (backoffice)
- Criar categorias -> criar produtos -> adicionar imagens -> variantes -> personalização.
- Campos obrigatórios: nome, descrição curta, preço, imagem principal, categoria.
- Produtos digitais: anexar ficheiro e regras de download.
- Produtos físicos: ativar `requiresShipping`.
- Packs criados no módulo "Marketing".

## 3) Loja pública
- Página de loja no perfil (`/[username]/loja`).
- Listagem por categoria, pesquisa e filtros (preço, stock, tags).
- Página de produto com imagens, variantes, personalização.
- Botão "Adicionar ao carrinho".

## 4) Carrinho
- Carrinho persistente por sessão/conta.
- Recomendações "Completa o teu pedido".
- Barra de portes grátis.

## 5) Checkout
- Dados do comprador: nome, email, telefone.
- Morada de envio se houver itens físicos.
- NIF opcional (cifrado).
- Resumo com portes e descontos.
- Stripe PaymentIntent com metadata `STORE`.

## 6) Pós-pagamento
- Criação de `StoreOrder` e linhas.
- Envio de email de confirmação.
- Para digital: geração de `StoreDigitalGrant` e link seguro.
- Para físico: estado "PENDING" até envio.

## 7) Operação e fulfillment
- Backoffice: gerir encomendas, marcar como enviada.
- Refund parcial ou total (Stripe + atualização de ordem).
- Inventário ajustado automaticamente.

---

# UI e páginas (mapa)

## Organização
- `/organizacao/loja` (dashboard)
  - Visão geral: estado, vendas, portes, alertas
  - Produtos, categorias, packs
  - Encomendas e exportações
  - Definições de portes
  - Marketing (promos)

## Perfil individual
- `/me/loja` (ativação + catálogo)
- `/[username]/loja` (público)

## Cliente
- Carrinho (slide-over)
- Checkout (page dedicada)
- Histórico de compras (`/me/compras` com secção Loja)

---

# API (contratos principais)

- `GET /api/store/:slug` (público)
- `GET /api/store/:slug/products` (listagem + filtros)
- `GET /api/store/:slug/product/:productSlug`
- `POST /api/store/cart` (criar/atualizar)
- `GET /api/store/cart/:cartId`
- `POST /api/store/checkout` (criar PaymentIntent)
- `POST /api/store/order/confirm` (webhook)
- `GET /api/store/orders` (backoffice)
- `PATCH /api/store/orders/:id` (fulfillment/refund)

Backoffice:
- `POST /api/organizacao/loja/products`
- `PATCH /api/organizacao/loja/products/:id`
- `POST /api/organizacao/loja/categories`
- `POST /api/organizacao/loja/bundles`
- `POST /api/organizacao/loja/shipping`

---

# Segurança e dados sensíveis

- NIF e moradas cifrados (KMS/crypto server-side).
- Acesso limitado por role e por owner.
- Auditoria de alterações críticas (Order status, refunds, stock).
- Retenção: apagar moradas após X dias, manter só resumo fiscal.

---

# Testes críticos

- Criação de produto e variantes.
- Carrinho com itens físicos e digitais.
- Portes grátis e tiers por subtotal.
- Checkout com Stripe e webhook.
- Download digital com limite de downloads.
- Refund parcial e total.

---

# Fases de execução (ordem rigorosa)

## Fase 0 - Fundamentos e gates
1. Adicionar módulo LOJA em enums e listas.
2. Criar modelo `Store` com `status=CLOSED` e `catalogLocked=true`.
3. Guards nos endpoints públicos (loja fechada).
4. Feature flag `STORE_ENABLED` (server).
5. UI mínima para ativar loja (sem catálogo).

## Fase 1 - Modelo de dados completo
1. Adicionar tabelas do catálogo, carrinho e encomendas.
2. Migrar e indexar (Prisma + SQL).
3. Validadores Zod para payloads.
4. Storage para imagens e assets digitais.

## Fase 2 - Backoffice e catálogo
1. UI de categorias, produtos e imagens.
2. Variantes e personalização.
3. Packs/bundles.
4. Catálogo continua bloqueado por `catalogLocked`.

## Fase 3 - Carrinho e checkout
1. Carrinho persistente (guest + user).
2. Integração Stripe (PaymentIntent STORE).
3. Webhook e criação de `StoreOrder`.
4. Emails transacionais (confirmação + download).

## Fase 4 - Portes, operações e analytics
1. Portes por zona e métodos.
2. Barra de portes grátis e recomendações.
3. Fulfillment (tracking, estados).
4. Exportações e métricas.

---

# Checklist de aceitação (100%)

- Loja fechada por defeito, com ativação explícita.
- Catálogo completo e validado.
- Checkout seguro com Stripe e webhook.
- Portes simples, previsíveis e alinhados com mercado.
- Produtos digitais com downloads seguros.
- Backoffice com operações completas.
- Dados sensíveis protegidos e auditáveis.
