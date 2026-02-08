import { PUBLIC_ENTRIES, ROUTE_SEGMENTS } from "./reservedUsernames.generated";

const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;
const USERNAME_MAX = 15;

const PUBLIC_FILES = [
  ...PUBLIC_ENTRIES,
  "favicon.ico",
  "sitemap.xml",
  "sitemap",
  "robots",
  "security",
  "robotstxt",
  "securitytxt",
];

const SYSTEM_WORDS = [
  "admin",
  "support",
  "help",
  "ajuda",
  "suporte",
  "assistencia",
  "assistencia-tecnica",
  "assistenciatecnica",
  "about",
  "sobre",
  "about-us",
  "sobre-nos",
  "sobrenos",
  "faq",
  "faqs",
  "perguntas-frequentes",
  "perguntasfrequentes",
  "duvidas",
  "duvida",
  "contact",
  "contacto",
  "contato",
  "contactus",
  "email",
  "e-mail",
  "mail",
  "contact-us",
  "contacte-nos",
  "contactenos",
  "fale-conosco",
  "faleconosco",
  "support-center",
  "help-center",
  "helpcenter",
  "helpdesk",
  "suporte-tecnico",
  "suportetecnico",
  "atendimento",
  "atendimento-ao-cliente",
  "atendimentoaocliente",
  "centro-de-ajuda",
  "centroajuda",
  "centro-de-suporte",
  "centrosuporte",
  "suporte-cliente",
  "suportecliente",
  "suporte-ao-cliente",
  "suporteaocliente",
  "privacy",
  "privacidade",
  "policy",
  "policies",
  "politica",
  "politicas",
  "politica-privacidade",
  "politica-de-privacidade",
  "politica-cookies",
  "politica-de-cookies",
  "terms",
  "termos",
  "terms-of-service",
  "termsofservice",
  "terms-and-conditions",
  "termsandconditions",
  "termos-de-servico",
  "termos-servico",
  "termos-de-uso",
  "termos-uso",
  "condicoes",
  "condicoes-de-uso",
  "condicoes-de-servico",
  "legal",
  "juridico",
  "juridica",
  "status",
  "estado",
  "jobs",
  "job",
  "careers",
  "career",
  "carreiras",
  "carreira",
  "trabalhe-conosco",
  "trabalheconosco",
  "equipa",
  "equipe",
  "team",
  "time",
  "press",
  "imprensa",
  "media-kit",
  "mediakit",
  "blog",
  "news",
  "noticias",
  "updates",
  "novidades",
  "announcements",
  "anuncios",
  "anuncio",
  "ads",
  "advertise",
  "publicidade",
  "marketing",
  "explore",
  "discover",
  "search",
  "buscar",
  "procurar",
  "procura",
  "pesquisar",
  "pesquisa",
  "notifications",
  "notification",
  "alerta",
  "alertas",
  "notificacoes",
  "notificacao",
  "inbox",
  "caixa-de-entrada",
  "caixadeentrada",
  "messages",
  "message",
  "mensagens",
  "mensagem",
  "mensageria",
  "direct",
  "dm",
  "direto",
  "chat",
  "conversas",
  "conversa",
  "story",
  "stories",
  "historias",
  "historia",
  "reel",
  "reels",
  "rolos",
  "video",
  "videos",
  "feed",
  "timeline",
  "activity",
  "atividade",
  "atividades",
  "seguidores",
  "seguindo",
  "seguir",
  "amigos",
  "amigo",
  "amizades",
  "amigos-proximos",
  "amigosproximos",
  "pricing",
  "price",
  "prices",
  "preco",
  "precos",
  "billing",
  "cobranca",
  "cobrancas",
  "payments",
  "checkout",
  "subscribe",
  "subscription",
  "assinatura",
  "assinar",
  "subscricao",
  "subscricoes",
  "upgrade",
  "pro",
  "premium",
  "plano",
  "planos",
  "faturacao",
  "faturamento",
  "pagamento",
  "pagamentos",
  "fatura",
  "faturas",
  "community",
  "comunidade",
  "guidelines",
  "community-guidelines",
  "regras",
  "regras-comunidade",
  "regrascomunidade",
  "diretrizes",
  "diretrizes-comunidade",
  "safety",
  "seguranca",
  "seguro",
  "trust",
  "confianca",
  "moderation",
  "moderacao",
  "moderador",
  "moderadores",
  "abuse",
  "abuso",
  "report",
  "reports",
  "denunciar",
  "denuncia",
  "denuncias",
  "reportar",
  "reporte",
  "copyright",
  "direitos-autor",
  "direitosautor",
  "dmca",
  "takedown",
  "remocao",
  "remover",
  "removido",
  "data",
  "dados",
  "cookie",
  "cookies",
  "account",
  "conta",
  "minha-conta",
  "minhaconta",
  "settings",
  "definicoes",
  "configuracoes",
  "configuracao",
  "preferencias",
  "profile",
  "perfil",
  "profiles",
  "perfis",
  "login",
  "logout",
  "signup",
  "signin",
  "sign-in",
  "signout",
  "sign-out",
  "log-in",
  "log-out",
  "register",
  "registrar",
  "registar",
  "entrar",
  "sair",
  "acesso",
  "recuperar",
  "recuperar-senha",
  "recuperarsenha",
  "redefinir-senha",
  "redefinirsenha",
  "resetar-senha",
  "resetarsenha",
  "password",
  "senha",
  "password-reset",
  "passwordreset",
  "auth",
  "authentication",
  "autenticacao",
  "api",
  "oauth",
  "callback",
  "callbacks",
  "oauth2",
  "oauth-callback",
  "oauthcallback",
  "auth-callback",
  "authcallback",
  "verify",
  "verification",
  "verified",
  "verificar",
  "verificacao",
  "confirmar",
  "confirmacao",
  "webhook",
  "webhooks",
  "graphql",
  "docs",
  "documentacao",
  "documentos",
  "documento",
  "developers",
  "developer",
  "desenvolvedores",
  "desenvolvedor",
  "devs",
  "dev",
  "home",
  "inicio",
  "pagina-inicial",
  "paginainicial",
  "root",
  "www",
  "app",
  "apps",
  "web",
  "mobile",
  "desktop",
  "ios",
  "android",
  "carteira",
  "wallet",
  "cdn",
  "assets",
  "static",
  "media",
  "images",
  "image",
  "img",
  "uploads",
  "upload",
  "download",
  "downloads",
  "orya",
  "staff",
  "apple-app-site-association",
  "appleappsiteassociation",
];

