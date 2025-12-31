import { OrganizationCategory } from "@prisma/client";

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
export type LiveHubMode = "DEFAULT" | "PREMIUM";

const EVENT_MODULES: LiveHubModule[] = [
  "HERO",
  "VIDEO",
  "NOW_PLAYING",
  "NEXT_MATCHES",
  "RESULTS",
  "BRACKET",
  "SPONSORS",
];

const DEFAULT_MODULES: Record<OrganizationCategory, LiveHubModule[]> = {
  PADEL: ["HERO", "VIDEO", "NEXT_MATCHES", "RESULTS", "BRACKET"],
  EVENTOS: EVENT_MODULES,
  RESERVAS: EVENT_MODULES,
  CLUBS: EVENT_MODULES,
};

const PREMIUM_MODULES: Partial<Record<OrganizationCategory, LiveHubModule[]>> = {};

export function resolveLiveHubModules(params: {
  category: OrganizationCategory;
  mode: LiveHubMode;
  premiumActive: boolean;
}) {
  const { category, mode, premiumActive } = params;
  const usePremium = mode === "PREMIUM" && premiumActive;
  if (usePremium) {
    return PREMIUM_MODULES[category] ?? DEFAULT_MODULES[category];
  }
  return DEFAULT_MODULES[category];
}
