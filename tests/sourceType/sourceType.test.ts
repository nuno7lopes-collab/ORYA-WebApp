import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import { assertSourceRef, normalizeSourceRef, normalizeSourceType, SOURCE_TYPE_ALLOWLIST } from "@/domain/sourceType";

describe("sourceType allowlist", () => {
  it("inclui allowlist v8", () => {
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.TICKET_ORDER)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.BOOKING)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.PADEL_REGISTRATION)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.STORE_ORDER)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.SUBSCRIPTION)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.MEMBERSHIP)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.EVENT)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.TOURNAMENT)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.MATCH)).toBe(true);
    expect(SOURCE_TYPE_ALLOWLIST.has(SourceType.LOYALTY_TX)).toBe(true);
  });

  it("normaliza legados (RESERVATION -> BOOKING)", () => {
    expect(normalizeSourceType("reservation")).toBe(SourceType.BOOKING);
  });

  it("rejeita sourceType inválido", () => {
    expect(normalizeSourceType("INVALID")).toBeNull();
  });
});

describe("sourceRef", () => {
  it("assertSourceRef valida type+id", () => {
    const eventId = "evt-1";
    const ref = assertSourceRef({ sourceType: SourceType.EVENT, sourceId: eventId });
    expect(ref).toEqual({ sourceType: SourceType.EVENT, sourceId: eventId });
  });

  it("assertSourceRef falha sem sourceId", () => {
    expect(() => assertSourceRef({ sourceType: SourceType.EVENT, sourceId: null })).toThrow("SOURCE_ID_INVALID");
  });

  it("normalizeSourceRef devolve null se incompleto", () => {
    expect(normalizeSourceRef({ sourceType: SourceType.EVENT, sourceId: null })).toBeNull();
  });
});
