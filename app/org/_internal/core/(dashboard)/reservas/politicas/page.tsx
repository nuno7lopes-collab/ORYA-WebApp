import { redirect } from "next/navigation";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type RouteParams = Promise<{ orgId?: string | string[] }> | { orgId?: string | string[] } | undefined;
type RouteSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyBookingPoliciesRedirectPage({
  params,
  searchParams,
}: {
  params?: RouteParams;
  searchParams?: RouteSearchParams;
}) {
  const resolvedParams = (await Promise.resolve(params ?? {})) as { orgId?: string | string[] };
  const resolvedSearch =
    ((await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>) ?? {};

  const orgIdFromParams = parseOrganizationId(readSingle(resolvedParams.orgId));
  const orgIdFromQuery = parseOrganizationId(readSingle(resolvedSearch.organizationId));
  const orgIdFromCookie = await resolveOrganizationIdFromCookies();
  const orgId = orgIdFromParams ?? orgIdFromQuery ?? orgIdFromCookie;

  if (!orgId) {
    redirect("/org-hub/organizations");
  }

  redirect(buildOrgHref(orgId, "/policies", { view: "booking" }));
}
