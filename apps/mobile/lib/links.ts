import { getMobileEnv } from "./env";

export type ResolvedMobileLink =
  | { kind: "native"; path: string }
  | { kind: "web"; url: string }
  | { kind: "none" };

export type ResolveMobileLinkOptions = {
  source?: string;
  allowWeb?: boolean;
};

// Exceções raras que podem abrir no webview.
// Adiciona aqui apenas o que for estritamente necessário.
const WEB_ALLOWED_PATHS = new Set<string>([]);
const WEB_ALLOWED_PREFIXES: string[] = ["/organizacao"];

const normalizeInput = (input?: string | null) => {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeParseUrl = (input: string) => {
  const base = getMobileEnv().apiBaseUrl || "https://www.orya.pt";
  try {
    return new URL(input, base);
  } catch {
    return null;
  }
};

const stripTrailingSlash = (value: string) => {
  if (!value) return value;
  const stripped = value.replace(/\/+$/, "");
  return stripped || "/";
};

const appendSourceParam = (path: string, search: string, source?: string) => {
  if (!source) return `${path}${search}`;
  if (search) {
    if (search.includes("source=")) return `${path}${search}`;
    return `${path}${search}&source=${encodeURIComponent(source)}`;
  }
  return `${path}?source=${encodeURIComponent(source)}`;
};

const buildNative = (path: string, search: string, source?: string): ResolvedMobileLink => ({
  kind: "native",
  path: appendSourceParam(path, search, source),
});

export const resolveMobileLink = (
  input?: string | null,
  options: ResolveMobileLinkOptions = {},
): ResolvedMobileLink => {
  const value = normalizeInput(input);
  if (!value) return { kind: "none" };

  const url = safeParseUrl(value);
  if (!url) return { kind: "none" };

  const path = stripTrailingSlash(url.pathname || "/");
  const search = url.search || "";
  const parts = path.split("/").filter(Boolean);
  const source = options.source;

  if (parts[0] === "eventos" && parts[1]) {
    return buildNative(`/event/${parts[1]}`, search, source);
  }
  if (parts[0] === "event" && parts[1]) {
    return buildNative(`/event/${parts[1]}`, search, source);
  }
  if (path === "/eventos") {
    return buildNative("/(tabs)/index", "", source);
  }
  if (path.startsWith("/messages")) {
    return buildNative(path, search, source);
  }
  if (path.startsWith("/wallet/")) {
    return buildNative(path, search, source);
  }
  if (path === "/me") {
    return buildNative("/profile", "", source);
  }
  if (path === "/profile") {
    return buildNative("/profile", "", source);
  }
  if (path === "/network" || path === "/notifications" || path === "/tickets") {
    return buildNative(path, search, source);
  }
  if (path === "/me/bilhetes") {
    return buildNative("/tickets", "", source);
  }
  if (path === "/me/carteira" || path === "/me/inscricoes") {
    return buildNative("/tickets", "", source);
  }
  if (parts[0] === "me" && parts[1] === "bilhetes" && parts[2]) {
    return buildNative(`/wallet/${parts[2]}`, "", source);
  }
  if (path === "/convites/organizacoes") {
    return buildNative(path, search, source);
  }
  if (path === "/social") {
    const tab = url.searchParams.get("tab");
    if (tab === "notifications") {
      return buildNative("/notifications", "", source);
    }
  }
  if (path === "/organizacao/chat") {
    const conversationId = url.searchParams.get("conversationId");
    if (conversationId) {
      return buildNative(`/messages/${conversationId}`, "", source);
    }
    return buildNative("/messages", "", source);
  }

  const reserved = new Set([
    "eventos",
    "event",
    "messages",
    "wallet",
    "me",
    "profile",
    "network",
    "notifications",
    "tickets",
    "social",
    "convites",
    "organizacao",
    "auth",
    "map",
    "search",
    "agora",
    "index",
    "servicos",
    "service",
    "chat",
    "api",
  ]);
  if (parts.length === 1 && parts[0] && !reserved.has(parts[0])) {
    return buildNative(`/${parts[0]}`, search, source);
  }

  const allowWeb = options.allowWeb !== false;
  const allowWebMatch =
    WEB_ALLOWED_PATHS.has(path) || WEB_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (allowWeb && allowWebMatch) {
    return { kind: "web", url: url.toString() };
  }

  return { kind: "none" };
};
