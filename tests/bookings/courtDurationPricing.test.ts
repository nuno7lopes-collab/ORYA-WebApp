import { describe, expect, it } from "vitest";
import {
  buildDefaultCourtDurationPrices,
  normalizeCourtDurationPricePayload,
} from "@/lib/reservas/serviceDurationPrices";

describe("court duration pricing", () => {
  it("gera catálogo completo proporcional a partir da duração/preço base", () => {
    const rows = buildDefaultCourtDurationPrices({
      baseDurationMinutes: 60,
      basePriceCents: 2400,
    });

    expect(rows).toEqual([
      { durationMinutes: 30, priceCents: 1200, isActive: true },
      { durationMinutes: 60, priceCents: 2400, isActive: true },
      { durationMinutes: 90, priceCents: 3600, isActive: true },
      { durationMinutes: 120, priceCents: 4800, isActive: true },
    ]);
  });

  it("normaliza payload válido e recusa duplicados/fora de catálogo", () => {
    const valid = normalizeCourtDurationPricePayload([
      { durationMinutes: 60, priceCents: 2400, isActive: true },
      { durationMinutes: 30, priceCents: 1200, isActive: true },
    ]);
    expect(valid).toEqual([
      { durationMinutes: 30, priceCents: 1200, isActive: true },
      { durationMinutes: 60, priceCents: 2400, isActive: true },
    ]);

    expect(
      normalizeCourtDurationPricePayload([
        { durationMinutes: 60, priceCents: 2400 },
        { durationMinutes: 60, priceCents: 2500 },
      ]),
    ).toBeNull();

    expect(
      normalizeCourtDurationPricePayload([
        { durationMinutes: 75, priceCents: 3000 },
      ]),
    ).toBeNull();
  });
});
