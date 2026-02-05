# A0 - Repo grounding + inventario (Bloco A)
> Nota: snapshot de diagnóstico do repo (data/commit específicos). Para SSOT atual, ver `docs/v9_ssot_registry.md`.

## Estado repo (A0)
- Branch: developer
- Commit: 7be605a
- git status: clean

## Baseline executado
- npm run db:gates:offline OK
- npx vitest run tests/rbac tests/access OK
- RG guardrails:
  - rg -n "organizationMember\.findFirst|ownerId\s*=" app lib domain tests -S -> 0
  - rg -n "if \(!.*can|hasPermission\(|isOwner\(" app/api/organizacao -S -> 0

## Endpoints suspeitos (cookie/lastUsedOrg para mais do que redirect)
- org context com fallback para profile/cookie:
  - lib/organizationContext.ts (allowFallback + resolveOrganizationIdFromCookies)
  - lib/organizationId.ts (resolveOrganizationIdFromRequest com allowFallback)
- API que resolve org via cookie (nao so redirect):
  - app/api/organizacao/me/route.ts (forcedOrgId via cookie + allowFallback quando nao ha query)
  - app/api/me/location/coarse/route.ts (orgContext via ORG_ACTIVE_ACCESS_OPTIONS para EventLog)
  - app/api/me/location/consent/route.ts (orgContext via ORG_ACTIVE_ACCESS_OPTIONS para EventLog)
- Server Components com allowFallback true (renderizam conteudo com org resolvida por cookie):
  - app/organizacao/(dashboard)/page.tsx
  - app/organizacao/(dashboard)/loja/page.tsx
  - app/organizacao/(dashboard)/eventos/page.tsx
  - app/organizacao/(dashboard)/eventos/[id]/page.tsx
  - app/organizacao/(dashboard)/eventos/[id]/live/page.tsx
  - app/organizacao/(dashboard)/eventos/[id]/edit/page.tsx
  - app/organizacao/(dashboard)/_components/ModuleGuardLayout.tsx
  - app/organizacao/(dashboard)/organizations/page.tsx
  - app/organizacao/(dashboard)/torneios/page.tsx
  - app/organizacao/(dashboard)/crm/layout.tsx

## Acoes irreversiveis existentes - mapa FECHADO v1 (step-up)
- Refunds:
  - app/api/organizacao/events/[id]/refund/route.ts
- Cancelamento de evento/torneio (soft-cancel):
  - app/api/organizacao/events/update/route.ts (status update; confirmar CANCELLED)
- Alteracao de fee policy / overrides:
  - app/api/admin/fees/route.ts (fees plataforma)
  - app/api/organizacao/payouts/settings/route.ts (feeMode/platformFee*)
  - app/api/organizacao/events/create/route.ts (feeMode/platformFee* em overrides)
  - app/api/organizacao/events/update/route.ts (feeMode/platformFee* em overrides)
- Exportacao com PII:
  - app/api/organizacao/finance/exports/payouts/route.ts
  - app/api/organizacao/finance/exports/fees/route.ts
  - app/api/organizacao/finance/exports/ledger/route.ts
  - app/api/organizacao/padel/exports/analytics/route.ts
  - app/api/organizacao/padel/exports/bracket/route.ts
  - app/api/organizacao/padel/exports/resultados/route.ts
  - app/api/organizacao/padel/exports/calendario/route.ts
  - app/api/organizacao/padel/exports/inscritos/route.ts
  - app/api/admin/payments/export/route.ts
  - app/api/admin/tickets/export/route.ts

## Guard canonico (nao duplicar)
- Org context + membership:
  - lib/organizationContext.ts (getActiveOrganizationForUser)
  - lib/organizationGroupAccess.ts (resolveGroupMemberForOrg / ensureGroupMemberRole)
- RBAC por modulo/role pack:
  - lib/organizationMemberAccess.ts (ensureMemberModuleAccess)
  - lib/organizationRbac.ts (resolveMemberModuleAccess / role packs)
- EventAccessPolicy:
  - lib/checkin/accessPolicy.ts (create/get/lock policy)
  - domain/access/evaluateAccess.ts (evaluateEventAccess)
