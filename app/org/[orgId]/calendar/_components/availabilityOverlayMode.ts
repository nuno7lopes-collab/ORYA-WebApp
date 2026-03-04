export type AvailabilityOverlayMode = "none" | "general" | "scope";

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
      : "general";

  return {
    showAvailabilityOverlay,
    overlayMode,
    renderAvailabilityOverlay: overlayMode !== "none",
  };
}

export function resolveAvailabilityOverlayHint(input: {
  overlayMode: AvailabilityOverlayMode;
  hasActiveSelection: boolean;
}) {
  if (input.overlayMode === "scope") {
    return "Disponibilidade do escopo selecionado.";
  }
  if (input.overlayMode === "general") {
    return input.hasActiveSelection
      ? "Múltiplos escopos ativos: a sobreposição mostra disponibilidade geral."
      : "Disponibilidade geral ativa.";
  }
  return "Sobreposição de disponibilidade desligada.";
}

