export type PublicSocialKind = "instagram" | "youtube" | "tiktok" | "linkedin";

const SOCIAL_PREFIX: Record<PublicSocialKind, string> = {
  instagram: "https://www.instagram.com/",
  youtube: "https://www.youtube.com/",
  tiktok: "https://www.tiktok.com/@",
  linkedin: "https://www.linkedin.com/company/",
};

const SOCIAL_LABEL: Record<PublicSocialKind, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

const SOCIAL_HOSTS: Record<PublicSocialKind, Set<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  youtube: new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]),
  linkedin: new Set(["linkedin.com", "www.linkedin.com"]),
};

function stripQueryAndHash(value: string) {
  return value.split("#")[0]?.split("?")[0] ?? value;
}

function normalizeHandleInput(raw: string) {
  return stripQueryAndHash(raw.trim()).replace(/^\/+|\/+$/g, "");
}

function parseSocialUrl(raw: string): URL | null {
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeInstagramHandle(raw: string): string | null {
  const input = normalizeHandleInput(raw).replace(/^@+/, "");
  if (!input) return null;
  const segment = input.split("/")[0] ?? "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(segment)) return null;
  return segment;
}

function normalizeYoutubePath(raw: string): string | null {
  const input = normalizeHandleInput(raw);
  if (!input) return null;
  const segment = input.split("/").filter(Boolean);
  if (segment.length === 0 || segment.length > 2) return null;
  const first = segment[0] ?? "";
  const second = segment[1] ?? "";
  if (first.startsWith("@")) {
    if (!/^@[A-Za-z0-9._-]{3,100}$/.test(first)) return null;
    return first;
  }
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(first)) return null;
  if (!second) return first;
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(second)) return null;
  return `${first}/${second}`;
}

function normalizeTiktokHandle(raw: string): string | null {
  const input = normalizeHandleInput(raw).replace(/^@+/, "");
  if (!input) return null;
  const base = input.startsWith("@") ? input.slice(1) : input;
  const segment = base.split("/")[0] ?? "";
  if (!/^[A-Za-z0-9._]{2,32}$/.test(segment)) return null;
  return segment;
}

function normalizeLinkedinHandle(raw: string): string | null {
  const input = normalizeHandleInput(raw).replace(/^company\//i, "");
  if (!input) return null;
  const segment = input.split("/")[0] ?? "";
  if (!/^[A-Za-z0-9-]{2,100}$/.test(segment)) return null;
  return segment;
}

function extractFromUrl(url: URL, kind: PublicSocialKind): string | null {
  const host = url.hostname.toLowerCase();
  if (!SOCIAL_HOSTS[kind].has(host)) return null;

  const path = normalizeHandleInput(url.pathname);
  if (!path) return null;

  if (kind === "instagram") {
    return normalizeInstagramHandle(path);
  }
  if (kind === "youtube") {
    return normalizeYoutubePath(path);
  }
  if (kind === "tiktok") {
    const clean = path.startsWith("@") ? path : path.replace(/^@?/, "");
    return normalizeTiktokHandle(clean);
  }
  return normalizeLinkedinHandle(path);
}

function normalizeByKind(raw: string, kind: PublicSocialKind): string | null {
  if (kind === "instagram") return normalizeInstagramHandle(raw);
  if (kind === "youtube") return normalizeYoutubePath(raw);
  if (kind === "tiktok") return normalizeTiktokHandle(raw);
  return normalizeLinkedinHandle(raw);
}

function buildCanonicalUrl(kind: PublicSocialKind, normalized: string): string {
  if (kind === "tiktok") {
    return `${SOCIAL_PREFIX[kind]}${normalized}`;
  }
  return `${SOCIAL_PREFIX[kind]}${normalized}`;
}

export function normalizePublicSocialUrl(input: unknown, kind: PublicSocialKind) {
  if (input === null || typeof input === "undefined") {
    return { value: null as string | null };
  }
  if (typeof input !== "string") {
    return { error: `${SOCIAL_LABEL[kind]} inválido.` };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null as string | null };
  }

  const asUrl = parseSocialUrl(trimmed);
  const normalized = asUrl ? extractFromUrl(asUrl, kind) : normalizeByKind(trimmed, kind);
  if (!normalized) {
    return {
      error: `${SOCIAL_LABEL[kind]} inválido. Usa apenas o handle/username da conta oficial.`,
    };
  }

  return { value: buildCanonicalUrl(kind, normalized) };
}

export function extractPublicSocialHandle(value: string | null | undefined, kind: PublicSocialKind): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const asUrl = parseSocialUrl(trimmed);
  if (asUrl) {
    const extracted = extractFromUrl(asUrl, kind);
    if (extracted) {
      if (kind === "tiktok") return extracted;
      if (kind === "linkedin") return extracted;
      return extracted;
    }
  }

  const normalized = normalizeByKind(trimmed, kind);
  if (!normalized) return "";
  return kind === "tiktok" ? normalized : normalized;
}
