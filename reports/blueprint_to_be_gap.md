# Blueprint TO-BE Gap Report

Generated: 2026-02-08T00:48:20.179Z

## Summary
- Implemented: 62
- Partial: 29
- Missing: 1
- Unknown: 0

## Items
- [Implemented] L4070 | ORYA — Padel (TO-BE) — Plano de Excelência | **Estrutura obrigatoria:** Ferramenta A (Padel Clube) / Ferramenta B (Padel Torneios) / Integracoes (contratos). Nao colocar infra de Reservas/Financas/CRM dentro de Padel.
Evidence: docs/plano_operacional.md, docs/padel_uiux_master_plan.md, app/admin/finance/page.tsx
Search terms: Reservas/Financas/CRM, Integracoes, Ferramenta, Estrutura
Note: Evidência encontrada em código/schema.

- [Partial] L4073 | ORYA — Padel (TO-BE) — Plano de Excelência | **Regra de hierarquia (obrigatória):** este anexo é subordinado ao **ORYA — Blueprint Final v9 (SSOT)**. Em caso de conflito, vence o **v9**. O Padel define apenas domínio/UX; owners e contratos permanecem os do v9.
Evidence: docs/release/appstore_checklist.md, docs/padel_uiux_master_plan.md, docs/plano_operacional.md
Search terms: domínio/UX, Blueprint, obrigatória, subordinado
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4082 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Objetivo:** elevar o ecossistema ORYA de Padel ao nível das melhores plataformas globais (Padel Manager, Playtomic Manager, Tournament Software, PadelTeams), criando **duas ferramentas distintas e integradas**:
Evidence: domain/padelRegistration.ts, domain/notifications/producer.ts, domain/notifications/tournament.ts
Search terms: Tournament, PadelTeams, Playtomic, Objetivo
Note: Evidência encontrada em código/schema.

- [Partial] L4083 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Gestão de Clube de Padel**
Evidence: components/store/StoreProductsPanel.tsx, apps/mobile/app/search/index.tsx, app/[username]/treinadores/[trainer]/page.tsx
Search terms: Gesta, Clube, Padel
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4084 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Gestão de Torneios de Padel**
Evidence: app/[username]/page.tsx, app/descobrir/page.tsx, app/descobrir/_components/DiscoverFilters.tsx
Search terms: Torneios, Gesta, Padel
Note: Evidência encontrada em código/schema.

- [Implemented] L4086 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Princípios (TO-BE):**
Evidence: domain/tournaments/generation.ts, lib/i18n.ts, apps/mobile/node_modules/picomatch/CHANGELOG.md
Search terms: Princi, pios
Note: Evidência encontrada em código/schema.

- [Implemented] L4087 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Simples e automático:** defaults fortes, pouco atrito.
Evidence: docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, apps/mobile/node_modules/xml2js/README.md
Search terms: Simples, defaults, automa, fortes
Note: Evidência encontrada em código/schema.

- [Implemented] L4088 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Operacional e robusto:** tudo funciona em tempo real, com logs e controlo.
Evidence: app/organizacao/(dashboard)/padel/PadelHubClient.tsx, app/organizacao/(dashboard)/settings/page.tsx, apps/mobile/app/auth/index.tsx
Search terms: Operacional, funciona, controlo, robusto
Note: Evidência encontrada em código/schema.

- [Implemented] L4089 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Experiência premium:** organizadores e jogadores com UX limpa e previsível.
Evidence: apps/mobile/app/messages/[threadId].tsx, lib/publicProfileLayout.ts, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md
Search terms: organizadores, Experie, jogadores, premium
Note: Evidência encontrada em código/schema.

- [Partial] L4090 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Integração total:** clube, torneio, CRM, perfis e estatísticas em sintonia.
Evidence: docs/plano_operacional.md, docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md
Search terms: estatísticas, Integrac, sintonia, torneio
Note: Evidência apenas em docs (ou indireta).

