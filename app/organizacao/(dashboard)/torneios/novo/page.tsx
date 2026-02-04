import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function OrganizationTorneiosNovoPage({ searchParams }: Props) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const target = await appendOrganizationIdToRedirectHref("/organizacao/padel/torneios/novo", resolvedSearchParams);
  redirect(target);
}
