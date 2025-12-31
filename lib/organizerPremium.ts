import type { LiveHubModule } from "@/lib/liveHubConfig";

type OrganizerRef = {
  id?: number | null;
  username?: string | null;
  // Gerido por subscrição (SaaS), não editar manualmente na UI.
  liveHubPremiumEnabled?: boolean | null;
};

type OrganizerPremiumModules = {
  inscricoes?: boolean;
};

type LiveHubMatchOrder = "ONEVONE";

type OrganizerPremiumConfig = {
  key: "ONEVONE";
  organizerId: number;
  username: string;
  liveHubModules?: LiveHubModule[];
  profileModules?: OrganizerPremiumModules;
  liveHubMatchOrder?: LiveHubMatchOrder;
};

const CUSTOM_PREMIUM_CONFIGS: OrganizerPremiumConfig[] = [
  {
    key: "ONEVONE",
    organizerId: 23,
    username: "onevone",
    liveHubModules: ["HERO", "VIDEO", "NOW_PLAYING", "NEXT_MATCHES", "RESULTS", "BRACKET", "SPONSORS"],
    profileModules: { inscricoes: true },
    liveHubMatchOrder: "ONEVONE",
  },
];

const normalizeUsername = (value?: string | null) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export function getCustomPremiumConfig(organizer?: OrganizerRef | null) {
  if (!organizer) return null;
  const normalizedUsername = normalizeUsername(organizer.username);
  return (
    CUSTOM_PREMIUM_CONFIGS.find(
      (config) =>
        (config.organizerId && organizer.id === config.organizerId) ||
        (normalizedUsername && config.username === normalizedUsername),
    ) ?? null
  );
}

export function isCustomPremiumOrganizer(organizer?: OrganizerRef | null) {
  return Boolean(getCustomPremiumConfig(organizer));
}

export function isCustomPremiumActive(organizer?: OrganizerRef | null, premiumEnabled?: boolean | null) {
  const config = getCustomPremiumConfig(organizer);
  if (!config) return false;
  const enabled = premiumEnabled ?? organizer?.liveHubPremiumEnabled ?? false;
  return Boolean(enabled);
}

export function getCustomPremiumKey(organizer?: OrganizerRef | null) {
  return getCustomPremiumConfig(organizer)?.key ?? null;
}

export function getCustomLiveHubModules(organizer?: OrganizerRef | null) {
  return getCustomPremiumConfig(organizer)?.liveHubModules ?? null;
}

export function getCustomPremiumProfileModules(organizer?: OrganizerRef | null) {
  return getCustomPremiumConfig(organizer)?.profileModules ?? null;
}

export function getCustomLiveHubMatchOrder(organizer?: OrganizerRef | null) {
  return getCustomPremiumConfig(organizer)?.liveHubMatchOrder ?? null;
}
