import { describe, expect, it } from "vitest";
import { buildContactWhereFromRule, extractInteractionRule } from "@/lib/crm/segments";

describe("segment rules padel fields", () => {
  it("suporta filtros numéricos avançados de padel", () => {
    const where = buildContactWhereFromRule({
      kind: "rule",
      id: "r1",
      field: "padel.churnRiskScore",
      op: "gte",
      value: 60,
    });
    expect(where).toEqual({
      padelProfile: { is: { churnRiskScore: { gte: 60 } } },
    });
  });

  it("suporta filtros string de estado/tier padel", () => {
    const where = buildContactWhereFromRule({
      kind: "rule",
      id: "r2",
      field: "padel.activityStatus",
      op: "eq",
      value: "ACTIVE",
    });
    expect(where).toEqual({
      padelProfile: { is: { activityStatus: { equals: "ACTIVE", mode: "insensitive" } } },
    });
  });

  it("suporta filtros de data para último jogo", () => {
    const where = buildContactWhereFromRule({
      kind: "rule",
      id: "r3",
      field: "padel.lastMatchAt",
      op: "after",
      value: "30d",
    });
    expect(where).toEqual({
      padelProfile: { is: { lastMatchAt: { gte: expect.any(Date) } } },
    });
  });

  it("suporta filtros numéricos de ADN padel (off-peak e sessões)", () => {
    const where = buildContactWhereFromRule({
      kind: "rule",
      id: "r4",
      field: "padel.offPeakRatio30d",
      op: "lte",
      value: 0.4,
    });
    expect(where).toEqual({
      padelProfile: { is: { offPeakRatio30d: { lte: 0.4 } } },
    });
  });

  it("ignora tipos de interação legacy em regras interactionType", () => {
    const interactionRule = extractInteractionRule({
      kind: "rule",
      id: "r5",
      field: "interactionType",
      op: "in",
      value: ["PADEL_MATCH_PLAYED", "BOOKING_CONFIRMED", "EVENT_CHECKIN"],
    });
    expect(interactionRule?.types).toEqual(["PADEL_MATCH_PLAYED"]);
  });
});
