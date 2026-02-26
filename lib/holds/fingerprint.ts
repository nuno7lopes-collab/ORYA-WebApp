import { createHash } from "crypto";
import {
  buildHoldSubjectFingerprint,
  type HoldSubjectType,
} from "@orya/shared";

type BuildSubjectFingerprintInput = {
  orgId: number;
  subjectType: HoldSubjectType | string;
  serviceOrEventId?: number | string | null;
  startAtISO: string;
  durationMinutes: number;
  resourceIds?: Array<number | string | null | undefined>;
  professionalId?: number | string | null;
};

export function buildSubjectFingerprint(input: BuildSubjectFingerprintInput) {
  return buildHoldSubjectFingerprint({
    orgId: input.orgId,
    subjectType: input.subjectType,
    serviceId: input.serviceOrEventId ?? null,
    startAtISO: input.startAtISO,
    durationMinutes: input.durationMinutes,
    resourceIds: input.resourceIds,
    professionalId: input.professionalId ?? null,
  });
}

export function buildClientSessionHash(clientSessionId: string) {
  return createHash("sha256").update(clientSessionId).digest("hex");
}
