import { redirect } from "next/navigation";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function OrganizationAnalyzePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activeOrganizationId } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const sectionParam = typeof resolvedSearchParams?.section === "string" ? resolvedSearchParams.section : null;

  const params = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (key === "section") continue;
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }
  params.delete("organizationId");
  params.delete("org");
  const target =
    sectionParam === "financas" || sectionParam === "invoices"
      ? buildOrgHref(activeOrganizationId, "/finance")
      : buildOrgHref(activeOrganizationId, "/analytics");
  if (sectionParam === "ops" && !params.get("tab")) {
    params.set("tab", "ops");
  }
  if (sectionParam === "vendas" && !params.get("tab")) {
    params.set("tab", "vendas");
  }
  const query = params.toString();
  redirect(`${target}${query ? `?${query}` : ""}`);
}
