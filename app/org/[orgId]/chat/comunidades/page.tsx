import OrganizationChatCommunitiesInternalPage from "@/app/org/_internal/core/(dashboard)/chat/comunidades/page";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export default async function OrgChatCommunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: SearchParamsInput;
}) {
  const [{ orgId }, resolvedSearchParams] = await Promise.all([
    params,
    Promise.resolve(searchParams),
  ]);

  const mergedSearchParams: Record<string, string | string[] | undefined> = {
    ...(resolvedSearchParams ?? {}),
    organizationId: orgId,
    tab: "comunidades",
  };

  return <OrganizationChatCommunitiesInternalPage searchParams={mergedSearchParams} />;
}
