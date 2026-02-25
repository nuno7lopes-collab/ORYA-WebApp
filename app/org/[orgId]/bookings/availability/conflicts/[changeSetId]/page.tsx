import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type LegacyAvailabilityConflictsPageProps = {
  params: {
    orgId?: string;
    changeSetId?: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function LegacyBookingsAvailabilityConflictsPage({
  params,
  searchParams,
}: LegacyAvailabilityConflictsPageProps) {
  const organizationId = parseOrganizationId(params?.orgId ?? null);
  const changeSetId = parseOrganizationId(params?.changeSetId ?? null);
  if (!organizationId || !changeSetId) {
    return <div className="p-6 text-sm text-white/70">Pedido inválido.</div>;
  }

  const query = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
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

  const destination = buildOrgHref(organizationId, `/calendar/availability/conflicts/${changeSetId}`);
  const serialized = query.toString();
  redirect(serialized ? `${destination}?${serialized}` : destination);
}
