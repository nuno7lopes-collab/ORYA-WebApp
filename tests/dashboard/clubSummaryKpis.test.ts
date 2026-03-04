import { describe, expect, it } from "vitest";
import {
  buildOrganizationOccupancyMap,
  computeDeltaRate,
  computeOccupancyCoverage,
  computeOrganizationOccupancyCoverage,
  computeOrganizationOccupancyRate,
  computePadelCapacity,
  computePlatformAverageOccupancyRate,
  parsePadelMaxEntriesTotal,
} from "@/domain/dashboard/clubSummaryKpis";

describe("clubSummaryKpis", () => {
  it("parsePadelMaxEntriesTotal normaliza valores válidos", () => {
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: 16 })).toBe(16);
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: "12" })).toBe(12);
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: 9.9 })).toBe(9);
  });

  it("parsePadelMaxEntriesTotal ignora payload inválido", () => {
    expect(parsePadelMaxEntriesTotal(null)).toBeNull();
    expect(parsePadelMaxEntriesTotal({})).toBeNull();
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: 0 })).toBeNull();
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: -3 })).toBeNull();
    expect(parsePadelMaxEntriesTotal({ maxEntriesTotal: "abc" })).toBeNull();
  });

  it("computePadelCapacity usa maxEntriesTotal como prioridade", () => {
    expect(computePadelCapacity({ maxEntriesTotal: 24, categoryCapacities: [8, 8] })).toBe(24);
  });

  it("computePadelCapacity soma categorias quando todas têm capacidade", () => {
    expect(computePadelCapacity({ maxEntriesTotal: null, categoryCapacities: [8, 4, 2] })).toBe(14);
  });

  it("computePadelCapacity devolve null quando há categorias sem capacidade", () => {
    expect(computePadelCapacity({ maxEntriesTotal: null, categoryCapacities: [8, null, 4] })).toBeNull();
    expect(computePadelCapacity({ maxEntriesTotal: null, categoryCapacities: [] })).toBeNull();
  });

  it("agrega ocupação por organização e calcula taxa de clube", () => {
    const map = buildOrganizationOccupancyMap([
      { organizationId: 10, sold: 20, capacity: 40 },
      { organizationId: 10, sold: 10, capacity: 20 },
      { organizationId: 11, sold: 6, capacity: 10 },
      { organizationId: 12, sold: 5, capacity: null },
    ]);
    const club = computeOrganizationOccupancyRate(map, 10);
    expect(club.capacity).toBe(60);
    expect(club.sold).toBe(30);
    expect(club.eventsCount).toBe(2);
    expect(club.rate).toBeCloseTo(0.5, 5);
  });

  it("calcula média da plataforma por média das organizações com capacidade", () => {
    const map = buildOrganizationOccupancyMap([
      { organizationId: 10, sold: 30, capacity: 60 }, // 0.5
      { organizationId: 11, sold: 8, capacity: 10 }, // 0.8
      { organizationId: 12, sold: 0, capacity: 0 }, // ignorado
    ]);
    const platform = computePlatformAverageOccupancyRate(map);
    expect(platform.organizations).toBe(2);
    expect(platform.rate).toBeCloseTo(0.65, 5);
  });

  it("calcula delta entre clube e plataforma com sinal", () => {
    expect(computeDeltaRate(0.72, 0.65)).toBeCloseTo(0.07, 5);
    expect(computeDeltaRate(0.52, 0.65)).toBeCloseTo(-0.13, 5);
    expect(computeDeltaRate(null, 0.65)).toBeNull();
  });

  it("mede cobertura de lotação no conjunto de torneios", () => {
    const coverage = computeOccupancyCoverage([
      { capacity: 16 },
      { capacity: null },
      { capacity: 12 },
      { capacity: 0 },
    ]);
    expect(coverage.totalEvents).toBe(4);
    expect(coverage.eventsWithCapacity).toBe(2);
    expect(coverage.coverageRate).toBeCloseTo(0.5, 5);
  });

  it("mede cobertura de lotação por organização", () => {
    const coverage = computeOrganizationOccupancyCoverage(
      [
        { organizationId: 10, capacity: 16 },
        { organizationId: 10, capacity: null },
        { organizationId: 11, capacity: 8 },
      ],
      10,
    );
    expect(coverage.totalEvents).toBe(2);
    expect(coverage.eventsWithCapacity).toBe(1);
    expect(coverage.coverageRate).toBeCloseTo(0.5, 5);
  });
});