- [Partial] L4091 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **SSOT v9:** Financas/Reservas/Check-in/CRM/RBAC/Address seguem o v9; Padel nunca duplica logica.
Evidence: domain/padelRegistrationBackfill.ts, domain/notifications/consumer.ts, app/descobrir/page.tsx
Search terms: Financas/Reservas/Check-in/CRM/RBAC/Address, Padel, duplica, seguem
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4098 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | **Estado atual relevante (resumo):**
Evidence: components/store/StoreProductVariantsPanel.tsx, lib/i18n.ts, components/store/StoreProductDigitalAssetsPanel.tsx
Search terms: Estado, relevante, resumo, atual
Note: Evidência encontrada em código/schema.

- [Implemented] L4099 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | Padel existe como preset de torneio, com Wizard e Hub Padel.
Evidence: components/organizacao/eventos/wizard/StepperDots.tsx, docs/plano_operacional.md, docs/v10_execution_checklist.md
Search terms: Wizard, Padel, torneio, existe
Note: Evidência encontrada em código/schema.

- [Implemented] L4100 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | Há clubes, courts, staff, categorias, regras, matches, standings e live via SSE.
Evidence: lib/i18n.ts, components/store/StoreCategoriesPanel.tsx, components/organization/BecomeOrganizationForm.tsx
Search terms: categorias, standings, matches, clubes
Note: Evidência encontrada em código/schema.

- [Partial] L4101 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | Páginas públicas + widgets + exports existem.
Evidence: docs/UX (ORYA WebApp).md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, app/globals.css
Search terms: Páginas, públicas, widgets, exports
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4102 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | Algumas areas-chave estão **parciais** (ex.: cancelamentos, check-in, acessibilidade).
Evidence: docs/UX (ORYA WebApp).md, docs/mobile_ios_plan.md, docs/runbooks/reservas.md
Search terms: areas-chave, acessibilidade, cancelamentos, check-in
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4109 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | **SSOT em Reservas (v9):** Padel consome a Agenda Engine via contrato, nao cria agenda propria.
Evidence: prisma/schema.prisma, components/organization/BecomeOrganizationForm.tsx, docs/observability/slo_sli.md
Search terms: Reservas, Agenda, Engine, Padel
Note: Evidência encontrada em código/schema.

- [Implemented] L4110 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | **Pagamentos via Financas:** reservas chamam `createCheckout` (Financas); nenhum modulo cria intents Stripe.
Evidence: apps/mobile/app/event/[slug].tsx, apps/mobile/app/checkout/index.tsx, apps/mobile/features/checkout/api.ts
Search terms: createCheckout, Pagamentos, Financas, Stripe
Note: Evidência encontrada em código/schema.

- [Missing] L4111 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | Multi-clube e multi-court com agendas independentes.
Evidence: none
Search terms: Multi-clube, multi-court, independentes, agendas
Note: Sem evidência encontrada.

- [Implemented] L4112 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | Otimização de ocupação (open matches, listas de espera) conforme regras de Reservas (Fase 2).
Evidence: app/servicos/page.tsx, app/[username]/page.tsx, app/[username]/_components/ReservasBookingClient.tsx
Search terms: Otimizac, Reservas, conforme, matches
Note: Evidência encontrada em código/schema.

- [Implemented] L4113 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | Integração com torneios via **MatchSlot hard-block** e CalendarBlock (D3/D3.1).
Evidence: lib/envModels.ts, prisma/schema.prisma, app/organizacao/(dashboard)/padel/PadelHubClient.tsx
Search terms: CalendarBlock, hard-block, D3/D3.1, MatchSlot
Note: Evidência encontrada em código/schema.

- [Implemented] L4114 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | Agenda com visões dia/semana e drag & drop (UI), respeitando prioridades: HardBlock > MatchSlot > Booking > SoftBlock.
Evidence: docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, domain/hardBlocks/commands.ts
Search terms: dia/semana, HardBlock, MatchSlot, SoftBlock
Note: Evidência encontrada em código/schema.

