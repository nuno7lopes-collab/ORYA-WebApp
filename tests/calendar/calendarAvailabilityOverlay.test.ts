import { describe, expect, it } from "vitest";
import {
  resolveAvailabilityOverlayHint,
  resolveAvailabilityOverlayState,
} from "@/app/org/[orgId]/calendar/_components/availabilityOverlayMode";

describe("calendar availability overlay", () => {
  it("usa disponibilidade geral por defeito quando não existe query param", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: false,
    });
    expect(state.showAvailabilityOverlay).toBe(true);
    expect(state.overlayMode).toBe("general");
    expect(state.renderAvailabilityOverlay).toBe(true);
  });

  it("usa disponibilidade por escopo com seleção única", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: true,
    });
    expect(state.overlayMode).toBe("scope");
    expect(resolveAvailabilityOverlayHint({ overlayMode: state.overlayMode, hasActiveSelection: true })).toContain(
      "escopo selecionado",
    );
  });

  it("mantém geral com múltiplos escopos e hint explícito", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: null,
      hasSingleScopeSelection: false,
    });
    expect(state.overlayMode).toBe("general");
    expect(resolveAvailabilityOverlayHint({ overlayMode: state.overlayMode, hasActiveSelection: true })).toContain(
      "Múltiplos escopos",
    );
  });

  it("desativa overlay com showAvailabilityOverlay=0", () => {
    const state = resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: "0",
      hasSingleScopeSelection: true,
    });
    expect(state.showAvailabilityOverlay).toBe(false);
    expect(state.overlayMode).toBe("none");
    expect(state.renderAvailabilityOverlay).toBe(false);
  });
});

