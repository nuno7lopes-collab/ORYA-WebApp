import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type LegacyAvailabilityPageProps = {
  params: {
    orgId?: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function LegacyBookingsAvailabilityPage({
  params,
  searchParams,
}: LegacyAvailabilityPageProps) {
  const organizationId = parseOrganizationId(params?.orgId ?? null);
  if (!organizationId) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
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

  const destination = buildOrgHref(organizationId, "/calendar/availability");
  const serialized = query.toString();
  redirect(serialized ? `${destination}?${serialized}` : destination);
}
