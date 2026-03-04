import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type CalendarDayRedirectPageProps = {
  params: Promise<{
    orgId?: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CalendarDayRedirectPage({ params, searchParams }: CalendarDayRedirectPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const organizationId = parseOrganizationId(resolvedParams?.orgId ?? null);
  if (!organizationId) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  const query = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      query.set(key, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") query.append(key, entry);
      });
    }
  });
  query.set("view", "day");

  const destination = buildOrgHref(organizationId, "/calendar");
  const serialized = query.toString();
  redirect(serialized ? `${destination}?${serialized}` : destination);
}