- [Implemented] L4117 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | **CRM e Perfil unificado (owner: CRM/Perfil publico)** com tags/segmentos de Padel.
Evidence: apps/mobile/components/profile/FollowListModal.tsx, app/[username]/page.tsx, apps/mobile/components/profile/ProfileHeader.tsx
Search terms: tags/segmentos, CRM/Perfil, Perfil, unificado
Note: Evidência encontrada em código/schema.

- [Partial] L4118 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | **Credits/loyalty** apenas via Servicos/Financas/CRM (Fase 2), sem carteira paralela em Padel.
Evidence: apps/mobile/lib/notifications.ts, apps/mobile/app/checkout/success.tsx, apps/mobile/app/checkout/index.tsx
Search terms: Servicos/Financas/CRM, Credits/loyalty, carteira, paralela
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4119 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | Planos e passes (assinaturas/pacotes) via Stripe Billing (Fase 2).
Evidence: prisma/migrations/0011_padel_club_os/migration.sql, components/storefront/StorefrontCheckoutClient.tsx, prisma/migrations/20260207120000_drop_membership_legacy/migration.sql
Search terms: assinaturas/pacotes, Billing, Planos, Stripe
Note: Evidência encontrada em código/schema.

- [Implemented] L4120 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | Comunicação via Notificações/Chat interno (owners core), com triggers a partir do EventLog.
Evidence: docs/runbooks/notifications.md, app/social/page.tsx, docs/plano_operacional.md
Search terms: es/Chat, Comunicac, Notificac, EventLog
Note: Evidência encontrada em código/schema.

- [Implemented] L4121 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | Matchmaking e comunidade (dominio Padel).
Evidence: domain/padelDeadlines.ts, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, lib/i18n.ts
Search terms: Matchmaking, comunidade, Padel, dominio
Note: Evidência encontrada em código/schema.

- [Partial] L4124 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | **Owner: Servicos/Reservas.** Padel nao duplica logica de aulas.
Evidence: apps/mobile/lib/push.ts, prisma/schema.prisma, prisma/migrations/0000_baseline/migration.sql
Search terms: Servicos/Reservas, Owner, Padel, duplica
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4125 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Gestão de treinadores com perfis públicos (via Servicos).
Evidence: app/[username]/page.tsx, app/organizacao/(dashboard)/staff/page.tsx, docs/padel_uiux_master_plan.md
Search terms: treinadores, Servicos, Gestão, públicos
Note: Evidência encontrada em código/schema.

- [Implemented] L4126 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Agenda de aulas (particulares e cursos) em Reservas.
Evidence: docs/observability/slo_sli.md, lib/organizationRbac.ts, prisma/schema.prisma
Search terms: particulares, Reservas, Agenda, cursos
Note: Evidência encontrada em código/schema.

- [Implemented] L4127 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Pagamentos via Financas (createCheckout).
Evidence: apps/mobile/app/event/[slug].tsx, apps/mobile/app/checkout/index.tsx, apps/mobile/features/checkout/api.ts
Search terms: createCheckout, Pagamentos, Financas
Note: Evidência encontrada em código/schema.

- [Implemented] L4128 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Histórico e feedback via Servicos/CRM.
Evidence: app/[username]/page.tsx, apps/mobile/app/(tabs)/tickets.tsx, app/organizacao/promo/PromoCodesClient.tsx
Search terms: Servicos/CRM, Histórico, feedback
Note: Evidência encontrada em código/schema.

- [Implemented] L4129 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Atalho direto ao módulo existente de serviços/aulas (UI).
Evidence: app/organizacao/(dashboard)/eventos/[id]/page.tsx, app/organizacao/(dashboard)/categorias/page.tsx, app/organizacao/(dashboard)/padel/PadelHubClient.tsx
Search terms: serviços/aulas, Atalho, existente, direto
Note: Evidência encontrada em código/schema.

