import { padel_format } from "@prisma/client";
import type { PadelFormatProfile } from "@/domain/padel/formatEngine/types";
import { PADEL_FORMAT_LABELS_PT } from "@/domain/padel/formatPresentation";

const profiles = {
  TODOS_CONTRA_TODOS: {
    format: padel_format.TODOS_CONTRA_TODOS,
    label: PADEL_FORMAT_LABELS_PT.TODOS_CONTRA_TODOS,
    minTeams: 2,
  },
  CAMPEONATO_LIGA: {
    format: padel_format.CAMPEONATO_LIGA,
    label: PADEL_FORMAT_LABELS_PT.CAMPEONATO_LIGA,
    minTeams: 2,
  },
  QUADRO_ELIMINATORIO: {
    format: padel_format.QUADRO_ELIMINATORIO,
    label: PADEL_FORMAT_LABELS_PT.QUADRO_ELIMINATORIO,
    minTeams: 2,
    requiresKnockout: true,
  },
  QUADRO_AB: {
    format: padel_format.QUADRO_AB,
    label: PADEL_FORMAT_LABELS_PT.QUADRO_AB,
    minTeams: 4,
    requiresKnockout: true,
  },
  DUPLA_ELIMINACAO: {
    format: padel_format.DUPLA_ELIMINACAO,
    label: PADEL_FORMAT_LABELS_PT.DUPLA_ELIMINACAO,
    minTeams: 4,
    requiresKnockout: true,
  },
  GRUPOS_ELIMINATORIAS: {
    format: padel_format.GRUPOS_ELIMINATORIAS,
    label: PADEL_FORMAT_LABELS_PT.GRUPOS_ELIMINATORIAS,
    minTeams: 4,
    requiresKnockout: true,
  },
  NON_STOP: {
    format: padel_format.NON_STOP,
    label: PADEL_FORMAT_LABELS_PT.NON_STOP,
    minTeams: 4,
    defaultNonStopMode: "ACTIVE_QUEUE",
    isTimed: true,
  },
  AMERICANO: {
    format: padel_format.AMERICANO,
    label: PADEL_FORMAT_LABELS_PT.AMERICANO,
    minTeams: 2,
    defaultAmMxMode: "INDIVIDUAL_ROTATION",
    defaultAmMxProgressionMode: "ROUND_BY_ROUND",
    isTimed: true,
  },
  MEXICANO: {
    format: padel_format.MEXICANO,
    label: PADEL_FORMAT_LABELS_PT.MEXICANO,
    minTeams: 2,
    defaultAmMxMode: "INDIVIDUAL_ROTATION",
    defaultAmMxProgressionMode: "ROUND_BY_ROUND",
    isTimed: true,
  },
} satisfies Record<padel_format, PadelFormatProfile>;

export const PADEL_FORMAT_ENGINE_REGISTRY = profiles;

export function getPadelFormatProfile(format: padel_format): PadelFormatProfile {
  return PADEL_FORMAT_ENGINE_REGISTRY[format] ?? PADEL_FORMAT_ENGINE_REGISTRY.TODOS_CONTRA_TODOS;
}
