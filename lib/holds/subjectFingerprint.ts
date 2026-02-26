import {
  buildHoldSubjectFingerprintSeed,
  type HoldSubjectType,
} from "@orya/shared/holds/fingerprint";

type SubjectFingerprintInput = {
  orgId: number;
  subjectType: HoldSubjectType | string;
  serviceOrEventId?: number | string | null;
  startAtISO: string;
  durationMinutes: number;
  resourceIds?: Array<number | string | null | undefined>;
  professionalId?: number | string | null;
};

export type { HoldSubjectType };

export function buildSubjectFingerprintSeed(input: SubjectFingerprintInput) {
  return buildHoldSubjectFingerprintSeed({
    orgId: input.orgId,
    subjectType: input.subjectType,
    serviceId: input.serviceOrEventId ?? null,
    startAtISO: input.startAtISO,
    durationMinutes: input.durationMinutes,
    resourceIds: input.resourceIds,
    professionalId: input.professionalId ?? null,
  });
}