- [Partial] L4132 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.4 Eventos Sociais e Ligas Internas | Mix rápidos (Americano/Mexicano) — Fase 2.
Evidence: docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, app/admin/infra/InfraClient.tsx, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
Search terms: Americano/Mexicano, rápidos, Fase
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4133 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.4 Eventos Sociais e Ligas Internas | Ligas internas, ladders e rankings internos.
Evidence: components/store/StoreOrdersPanel.tsx, docs/ssot_registry.md, docs/v10_execution_checklist.md
Search terms: Ligas, internas, rankings, internos
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4134 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.4 Eventos Sociais e Ligas Internas | Eventos personalizados e formatos flexíveis.
Evidence: apps/mobile/app/notifications/index.tsx, docs/mobile_ios_plan.md, docs/plano_operacional.md
Search terms: personalizados, Eventos, flexíveis, formatos
Note: Evidência encontrada em código/schema.

- [Implemented] L4137 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | **Checkout unificado via Financas** (gateway unico; D4).
Evidence: apps/mobile/app/event/[slug].tsx, prisma/schema.prisma, apps/mobile/app/checkout/success.tsx
Search terms: Checkout, Financas, unificado, gateway
Note: Evidência encontrada em código/schema.

- [Implemented] L4138 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | Ledger/fees/payouts/refunds como SSOT (Financas); Padel apenas consulta.
Evidence: lib/organizationRbac.ts, docs/plano_operacional.md, apps/mobile/features/onboarding/types.ts
Search terms: Ledger/fees/payouts/refunds, Financas, Padel, consulta
Note: Evidência encontrada em código/schema.

- [Implemented] L4139 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | Faturacao **nao obrigatoria** dentro da ORYA (D9.1); exports e trilho contabilistico sao obrigatorios.
Evidence: components/store/StoreOrdersPanel.tsx, lib/store/invoice.ts, app/onboarding/padel/page.tsx
Search terms: contabilistico, Faturacao, obrigatorios, obrigatoria
Note: Evidência encontrada em código/schema.

- [Implemented] L4140 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | Dashboard financeiro com KPIs (derivado de Ledger + EventLog).
Evidence: docs/runbooks/release-checklist.md, app/components/Navbar.tsx, docs/runbooks/ops-endpoints.md
Search terms: Dashboard, EventLog, financeiro, Ledger
Note: Evidência encontrada em código/schema.

- [Partial] L4141 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | Exportacoes (CSV/PDF) e integracoes contabilisticas (Fase 2).
Evidence: docs/plano_operacional.md
Search terms: contabilisticas, Exportacoes, CSV/PDF, integracoes
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4144 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.6 Staff e Permissões | RBAC centralizado (v9) com **Role Packs**: CLUB_MANAGER, TOURNAMENT_DIRECTOR, FRONT_DESK, COACH, REFEREE.
Evidence: prisma/schema.prisma, prisma/migrations/0052_role_packs_v7/migration.sql, lib/organizationRbac.ts
Search terms: TOURNAMENT_DIRECTOR, CLUB_MANAGER, FRONT_DESK, centralizado
Note: Evidência encontrada em código/schema.

- [Implemented] L4145 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.6 Staff e Permissões | Agenda de staff/treinadores via Reservas.
Evidence: app/servicos/page.tsx, app/[username]/page.tsx, app/[username]/_components/ReservasBookingClient.tsx
Search terms: staff/treinadores, Reservas, Agenda
Note: Evidência encontrada em código/schema.

- [Partial] L4146 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.6 Staff e Permissões | Escalas e comunicação interna via Equipa/Chat interno.
Evidence: docs/plano_operacional.md, docs/v10_execution_checklist.md, apps/mobile/package-lock.json
Search terms: Equipa/Chat, Escalas, comunicac, interna
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4149 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.7 Experiência do Jogador (Clube) | Portal/app do jogador.
Evidence: docs/padel_uiux_master_plan.md, domain/padel/imports.ts, docs/plano_operacional.md
Search terms: Portal/app, jogador
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4150 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.7 Experiência do Jogador (Clube) | Perfil unificado com estatísticas e reservas.
Evidence: docs/plano_operacional.md, docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md
Search terms: estatísticas, Perfil, unificado, reservas
Note: Evidência apenas em docs (ou indireta).

