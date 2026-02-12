import { padel_format } from "@prisma/client";

export const PADEL_FORMAT_CATALOG: readonly padel_format[] = [
  padel_format.TODOS_CONTRA_TODOS,
  padel_format.QUADRO_ELIMINATORIO,
  padel_format.GRUPOS_ELIMINATORIAS,
  padel_format.QUADRO_AB,
  padel_format.DUPLA_ELIMINACAO,
  padel_format.NON_STOP,
  padel_format.CAMPEONATO_LIGA,
] as const;

export const PADEL_FORMAT_SET = new Set<padel_format>(PADEL_FORMAT_CATALOG);

export function isPadelFormat(value: unknown): value is padel_format {
  return typeof value === "string" && PADEL_FORMAT_SET.has(value as padel_format);
}

export function parsePadelFormat(value: unknown): padel_format | null {
  if (!isPadelFormat(value)) return null;
  return value;
}

export function resolvePadelFormat(
  value: unknown,
  fallback: padel_format = padel_format.TODOS_CONTRA_TODOS,
): padel_format {
  return parsePadelFormat(value) ?? fallback;
}

export function filterPadelFormats(values: unknown): padel_format[] {
  if (!Array.isArray(values)) return [];
  return values.reduce<padel_format[]>((acc, value) => {
    const format = parsePadelFormat(value);
    if (!format || acc.includes(format)) return acc;
    acc.push(format);
    return acc;
  }, []);
}
