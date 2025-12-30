export function isFlagEnabled(name: string): boolean {
  // Flags estão todos ativos por padrão; ficheiro mantém API para evitar refactors grandes.
  return true;
}

export const featureFlags = {
  NEW_NAVBAR: () => true,
  NEW_EXPLORE_FILTERS: () => true,
  NEW_STRIPE_CONNECT_FLOW: () => true,
  NOTIFICATIONS_V1: () => true,
};
