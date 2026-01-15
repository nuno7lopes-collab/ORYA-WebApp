export type ReservationAssignmentMode = "PROFESSIONAL" | "RESOURCE";

const normalizeMode = (value?: string | null): ReservationAssignmentMode =>
  value === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";

export function resolveServiceAssignmentMode(params: {
  organizationMode?: string | null;
  serviceKind?: string | null;
}) {
  const organizationMode = normalizeMode(params.organizationMode);
  const serviceKind = typeof params.serviceKind === "string" ? params.serviceKind.trim().toUpperCase() : "";
  const isCourtService = serviceKind === "COURT";
  const mode: ReservationAssignmentMode = isCourtService ? organizationMode : "PROFESSIONAL";
  return { mode, organizationMode, isCourtService };
}

export function getResourceModeBlockedPayload() {
  return {
    ok: false,
    error: "RESOURCE_MODE_NOT_ALLOWED",
    message: "Este serviço não permite reservas por recurso.",
  };
}
