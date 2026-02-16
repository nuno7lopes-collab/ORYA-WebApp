import { redirect } from "next/navigation";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function OrganizationProfilePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activeOrganizationId } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const params = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }
  params.delete("organizationId");
  params.delete("org");
  const query = params.toString();
  const target = buildOrgHref(activeOrganizationId, "/settings");
  redirect(`${target}${query ? `?${query}` : ""}`);
}