- [Partial] L4151 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.7 Experiência do Jogador (Clube) | Gamificação local (badges/objetivos).
Evidence: apps/mobile/app.json, apps/mobile/app/onboarding/index.tsx, apps/mobile/lib/env.ts
Search terms: badges/objetivos, Gamificação, local
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4158 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | Wizard dedicado a Padel (separado do wizard geral).
Evidence: components/organizacao/eventos/wizard/StepperDots.tsx, docs/padel_uiux_master_plan.md, docs/plano_operacional.md
Search terms: Wizard, dedicado, Padel, separado
Note: Evidência encontrada em código/schema.

- [Implemented] L4159 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | Presets e templates de torneio (clonar e reutilizar).
Evidence: apps/mobile/app/search/index.tsx, apps/mobile/app/(tabs)/index.tsx, apps/mobile/node_modules/jiti/dist/babel.js
Search terms: Presets, reutilizar, templates, torneio
Note: Evidência encontrada em código/schema.

- [Implemented] L4160 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | **MVP (v9):** eliminacao simples, grupos+eliminacao, round-robin.
Evidence: apps/mobile/node_modules/jest-worker/build/index.d.ts, apps/mobile/node_modules/jest-worker/build/Farm.js, apps/mobile/node_modules/jest-worker/README.md
Search terms: round-robin, eliminacao, simples, grupos
Note: Evidência encontrada em código/schema.

- [Implemented] L4161 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | **Fase 2+:** Americano/Mexicano, ligas por equipas, double elimination.
Evidence: lib/i18n.ts, apps/mobile/node_modules/babel-preset-expo/README.md, apps/mobile/node_modules/react-dom/profiling.js
Search terms: Americano/Mexicano, elimination, Fase, equipas
Note: Evidência encontrada em código/schema.

- [Partial] L4162 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | Circuitos e etapas com ranking cumulativo (Fase 2/3).
Evidence: apps/mobile/app/(tabs)/profile.tsx, lib/i18n.ts, app/eventos/[slug]/page.tsx
Search terms: Circuitos, cumulativo, ranking, Fase
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4163 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | Validações inteligentes e sugestões operacionais.
Evidence: docs/UX (ORYA WebApp).md, docs/release/appstore_checklist.md, docs/runbooks/incident-playbook.md
Search terms: Validações, inteligentes, operacionais, sugestões
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4164 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.1 Criação de Torneios (Wizard) | **Regra D1 (v9):** todo torneio Padel tem **eventId obrigatorio** (Eventos e owner da base).
Evidence: app/onboarding/padel/page.tsx, components/store/StoreProductsPanel.tsx, components/store/StoreShippingMethodsPanel.tsx
Search terms: obrigatorio, eventId, Eventos, Regra
Note: Evidência encontrada em código/schema.

- [Implemented] L4167 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Onboarding competitivo obrigatório.
Evidence: apps/mobile/features/onboarding/types.ts, apps/mobile/features/onboarding/api.ts, apps/mobile/app/onboarding/index.tsx
Search terms: Onboarding, competitivo, obrigatório
Note: Evidência encontrada em código/schema.

- [Implemented] L4168 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Convite de parceiro simplificado + status claro (alinhado com **EventAccessPolicy**).
Evidence: lib/envModels.ts, prisma/schema.prisma, lib/events/accessPolicy.ts
Search terms: EventAccessPolicy, simplificado, Convite, parceiro
Note: Evidência encontrada em código/schema.

- [Implemented] L4169 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Pagamento full/split **via Financas** com regra 48/24 (D12): confirmacao so com ambos pagos.
Evidence: apps/mobile/app/notifications/index.tsx, app/[username]/loja/page.tsx, domain/notifications/consumer.ts
Search terms: full/split, Pagamento, Financas, 48/24
Note: Evidência encontrada em código/schema.

