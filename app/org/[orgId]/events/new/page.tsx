import { notFound, redirect } from "next/navigation";
import NewOrganizationEventPage from "@/app/org/_internal/core/(dashboard)/eventos/novo/page";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildRedirectQuery(searchParams: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "preset") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) query.append(key, item);
      }
      continue;
    }
    if (typeof value === "string" && value) {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function OrgEventsNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { orgId } = await params;
  const parsedOrgId = Number(orgId);
  if (!Number.isFinite(parsedOrgId) || parsedOrgId <= 0) {
    notFound();
  }

  const resolvedSearchParams = ((await Promise.resolve(searchParams)) ?? {}) as SearchParams;
  const preset = firstValue(resolvedSearchParams.preset).trim().toLowerCase();

  if (preset === "padel") {
    const query = buildRedirectQuery(resolvedSearchParams);
    redirect(`/org/${parsedOrgId}/padel/tournaments/create${query}`);
  }

  return <NewOrganizationEventPage />;
}
