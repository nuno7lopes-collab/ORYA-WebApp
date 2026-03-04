export type ResolvedMobileLink =
  | { kind: "native"; path: string }
  | { kind: "web"; url: string }
  | { kind: "none" };

export type ResolveMobileLinkOptions = {
  source?: string;
  allowWeb?: boolean;
  apiBaseUrl?: string;
};

const WEB_ALLOWED_PATHS = new Set<string>([]);
const WEB_ALLOWED_PREFIXES: string[] = [];

const normalizeInput = (input?: string | null) => {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeParseUrl = (input: string, apiBaseUrl?: string) => {
  const base = apiBaseUrl || "https://www.orya.pt";
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

const mapLegacyMessagesPath = (path: string) => {
  const normalized = stripTrailingSlash(path);
  if (normalized === "/messages") return "/comunidade/mensagens";
  if (normalized === "/messages/requests") return "/comunidade/mensagens/pedidos";

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] !== "messages") return normalized;

  if (segments.length === 3 && segments[1] === "community-invite") {
    return `/comunidade/mensagens/convite/${segments[2]}`;
  }
  if (segments.length === 2) {
    return `/comunidade/mensagens/${segments[1]}`;
  }

  return "/comunidade/mensagens";
};

export const resolveMobileLink = (
  input?: string | null,
  options: ResolveMobileLinkOptions = {},
): ResolvedMobileLink => {
  const value = normalizeInput(input);
  if (!value) return { kind: "none" };

  const url = safeParseUrl(value, options.apiBaseUrl);
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
    return buildNative("/competir", "", source);
  }

  if (path === "/me") {
    return buildNative("/perfil", "", source);
  }
  if (path === "/perfil") {
    return buildNative("/perfil", "", source);
  }
  if (path === "/comunidade") {
    return buildNative("/comunidade", search, source);
  }
  if (path.startsWith("/comunidade/mensagens")) {
    return buildNative(path, search, source);
  }
  if (path.startsWith("/messages")) {
    return buildNative(mapLegacyMessagesPath(path), search, source);
  }

  if (path.startsWith("/wallet/")) {
    return buildNative(path, search, source);
  }
  if (path === "/notifications" || path === "/tickets" || path === "/reservas" || path === "/competir") {
    return buildNative(path, search, source);
  }
  if (path === "/me/bilhetes") {
    return buildNative("/tickets", "", source);
  }
  if (path === "/me/reservas") {
    return buildNative("/reservas", "", source);
  }
  if (parts[0] === "me" && parts[1] === "reservas" && parts[2]) {
    return buildNative("/reservas", `?bookingId=${encodeURIComponent(parts[2])}`, source);
  }
  if (path === "/me/carteira" || path === "/me/inscricoes") {
    return buildNative("/tickets", "", source);
  }
  if (parts[0] === "inscricoes" && parts[1]) {
    return buildNative(`/inscricoes/${parts[1]}`, search, source);
  }
  if (parts[0] === "me" && parts[1] === "inscricoes" && parts[2]) {
    return buildNative(`/inscricoes/${parts[2]}`, search, source);
  }
  if (parts[0] === "me" && parts[1] === "bilhetes" && parts[2]) {
    return buildNative(`/wallet/${parts[2]}`, "", source);
  }

  if (path === "/convites/organizacoes") {
    return buildNative(path, search, source);
  }
  if (path === "/aulas") {
    return buildNative(path, search, source);
  }

  if (path.startsWith("/store/")) {
    return buildNative(path, search, source);
  }
  if (path === "/me/compras/loja") {
    return buildNative("/store/purchases", "", source);
  }
  if (parts[0] === "me" && parts[1] === "compras" && parts[2] === "loja" && parts[3]) {
    return buildNative(`/store/purchases/${parts[3]}`, "", source);
  }
  if (parts.length >= 2 && parts[1] === "loja" && parts[0]) {
    const username = parts[0];
    if (parts.length === 2) {
      return buildNative(`/store/${username}`, search, source);
    }
    if (parts[2] === "produto" && parts[3]) {
      return buildNative(`/store/${username}/product/${parts[3]}`, search, source);
    }
    if (parts[2] === "carrinho") {
      return buildNative(`/store/${username}/cart`, search, source);
    }
    if (parts[2] === "checkout") {
      return buildNative(`/store/${username}/checkout`, search, source);
    }
    if (parts[2] === "descargas") {
      return buildNative("/store/downloads", search, source);
    }
    if (parts[2] === "sucesso") {
      return buildNative(`/store/${username}/success`, search, source);
    }
    return buildNative(`/store/${username}`, search, source);
  }

  if (path === "/social") {
    const tab = url.searchParams.get("tab");
    if (tab === "notifications") {
      return buildNative("/notifications", "", source);
    }
  }

  if (parts[0] === "org" && parts[2] === "chat") {
    const conversationId = url.searchParams.get("conversationId");
    if (conversationId) {
      return buildNative(`/comunidade/mensagens/${conversationId}`, "", source);
    }
    return buildNative("/comunidade/mensagens", "", source);
  }

  const reserved = new Set([
    "eventos",
    "event",
    "comunidade",
    "wallet",
    "me",
    "perfil",
    "notifications",
    "tickets",
    "social",
    "convites",
    "organizacao",
    "auth",
    "map",
    "search",
    "inicio",
    "competir",
    "aulas",
    "service",
    "reservas",
    "inscricoes",
    "chat",
    "api",
    "store",
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
