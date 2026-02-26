import { padel_format } from "@prisma/client";
import { PADEL_FORMAT_CATALOG, parsePadelFormat } from "@/domain/padel/formatCatalog";

export const PADEL_FORMAT_LABELS_PT: Record<padel_format, string> = {
  TODOS_CONTRA_TODOS: "Todos contra todos",
  QUADRO_ELIMINATORIO: "Quadro eliminatório",
  GRUPOS_ELIMINATORIAS: "Grupos + eliminatórias",
  QUADRO_AB: "Quadro A/B",
  DUPLA_ELIMINACAO: "Dupla eliminação",
  NON_STOP: "Non-stop",
  CAMPEONATO_LIGA: "Campeonato/Liga",
  AMERICANO: "Americano",
  MEXICANO: "Mexicano",
};

export const PADEL_FORMAT_OPTIONS_PT = PADEL_FORMAT_CATALOG.map((value) => ({
  value,
  label: PADEL_FORMAT_LABELS_PT[value],
}));

export function toPadelFormatLabel(value: unknown): string | null {
  const parsed = parsePadelFormat(value);
  return parsed ? PADEL_FORMAT_LABELS_PT[parsed] : null;
}
