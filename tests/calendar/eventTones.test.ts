import { describe, expect, it } from "vitest";
import {
  resolveAggregateItemsToneClass,
  resolveAggregateToneBucket,
  resolveEventToneClass,
} from "@/app/org/[orgId]/calendar/_components/eventTones";

describe("calendar event tones", () => {
  it("prioritiza confirmado em agregados mistos", () => {
    expect(resolveAggregateToneBucket(["CANCELLED_BY_ORG", "CONFIRMED"])).toBe("confirmed");
    const toneClass = resolveAggregateItemsToneClass([
      { kind: "RESERVATION", status: "CANCELLED_BY_ORG" },
      { kind: "RESERVATION", status: "CONFIRMED" },
    ]);
    expect(toneClass).toContain("border-sky");
  });

  it("usa tom cancelado quando todos os itens estao cancelados", () => {
    expect(resolveAggregateToneBucket(["CANCELLED_BY_ORG", "NO_SHOW"])).toBe("cancelled");
    const toneClass = resolveAggregateItemsToneClass([
      { kind: "RESERVATION", status: "CANCELLED_BY_ORG" },
      { kind: "RESERVATION", status: "NO_SHOW" },
    ]);
    expect(toneClass).toContain("border-rose");
  });

  it("usa tom pendente sem confirmados", () => {
    expect(resolveAggregateToneBucket(["PENDING", "PENDING_CONFIRMATION"])).toBe("pending");
    const toneClass = resolveEventToneClass({ kind: "RESERVATION", status: "PENDING_CONFIRMATION" });
    expect(toneClass).toContain("border-amber");
  });
});
