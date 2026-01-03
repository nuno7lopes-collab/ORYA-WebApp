import type { LiveHubModule } from "@/lib/liveHubConfig";

type OrganizationRef = {
  id?: number | null;
  username?: string | null;
  // Gerido por subscrição (SaaS), não editar manualmente na UI.
  liveHubPremiumEnabled?: boolean | null;
};

type OrganizationPremiumModules = {
  inscricoes?: boolean;
};

type LiveHubMatchOrder = "ONEVONE";

type OrganizationPremiumConfig = {
  key: "ONEVONE";
  organizationId: number;
  username: string;
  liveHubModules?: LiveHubModule[];
  profileModules?: OrganizationPremiumModules;
  liveHubMatchOrder?: LiveHubMatchOrder;
};

const CUSTOM_PREMIUM_CONFIGS: OrganizationPremiumConfig[] = [
  {
    key: "ONEVONE",
    organizationId: 23,
    username: "onevone",
    liveHubModules: ["HERO", "VIDEO", "NOW_PLAYING", "NEXT_MATCHES", "RESULTS", "BRACKET", "SPONSORS"],
    profileModules: { inscricoes: true },
    liveHubMatchOrder: "ONEVONE",
  },
];

const normalizeUsername = (value?: string | null) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export function getCustomPremiumConfig(organization?: OrganizationRef | null) {
  if (!organization) return null;
  const normalizedUsername = normalizeUsername(organization.username);
  return (
    CUSTOM_PREMIUM_CONFIGS.find(
      (config) =>
        (config.organizationId && organization.id === config.organizationId) ||
        (normalizedUsername && config.username === normalizedUsername),
    ) ?? null
  );
}

export function isCustomPremiumOrganization(organization?: OrganizationRef | null) {
  return Boolean(getCustomPremiumConfig(organization));
}

export function isCustomPremiumActive(organization?: OrganizationRef | null, premiumEnabled?: boolean | null) {
  const config = getCustomPremiumConfig(organization);
  if (!config) return false;
  const enabled = premiumEnabled ?? organization?.liveHubPremiumEnabled ?? false;
  return Boolean(enabled);
}

export function getCustomPremiumKey(organization?: OrganizationRef | null) {
  return getCustomPremiumConfig(organization)?.key ?? null;
}

export function getCustomLiveHubModules(organization?: OrganizationRef | null) {
  return getCustomPremiumConfig(organization)?.liveHubModules ?? null;
}

export function getCustomPremiumProfileModules(organization?: OrganizationRef | null) {
  return getCustomPremiumConfig(organization)?.profileModules ?? null;
}

export function getCustomLiveHubMatchOrder(organization?: OrganizationRef | null) {
  return getCustomPremiumConfig(organization)?.liveHubMatchOrder ?? null;
}
