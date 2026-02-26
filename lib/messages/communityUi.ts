export type CommunityAccessMode = "PUBLIC" | "FOLLOWERS" | "APPROVAL" | "INVITE";
export type CommunityTalkPolicy = "EVERYONE" | "TEAM_ONLY";

export const COMMUNITY_TALK_POLICY_OPTIONS: Array<{
  value: CommunityTalkPolicy;
  label: string;
}> = [
  { value: "EVERYONE", label: "Todos falam" },
  { value: "TEAM_ONLY", label: "Só equipa fala" },
];

export const COMMUNITY_ACCESS_MODE_OPTIONS: Array<{
  value: CommunityAccessMode;
  label: string;
}> = [
  { value: "PUBLIC", label: "Pública" },
  { value: "FOLLOWERS", label: "Seguidores" },
  { value: "APPROVAL", label: "Por aprovação" },
  { value: "INVITE", label: "Só convite" },
];

const COMMUNITY_ACCESS_MODE_LABELS = new Map(
  COMMUNITY_ACCESS_MODE_OPTIONS.map((option) => [option.value, option.label] as const),
);
const COMMUNITY_TALK_POLICY_LABELS = new Map(
  COMMUNITY_TALK_POLICY_OPTIONS.map((option) => [option.value, option.label] as const),
);

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function formatCommunityAccessModeLabel(value: unknown) {
  const normalized = normalizeToken(value);
  if (!normalized) return "Desconhecido";
  return COMMUNITY_ACCESS_MODE_LABELS.get(normalized as CommunityAccessMode) ?? normalized;
}

export function formatCommunityTalkPolicyLabel(value: unknown) {
  const normalized = normalizeToken(value);
  if (!normalized) return "Desconhecido";
  return COMMUNITY_TALK_POLICY_LABELS.get(normalized as CommunityTalkPolicy) ?? normalized;
}
