import { redirect } from "next/navigation";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";

export default async function CrmPage() {
  const organizationId = await resolveOrganizationIdFromCookies();
  const target = organizationId ? buildOrgHref(organizationId, "/crm/customers") : buildOrgHubHref("/organizations");
  redirect(target);
}
