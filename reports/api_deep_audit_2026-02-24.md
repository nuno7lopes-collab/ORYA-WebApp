# Auditoria profunda de APIs

Data: 2026-02-24

## 1) Cobertura e utilidade (evidência)

- Total de endpoints inventariados: **495**
- Cobertos por UI/mobile: **442**
- Exempt (internal/cron/webhook): **47**
- Orphan (sem uso UI): **6**
- Rotas `cron`: **19** (todas com scheduler em `lib/cron/jobs.ts`)
- Rotas `internal`: **26**

### Orphans UI (atuais)

- `/api/auth/clear`
- `/api/me/dsar/export`
- `/api/me/wallet/[entitlementId]/pass`
- `/api/messages/attachments/presign`
- `/api/messages/messages/[messageId]/report`
- `/api/upload/delete`

### Orphans baseline conhecidos

- `/api/me/dsar/export`
- `/api/me/wallet/[entitlementId]/pass`
- `/api/upload/delete`

### Allowlist explícita

- `/api/auth/clear`
- `/api/messages/attachments/presign`
- `/api/messages/messages/[messageId]/report`

## 2) Redundâncias / aliases

- Re-exports de rota encontrados: **2**
- `/api/org-hub` -> `@/app/api/org-hub/organizations/route`
- `/api/org/[orgId]` -> `@/app/api/org/[orgId]/me/route`

### Grupos com implementação praticamente idêntica (normalização textual)

- `/api/admin/infra/hard-pause` | `/api/admin/infra/soft-pause`
- `/api/admin/infra/redis/start` | `/api/admin/infra/redis/stop`
- `/api/admin/infra/resume` | `/api/admin/infra/start`
- `/api/org-hub/groups/exit-requests/[id]/email/confirm` | `/api/org-hub/groups/join-requests/[id]/email/confirm`
- `/api/org-hub/groups/exit-requests/[id]/email/resend` | `/api/org-hub/groups/join-requests/[id]/email/resend`
- `/api/org-hub/groups/exit-requests/[id]/generate-code` | `/api/org-hub/groups/join-requests/[id]/generate-code`
- `/api/org-hub` | `/api/org/[orgId]`

## 3) Endpoints internos sem chamador literal no repositório

Total: **11**

- `/api/internal/crm/ingest`
- `/api/internal/crm/rebuild`
- `/api/internal/cron/coverage`
- `/api/internal/notifications/sweep`
- `/api/internal/ops/outbox/replay`
- `/api/internal/ops/outbox/summary`
- `/api/internal/ops/padel/cleanup`
- `/api/internal/ops/padel/integrity`
- `/api/internal/ops/padel/workforce-hygiene`
- `/api/internal/padel/registrations/backfill`
- `/api/internal/public-api/keys`

## 4) Conclusão técnica

- A maioria das APIs tem utilidade comprovada (UI/mobile, cron scheduler, webhooks, testes/operacional).
- Não há sinais de namespace legacy antigo ativo (`/api/store/**`, `/api/org/:id/payouts/**`, `/api/organizacao/**`): hard-cut e guardrails estão no código/testes.
- Há **redundâncias controladas** (aliases por re-export) e **superfícies possivelmente subutilizadas** (internals sem chamador literal, e orphans allowlisted).
- Candidato com maior probabilidade de remoção sem impacto funcional direto no produto: `/api/upload/delete` (sem consumidores encontrados).
