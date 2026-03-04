import { describe, expect, it } from "vitest";
import { resolveAggregateToneBucket } from "@/app/org/[orgId]/calendar/_components/eventTones";

describe("event tones", () => {
  it("não marca agregado como cancelado quando existe confirmado", () => {
    expect(resolveAggregateToneBucket(["CANCELLED_BY_ORG", "CONFIRMED"])).toBe("confirmed");
  });

  it("usa cancelado apenas quando todos os estados são cancelados/no-show", () => {
    expect(resolveAggregateToneBucket(["CANCELLED_BY_ORG", "NO_SHOW"])).toBe("cancelled");
  });

  it("usa pendente quando não existe confirmado", () => {
    expect(resolveAggregateToneBucket(["PENDING", "CANCELLED_BY_ORG"])).toBe("pending");
  });

  it("fallback neutro para mistura sem confirmado/pendente/disputa", () => {
    expect(resolveAggregateToneBucket(["CANCELLED_BY_ORG", "UNKNOWN_STATUS"])).toBe("other");
  });
});

