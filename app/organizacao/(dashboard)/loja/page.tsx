import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationStatus } from "@prisma/client";

type SearchParams = {
  view?: string | string[];
  sub?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function pickString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyOrganizationStorePage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/organizacao");
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowFallback: true,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/organizacao/organizations");
  }

  const resolved = (await searchParams) ?? {};
  const view = pickString(resolved.view);
  const sub = pickString(resolved.sub);
  const next = new URLSearchParams();
  if (view) next.set("view", view);
  if (sub) next.set("sub", sub);
  const suffix = next.size > 0 ? `?${next.toString()}` : "";
  redirect(`/org/${organization.id}/loja${suffix}`);
}
