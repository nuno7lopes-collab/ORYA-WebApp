import { describe, expect, it } from "vitest";
import {
  buildPadelExternalId,
  validatePadelInteractionMetadata,
} from "@/lib/crm/padelEventContract";

describe("padelEventContract", () => {
  it("gera externalId idempotente por participante para jogos", () => {
    const externalId = buildPadelExternalId(
      "PADEL_MATCH_WIN",
      "EVENT",
      321,
      "contact_77",
      "OFFICIAL:v3",
    );
    expect(externalId).toBe("padel-match:321:contact_77:PADEL_MATCH_WIN:official:v3");
  });

  it("valida metadata mínima para booking", () => {
    const result = validatePadelInteractionMetadata("PADEL_BOOKING_CONFIRMED", {
      bookingId: 1,
      serviceId: 2,
      timeslot: "2026-03-03T18:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("deteta metadata em falta para match", () => {
    const result = validatePadelInteractionMetadata("PADEL_MATCH_PLAYED", {
      matchId: 10,
      eventId: 20,
      resultType: "NORMAL",
      winnerSide: "A",
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["categoryId", "participantIds"]);
  });
});
