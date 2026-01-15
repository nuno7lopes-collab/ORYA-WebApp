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

export type LiveHubViewerRole = "PUBLIC" | "PARTICIPANT" | "ORGANIZATION";

const EVENT_MODULES: LiveHubModule[] = [
  "HERO",
  "VIDEO",
  "NOW_PLAYING",
  "NEXT_MATCHES",
  "RESULTS",
  "BRACKET",
  "SPONSORS",
];

const PADEL_MODULES: LiveHubModule[] = ["HERO", "VIDEO", "NEXT_MATCHES", "RESULTS", "BRACKET"];

export function resolveLiveHubModules(input: { templateType?: string | null; primaryModule?: string | null } = {}) {
  const templateType = typeof input.templateType === "string" ? input.templateType.trim().toUpperCase() : null;
  const primaryModule = typeof input.primaryModule === "string" ? input.primaryModule.trim().toUpperCase() : null;
  if (templateType === "PADEL" || primaryModule === "TORNEIOS") {
    return PADEL_MODULES;
  }
  return EVENT_MODULES;
}
