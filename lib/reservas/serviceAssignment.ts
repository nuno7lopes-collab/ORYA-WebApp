export type ReservationAssignmentMode =
  | "PROFESSIONAL_ONLY"
  | "RESOURCE_ONLY"
  | "PROFESSIONAL_AND_RESOURCE";

export type ReservationAssignmentAvailabilityMode = "PROFESSIONAL" | "RESOURCE" | "HYBRID";

export function normalizeReservationAssignmentMode(
  value?: string | null,
  fallback: ReservationAssignmentMode = "PROFESSIONAL_ONLY",
): ReservationAssignmentMode {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "PROFESSIONAL_ONLY" || normalized === "PROFESSIONAL") return "PROFESSIONAL_ONLY";
  if (normalized === "RESOURCE_ONLY" || normalized === "RESOURCE") return "RESOURCE_ONLY";
  if (normalized === "PROFESSIONAL_AND_RESOURCE") return "PROFESSIONAL_AND_RESOURCE";
  return fallback;
}

export function requiresProfessionalForAssignmentMode(mode?: string | null) {
  const normalized = normalizeReservationAssignmentMode(mode);
  return normalized === "PROFESSIONAL_ONLY" || normalized === "PROFESSIONAL_AND_RESOURCE";
}

export function requiresResourceForAssignmentMode(mode?: string | null) {
  const normalized = normalizeReservationAssignmentMode(mode);
  return normalized === "RESOURCE_ONLY" || normalized === "PROFESSIONAL_AND_RESOURCE";
}

export function requiresPartySizeForAssignmentMode(mode?: string | null) {
  const normalized = normalizeReservationAssignmentMode(mode);
  return normalized === "RESOURCE_ONLY" || normalized === "PROFESSIONAL_AND_RESOURCE";
}

export function resolveServiceAssignmentMode(params: {
  organizationMode?: string | null;
  serviceMode?: string | null;
  serviceKind?: string | null;
}) {
  const organizationMode = normalizeReservationAssignmentMode(params.organizationMode);
  const assignmentMode = normalizeReservationAssignmentMode(params.serviceMode, organizationMode);
  const requiresProfessional = requiresProfessionalForAssignmentMode(assignmentMode);
  const requiresResource = requiresResourceForAssignmentMode(assignmentMode);
  const serviceKind = typeof params.serviceKind === "string" ? params.serviceKind.trim().toUpperCase() : "";
  const isCourtService = serviceKind === "COURT";
  const availabilityMode: ReservationAssignmentAvailabilityMode =
    requiresProfessional && requiresResource
      ? "HYBRID"
      : requiresResource
        ? "RESOURCE"
        : "PROFESSIONAL";
  // Backward-compatibility alias for legacy callers that still expect binary mode.
  const mode: Exclude<ReservationAssignmentAvailabilityMode, "HYBRID"> =
    availabilityMode === "PROFESSIONAL" ? "PROFESSIONAL" : "RESOURCE";
  return {
    availabilityMode,
    mode,
    assignmentMode,
    organizationMode,
    requiresProfessional,
    requiresResource,
    isCourtService,
    isHybrid: assignmentMode === "PROFESSIONAL_AND_RESOURCE",
  };
}

export function getResourceModeBlockedPayload() {
  return {
    ok: false,
    error: "RESOURCE_MODE_NOT_ALLOWED",
    message: "Este serviço não permite reservas por recurso.",
  };
}

export function getProfessionalModeBlockedPayload() {
  return {
    ok: false,
    error: "PROFESSIONAL_MODE_NOT_ALLOWED",
    message: "Este serviço não permite reservas por profissional.",
  };
}
