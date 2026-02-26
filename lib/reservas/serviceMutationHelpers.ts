import { ReservationCategoryDomain } from "@prisma/client";

export const ALLOWED_SERVICE_DURATIONS = new Set([30, 60, 90, 120]);

export function normalizeIdList(value: unknown, label: string) {
  if (value === undefined) return { ids: null as number[] | null, error: null as string | null };
  if (value === null) return { ids: [] as number[], error: null as string | null };
  if (!Array.isArray(value)) {
    return { ids: null as number[] | null, error: `${label} inválidos.` };
  }
  const parsed: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isFinite(id) || id <= 0) {
      return { ids: null as number[] | null, error: `${label} inválidos.` };
    }
    parsed.push(Math.trunc(id));
  }
  return { ids: Array.from(new Set(parsed)), error: null as string | null };
}

export function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function getDefaultCategoryByDomain(domain: ReservationCategoryDomain) {
  if (domain === "COURT") return { slug: "campo-padel", label: "Reserva de Campo", sortOrder: 10 };
  if (domain === "CLASS") return { slug: "aulas", label: "Aulas", sortOrder: 20 };
  return { slug: "servicos", label: "Serviços", sortOrder: 30 };
}

export function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
