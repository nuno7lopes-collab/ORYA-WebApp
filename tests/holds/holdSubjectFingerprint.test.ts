import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildHoldSubjectFingerprint,
  buildHoldSubjectFingerprintSeed,
} from "@orya/shared";

describe("hold subject fingerprint", () => {
  it("ordena resourceIds e deduplica de forma determinística", () => {
    const base = {
      orgId: 10,
      subjectType: "SERVICE",
      serviceId: 77,
      startAtISO: "2026-03-01T09:00:00.000Z",
      durationMinutes: 60,
      professionalId: 15,
    };

    const seedA = buildHoldSubjectFingerprintSeed({
      ...base,
      resourceIds: [22, 7, 11, 7],
    });
    const seedB = buildHoldSubjectFingerprintSeed({
      ...base,
      resourceIds: [11, 22, 7],
    });

    expect(seedA).toContain("resources:7,11,22");
    expect(seedA).toBe(seedB);
    expect(
      buildHoldSubjectFingerprint({
        ...base,
        resourceIds: [22, 7, 11, 7],
      }),
    ).toBe(
      buildHoldSubjectFingerprint({
        ...base,
        resourceIds: [11, 22, 7],
      }),
    );
  });

  it("normaliza startAtISO para UTC de forma canónica", () => {
    const inputOffset = {
      orgId: 10,
      subjectType: "SERVICE",
      serviceId: 77,
      startAtISO: "2026-03-01T10:00:00+01:00",
      durationMinutes: 60,
      professionalId: 15,
      resourceIds: [7, 11],
    };
    const inputUtc = {
      ...inputOffset,
      startAtISO: "2026-03-01T09:00:00.000Z",
    };

    const seedOffset = buildHoldSubjectFingerprintSeed(inputOffset);
    const seedUtc = buildHoldSubjectFingerprintSeed(inputUtc);

    expect(seedOffset).toContain("start:2026-03-01T09:00:00.000Z");
    expect(seedOffset).toBe(seedUtc);
    expect(buildHoldSubjectFingerprint(inputOffset)).toBe(
      buildHoldSubjectFingerprint(inputUtc),
    );
  });

  it("produz sha256 hex com o seed canónico", () => {
    const input = {
      orgId: 42,
      subjectType: "EVENT",
      eventId: 501,
      startAtISO: "2026-05-01T16:30:00Z",
      durationMinutes: 90,
      professionalId: null,
      resourceIds: [3, 1],
    };
    const seed = buildHoldSubjectFingerprintSeed(input);
    const expected = createHash("sha256").update(seed).digest("hex");

    expect(buildHoldSubjectFingerprint(input)).toBe(expected);
  });
});
