import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

function toSearchParams(input: Record<string, string | string[] | undefined> | undefined) {
  const params = new URLSearchParams();
  if (!input) return params;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    }
  }
  return params;
}

function redirectWithParams(orgId: number, subpath: string, params: URLSearchParams) {
  const queryObject: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    queryObject[key] = value;
  }
  redirect(buildOrgHref(orgId, subpath, queryObject));
}

export default async function OrgFallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; slug: string[] }>;
  searchParams?: SearchParamsInput;
}) {
  const [{ orgId: orgIdRaw, slug }, resolvedSearch] = await Promise.all([
    params,
    Promise.resolve(searchParams),
  ]);
  const orgId = parseOrganizationId(orgIdRaw);
  if (!orgId) {
    redirect("/org-hub/organizations");
  }

  const nextSearch = toSearchParams(resolvedSearch);
  const [headRaw, secondRaw] = slug;
  const head = (headRaw ?? "").toLowerCase();
  const second = (secondRaw ?? "").toLowerCase();

  if (head === "operations" || head === "manage") {
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "marketing" || head === "promote" || head === "promo") {
    redirectWithParams(orgId, "/promote", nextSearch);
  }
  if (head === "finance") {
    if (second === "invoices") nextSearch.set("tab", "invoices");
    redirectWithParams(orgId, "/financas", nextSearch);
  }
  if (head === "analytics") {
    redirectWithParams(orgId, "/analytics", nextSearch);
  }
  if (head === "check-in" || head === "checkin" || head === "scan") {
    redirectWithParams(orgId, "/checkin", nextSearch);
  }
  if ((head === "profile" || head === "perfil") && (second === "followers" || second === "seguidores")) {
    redirectWithParams(orgId, "/profile/followers", nextSearch);
  }
  if (head === "profile" || head === "perfil") {
    redirectWithParams(orgId, "/profile", nextSearch);
  }
  if (head === "settings") {
    redirectWithParams(orgId, "/settings", nextSearch);
  }
  if (head === "bookings" || head === "services" || head === "servicos") {
    nextSearch.set("section", "reservas");
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "events") {
    nextSearch.set("section", "eventos");
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "forms") {
    nextSearch.set("section", "inscricoes");
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "crm") {
    const crmTail = slug.slice(1).join("/");
    redirectWithParams(orgId, `/crm/${crmTail || "clientes"}`, nextSearch);
  }
  if (head === "team" || head === "trainers") {
    nextSearch.set("section", "staff");
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "chat") {
    nextSearch.set("section", "chat");
    redirectWithParams(orgId, "/manage", nextSearch);
  }
  if (head === "organizations") {
    redirect("/org-hub/organizations");
  }
  if (head === "store" || head === "loja") {
    redirectWithParams(orgId, "/loja", nextSearch);
  }

  redirectWithParams(orgId, "/overview", nextSearch);
}
