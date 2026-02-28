import { describe, expect, it } from "vitest";
import {
  buildEventClaimCandidatesForProfessional,
  buildEventClaimCandidatesForResource,
  buildEventClaimConflictBlocks,
  type EventClaimBlock,
} from "@/lib/reservas/eventClaims";

describe("event claim helpers", () => {
  const claims: EventClaimBlock[] = [
    {
      sourceId: "evt-1",
      startsAt: new Date("2026-03-10T10:00:00.000Z"),
      endsAt: new Date("2026-03-10T11:00:00.000Z"),
      professionalId: 7,
      resourceId: null,
      courtId: null,
    },
    {
      sourceId: "evt-2",
      startsAt: new Date("2026-03-10T10:00:00.000Z"),
      endsAt: new Date("2026-03-10T11:00:00.000Z"),
      professionalId: null,
      resourceId: 20,
      courtId: null,
    },
    {
      sourceId: "evt-3",
      startsAt: new Date("2026-03-10T10:00:00.000Z"),
      endsAt: new Date("2026-03-10T11:00:00.000Z"),
      professionalId: null,
      resourceId: null,
      courtId: 30,
    },
  ];

  it("mapeia claims para blocos de conflito de profissional/recurso", () => {
    const blocks = buildEventClaimConflictBlocks({
      claims,
      courtToResourceIds: new Map([[30, [99]]]),
    });

    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ professionalId: 7, resourceId: null }),
        expect.objectContaining({ professionalId: null, resourceId: 20 }),
        expect.objectContaining({ professionalId: null, resourceId: 99 }),
      ]),
    );
  });

  it("gera candidates por profissional e por recurso/court", () => {
    const professionalCandidates = buildEventClaimCandidatesForProfessional({
      claims,
      professionalId: 7,
    });
    const resourceCandidates = buildEventClaimCandidatesForResource({
      claims,
      resourceId: 20,
    });
    const courtCandidates = buildEventClaimCandidatesForResource({
      claims,
      resourceId: null,
      courtId: 30,
    });

    expect(professionalCandidates).toHaveLength(1);
    expect(professionalCandidates[0]?.type).toBe("MATCH");
    expect(resourceCandidates).toHaveLength(1);
    expect(resourceCandidates[0]?.sourceId).toContain("evt-2");
    expect(courtCandidates).toHaveLength(1);
    expect(courtCandidates[0]?.sourceId).toContain("evt-3");
  });
});
