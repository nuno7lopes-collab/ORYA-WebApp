export const PUBLIC_ORGANIZATION_FIXED_SECTIONS = [
  "AGENDA_PUBLICA",
  "RESERVAS",
  "FORMULARIOS",
  "LOJA",
] as const;

export type PublicOrganizationFixedSection = (typeof PUBLIC_ORGANIZATION_FIXED_SECTIONS)[number];

type PublicStoreVisibilityInput = {
  status?: string | null;
  showOnProfile?: boolean | null;
  publicProductCount?: number | null;
};

export function shouldShowStoreOnPublicProfile(input: PublicStoreVisibilityInput): boolean {
  const status = typeof input.status === "string" ? input.status.trim().toUpperCase() : "";
  const publicProductCount =
    typeof input.publicProductCount === "number" && Number.isFinite(input.publicProductCount)
      ? Math.max(0, Math.floor(input.publicProductCount))
      : 0;
  return status === "ACTIVE" && input.showOnProfile === true && publicProductCount >= 1;
}

export function canPublishStoreOnProfile(publicProductCount: number): { ok: true } | { ok: false; error: string } {
  const count = Number.isFinite(publicProductCount) ? Math.max(0, Math.floor(publicProductCount)) : 0;
  if (count >= 1) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Não foi possível publicar a loja: adiciona e publica pelo menos 1 produto público.",
  };
}
