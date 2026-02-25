import type { ReservationCategoryDomain, ServiceKind } from "@prisma/client";

export type BookingVertical = "COURT" | "CLASS" | "SERVICE";

export function resolveBookingVerticalFromServiceKind(kind: ServiceKind | string | null | undefined): BookingVertical {
  const normalized = typeof kind === "string" ? kind.trim().toUpperCase() : "";
  if (normalized === "COURT") return "COURT";
  if (normalized === "CLASS") return "CLASS";
  return "SERVICE";
}

export function resolveCategoryDomainFromServiceKind(
  kind: ServiceKind | string | null | undefined,
): ReservationCategoryDomain {
  const vertical = resolveBookingVerticalFromServiceKind(kind);
  if (vertical === "COURT") return "COURT";
  if (vertical === "CLASS") return "CLASS";
  return "SERVICE";
}
