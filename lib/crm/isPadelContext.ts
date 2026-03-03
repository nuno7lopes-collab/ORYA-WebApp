import {
  EventTemplateType,
  OrganizationKind,
  ServiceKind,
} from "@prisma/client";

type PadelContextInput = {
  organizationKind?: OrganizationKind | string | null;
  templateType?: EventTemplateType | string | null;
  serviceKind?: ServiceKind | string | null;
};

function normalizeToken(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function isPadelContext(input: PadelContextInput) {
  const organizationKind = normalizeToken(input.organizationKind ?? null);
  const templateType = normalizeToken(input.templateType ?? null);
  const serviceKind = normalizeToken(input.serviceKind ?? null);

  if (organizationKind === OrganizationKind.CLUBE_PADEL) {
    return true;
  }
  if (templateType === EventTemplateType.PADEL) {
    return true;
  }
  if (
    organizationKind === OrganizationKind.CLUBE_PADEL &&
    (serviceKind === ServiceKind.COURT || serviceKind === ServiceKind.CLASS)
  ) {
    return true;
  }
  return false;
}
