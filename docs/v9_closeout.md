# v9 Closeout

## Decisões implementadas (v9)
- DLQ Outbox: `deadLetteredAt` (append-only; publishedAt só em sucesso).
- Apple Maps (D11): fallback OSM apenas em DEV quando faltam credenciais; em PROD falha explícita.
- Analytics (D15): rollups por job com bucket DAY e dimensões MODULE/SOURCE_TYPE/PAYMENT_PROVIDER/CURRENCY; métricas GROSS/PLATFORM_FEES/PROCESSOR_FEES/NET_TO_ORG.
- EventLog (D16): fonte de verdade para Ops Feed; Outbox só transporte.
- Apple V1 (D17): Sign in with Apple, APNs token-based, universal links, share web.

## Slice → migrações → ficheiros chave
- D10 Outbox/Jobs: 0057_outbox_events_v9 → `domain/outbox/*`
- D12 Padel status/Outbox: 0058_padel_registration_status_v9, 0059_drop_padel_pairing_lifecycle_v9 → `domain/padelRegistration*.ts`
- D14 Multi-org: 0060_add_org_groups_v9 → `lib/organizationGroupAccess.ts`
- D15 Analytics: 0061_analytics_rollups_v9 → `domain/analytics/*`
- D16 EventLog + Ops Feed: 0063_event_log_ops_feed_v9 → `domain/eventLog/append.ts`, `domain/opsFeed/consumer.ts`
- D17 Apple V1: 0064_apple_v1_v9 → `lib/apple/*`, `lib/push/apns.ts`

## Validação única
- `npm run db:gates`

## Backlog D0–D9 (plano)
### D0 API pública (fora de scope v1–v3)
- Objetivo: manter sem API pública/SDK/webhooks externos.
- Outputs mínimos: contratos internos versionados + exports.
- Riscos/decisões: limites de integração externa.

### D1 Evento base obrigatório para torneios
- Objetivo: garantir eventId em torneios.
- Outputs mínimos: validações + migração de dados existentes.
- Riscos/decisões: backfill e compat.

### D2 Owners / SSOT por domínio
- Objetivo: remover duplicações de estado entre módulos.
- Outputs mínimos: guardrails/architecture tests.
- Riscos/decisões: refactors por módulo.

### D3 Agenda engine & conflitos
- Objetivo: prioridade HardBlock > MatchSlot > Booking > SoftBlock.
- Outputs mínimos: motor de agenda único + validações.
- Riscos/decisões: migração de dados legacy.

### D4 Finanças determinística
- Objetivo: Payment+Ledger SSOT, fees determinísticas.
- Outputs mínimos: snapshot + ledger types + reconciliação.
- Riscos/decisões: integração Stripe e idempotência E2E.

### D5 RBAC mínimo + Role Packs
- Objetivo: roles/scopes canónicos + packs.
- Outputs mínimos: guardrails em rotas críticas.
- Riscos/decisões: migração de permissões legacy.

### D6 Notificações como serviço
- Objetivo: outbox + templates + logs.
- Outputs mínimos: delivery log + preferências.
- Riscos/decisões: consentimentos RGPD.

### D7 sourceType canónico
- Objetivo: unificação em Finanças/Entitlements/Check-in.
- Outputs mínimos: enums + validações.
- Riscos/decisões: migração de dados antigos.

### D8 EventAccessPolicy & convites
- Objetivo: política canónica com tokens de convite.
- Outputs mínimos: policy versionada + lock pós-venda.
- Riscos/decisões: migração de flags legacy.

### D9 Merchant of Record + faturação
- Objetivo: MoR=Org, fees ORYA B2B.
- Outputs mínimos: settings + exports.
- Riscos/decisões: compliance e integrações fiscais.
