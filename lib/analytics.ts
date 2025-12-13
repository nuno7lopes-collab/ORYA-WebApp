export type AnalyticsPayload = Record<string, any>;

export function trackEvent(name: string, payload?: AnalyticsPayload) {
  if (!name) return;
  // Por agora, apenas console.log; preparado para PostHog/Amplitude/GA.
  // Mantém formato consistente para fácil troca futura.
   
  console.log("[trackEvent]", name, payload ?? {});
}
