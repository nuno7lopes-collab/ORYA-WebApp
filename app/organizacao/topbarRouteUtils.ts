export type OrgToolKey =
  | "dashboard"
  | "events"
  | "bookings"
  | "check-in"
  | "finance"
  | "analytics"
  | "crm"
  | "store"
  | "forms"
  | "chat"
  | "team"
  | "padel-club"
  | "padel-tournaments"
  | "marketing"
  | "profile"
  | "settings";

function stripTrailingSlash(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function normalizeOrganizationPathname(pathname: string | null): string | null {
  if (!pathname) return pathname;
  const normalizedInput = stripTrailingSlash(pathname);

  const canonicalMatch = normalizedInput.match(/^\/org\/(\d+)(?:\/(.*))?$/i);
  if (!canonicalMatch) return normalizedInput;

  const orgId = canonicalMatch[1];
  const segments = (canonicalMatch[2] ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return `/org/${orgId}/overview`;
  return `/org/${orgId}/${segments.join("/")}`;
}

export function resolveOrganizationTool(pathname: string | null): OrgToolKey | null {
  const normalized = normalizeOrganizationPathname(pathname);
  if (!normalized) return null;
  const canonicalMatch = normalized.match(/^\/org\/\d+(?:\/(.*))?$/i);
  if (!canonicalMatch) return null;

  const rest = `/${canonicalMatch[1] ?? "overview"}`;
  if (rest === "/overview") return "dashboard";
  if (rest.startsWith("/events")) return "events";
  if (rest.startsWith("/bookings")) return "bookings";
  if (rest.startsWith("/check-in")) return "check-in";
  if (rest.startsWith("/finance")) return "finance";
  if (rest.startsWith("/analytics")) return "analytics";
  if (rest.startsWith("/crm")) return "crm";
  if (rest.startsWith("/store")) return "store";
  if (rest.startsWith("/forms")) return "forms";
  if (rest.startsWith("/chat")) return "chat";
  if (rest.startsWith("/team")) return "team";
  if (rest.startsWith("/padel/clubs")) return "padel-club";
  if (rest.startsWith("/padel/tournaments")) return "padel-tournaments";
  if (rest.startsWith("/marketing")) return "marketing";
  if (rest.startsWith("/profile")) return "profile";
  if (rest.startsWith("/settings")) return "settings";
  return "dashboard";
}
