import {
  formatBookingDateTime,
  resolveBookingOrganization,
  resolveBookingTitle,
  resolveFirstName,
  resolveGreetingPeriod,
  resolveRelativeDayMeta,
} from "../features/home/formatters";

describe("home formatters", () => {
  it("resolveFirstName devolve o primeiro nome limpo", () => {
    expect(resolveFirstName("  Maria Silva  ")).toBe("Maria");
    expect(resolveFirstName("")).toBeNull();
    expect(resolveFirstName(null)).toBeNull();
  });

  it("resolveGreetingPeriod calcula período do dia", () => {
    expect(resolveGreetingPeriod(new Date("2026-03-05T09:00:00.000Z"))).toBe("morning");
    expect(resolveGreetingPeriod(new Date("2026-03-05T15:00:00.000Z"))).toBe("afternoon");
    expect(resolveGreetingPeriod(new Date("2026-03-05T22:00:00.000Z"))).toBe("evening");
  });

  it("resolveRelativeDayMeta devolve today/tomorrow/inDays", () => {
    const now = new Date("2026-03-05T10:00:00.000Z");
    expect(resolveRelativeDayMeta("2026-03-05T15:30:00.000Z", now)).toEqual({ kind: "today" });
    expect(resolveRelativeDayMeta("2026-03-06T09:00:00.000Z", now)).toEqual({ kind: "tomorrow" });
    expect(resolveRelativeDayMeta("2026-03-08T09:00:00.000Z", now)).toEqual({
      kind: "inDays",
      count: 3,
    });
  });

  it("resolveBookingTitle e resolveBookingOrganization aplicam fallback null", () => {
    expect(
      resolveBookingTitle({
        service: { id: 1, title: "Aula Técnica" },
      } as never),
    ).toBe("Aula Técnica");
    expect(resolveBookingTitle({ service: null } as never)).toBeNull();

    expect(
      resolveBookingOrganization({
        organization: { publicName: "ORYA Club" },
      } as never),
    ).toBe("ORYA Club");
    expect(resolveBookingOrganization({ organization: null } as never)).toBeNull();
  });

  it("formatBookingDateTime devolve null para datas inválidas", () => {
    expect(formatBookingDateTime("not-a-date")).toBeNull();
    expect(formatBookingDateTime(null)).toBeNull();
  });
});