const RESERVED_ALLOWLIST: Record<string, string[]> = {
  orya: ["admin@orya.pt"],
};

export function isReservedAllowlistEntry(username: string) {
  const normalized = normalizeReserved(username);
  if (!normalized) return false;
  return Boolean(RESERVED_ALLOWLIST[normalized]?.length);
}

export type UsernameValidation =
  | { valid: true; normalized: string }
  | { valid: false; error: string; code?: "USERNAME_RESERVED" | "USERNAME_INVALID"; normalized?: string };

export type UsernameValidationOptions = {
  allowReservedForEmail?: string | null;
  skipReservedCheck?: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Remove acentos, espaços e caracteres inválidos, deixando apenas letras, números, _ e . (lowercase).
 * Limita a 15 chars e evita que termine/comece em '.'.
 */
export function sanitizeUsername(input: string): string {
  const base = (input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const cleaned = base.replace(/[^A-Za-z0-9._]/g, "");
  const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
  const collapsedDots = trimmed.replace(/\.{2,}/g, ".");
  return collapsedDots.toLowerCase().slice(0, USERNAME_MAX);
}

export function normalizeReserved(input: string): string {
  const base = (input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const cleaned = base.replace(/[^A-Za-z0-9._]/g, "");
  const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
  const collapsedDots = trimmed.replace(/\.{2,}/g, ".");
  return collapsedDots.toLowerCase().slice(0, USERNAME_MAX);
}

const RESERVED_SET = (() => {
  const set = new Set<string>();
  const collapsed = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeReserved(value);
    if (!normalized) return;
    set.add(normalized);
    const withoutSeparators = normalized.replace(/[._]/g, "");
    if (withoutSeparators) collapsed.add(withoutSeparators);
  };

  ROUTE_SEGMENTS.forEach(add);
  PUBLIC_FILES.forEach(add);
  SYSTEM_WORDS.forEach(add);

  return { set, collapsed };
})();

export function getReservedSet() {
  return new Set(RESERVED_SET.set);
}

export function isReservedUsernameAllowed(username: string, email?: string | null) {
  if (!email) return false;
  const normalized = normalizeReserved(username);
  if (!normalized) return false;
  const allowlist = RESERVED_ALLOWLIST[normalized];
  if (!allowlist || allowlist.length === 0) return false;
  const normalizedEmail = normalizeEmail(email);
  return allowlist.some((entry) => normalizeEmail(entry) === normalizedEmail);
}

export function isReservedUsername(rawOrNormalized: string | null | undefined) {
  if (!rawOrNormalized) return false;
  const normalized = normalizeReserved(rawOrNormalized);
  if (!normalized) return false;
  if (RESERVED_SET.set.has(normalized)) return true;
  const collapsed = normalized.replace(/[._]/g, "");
  if (!collapsed) return false;
  return RESERVED_SET.collapsed.has(collapsed);
}

export function validateUsername(raw: string, options?: UsernameValidationOptions): UsernameValidation {
  const normalized = sanitizeUsername(raw);
  if (!normalized || normalized.length < 3 || normalized.length > USERNAME_MAX) {
    return {
      valid: false,
      error: "Escolhe um username entre 3 e 15 caracteres (letras, números, _ ou .).",
      code: "USERNAME_INVALID",
      normalized,
    };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      error: "O username só pode ter letras, números, _ e . (sem espaços ou acentos).",
      code: "USERNAME_INVALID",
      normalized,
    };
  }
  if (normalized.includes("..")) {
    return {
      valid: false,
      error: "O username não pode ter '..' seguido.",
      code: "USERNAME_INVALID",
      normalized,
    };
  }
  if (!options?.skipReservedCheck && isReservedUsername(normalized)) {
    if (isReservedUsernameAllowed(normalized, options?.allowReservedForEmail)) {
      return { valid: true, normalized };
    }
    if (isReservedAllowlistEntry(normalized)) {
      return {
        valid: false,
        error: "Este @ já está a ser usado.",
        code: "USERNAME_RESERVED",
        normalized,
      };
    }
    return {
      valid: false,
      error: "Este username está reservado.",
      code: "USERNAME_RESERVED",
      normalized,
    };
  }
  return { valid: true, normalized };
}

export const USERNAME_RULES_HINT =
  "3-15 caracteres, letras ou números, opcionalmente _ ou ., sem espaços ou acentos. Algumas palavras estão reservadas.";
