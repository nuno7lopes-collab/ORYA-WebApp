import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

export default async function CrmPage() {
  const target = await appendOrganizationIdToRedirectHref("/organizacao/crm/clientes");
  redirect(target);
}
