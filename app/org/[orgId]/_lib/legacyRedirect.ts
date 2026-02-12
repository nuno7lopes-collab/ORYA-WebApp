export type OrgRouteSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

function pickFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function buildLegacyOrgHref(input: {
  orgId: number;
  legacyPath: string;
  searchParams?: OrgRouteSearchParams;
  override?: Record<string, string | null | undefined>;
}) {
  const resolvedSearchParams = await Promise.resolve(input.searchParams);
  const params = new URLSearchParams();

  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      const picked = pickFirst(value);
      if (typeof picked !== "string" || !picked) continue;
      params.set(key, picked);
    }
  }

  params.set("organizationId", String(input.orgId));

  if (input.override) {
    for (const [key, value] of Object.entries(input.override)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();
  return query ? `${input.legacyPath}?${query}` : input.legacyPath;
}
