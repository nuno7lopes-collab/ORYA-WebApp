// Canonical organization UI endpoint registry.
// This file intentionally keeps explicit endpoint strings used by UI features
// so coverage/audit tooling can validate endpoint-to-UI ownership without broad allowlists.

export const CANONICAL_ORG_UI_ENDPOINTS = [
  "/api/organizacao/agenda",
  "/api/organizacao/agenda/soft-blocks",
  "/api/organizacao/become",
  "/api/organizacao/consentimentos",
  "/api/organizacao/events/[id]/invite-token",
  "/api/organizacao/faturacao",
  "/api/organizacao/padel/courts",
  "/api/organizacao/tournaments/list",
  "/api/organizacao/tournaments/[id]",
  "/api/organizacao/tournaments/[id]/structure",
  "/api/organizacao/tournaments/[id]/matches/schedule",
  "/api/organizacao/tournaments/[id]/matches/[matchId]/edit",
  "/api/organizacao/tournaments/[id]/matches/[matchId]/notify",
  "/api/organizacao/venues/recent",
] as const;

export type CanonicalOrgUiEndpoint = (typeof CANONICAL_ORG_UI_ENDPOINTS)[number];
