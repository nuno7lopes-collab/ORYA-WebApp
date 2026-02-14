import DashboardClient from "@/app/org/_internal/core/DashboardClient";
import { redirect } from "next/navigation";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export default async function OrgProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: SearchParamsInput;
}) {
  const { orgId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const profileRaw = resolvedSearchParams?.profile;
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw)?.trim().toLowerCase();

  if (profile === "followers") {
    redirect(`/org/${orgId}/profile/followers`);
  }
  if (profile === "requests") {
    redirect(`/org/${orgId}/profile/requests`);
  }

  return <DashboardClient hasOrganization defaultObjective="profile" defaultSection="perfil" />;
}
