import OrganizationChatPage from "../page";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

export default async function OrganizationChatCommunitiesInternalPage({
  searchParams,
}: {
  searchParams?: SearchParamsInput;
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const mergedSearchParams: Record<string, string | string[] | undefined> = {
    ...resolvedSearchParams,
    tab: "comunidades",
  };
  return <OrganizationChatPage searchParams={mergedSearchParams} />;
}