- [Implemented] L4170 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Waitlist com promocao automatica (Fase 2).
Evidence: docs/padel_uiux_master_plan.md, docs/plano_operacional.md, domain/notifications/splitPayments.ts
Search terms: Waitlist, automatica, promocao, Fase
Note: Evidência encontrada em código/schema.

- [Partial] L4171 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Comunicacao pre-torneio via Notificacoes/Chat interno (owners core).
Evidence: prisma/schema.prisma, docs/runtime_validation_checklist.md, docs/runbooks/DLQ_replay.md
Search terms: Notificacoes/Chat, pre-torneio, Comunicacao, interno
Note: Evidência fraca em código (termos pouco específicos).

- [Partial] L4172 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.2 Inscrições, Convites e Pagamentos | Multilinguagem nas paginas publicas (Fase 2).
Evidence: docs/plano_operacional.md, domain/tournaments/generation.ts, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx
Search terms: Multilinguagem, publicas, paginas, Fase
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4175 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Geração automática + ajustes manuais.
Evidence: docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, app/organizacao/(dashboard)/eventos/[id]/page.tsx
Search terms: Geração, automática, ajustes, manuais
Note: Evidência encontrada em código/schema.

- [Implemented] L4176 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Suporte robusto aos formatos **MVP** (KO, grupos+KO, round-robin).
Evidence: apps/mobile/node_modules/@types/node/cluster.d.ts, apps/mobile/node_modules/jest-worker/build/index.d.ts, apps/mobile/node_modules/jest-worker/build/Farm.js
Search terms: round-robin, Suporte, formatos, robusto
Note: Evidência encontrada em código/schema.

- [Implemented] L4177 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Formatos adicionais (A/B, consolacoes, double elimination, Americano/Mexicano) em Fase 2+.
Evidence: app/api/padel/tournaments/config/route.ts, app/organizacao/(dashboard)/padel/PadelHubClient.tsx, lib/i18n.ts
Search terms: Americano/Mexicano, Formatos, consolacoes, elimination
Note: Evidência encontrada em código/schema.

- [Implemented] L4178 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Seeding explícito + regras de desempate visíveis e aplicadas.
Evidence: app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, docs/ssot_registry.md, docs/plano_operacional.md
Search terms: Seeding, explícito, desempate, aplicadas
Note: Evidência encontrada em código/schema.

- [Partial] L4179 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Calendarização premium com drag & drop.
Evidence: apps/mobile/app/(tabs)/index.tsx, app/explorar/_components/ExplorarContent.tsx, docs/padel_uiux_master_plan.md
Search terms: Calendarização, premium, drag, drop
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4180 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Respeito de bloqueios e disponibilidades.
Evidence: app/api/padel/calendar/route.ts, app/organizacao/(dashboard)/padel/PadelHubClient.tsx, prisma/schema.prisma
Search terms: disponibilidades, Respeito, bloqueios
Note: Evidência encontrada em código/schema.

- [Implemented] L4181 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.3 Formatos, Chaves e Geração de Jogos | Gestão de atrasos com impacto no cronograma.
Evidence: components/organization/BecomeOrganizationForm.tsx, app/admin/utilizadores/page.tsx, docs/padel_uiux_master_plan.md
Search terms: cronograma, Gestão, atrasos, impacto
Note: Evidência encontrada em código/schema.

- [Partial] L4184 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Check-in de equipas/duplas via **Entitlement + Check-in Policy** (owner: Check-in).
Evidence: docs/observability/slo_sli.md, docs/runbooks/checkin.md, docs/runbooks/metrics-alerts.md
Search terms: equipas/duplas, Check-in, Entitlement, Policy
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4185 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Manual no painel; self check-in apenas Fase 2 (com guardrails).
Evidence: apps/mobile/app/wallet/[entitlementId].tsx, prisma/migrations/20260207211000_remove_ticket_usedat_checkin_refunded/migration.sql, components/organization/BecomeOrganizationForm.tsx
Search terms: check-in, guardrails, Manual, Fase
Note: Evidência encontrada em código/schema.

