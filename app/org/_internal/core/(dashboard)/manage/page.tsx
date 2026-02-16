import { redirect } from "next/navigation";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export default async function OrganizationManagePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activeOrganizationId } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const params = new URLSearchParams();
  const sectionParam = typeof resolvedSearchParams?.section === "string" ? resolvedSearchParams.section : null;
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

  const targetBase =
    sectionParam === "reservas"
      ? buildOrgHref(activeOrganizationId, "/bookings")
      : sectionParam === "inscricoes"
        ? buildOrgHref(activeOrganizationId, "/forms")
        : sectionParam === "padel-club"
          ? buildOrgHref(activeOrganizationId, "/padel/clubs")
          : sectionParam === "padel-tournaments"
            ? buildOrgHref(activeOrganizationId, "/padel/tournaments")
            : sectionParam === "staff"
              ? buildOrgHref(activeOrganizationId, "/team")
              : sectionParam === "chat"
                ? buildOrgHref(activeOrganizationId, "/chat")
                : sectionParam === "crm"
                  ? buildOrgHref(activeOrganizationId, "/crm/customers")
                  : buildOrgHref(activeOrganizationId, "/events");
  const query = params.toString();
  redirect(`${targetBase}${query ? `?${query}` : ""}`);

}
