import { OrganizationCategory, LiveHubMode } from "@prisma/client";

export type LiveHubModule =
  | "HERO"
  | "VIDEO"
  | "NOW_PLAYING"
  | "BRACKET"
  | "RESULTS"
  | "NEXT_MATCHES"
  | "CHAMPION"
  | "SUMMARY"
  | "UPDATES"
  | "CTA"
  | "SPONSORS";

export type LiveHubViewerRole = "PUBLIC" | "PARTICIPANT" | "ORGANIZER";

const DEFAULT_MODULES: Record<OrganizationCategory, LiveHubModule[]> = {
  PADEL: ["HERO", "VIDEO", "NEXT_MATCHES", "RESULTS", "BRACKET"],
  EVENTOS: ["HERO", "VIDEO", "NOW_PLAYING", "NEXT_MATCHES", "RESULTS", "BRACKET", "SPONSORS"],
  VOLUNTARIADO: ["HERO", "SUMMARY", "CTA"],
};

const PREMIUM_MODULES: Record<OrganizationCategory, LiveHubModule[]> = {
  PADEL: ["HERO", "VIDEO", "NEXT_MATCHES", "RESULTS", "BRACKET"],
  EVENTOS: ["HERO", "VIDEO", "NOW_PLAYING", "NEXT_MATCHES", "RESULTS", "BRACKET", "SPONSORS"],
  VOLUNTARIADO: ["HERO", "SUMMARY", "CTA"],
};

export function resolveLiveHubModules(params: {
  category: OrganizationCategory;
  mode: LiveHubMode;
  premiumActive: boolean;
}) {
  const { category, mode, premiumActive } = params;
  const usePremium = mode === "PREMIUM" && premiumActive;
  return usePremium ? PREMIUM_MODULES[category] : DEFAULT_MODULES[category];
}

export function normalizeLiveHubMode(mode: LiveHubMode | null | undefined) {
  return mode === "PREMIUM" ? "PREMIUM" : "DEFAULT";
}
