export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OrganizationTorneiosPage({ searchParams }: Props) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (typeof value === "string") params.set(key, value);
      if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    });
  }
  const target = await appendOrganizationIdToRedirectHref(
    `/org/padel/torneios?${params.toString()}`,
    searchParams,
  );
  redirect(target);
}
