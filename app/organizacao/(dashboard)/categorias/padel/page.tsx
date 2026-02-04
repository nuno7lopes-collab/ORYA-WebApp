import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

export const runtime = "nodejs";

export default async function PadelCategoryPage() {
  const target = await appendOrganizationIdToRedirectHref(
    "/organizacao/padel/torneios?section=padel-tournaments&padel=manage",
  );
  redirect(target);
}
