export type AvailabilityOverlayMode = "none" | "scope";

export function resolveAvailabilityOverlayState(input: {
  showAvailabilityOverlayParam: string | null;
  hasSingleScopeSelection: boolean;
}) {
  const showAvailabilityOverlay =
    input.showAvailabilityOverlayParam === "1"
      ? true
      : input.showAvailabilityOverlayParam === "0"
        ? false
        : true;
  const overlayMode: AvailabilityOverlayMode = !showAvailabilityOverlay
    ? "none"
    : input.hasSingleScopeSelection
      ? "scope"
      : "none";

  return {
    showAvailabilityOverlay,
    overlayMode,
    renderAvailabilityOverlay: overlayMode !== "none",
  };
}

export function resolveAvailabilityOverlayHint(input: {
  overlayMode: AvailabilityOverlayMode;
  hasActiveSelection: boolean;
  showAvailabilityOverlay: boolean;
}) {
  if (input.overlayMode === "scope") {
    return "Disponibilidade do escopo selecionado.";
  }
  if (!input.showAvailabilityOverlay) {
    return "Sobreposição de disponibilidade desligada.";
  }
  if (input.hasActiveSelection) {
    return "Seleciona apenas 1 treinador ou 1 campo para ver indisponibilidade.";
  }
  return null;
}
