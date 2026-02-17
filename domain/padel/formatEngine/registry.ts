import { padel_format } from "@prisma/client";
import type { PadelFormatProfile } from "@/domain/padel/formatEngine/types";

const profiles = {
  TODOS_CONTRA_TODOS: {
    format: padel_format.TODOS_CONTRA_TODOS,
    label: "Todos contra todos",
    minTeams: 2,
  },
  CAMPEONATO_LIGA: {
    format: padel_format.CAMPEONATO_LIGA,
    label: "Campeonato liga",
    minTeams: 2,
  },
  QUADRO_ELIMINATORIO: {
    format: padel_format.QUADRO_ELIMINATORIO,
    label: "Quadro eliminatório",
    minTeams: 2,
    requiresKnockout: true,
  },
  QUADRO_AB: {
    format: padel_format.QUADRO_AB,
    label: "Quadro A/B",
    minTeams: 4,
    requiresKnockout: true,
  },
  DUPLA_ELIMINACAO: {
    format: padel_format.DUPLA_ELIMINACAO,
    label: "Dupla eliminação",
    minTeams: 4,
    requiresKnockout: true,
  },
  GRUPOS_ELIMINATORIAS: {
    format: padel_format.GRUPOS_ELIMINATORIAS,
    label: "Grupos + eliminatórias",
    minTeams: 4,
    requiresKnockout: true,
  },
  NON_STOP: {
    format: padel_format.NON_STOP,
    label: "Non-stop (King of Court)",
    minTeams: 4,
    isTimed: true,
  },
  AMERICANO: {
    format: padel_format.AMERICANO,
    label: "Americano",
    minTeams: 2,
    defaultAmMxMode: "INDIVIDUAL_ROTATION",
    isTimed: true,
  },
  MEXICANO: {
    format: padel_format.MEXICANO,
    label: "Mexicano",
    minTeams: 2,
    defaultAmMxMode: "INDIVIDUAL_ROTATION",
    isTimed: true,
  },
} satisfies Record<padel_format, PadelFormatProfile>;

export const PADEL_FORMAT_ENGINE_REGISTRY = profiles;

export function getPadelFormatProfile(format: padel_format): PadelFormatProfile {
  return PADEL_FORMAT_ENGINE_REGISTRY[format] ?? PADEL_FORMAT_ENGINE_REGISTRY.TODOS_CONTRA_TODOS;
}
