import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type PageProps = {
  params: {
    orgId?: string;
    id?: string;
  };
};

export default function RecursoDisponibilidadeRedirectPage({ params }: PageProps) {
  const orgId = parseOrganizationId(params?.orgId ?? null);
  const resourceId = parseOrganizationId(params?.id ?? null);

  if (!orgId || !resourceId) {
    return <div className="text-white">Recurso inválido.</div>;
  }

  redirect(
    buildOrgHref(orgId, "/bookings/availability", {
      scopeType: "RESOURCE",
      scopeId: resourceId,
    }),
  );
}