- [Implemented] L4186 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Interface de árbitro/mobile para score.
Evidence: apps/mobile/app.json, apps/mobile/node_modules/path-scurry/README.md, apps/mobile/node_modules/plist/dist/plist-build.js
Search terms: árbitro/mobile, Interface, score
Note: Evidência encontrada em código/schema.

- [Partial] L4187 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Live score robusto com status/tempo.
Evidence: prisma/schema.prisma, domain/tournaments/liveWarnings.ts, apps/mobile/app/(tabs)/agora.tsx
Search terms: status/tempo, Live, robusto, score
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4188 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Streaming integrado (por court/jogo).
Evidence: app/organizacao/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx, apps/mobile/node_modules/chrome-launcher/docs/chrome-flags-for-tools.md, apps/mobile/node_modules/strip-ansi/readme.md
Search terms: court/jogo, Streaming, integrado
Note: Evidência encontrada em código/schema.

- [Partial] L4189 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Monitor/TV com dashboards ricos.
Evidence: docs/observability/slo_sli.md, docs/runbooks/incident-playbook.md, docs/runbooks/operability-checklist.md
Search terms: Monitor/TV, dashboards, ricos
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4190 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Notificações de chamada de jogo e progresso.
Evidence: docs/runbooks/notifications.md, docs/plano_operacional.md, lib/i18n.ts
Search terms: Notificac, progresso, chamada, jogo
Note: Evidência encontrada em código/schema.

- [Partial] L4191 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | WO, disputa e logs visíveis.
Evidence: app/eventos/[slug]/WavesSectionClient.tsx, lib/env.ts, docs/UX (ORYA WebApp).md
Search terms: visíveis, disputa, logs
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4194 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.5 Páginas Públicas e Widgets | Páginas ricas (Calendário, Chaves, Resultados, Classificações).
Evidence: lib/i18n.ts, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, apps/mobile/app/(tabs)/profile.tsx
Search terms: Classificações, Calendário, Resultados, Páginas
Note: Evidência encontrada em código/schema.

- [Implemented] L4195 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.5 Páginas Públicas e Widgets | Widgets embedáveis adicionais (placar live por jogo) — Fase 2.
Evidence: app/organizacao/(dashboard)/eventos/[id]/page.tsx, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, apps/mobile/node_modules/@react-native/debugger-frontend/dist/third-party/front_end/third_party/lighthouse/lighthouse-dt-bundle.js
Search terms: Widgets, embedáveis, adicionais, Fase
Note: Evidência encontrada em código/schema.

- [Partial] L4196 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.5 Páginas Públicas e Widgets | Partilha/SEO e URLs por jogo.
Evidence: lib/env.ts, docs/runbooks/infra-modes.md, docs/mobile_local_dev.md
Search terms: Partilha/SEO, URLs, jogo
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4197 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.5 Páginas Públicas e Widgets | Galeria e multimédia (Fase 2).
Evidence: app/organizacao/DashboardClient.tsx, app/organizacao/(dashboard)/eventos/novo/page.tsx, lib/i18n.ts
Search terms: Galeria, multimédia, Fase
Note: Evidência encontrada em código/schema.

- [Implemented] L4200 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.6 Rankings, Histórico e Perfis | Rankings internos e por circuito.
Evidence: docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, app/eventos/[slug]/ranking/page.tsx
Search terms: Rankings, internos, circuito
Note: Evidência encontrada em código/schema.

- [Partial] L4201 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.6 Rankings, Histórico e Perfis | Integração opcional com federações.
Evidence: apps/mobile/app/onboarding/index.tsx, app/onboarding/padel/page.tsx, apps/mobile/lib/username.ts
Search terms: Integração, federações, opcional
Note: Evidência fraca em código (termos pouco específicos).

