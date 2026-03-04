import { describe, expect, it } from "vitest";
import {
  resolveAvailabilityOverlayHint,
  resolveAvailabilityOverlayState,
} from "@/app/org/[orgId]/calendar/_components/availabilityOverlayMode";
import {
  resolveCalendarAvailabilityAuditState,
  summarizeCalendarAvailabilityAudit,
} from "@/app/org/[orgId]/calendar/_components/calendarAvailabilityAudit";

describe("calendar availability overlay", () => {
  it("mantém overlay desligado sem escopo único quando não existe query param", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: false,
    });
    expect(state.showAvailabilityOverlay).toBe(true);
    expect(state.overlayMode).toBe("none");
    expect(state.renderAvailabilityOverlay).toBe(false);
    expect(
      resolveAvailabilityOverlayHint({
        overlayMode: state.overlayMode,
        hasActiveSelection: false,
        showAvailabilityOverlay: state.showAvailabilityOverlay,
      }),
    ).toBeNull();
  });

  it("usa disponibilidade por escopo com seleção única", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: true,
    });
    expect(state.overlayMode).toBe("scope");
    expect(
      resolveAvailabilityOverlayHint({
        overlayMode: state.overlayMode,
        hasActiveSelection: true,
        showAvailabilityOverlay: state.showAvailabilityOverlay,
      }),
    ).toContain("escopo selecionado");
  });

  it("com múltiplos escopos mostra hint para afinar seleção", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: false,
    });
    expect(state.overlayMode).toBe("none");
    expect(
      resolveAvailabilityOverlayHint({
        overlayMode: state.overlayMode,
        hasActiveSelection: true,
        showAvailabilityOverlay: state.showAvailabilityOverlay,
      }),
    ).toContain("Seleciona apenas 1 treinador ou 1 campo");
  });

  it("desativa overlay com showAvailabilityOverlay=0", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: "0",
      hasSingleScopeSelection: true,
    });
    expect(state.showAvailabilityOverlay).toBe(false);
    expect(state.overlayMode).toBe("none");
    expect(state.renderAvailabilityOverlay).toBe(false);
    expect(
      resolveAvailabilityOverlayHint({
        overlayMode: state.overlayMode,
        hasActiveSelection: true,
        showAvailabilityOverlay: state.showAvailabilityOverlay,
      }),
    ).toContain("desligada");
  });

  it("classifica corretamente IN/OUTSIDE_SCOPE/OUTSIDE_GENERAL/NOT_GATED_KIND", () => {
    const baseDay = new Date("2030-01-08T10:00:00.000Z");
    const baseEnd = new Date("2030-01-08T11:00:00.000Z");
    const general = [{ startMinute: 8 * 60, endMinute: 18 * 60 }];
    const scope = [{ startMinute: 9 * 60, endMinute: 10 * 60 }];

    const inside = resolveCalendarAvailabilityAuditState({
      kind: "RESERVATION",
      startsAt: baseDay,
      endsAt: baseEnd,
      timezone: "UTC",
      generalIntervals: general,
      scopeIntervals: general,
      hasSingleScopeSelection: true,
    });
    const outsideScope = resolveCalendarAvailabilityAuditState({
      kind: "CLASS",
      startsAt: baseDay,
      endsAt: baseEnd,
      timezone: "UTC",
      generalIntervals: general,
      scopeIntervals: scope,
      hasSingleScopeSelection: true,
    });
    const outsideGeneral = resolveCalendarAvailabilityAuditState({
      kind: "RESERVATION",
      startsAt: new Date("2030-01-08T20:00:00.000Z"),
      endsAt: new Date("2030-01-08T21:00:00.000Z"),
      timezone: "UTC",
      generalIntervals: general,
      scopeIntervals: general,
      hasSingleScopeSelection: true,
    });
    const notGated = resolveCalendarAvailabilityAuditState({
      kind: "EVENT",
      startsAt: baseDay,
      endsAt: baseEnd,
      timezone: "UTC",
      generalIntervals: general,
      hasSingleScopeSelection: false,
    });

    expect(inside).toBe("IN");
    expect(outsideScope).toBe("OUTSIDE_SCOPE");
    expect(outsideGeneral).toBe("OUTSIDE_GENERAL");
    expect(notGated).toBe("NOT_GATED_KIND");

    const summary = summarizeCalendarAvailabilityAudit([inside, outsideScope, outsideGeneral, notGated]);
    expect(summary).toEqual({
      inCount: 1,
      outsideScopeCount: 1,
      outsideGeneralCount: 1,
      notGatedCount: 1,
    });
  });
});
