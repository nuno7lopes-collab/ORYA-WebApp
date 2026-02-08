# Blueprint TO-BE — Gap Summary

Generated: 2026-02-08T00:48:20.179Z

## Resumo
- Implemented: 62
- Partial: 29
- Missing: 1
- Unknown: 0

## Usernames reservados (higiene de rotas)
- Fonte única: `packages/shared/src/usernamePolicy.ts` (usa `packages/shared/src/reservedUsernames.generated.ts`).
- Geração automática de segmentos de rota, incluindo route groups: `scripts/generate-reserved-usernames.ts`.
- Validação centralizada: `lib/username.ts` + `lib/globalUsernames.ts` + `/api/username/check` e `/api/profiles/check-username`.
- Proteção defensiva de rotas: `app/[username]/page.tsx` devolve `notFound()` quando reservado.
- Auditoria/limpeza (env-aware): `scripts/audit-reserved-usernames.ts` e `scripts/purge-reserved-usernames.ts`.
- Exceção controlada: `orya` permitido apenas para a conta `admin@orya.pt` (allowlist por email).
- Estado (2026-02-08): `reservedCount=330`, sem conflitos em `prod` e `test`.

## Top 5 gaps críticos
- [Partial] L4091 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **SSOT v9:** Financas/Reservas/Check-in/CRM/RBAC/Address seguem o v9; Padel nunca duplica logica.
- [Partial] L4184 | ORYA — Padel (TO-BE) — Plano de Excelência > 3) Ferramenta B — Gestão de Torneios de Padel (TO-BE) > 3.4 Operação Live | Check-in de equipas/duplas via **Entitlement + Check-in Policy** (owner: Check-in).
- [Partial] L4102 | ORYA — Padel (TO-BE) — Plano de Excelência > 1) Base AS-IS (resumo) | Algumas areas-chave estão **parciais** (ex.: cancelamentos, check-in, acessibilidade).
- [Partial] L4073 | ORYA — Padel (TO-BE) — Plano de Excelência | **Regra de hierarquia (obrigatória):** este anexo é subordinado ao **ORYA — Blueprint Final v9 (SSOT)**. Em caso de conflito, vence o **v9**. O Padel define ap…
- [Partial] L4083 | ORYA — Padel (TO-BE) — Plano de Excelência > 0) Objetivo e Princípios | **Gestão de Clube de Padel**

## Implementados relevantes
- [Implemented] L4110 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.1 Reservas e Agenda Inteligente | **Pagamentos via Financas:** reservas chamam `createCheckout` (Financas); nenhum modulo cria intents Stripe.
- [Implemented] L4138 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | Ledger/fees/payouts/refunds como SSOT (Financas); Padel apenas consulta.
- [Implemented] L4127 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.3 Aulas, Treinos e Academia | Pagamentos via Financas (createCheckout).
- [Implemented] L4119 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.2 Sócios, Jogadores e Comunicação | Planos e passes (assinaturas/pacotes) via Stripe Billing (Fase 2).
- [Implemented] L4137 | ORYA — Padel (TO-BE) — Plano de Excelência > 2) Ferramenta A — Gestão de Clube de Padel (TO-BE) > 2.5 Pagamentos, Faturação e Relatórios | **Checkout unificado via Financas** (gateway unico; D4).

## Limitações
- Classificação baseada em heurística e busca textual; não substitui validação manual.
- Itens com dependências externas/runtime podem aparecer como Unknown ou Partial.
- Report completo em reports/blueprint_to_be_gap.md.
