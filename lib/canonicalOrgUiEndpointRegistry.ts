// Canonical organization UI endpoint registry.
// This file intentionally keeps explicit endpoint strings used by UI features
// so coverage/audit tooling can validate endpoint-to-UI ownership without broad allowlists.

export const CANONICAL_ORG_UI_ENDPOINTS = [
  "/api/org/[orgId]/agenda",
  "/api/org/[orgId]/agenda/soft-blocks",
  "/api/org-hub/become",
  "/api/org/[orgId]/consentimentos",
  "/api/org/[orgId]/events/[id]/invite-token",
  "/api/org/[orgId]/faturacao",
  "/api/org/[orgId]/venues/recent",
] as const;

export type CanonicalOrgUiEndpoint = (typeof CANONICAL_ORG_UI_ENDPOINTS)[number];
