import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  AGENDA_SOURCE_TYPE_ALLOWLIST,
  FINANCE_SOURCE_TYPE_ALLOWLIST,
  assertSourceRef,
  normalizeAgendaSourceType,
  normalizeFinanceSourceType,
  normalizeSourceRef,
  normalizeSourceType,
} from "@/domain/sourceType";

describe("sourceType allowlists", () => {
  it("finance allowlist segue SSOT (D7)", () => {
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.TICKET_ORDER)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.BOOKING)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.PADEL_REGISTRATION)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.STORE_ORDER)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.SUBSCRIPTION)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.MEMBERSHIP)).toBe(true);
    expect(FINANCE_SOURCE_TYPE_ALLOWLIST.has(SourceType.EVENT)).toBe(false);
  });

  it("agenda allowlist cobre agenda/check-in", () => {
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.EVENT)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.TOURNAMENT)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.MATCH)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.BOOKING)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.CLASS_SESSION)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.SOFT_BLOCK)).toBe(true);
    expect(AGENDA_SOURCE_TYPE_ALLOWLIST.has(SourceType.HARD_BLOCK)).toBe(true);
  });
});

describe("normalize sourceType", () => {
  it("aceita apenas valores canónicos no finance scope", () => {
    expect(normalizeFinanceSourceType("BOOKING")).toBe(SourceType.BOOKING);
    expect(normalizeSourceType("BOOKING")).toBe(SourceType.BOOKING);
  });

  it("rejeita legados e tipos fora do scope", () => {
    expect(normalizeFinanceSourceType("reservation")).toBeNull();
    expect(normalizeFinanceSourceType("EVENT")).toBeNull();
    expect(normalizeAgendaSourceType("BOOKING")).toBe(SourceType.BOOKING);
    expect(normalizeAgendaSourceType("CLASS_SESSION")).toBe(SourceType.CLASS_SESSION);
  });
});

describe("sourceRef", () => {
  it("assertSourceRef valida type+id", () => {
    const id = "ord-1";
    const ref = assertSourceRef({ sourceType: SourceType.TICKET_ORDER, sourceId: id });
    expect(ref).toEqual({ sourceType: SourceType.TICKET_ORDER, sourceId: id });
  });

  it("assertSourceRef falha sem sourceId", () => {
    expect(() => assertSourceRef({ sourceType: SourceType.TICKET_ORDER, sourceId: null })).toThrow("SOURCE_ID_INVALID");
  });

  it("normalizeSourceRef devolve null se incompleto", () => {
    expect(normalizeSourceRef({ sourceType: SourceType.TICKET_ORDER, sourceId: null })).toBeNull();
  });
});
