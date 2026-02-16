import { redirect } from "next/navigation";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { isFinanceAllowedView } from "@/lib/domainBoundaries";

export default async function OrganizationAnalyzePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activeOrganizationId } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const viewParam = typeof resolvedSearchParams?.view === "string" ? resolvedSearchParams.view : null;

  const params = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (key === "section" || key === "tab" || key === "analytics" || key === "finance") continue;
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }
  params.delete("organizationId");
  params.delete("org");
  const target = viewParam && isFinanceAllowedView(viewParam)
    ? buildOrgHref(activeOrganizationId, "/finance")
    : buildOrgHref(activeOrganizationId, "/analytics");
  if (!params.get("view")) {
    params.set("view", "overview");
  }
  const query = params.toString();
  redirect(`${target}${query ? `?${query}` : ""}`);
}