- [Implemented] L4202 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.6 Rankings, Histórico e Perfis | Perfis competitivos avançados (stats + conquistas).
Evidence: app/[username]/padel/page.tsx, app/[username]/page.tsx, apps/mobile/app/(tabs)/network.tsx
Search terms: competitivos, conquistas, Perfis, avançados
Note: Evidência encontrada em código/schema.

- [Implemented] L4203 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.6 Rankings, Histórico e Perfis | Relatórios pós-evento para organizadores.
Evidence: app/organizacao/(dashboard)/crm/relatorios/page.tsx, app/organizacao/(dashboard)/crm/CrmSubnav.tsx, lib/publicProfileLayout.ts
Search terms: pós-evento, Relatórios, organizadores
Note: Evidência encontrada em código/schema.

- [Implemented] L4206 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Logs e auditoria centralizados.
Evidence: docs/release/appstore_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, prisma/schema.prisma
Search terms: centralizados, auditoria, Logs
Note: Evidência encontrada em código/schema.

- [Implemented] L4207 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Permissões multi-admin (árbitros/co-organizadores).
Evidence: app/organizacao/(dashboard)/staff/page.tsx, docs/plano_operacional.md, app/organizacao/DashboardClient.tsx
Search terms: árbitros/co-organizadores, multi-admin, Permissões
Note: Evidência encontrada em código/schema.

- [Partial] L4208 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Plano de contingência (exports PDF/backup).
Evidence: docs/ssot_registry.md, docs/padel_uiux_master_plan.md, docs/plano_operacional.md
Search terms: PDF/backup, contingência, Plano, exports
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4209 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Ajuda in-app e suporte rápido.
Evidence: docs/mobile_ios_plan.md, docs/plano_reservas_servicos.md, app/organizacao/(dashboard)/crm/campanhas/page.tsx
Search terms: in-app, Ajuda, suporte, rápido
Note: Evidência encontrada em código/schema.

- [Implemented] L4210 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Políticas de cancelamento/reembolso claras.
Evidence: components/store/StoreSettingsPanel.tsx, components/storefront/StorefrontCheckoutClient.tsx, app/organizacao/objectiveNav.ts
Search terms: cancelamento/reembolso, Políticas, claras
Note: Evidência encontrada em código/schema.

- [Partial] L4211 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.7 Governança e Qualidade | Acessibilidade e UX premium.
Evidence: docs/UX (ORYA WebApp).md, docs/v10_execution_checklist.md, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md
Search terms: Acessibilidade, premium
Note: Evidência apenas em docs (ou indireta).

- [Implemented] L4295 | ORYA — Padel (TO-BE) — Plano de Excelência > 6) Gap Analysis (AS-IS vs TO-BE) | **Definições de prioridade:**
Evidence: components/store/StoreSettingsPanel.tsx, app/me/settings/page.tsx, app/organizacao/objectiveNav.ts
Search terms: Definições, prioridade
Note: Evidência encontrada em código/schema.

- [Implemented] L4296 | ORYA — Padel (TO-BE) — Plano de Excelência > 6) Gap Analysis (AS-IS vs TO-BE) | **Obrigatório:** entra no MVP/Fase 1.
Evidence: docs/UX (ORYA WebApp).md, app/components/forms/InlineDateTimePicker.tsx, app/admin/infra/InfraClient.tsx
Search terms: MVP/Fase, Obrigatório, entra
Note: Evidência encontrada em código/schema.

- [Partial] L4297 | ORYA — Padel (TO-BE) — Plano de Excelência > 6) Gap Analysis (AS-IS vs TO-BE) | **Ideal:** fase de escala, não bloqueia MVP.
Evidence: components/organization/BecomeOrganizationForm.tsx, docs/Plano_Tecnico_v10_Auditoria_Final_e_Acao_para_ORYA_RAW.md, apps/mobile/node_modules/@types/babel__core/index.d.ts
Search terms: Ideal, bloqueia, escala, fase
Note: Evidência fraca em código (termos pouco específicos).
