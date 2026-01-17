import { EventStatus } from "@prisma/client";
import { isPadelCompetitionState, PadelCompetitionState } from "@/domain/padelCompetitionState";

type RegistrationCheckResult =
  | { ok: true }
  | { ok: false; code: "EVENT_NOT_PUBLISHED" | "INSCRIPTIONS_NOT_OPEN" | "INSCRIPTIONS_CLOSED" | "TOURNAMENT_STARTED" };

type RegistrationCheckParams = {
  eventStatus: EventStatus;
  eventStartsAt: Date | null;
  registrationStartsAt?: Date | null;
  registrationEndsAt?: Date | null;
  competitionState?: PadelCompetitionState | string | null;
  now?: Date;
};

export function checkPadelRegistrationWindow(params: RegistrationCheckParams): RegistrationCheckResult {
  const { eventStatus, eventStartsAt, registrationStartsAt, registrationEndsAt } = params;
  const now = params.now ?? new Date();
  const competitionState = isPadelCompetitionState(params.competitionState)
    ? params.competitionState
    : null;

  if (competitionState === "HIDDEN" || competitionState === "CANCELLED") {
    return { ok: false, code: "EVENT_NOT_PUBLISHED" };
  }
  if (competitionState === "PUBLIC") {
    return { ok: false, code: "INSCRIPTIONS_CLOSED" };
  }

  if (eventStatus !== "PUBLISHED" && eventStatus !== "DATE_CHANGED") {
    return { ok: false, code: "EVENT_NOT_PUBLISHED" };
  }

  if (registrationStartsAt && now.getTime() < registrationStartsAt.getTime()) {
    return { ok: false, code: "INSCRIPTIONS_NOT_OPEN" };
  }

  if (registrationEndsAt && now.getTime() > registrationEndsAt.getTime()) {
    return { ok: false, code: "INSCRIPTIONS_CLOSED" };
  }

  if (eventStartsAt && now.getTime() >= eventStartsAt.getTime()) {
    return { ok: false, code: "TOURNAMENT_STARTED" };
  }

  return { ok: true };
}
