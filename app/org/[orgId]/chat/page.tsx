import OrganizationChatPage from "@/app/org/_internal/core/(dashboard)/chat/page";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export default async function OrgChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: SearchParamsInput;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    Promise.resolve(searchParams),
  ]);
  return (
    <OrganizationChatPage
      params={resolvedParams}
      searchParams={resolvedSearchParams ?? {}}
    />
  );
}
